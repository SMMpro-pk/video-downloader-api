const express = require('express');
const router = express.Router();
const extractVideo = require('../utils/extractVideo');
const { getSupportedPlatforms, detectPlatform } = require('../utils/detectPlatform');
const { normalizeUrl } = require('../utils/normalizeUrl');
const { validateSafeUrl } = require('../utils/security');
const {
  proxyMediaStream,
  streamMergedMedia,
  streamAudioMedia,
  streamDirectFfmpegMerge,
} = require('../utils/streamHelper');
const cache = require('../utils/cache');
const queue = require('../utils/queue');
const stats = require('../utils/stats');
const pkg = require('../package.json');

// ─── Shared URL extraction helper ───
function getUrlFromRequest(req) {
  return (req.query && req.query.url) || (req.body && req.body.url) || null;
}

// ─── Shared URL validation helper (with SSRF check) ───
async function validateUrl(url, res) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    res.status(400).json({
      success: false,
      errorCode: 'MISSING_URL',
      error: 'Missing video URL. Pass it as ?url=<video_url> or {"url": "..."} in the JSON body.',
    });
    return false;
  }

  const safeCheck = await validateSafeUrl(url);
  if (!safeCheck.ok) {
    res.status(400).json({
      success: false,
      errorCode: 'INVALID_URL',
      error: safeCheck.error || 'Invalid or forbidden URL.',
    });
    return false;
  }

  return true;
}

// ─── Shared error handler ───
function handleExtractionError(err, res) {
  const code = err.errorCode || 'EXTRACTION_FAILED';
  const message = err.errorMessage || err.message || 'Unable to fetch video. Please try again later.';

  const STATUS_MAP = {
    INVALID_URL: 400,
    MISSING_URL: 400,
    FORBIDDEN_URL: 403,
    VIDEO_PRIVATE: 403,
    LOGIN_REQUIRED: 403,
    MEMBERS_ONLY: 403,
    AGE_RESTRICTED: 403,
    IP_BLOCKED: 403,
    GEO_RESTRICTED: 403,
    COPYRIGHT_TAKEDOWN: 451,
    VIDEO_REMOVED: 410,
    RATE_LIMITED_BY_PLATFORM: 429,
    BOT_VERIFICATION_REQUIRED: 429,
    PLATFORM_UNSUPPORTED: 400,
    LIVE_PREMIERE_NOT_STARTED: 400,
    VIDEO_TOO_LONG: 413,
    EXTRACTION_TIMEOUT: 504,
    EXTRACTION_FAILED: 500,
  };

  return res.status(STATUS_MAP[code] || 500).json({
    success: false,
    errorCode: code,
    error: message,
  });
}

/**
 * Handle extraction logic for /info
 */
async function handleInfo(req, res) {
  const startTime = Date.now();
  const url = getUrlFromRequest(req);
  if (!(await validateUrl(url, res))) return;

  try {
    const cacheKey = `info:${url.trim().toLowerCase()}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      stats.trackRequest(cached.platform);
      stats.trackCacheHit();
      return res.json({ success: true, cached: true, processingTime: `${Date.now() - startTime}ms`, ...cached });
    }

    const result = await queue.run(() => extractVideo(url, { infoOnly: true }));

    cache.set(cacheKey, result);
    stats.trackRequest(result.platform);
    stats.trackCacheMiss();

    return res.json({ success: true, cached: false, processingTime: `${Date.now() - startTime}ms`, ...result });
  } catch (err) {
    return handleExtractionError(err, res);
  }
}

/**
 * Handle extraction logic for /download
 * Accepts options:
 * - filter: 'all' | 'muxed' | 'audio' | 'video'
 * - hasAudio: boolean (when true, returns only formats with sound)
 * - quality: target quality (e.g. '1080p', '720p', 'best', 'audio')
 * - type: 'audio' | 'video'
 */
async function handleDownload(req, res) {
  const startTime = Date.now();
  const url = getUrlFromRequest(req);
  if (!(await validateUrl(url, res))) return;

  const filter = (req.query.filter || req.body.filter || req.query.type || req.body.type || 'all').toLowerCase();
  const hasAudio = req.query.hasAudio !== undefined ? req.query.hasAudio === 'true' || req.query.hasAudio === true : req.body.hasAudio;
  const quality = req.query.quality || req.body.quality || null;
  const type = req.query.type || req.body.type || null;

  try {
    const cacheKey = `download:${url.trim().toLowerCase()}:f=${filter}:a=${hasAudio}:q=${quality}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      stats.trackRequest(cached.platform);
      stats.trackCacheHit();
      return res.json({ success: true, cached: true, processingTime: `${Date.now() - startTime}ms`, ...cached });
    }

    const result = await queue.run(() =>
      extractVideo(url, { filter, hasAudio, quality, type })
    );

    cache.set(cacheKey, result);
    stats.trackRequest(result.platform);
    stats.trackCacheMiss();

    return res.json({ success: true, cached: false, processingTime: `${Date.now() - startTime}ms`, ...result });
  } catch (err) {
    return handleExtractionError(err, res);
  }
}

