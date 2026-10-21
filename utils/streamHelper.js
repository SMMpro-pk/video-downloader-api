const http = require('http');
const https = require('https');
const { URL } = require('url');
const { spawn } = require('child_process');
const { validateSafeUrl } = require('./security');
const { getYtdlpBinary } = require('./ytdlpHelper');

/**
 * Sanitize filename to prevent header injection or filesystem directory traversal.
 */
function sanitizeFilename(filename, defaultName = 'download') {
  if (!filename || typeof filename !== 'string') return defaultName;
  const clean = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 150);
  return clean || defaultName;
}

/**
 * Automatically determine required upstream headers (Referer, Origin, User-Agent)
 * based on the hostname to avoid 403 Forbidden on CDNs.
 */
function getPlatformHeaders(targetUrl) {
  const headers = {
    'User-Agent':
      process.env.YTDLP_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
    'Accept-Encoding': 'identity',
  };

  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('instagram.com') || host.includes('cdninstagram.com')) {
      headers['Referer'] = 'https://www.instagram.com/';
      headers['Origin'] = 'https://www.instagram.com';
    } else if (host.includes('tiktok.com') || host.includes('tiktokcdn.com') || host.includes('muscdn.com')) {
      headers['Referer'] = 'https://www.tiktok.com/';
    } else if (host.includes('twitter.com') || host.includes('twimg.com') || host.includes('x.com')) {
      headers['Referer'] = 'https://twitter.com/';
    } else if (host.includes('facebook.com') || host.includes('fbcdn.net')) {
      headers['Referer'] = 'https://www.facebook.com/';
    } else if (host.includes('reddit.com') || host.includes('redd.it')) {
      headers['Referer'] = 'https://www.reddit.com/';
    } else if (host.includes('googlevideo.com') || host.includes('youtube.com')) {
      headers['Referer'] = 'https://www.youtube.com/';
      headers['Origin'] = 'https://www.youtube.com';
    }
  } catch {}

  return headers;
}

/**
 * Proxy a media URL directly to the HTTP response, following up to maxRedirects redirects
 * with SSRF checks on every hop and Range header forwarding for media seeking.
 */
function proxyMediaStream(mediaUrl, req, res, options = {}) {
  const maxRedirects = 5;
  let redirectCount = 0;
  const rawFilename = options.filename || 'media.mp4';
  const safeFilename = sanitizeFilename(rawFilename);

  function executeRequest(currentUrl) {
    let parsed;
    try {
      parsed = new URL(currentUrl);
    } catch {
      if (!res.headersSent) {
        res.status(400).json({ success: false, errorCode: 'INVALID_URL', error: 'Invalid media URL.' });
      }
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const outgoingHeaders = getPlatformHeaders(currentUrl);

    // Forward client Range header if requested (essential for HTML5 video/audio seeking)
    if (req && req.headers && req.headers.range) {
      outgoingHeaders['Range'] = req.headers.range;
    }

    const streamReq = client.request(
      currentUrl,
      {
        method: 'GET',
        headers: outgoingHeaders,
        timeout: 45_000,
      },
      async (streamRes) => {
        // Handle 3xx redirects safely
        if (
          streamRes.statusCode >= 300 &&
          streamRes.statusCode < 400 &&
          streamRes.headers.location
        ) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            if (!res.headersSent) {
              res.status(502).json({ success: false, error: 'Too many redirects from media host.' });
            }
            return;
          }

          let nextUrl = streamRes.headers.location;
          if (nextUrl.startsWith('/')) {
            nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
          } else if (!nextUrl.startsWith('http')) {
            nextUrl = new URL(nextUrl, currentUrl).href;
          }

          // SSRF check on redirected hop
          const safeCheck = await validateSafeUrl(nextUrl);
          if (!safeCheck.ok) {
            if (!res.headersSent) {
              res.status(403).json({ success: false, errorCode: 'FORBIDDEN_URL', error: 'Redirected to forbidden destination.' });
            }
            return;
          }

          streamRes.resume(); // drain response
          return executeRequest(nextUrl);
        }

        // Set status code (200 OK or 206 Partial Content)
        res.status(streamRes.statusCode);

        // Forward headers
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

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        streamRes.pipe(res);

        streamRes.on('error', (err) => {
          if (!res.headersSent) {
            res.status(502).json({ success: false, error: 'Media stream failed: ' + err.message });
          }
        });
      }
    );

    streamReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(502).json({ success: false, error: 'Failed to connect to media host: ' + err.message });
      }
    });

    streamReq.on('timeout', () => {
      streamReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ success: false, error: 'Media stream connection timed out.' });
      }
    });

    if (req) {
      req.on('close', () => {
        streamReq.destroy();
      });
    }

    streamReq.end();
  }

  executeRequest(mediaUrl);
}

