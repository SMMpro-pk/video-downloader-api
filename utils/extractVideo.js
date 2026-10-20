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
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(level, message, meta = {}) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
  const line = JSON.stringify(entry) + '\n';
  const file = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(file, line);
  if (level === 'error') console.error(`[${level}] ${message}`);
  else if (level === 'warn') console.warn(`[${level}] ${message}`);
}

// ─── Environment & yt-dlp Settings ───
const YTDLP_PROXY = process.env.YTDLP_PROXY || process.env.PROXY_URL || process.env.HTTP_PROXY || null;
const YTDLP_COOKIES = process.env.YTDLP_COOKIES_FILE || process.env.COOKIES_PATH || null;
const YTDLP_USER_AGENT = process.env.YTDLP_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── Detailed error codes ───
const ERROR_MAP = {
  'private'                 : { code: 'VIDEO_PRIVATE',             message: 'This video is private.' },
  'removed'                 : { code: 'VIDEO_REMOVED',             message: 'This video has been removed.' },
  'unavailable'             : { code: 'VIDEO_REMOVED',             message: 'This video is unavailable.' },
  'geo'                     : { code: 'GEO_RESTRICTED',            message: 'This video is geo-restricted in your region.' },
  'country'                 : { code: 'GEO_RESTRICTED',            message: 'This video is not available in your country.' },
  'login'                   : { code: 'LOGIN_REQUIRED',            message: 'Login is required to access this video.' },
  'sign in'                 : { code: 'LOGIN_REQUIRED',            message: 'Login is required to access this video.' },
  'authentication'          : { code: 'LOGIN_REQUIRED',            message: 'Login is required to access this video.' },
  'bot'                     : { code: 'BOT_VERIFICATION_REQUIRED', message: 'Platform requested bot verification / captcha.' },
  'confirm you’re not a bot': { code: 'BOT_VERIFICATION_REQUIRED', message: 'Sign in or bot verification is required.' },
  'confirm you are not a bot':{ code: 'BOT_VERIFICATION_REQUIRED', message: 'Sign in or bot verification is required.' },
  'members-only'            : { code: 'MEMBERS_ONLY',              message: 'This video is reserved for channel members only.' },
  'copyright'               : { code: 'COPYRIGHT_TAKEDOWN',        message: 'This video has been taken down due to a copyright claim.' },
  'age'                     : { code: 'AGE_RESTRICTED',            message: 'This video is age-restricted and requires account verification.' },
  'premieres'               : { code: 'LIVE_PREMIERE_NOT_STARTED', message: 'This is a live premiere that has not started yet.' },
  'rate limit'              : { code: 'RATE_LIMITED_BY_PLATFORM',  message: 'The platform is rate-limiting requests. Try again later.' },
  'too many requests'       : { code: 'RATE_LIMITED_BY_PLATFORM',  message: 'The platform is rate-limiting requests. Try again later.' },
  '429'                     : { code: 'RATE_LIMITED_BY_PLATFORM',  message: 'The platform is rate-limiting requests. Try again later.' },
  'blocked'                 : { code: 'IP_BLOCKED',                message: 'Your IP or datacenter is blocked by the platform.' },
  'not supported'           : { code: 'PLATFORM_UNSUPPORTED',      message: 'This platform or URL type is not supported.' },
  'unsupported url'         : { code: 'PLATFORM_UNSUPPORTED',      message: 'This platform or URL type is not supported.' },
  'no video'                : { code: 'EXTRACTION_FAILED',         message: 'No video found at this URL.' },
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
  bluesky:     { addHeader: ['referer:https://bsky.app'] },
};