/**
 * Handle extraction logic for /audio
 * Dedicated convenience endpoint returning audio streams & conversion links.
 */
async function handleAudio(req, res) {
  req.query.filter = 'audio';
  req.query.type = 'audio';
  return handleDownload(req, res);
}

/**
 * GET & POST /api/info
 * Fast preview: title, thumbnail, duration, platform, chapters, subtitles summary.
 */
router.get('/info', handleInfo);
router.post('/info', handleInfo);

/**
 * GET & POST /api/download
 * Full extraction with video and audio download URLs.
 */
router.get('/download', handleDownload);
router.post('/download', handleDownload);

/**
 * GET & POST /api/audio
 * Direct audio extraction endpoint.
 */
router.get('/audio', handleAudio);
router.post('/audio', handleAudio);

/**
 * POST /api/batch
 * Extract multiple video URLs concurrently (up to 10 URLs).
 */
router.post('/batch', async (req, res) => {
  const urls = req.body && Array.isArray(req.body.urls) ? req.body.urls : null;
  if (!urls || urls.length === 0) {
    return res.status(400).json({
      success: false,
      errorCode: 'MISSING_URLS',
      error: 'Provide an array of URLs in the request body: {"urls": ["https://..."]}',
    });
  }

  const maxBatch = 10;
  const targetUrls = urls.slice(0, maxBatch);
  const startTime = Date.now();
  const filter = (req.body.filter || req.body.type || 'all').toLowerCase();
  const hasAudio = req.body.hasAudio;
  const quality = req.body.quality || null;

  const results = await Promise.all(
    targetUrls.map(async (rawUrl) => {
      try {
        const safeCheck = await validateSafeUrl(rawUrl);
        if (!safeCheck.ok) {
          return { url: rawUrl, success: false, error: safeCheck.error };
        }

        const cacheKey = `download:${rawUrl.trim().toLowerCase()}:f=${filter}:a=${hasAudio}:q=${quality}`;
        const cached = cache.get(cacheKey);
        if (cached) {
          stats.trackRequest(cached.platform);
          stats.trackCacheHit();
          return { url: rawUrl, success: true, cached: true, data: cached };
        }

        const data = await queue.run(() => extractVideo(rawUrl, { filter, hasAudio, quality }));
        cache.set(cacheKey, data);
        stats.trackRequest(data.platform);
        stats.trackCacheMiss();
        return { url: rawUrl, success: true, cached: false, data };
      } catch (err) {
        return {
          url: rawUrl,
          success: false,
          errorCode: err.errorCode || 'EXTRACTION_FAILED',
          error: err.errorMessage || err.message || 'Extraction failed',
        };
      }
    })
  );

  const successful = results.filter((r) => r.success).length;
  return res.json({
    success: true,
    total: results.length,
    successful,
    failed: results.length - successful,
    processingTime: `${Date.now() - startTime}ms`,
    results,
  });
});

/**
 * GET & POST /api/stream
 *
 * Versatile streaming proxy:
 * 1. Stream direct CDN media URL bypassing CORS and hotlinking (with Range support & redirect following).
 * 2. On-the-fly Video+Audio merge (`merge=true` or page URL).
 * 3. On-the-fly Audio extraction (`type=audio` or `format=mp3`).
 * 4. Merging separate video and audio URLs via FFmpeg (`videoUrl` + `audioUrl`).
 */