/**
 * Stream merged video + audio on the fly using yt-dlp.
 * Enables 1080p, 1440p, 4K video downloads WITH audio on platforms like YouTube where
 * high-resolution streams are stored separately as DASH tracks.
 */
function streamMergedMedia(pageUrl, res, options = {}) {
  const rawFilename = options.filename || 'video.mp4';
  const safeFilename = sanitizeFilename(rawFilename);
  const quality = options.quality ? parseInt(options.quality, 10) : null;

  // Format selector: choose target resolution or best, merging video and audio
  let formatArg;
  if (quality && !isNaN(quality)) {
    formatArg = `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`;
  } else {
    formatArg = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best';
  }

  const ytdlpBin = getYtdlpBinary();
  const args = [
    '-f', formatArg,
    '--no-playlist',
    '--no-warnings',
    '-o', '-',
  ];

  if (process.env.YTDLP_PROXY) {
    args.push('--proxy', process.env.YTDLP_PROXY);
  }

  args.push(pageUrl);

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  const child = spawn(ytdlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.pipe(res);

  child.stderr.on('data', (data) => {
    // Only log severe errors
    const str = data.toString();
    if (str.includes('ERROR:')) {
      console.warn('[streamMergedMedia stderr]', str.trim());
    }
  });

  child.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to start stream merger: ' + err.message });
    }
  });

  res.on('close', () => {
    try {
      child.kill('SIGTERM');
    } catch {}
  });
}

/**
 * Stream pure audio on the fly using yt-dlp.
 * Extracts audio from any video URL (YouTube, TikTok, Instagram, Twitter, etc.).
 */
function streamAudioMedia(pageUrl, res, options = {}) {
  const format = (options.format || 'mp3').toLowerCase();
  const ext = format === 'm4a' ? 'm4a' : 'mp3';
  const rawFilename = options.filename || `audio.${ext}`;
  const safeFilename = sanitizeFilename(rawFilename);

  const ytdlpBin = getYtdlpBinary();
  const formatArg = ext === 'm4a' ? 'bestaudio[ext=m4a]/bestaudio/best' : 'bestaudio/best';

  const args = [
    '-f', formatArg,
    '--no-playlist',
    '--no-warnings',
    '-o', '-',
  ];

  if (process.env.YTDLP_PROXY) {
    args.push('--proxy', process.env.YTDLP_PROXY);
  }

  args.push(pageUrl);

  const contentType = ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  const child = spawn(ytdlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.pipe(res);

  child.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to extract audio stream: ' + err.message });
    }
  });

  res.on('close', () => {
    try {
      child.kill('SIGTERM');
    } catch {}
  });
}

/**
 * Merge separate video stream URL and audio stream URL on the fly using FFmpeg
 * and stream the resulting fragmented MP4 directly to the client without saving to disk.
 */
function streamDirectFfmpegMerge(videoUrl, audioUrl, res, options = {}) {
  const rawFilename = options.filename || 'merged_video.mp4';
  const safeFilename = sanitizeFilename(rawFilename);

  const ffmpegArgs = [
    '-headers', `User-Agent: ${getPlatformHeaders(videoUrl)['User-Agent']}\r\n`,
    '-i', videoUrl,
    '-headers', `User-Agent: ${getPlatformHeaders(audioUrl)['User-Agent']}\r\n`,
    '-i', audioUrl,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov',
    'pipe:1',
  ];

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  const child = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.pipe(res);

  child.stderr.on('data', (d) => {
    const str = d.toString();
    if (str.includes('Error') || str.includes('failed')) {
      console.warn('[ffmpegMerge stderr]', str.trim());
    }
  });

  child.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'FFmpeg merging failed: ' + err.message });
    }
  });

  res.on('close', () => {
    try {
      child.kill('SIGTERM');
    } catch {}
  });
}

module.exports = {
  sanitizeFilename,
  getPlatformHeaders,
  proxyMediaStream,
  streamMergedMedia,
  streamAudioMedia,
  streamDirectFfmpegMerge,
};
