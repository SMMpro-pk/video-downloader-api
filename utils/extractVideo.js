const youtubedl = require('youtube-dl-exec');
const { detectPlatform } = require('./detectPlatform');
const { normalizeUrl } = require('./normalizeUrl');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───
const MAX_VIDEO_DURATION = parseInt(process.env.MAX_VIDEO_DURATION, 10) || 7200;   // seconds
const MAX_FILE_SIZE_MB   = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 500;
const MAX_FILE_SIZE      = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FORMATS        = parseInt(process.env.MAX_FORMATS, 10) || 10;

// ─── Logger ───
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(level, message, meta = {}) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
  const line = JSON.stringify(entry) + '\n';
  const file = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(file, line);
  if (level === 'error') console.error(`[${level}] ${message}`);
  else if (level === 'warn') console.warn(`[${level}] ${message}`);
}

// ─── Detailed error codes ───
const ERROR_MAP = {
  'private'          : { code: 'VIDEO_PRIVATE',             message: 'This video is private.' },
  'removed'          : { code: 'VIDEO_REMOVED',             message: 'This video has been removed.' },
  'unavailable'      : { code: 'VIDEO_REMOVED',             message: 'This video is unavailable.' },
  'geo'              : { code: 'GEO_RESTRICTED',            message: 'This video is geo-restricted in your region.' },
  'country'          : { code: 'GEO_RESTRICTED',            message: 'This video is not available in your country.' },
  'login'            : { code: 'LOGIN_REQUIRED',            message: 'Login is required to access this video.' },
  'sign in'          : { code: 'LOGIN_REQUIRED',            message: 'Login is required to access this video.' },
  'authentication'   : { code: 'LOGIN_REQUIRED',            message: 'Login is required to access this video.' },
  'rate limit'       : { code: 'RATE_LIMITED_BY_PLATFORM',  message: 'The platform is rate-limiting requests. Try again later.' },
  'too many requests': { code: 'RATE_LIMITED_BY_PLATFORM',  message: 'The platform is rate-limiting requests. Try again later.' },
  '429'              : { code: 'RATE_LIMITED_BY_PLATFORM',  message: 'The platform is rate-limiting requests. Try again later.' },
  'not supported'    : { code: 'PLATFORM_UNSUPPORTED',      message: 'This platform or URL type is not supported.' },
  'unsupported url'  : { code: 'PLATFORM_UNSUPPORTED',      message: 'This platform or URL type is not supported.' },
  'no video'         : { code: 'EXTRACTION_FAILED',         message: 'No video found at this URL.' },
};

function classifyError(stderr) {
  if (!stderr) return { code: 'EXTRACTION_FAILED', message: 'Could not extract video. The URL may be private, expired, or unsupported.' };
  const lower = stderr.toLowerCase();
  for (const [keyword, mapped] of Object.entries(ERROR_MAP)) {
    if (lower.includes(keyword)) return mapped;
  }
  return { code: 'EXTRACTION_FAILED', message: 'Could not extract video. The URL may be private, expired, or unsupported.' };
}

// ─── Platform-specific yt-dlp overrides ───
const PLATFORM_OPTIONS = {
  youtube:     { addHeader: ['referer:https://www.youtube.com'] },
  facebook:    { addHeader: ['referer:https://www.facebook.com'] },
  instagram:   { addHeader: ['referer:https://www.instagram.com'] },
  tiktok:      { addHeader: ['referer:https://www.tiktok.com'] },
  twitter:     { addHeader: ['referer:https://twitter.com'] },
  reddit:      { addHeader: ['referer:https://www.reddit.com'] },
  vimeo:       { addHeader: ['referer:https://vimeo.com'] },
  linkedin:    { addHeader: ['referer:https://www.linkedin.com'] },
  pinterest:   { addHeader: ['referer:https://www.pinterest.com'] },
  dailymotion: { addHeader: ['referer:https://www.dailymotion.com'] },
  snapchat:    { addHeader: ['referer:https://www.snapchat.com'] },
  twitch:      { addHeader: ['referer:https://www.twitch.tv'] },
  bilibili:    { addHeader: ['referer:https://www.bilibili.com'] },
  douyin:      { addHeader: ['referer:https://www.douyin.com'] },
  threads:     { addHeader: ['referer:https://www.threads.net'] },
};