function isValidUrl(str) {
  try {
    const parsed = new URL(str);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return null;
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
    userAgent: YTDLP_USER_AGENT,
  };

  if (YTDLP_PROXY) {
    baseOptions.proxy = YTDLP_PROXY;
  }

  if (YTDLP_COOKIES && fs.existsSync(YTDLP_COOKIES)) {
    baseOptions.cookies = YTDLP_COOKIES;
  }

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

  // ─ Subtitles / Captions Extraction ─
  const subtitles = [];
  const rawSubs = { ...(data.subtitles || {}), ...(data.automatic_captions || {}) };
  for (const [lang, subList] of Object.entries(rawSubs)) {
    if (Array.isArray(subList) && subList.length > 0) {
      const bestSub = subList.find((s) => s.ext === 'vtt') || subList[0];
      if (bestSub && bestSub.url) {
        subtitles.push({
          language: lang,
          name: bestSub.name || lang,
          ext: bestSub.ext || 'vtt',
          url: bestSub.url,
        });
      }
    }
  }

  // ─ Chapters Extraction ─
  const chapters = Array.isArray(data.chapters)
    ? data.chapters.map((ch) => ({
        title: ch.title || 'Chapter',
        startTime: ch.start_time || 0,
        endTime: ch.end_time || 0,
      }))
    : [];

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
    subtitlesCount: subtitles.length,
    chaptersCount: chapters.length,
  };

  // ── Info-only mode — return quickly without parsing full download formats ──
  if (infoOnly) {
    log('info', 'Info-only extraction complete', { platform: platformName, title: baseMeta.title });
    return {
      ...baseMeta,
      subtitles: subtitles.slice(0, 10),
      chapters,
    };
  }

  // ─ Parse formats ─
  const formats = data.formats || [];

  function getQualityScore(qualityStr, item) {
    const num = parseInt(qualityStr, 10);
    if (!isNaN(num) && num > 0) return num * 1000;
    if (item.filesize) return Math.round(item.filesize / 1024);
    return 1;
  }

  // Video downloads — dedupe by quality+format, best first, then limit
  let videoDownloads = formats
    .filter((f) => f.url && f.vcodec && f.vcodec !== 'none')
    .map((f) => {
      const hasAudio = !!(f.acodec && f.acodec !== 'none');
      const filesize = f.filesize || f.filesize_approx || null;
      return {
        quality: f.height ? `${f.height}p` : f.format_note || 'Standard',
        format: f.ext || 'mp4',
        filesize,
        filesizeFormatted: formatBytes(filesize),
        hasAudio,
        isMuxed: hasAudio,
        width: f.width || null,
        height: f.height || null,
        fps: f.fps || null,
        formatId: f.format_id || null,
        url: f.url,
      };
    })
    .filter((item, idx, self) =>
      idx === self.findIndex((t) => t.quality === item.quality && t.format === item.format && t.hasAudio === item.hasAudio)
    )
    .sort((a, b) => getQualityScore(b.quality, b) - getQualityScore(a.quality, a));

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
    .map((f) => {
      const filesize = f.filesize || f.filesize_approx || null;
      return {
        quality: f.abr ? `${Math.round(f.abr)}kbps` : 'Standard',
        format: f.ext || 'm4a',
        abr: f.abr ? Math.round(f.abr) : null,
        filesize,
        filesizeFormatted: formatBytes(filesize),
        formatId: f.format_id || null,
        url: f.url,
      };
    })
    .filter((item, idx, self) =>
      idx === self.findIndex((t) => t.quality === item.quality && t.format === item.format)
    )
    .sort((a, b) => (b.abr || 0) - (a.abr || 0))
    .slice(0, MAX_FORMATS);

  // Fallback: top-level URL when no formats parsed
  if (videoDownloads.length === 0 && data.url) {
    videoDownloads.push({
      quality: data.height ? `${data.height}p` : 'Standard',
      format: data.ext || 'mp4',
      filesize: data.filesize || null,
      filesizeFormatted: formatBytes(data.filesize),
      hasAudio: true,
      isMuxed: true,
      width: data.width || null,
      height: data.height || null,
      fps: data.fps || null,
      formatId: data.format_id || 'direct',
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
    subtitles: subtitles.slice(0, 15),
    chapters,
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
