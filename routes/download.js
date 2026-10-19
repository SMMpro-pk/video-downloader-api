const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const { URL } = require('url');
const extractVideo = require('../utils/extractVideo');
const { getSupportedPlatforms, detectPlatform } = require('../utils/detectPlatform');
const { normalizeUrl } = require('../utils/normalizeUrl');
const { validateSafeUrl } = require('../utils/security');
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
 */
async function handleDownload(req, res) {
  const startTime = Date.now();
  const url = getUrlFromRequest(req);
  if (!(await validateUrl(url, res))) return;

  try {
    const cacheKey = url.trim().toLowerCase();
    const cached = cache.get(cacheKey);

    if (cached) {
      stats.trackRequest(cached.platform);
      stats.trackCacheHit();
      return res.json({ success: true, cached: true, processingTime: `${Date.now() - startTime}ms`, ...cached });
    }

    const result = await queue.run(() => extractVideo(url));

    cache.set(cacheKey, result);
    stats.trackRequest(result.platform);
    stats.trackCacheMiss();

    return res.json({ success: true, cached: false, processingTime: `${Date.now() - startTime}ms`, ...result });
  } catch (err) {
    return handleExtractionError(err, res);
  }
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

  const results = await Promise.all(
    targetUrls.map(async (rawUrl) => {
      try {
        const safeCheck = await validateSafeUrl(rawUrl);
        if (!safeCheck.ok) {
          return { url: rawUrl, success: false, error: safeCheck.error };
        }

        const cacheKey = rawUrl.trim().toLowerCase();
        const cached = cache.get(cacheKey);
        if (cached) {
          stats.trackRequest(cached.platform);
          stats.trackCacheHit();
          return { url: rawUrl, success: true, cached: true, data: cached };
        }

        const data = await queue.run(() => extractVideo(rawUrl));
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
 * GET /api/stream
 * Stream or proxy media directly to client browser with Range header support.
 * Solves CORS and hotlinking blocks on Instagram, TikTok, Twitter/X, and YouTube CDN URLs.
 */
router.get('/stream', async (req, res) => {
  const mediaUrl = req.query.url;
  const rawFilename = (req.query.filename || 'video.mp4').trim();
  // Sanitize filename to prevent header injection
  const safeFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!mediaUrl) {
    return res.status(400).json({
      success: false,
      errorCode: 'MISSING_MEDIA_URL',
      error: 'Missing media stream URL. Pass ?url=<cdn_media_url>',
    });
  }

  const safeCheck = await validateSafeUrl(mediaUrl);
  if (!safeCheck.ok) {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_MEDIA_URL',
      error: safeCheck.error,
    });
  }

  let parsed;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid media URL.' });
  }

  const client = parsed.protocol === 'https:' ? https : http;
  const outgoingHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
  };

  // Forward Range header if client browser requested it (supports video seeking)
  if (req.headers.range) {
    outgoingHeaders['Range'] = req.headers.range;
  }

  const streamReq = client.request(
    mediaUrl,
    {
      method: 'GET',
      headers: outgoingHeaders,
      timeout: 30_000,
    },
    (streamRes) => {
      // Forward status (200 OK or 206 Partial Content)
      res.status(streamRes.statusCode);

      // Forward relevant headers
      const headersToForward = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'last-modified',
        'etag',
      ];
      for (const h of headersToForward) {
        if (streamRes.headers[h]) {
          res.setHeader(h, streamRes.headers[h]);
        }
      }

      // Force attachment download filename
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      streamRes.pipe(res);
      streamRes.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ success: false, error: 'Upstream stream error' });
        }
      });
    }
  );

  streamReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: 'Failed to connect to media host' });
    }
  });

  streamReq.on('timeout', () => {
    streamReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ success: false, error: 'Media stream connection timed out' });
    }
  });

  streamReq.end();
});

/**
 * GET & POST /api/check
 */
async function handleCheck(req, res) {
  const url = getUrlFromRequest(req);
  if (!url) return res.status(400).json({ success: false, error: 'Missing video URL.' });

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
