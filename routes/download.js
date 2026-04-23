const express = require('express');
const router = express.Router();
const extractVideo = require('../utils/extractVideo');
const { getSupportedPlatforms, detectPlatform } = require('../utils/detectPlatform');
const { normalizeUrl } = require('../utils/normalizeUrl');
const cache = require('../utils/cache');
const queue = require('../utils/queue');
const stats = require('../utils/stats');
const pkg = require('../package.json');

// ─── Shared URL validation helper ───
function validateUrl(url, res) {
  if (!url) {
    res.status(400).json({ success: false, errorCode: 'MISSING_URL', error: 'Missing video URL. Pass it as ?url=<video_url>' });
    return false;
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      res.status(400).json({ success: false, errorCode: 'INVALID_URL', error: 'URL must start with http:// or https://' });
      return false;
    }
  } catch {
    res.status(400).json({ success: false, errorCode: 'INVALID_URL', error: 'Invalid URL format.' });
    return false;
  }
  return true;
}

// ─── Shared error handler ───
function handleExtractionError(err, res) {
  const code = err.errorCode || 'EXTRACTION_FAILED';
  const message = err.errorMessage || 'Unable to fetch video. Please try again later.';

  const STATUS_MAP = {
    INVALID_URL: 400,
    MISSING_URL: 400,
    VIDEO_PRIVATE: 403,
    LOGIN_REQUIRED: 403,
    GEO_RESTRICTED: 403,
    VIDEO_REMOVED: 410,
    RATE_LIMITED_BY_PLATFORM: 429,
    PLATFORM_UNSUPPORTED: 400,
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
 * GET /api/info?url=<video_url>
 * Fast metadata-only endpoint — returns title, thumbnail, duration, platform.
 * No download URLs. Ideal for showing a preview before loading formats.
 */
router.get('/info', async (req, res) => {
  const startTime = Date.now();
  const url = req.query.url;
  if (!validateUrl(url, res)) return;

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
});

/**
 * GET /api/download?url=<video_url>
 * Full extraction — metadata + download URLs with best formats.
 */
router.get('/download', async (req, res) => {
  const startTime = Date.now();
  const url = req.query.url;
  if (!validateUrl(url, res)) return;

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
});

/**
 * GET /api/platforms
 */
router.get('/platforms', (req, res) => {
  const platforms = getSupportedPlatforms();
  return res.json({ success: true, count: platforms.length, platforms });
});

/**
 * GET /api/check?url=<video_url>
 */
router.get('/check', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ success: false, error: 'Missing video URL.' });

  try {
    const { originalUrl, resolvedUrl, wasRedirected } = await normalizeUrl(url);
    const platform = detectPlatform(resolvedUrl);

    return res.json({
      success: true,
      originalUrl, resolvedUrl, wasRedirected,
      supported: platform !== null,
      platform: platform ? platform.name : 'unknown',
      description: platform ? platform.description : 'Platform not recognized. yt-dlp may still support it.',
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to check URL.' });
  }
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