function isValidUrl(str) {
  try {
    const parsed = new URL(str);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ─── Fallback extraction: native → retry → generic → error ───
async function runYtdlp(url, options, platformName) {
  // Attempt 1 — native extractor
  try {
    return await youtubedl(url, options);
  } catch (err1) {
    log('warn', 'Attempt 1 (native) failed, retrying…', { url, error: err1.stderr || err1.message });

    // Attempt 2 — retry with same options
    try {
      return await youtubedl(url, options);
    } catch (err2) {
      log('warn', 'Attempt 2 (retry) failed, trying generic extractor…', { url, error: err2.stderr || err2.message });

      // Attempt 3 — generic extractor
      try {
        return await youtubedl(url, {
          ...options,
          forceGenericExtractor: true,
        });
      } catch (err3) {
        log('error', 'All 3 extraction attempts failed', {
          url,
          platform: platformName,
          error: err3.stderr || err3.message,
        });
        // Throw the last error for classification
        throw err3;
      }
    }
  }
}

/**
 * Extract video metadata + download links from any supported platform.
 * Supports: fallback extraction, detailed error codes, format limiting, size limits.
 *
 * @param {string} rawUrl
 * @param {object} [opts]
 * @param {boolean} [opts.infoOnly=false] - If true, skip download URLs (fast /api/info mode).
 * @returns {Promise<object>}
 */
async function extractVideo(rawUrl, { infoOnly = false } = {}) {
  if (!isValidUrl(rawUrl)) {
    const err = new Error('INVALID_URL');
    err.errorCode = 'INVALID_URL';
    err.errorMessage = 'The URL provided is not valid.';
    throw err;
  }

  // ─ Normalize URL ─
  const { originalUrl, resolvedUrl, wasRedirected } = await normalizeUrl(rawUrl);
  const url = resolvedUrl;

  // ─ Detect platform ─
  const platformInfo = detectPlatform(url);
  const platformName = platformInfo ? platformInfo.name : 'other';
  const platformDesc = platformInfo ? platformInfo.description : 'Unknown / Other platform (yt-dlp will attempt extraction)';

  log('info', `Extraction started (${infoOnly ? 'info-only' : 'full'})`, {
    originalUrl, resolvedUrl: url, wasRedirected, platform: platformName,
  });

  // ─ Build yt-dlp options ─
  const baseOptions = {
    dumpSingleJson: true,
    noWarnings: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: false,
    noPlaylist: true,
  };

  const platformOverrides = PLATFORM_OPTIONS[platformName] || {};
  const options = { ...baseOptions, ...platformOverrides };

  // ─ Run yt-dlp (with fallback chain) ─
  let data;
  try {
    data = await runYtdlp(url, options, platformName);
  } catch (err) {
    const classified = classifyError(err.stderr || err.message);
    const error = new Error(classified.code);
    error.errorCode = classified.code;
    error.errorMessage = classified.message;
    throw error;
  }

  // ─ Size limits ─
  const duration = data.duration || null;
  if (duration && duration > MAX_VIDEO_DURATION) {
    const err = new Error('VIDEO_TOO_LONG');
    err.errorCode = 'VIDEO_TOO_LONG';
    err.errorMessage = `Video is ${formatDuration(duration)} long. Max allowed is ${formatDuration(MAX_VIDEO_DURATION)}.`;
    throw err;
  }

  // ─ Frontend-friendly flags ─
  const isLiveStream = !!(data.is_live);
  const isShortVideo = !!(duration && duration <= 60);
  const hasVideoFormats = (data.formats || []).some((f) => f.vcodec && f.vcodec !== 'none');
  const isAudioOnly = !hasVideoFormats;

  // ─ Base metadata (shared by /api/info and /api/download) ─
  const baseMeta = {
    originalUrl,
    resolvedUrl: url,
    wasRedirected,
    platform: platformName,
    platformDescription: platformDesc,
    title: data.title || 'Untitled',
    thumbnail: data.thumbnail || null,
    duration,
    durationFormatted: duration ? formatDuration(duration) : null,
    uploader: data.uploader || data.channel || null,
    uploadDate: data.upload_date || null,
    viewCount: data.view_count || null,
    likeCount: data.like_count || null,
    isShortVideo,
    isAudioOnly,
    isLiveStream,
  };

  // ── Info-only mode — return quickly without parsing formats ──
  if (infoOnly) {
    log('info', 'Info-only extraction complete', { platform: platformName, title: baseMeta.title });
    return baseMeta;
  }

  // ─ Parse formats ─
  const formats = data.formats || [];

  // Video downloads — dedupe by quality+format, best first, then limit
  let videoDownloads = formats
    .filter((f) => f.url && f.vcodec && f.vcodec !== 'none')
    .map((f) => ({
      quality: f.height ? `${f.height}p` : f.format_note || 'Standard',
      format: f.ext || 'mp4',
      filesize: f.filesize || f.filesize_approx || null,
      hasAudio: !!(f.acodec && f.acodec !== 'none'),
      url: f.url,
    }))
    .filter((item, idx, self) =>
      idx === self.findIndex((t) => t.quality === item.quality && t.format === item.format)
    )
    .sort((a, b) => parseInt(b.quality, 10) - parseInt(a.quality, 10));

  // Apply size limit filter
  if (MAX_FILE_SIZE) {
    videoDownloads = videoDownloads.filter(
      (d) => !d.filesize || d.filesize <= MAX_FILE_SIZE
    );
  }

  // Limit to top N formats
  videoDownloads = videoDownloads.slice(0, MAX_FORMATS);

  // Audio-only downloads
  let audioDownloads = formats
    .filter((f) => f.url && f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
    .map((f) => ({
      quality: f.abr ? `${Math.round(f.abr)}kbps` : 'Standard',
      format: f.ext || 'm4a',
      filesize: f.filesize || f.filesize_approx || null,
      url: f.url,
    }))
    .filter((item, idx, self) =>
      idx === self.findIndex((t) => t.quality === item.quality && t.format === item.format)
    )
    .sort((a, b) => parseInt(b.quality, 10) - parseInt(a.quality, 10))
    .slice(0, MAX_FORMATS);

  // Fallback: top-level URL when no formats parsed
  if (videoDownloads.length === 0 && data.url) {
    videoDownloads.push({
      quality: data.height ? `${data.height}p` : 'Standard',
      format: data.ext || 'mp4',
      filesize: data.filesize || null,
      hasAudio: true,
      url: data.url,
    });
  }

  const qualities = [...new Set(videoDownloads.map((d) => d.quality))];
  const bestQuality = qualities[0] || null;

  const result = {
    ...baseMeta,
    bestQuality,
    qualities,
    downloads: videoDownloads,
    audioDownloads,
  };

  log('info', 'Extraction complete', {
    platform: platformName, title: result.title,
    videoFormats: videoDownloads.length, audioFormats: audioDownloads.length,
  });

  return result;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = extractVideo;