async function handleStream(req, res) {
  const mediaUrl = (req.query && req.query.url) || (req.body && req.body.url) || null;
  const videoUrl = (req.query && req.query.videoUrl) || (req.body && req.body.videoUrl) || null;
  const audioUrl = (req.query && req.query.audioUrl) || (req.body && req.body.audioUrl) || null;

  const filename = (req.query && req.query.filename) || (req.body && req.body.filename) || null;
  const type = (req.query && req.query.type) || (req.body && req.body.type) || null;
  const format = (req.query && req.query.format) || (req.body && req.body.format) || null;
  const quality = (req.query && req.query.quality) || (req.body && req.body.quality) || null;
  const shouldMerge = (req.query && req.query.merge === 'true') || (req.body && req.body.merge === true);

  // Case 1: Separate video and audio streams to merge directly via FFmpeg
  if (videoUrl && audioUrl) {
    const vCheck = await validateSafeUrl(videoUrl);
    const aCheck = await validateSafeUrl(audioUrl);
    if (!vCheck.ok || !aCheck.ok) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_MEDIA_URL',
        error: vCheck.error || aCheck.error,
      });
    }
    return streamDirectFfmpegMerge(videoUrl, audioUrl, res, { filename: filename || 'merged.mp4' });
  }

  // If no URL provided at all
  if (!mediaUrl) {
    return res.status(400).json({
      success: false,
      errorCode: 'MISSING_MEDIA_URL',
      error: 'Missing media stream URL. Pass ?url=<cdn_media_url_or_video_url>',
    });
  }

  // SSRF check on target URL
  const safeCheck = await validateSafeUrl(mediaUrl);
  if (!safeCheck.ok) {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_MEDIA_URL',
      error: safeCheck.error,
    });
  }

  const detectedPlatform = detectPlatform(mediaUrl);
  const isPageUrl = detectedPlatform !== null && !mediaUrl.includes('googlevideo.com') && !mediaUrl.includes('fbcdn.net') && !mediaUrl.includes('cdninstagram.com');

  // Case 2: Pure audio streaming requested
  if (type === 'audio' || format === 'mp3' || format === 'm4a') {
    return streamAudioMedia(mediaUrl, res, { format: format || 'mp3', filename });
  }

  // Case 3: Live merging requested or target is a platform page URL
  if (shouldMerge || (isPageUrl && !type)) {
    return streamMergedMedia(mediaUrl, res, { quality, filename });
  }

  // Case 4: Standard direct media proxy with redirect-following and Range support
  return proxyMediaStream(mediaUrl, req, res, { filename });
}

router.get('/stream', handleStream);
router.post('/stream', handleStream);

/**
 * GET & POST /api/check
 */
async function handleCheck(req, res) {
  const url = getUrlFromRequest(req);
  if (!url) return res.status(400).json({ success: false, error: 'Missing video URL.' });

  const safeCheck = await validateSafeUrl(url);
  if (!safeCheck.ok) {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_URL',
      error: safeCheck.error || 'Invalid or forbidden URL.',
    });
  }

  try {
    const { originalUrl, resolvedUrl, wasRedirected } = await normalizeUrl(url);
    const platform = detectPlatform(resolvedUrl);

    return res.json({
      success: true,
      originalUrl,
      resolvedUrl,
      wasRedirected,
      supported: platform !== null,
      platform: platform ? platform.name : 'unknown',
      description: platform ? platform.description : 'Platform not recognized. yt-dlp may still support it.',
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to check URL.' });
  }
}

router.get('/check', handleCheck);
router.post('/check', handleCheck);

/**
 * GET /api/platforms
 */
router.get('/platforms', (req, res) => {
  const platforms = getSupportedPlatforms();
  return res.json({ success: true, count: platforms.length, platforms });
});

/**
 * GET /api/cache — Cache statistics
 */
router.get('/cache', (req, res) => {
  return res.json({ success: true, ...cache.stats() });
});

/**
 * DELETE /api/cache — Flush cache
 */
router.delete('/cache', (req, res) => {
  cache.clear();
  return res.json({ success: true, message: 'Cache cleared.' });
});

/**
 * GET /api/version — API version and runtime info
 */
router.get('/version', (req, res) => {
  return res.json({
    success: true,
    name: pkg.name,
    version: pkg.version,
    node: process.version,
    platform: process.platform,
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

/**
 * GET /api/stats — Daily usage statistics
 */
router.get('/stats', (req, res) => {
  const s = stats.getStats();
  return res.json({
    success: true,
    ...s,
    queue: {
      active: queue.active(),
      pending: queue.pending(),
      maxConcurrent: queue.MAX_CONCURRENT,
    },
    cache: cache.stats(),
  });
});

module.exports = router;
