const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { bootstrapConfig } = require('./utils/bootstrapConfig');
const cache = require('./utils/cache');
const queue = require('./utils/queue');
const systemCheck = require('./utils/systemCheck');
const pkg = require('./package.json');

const boot = bootstrapConfig();

const app = express();

// --------------- Middleware ---------------

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Security headers
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
});

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: 'RATE_LIMITED',
    error: 'Too many requests. Try again later.',
  },
});
app.use(limiter);

// --------------- Index / System Status Page ---------------

// HTML-escape to prevent XSS from system check output
function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

app.get('/', (req, res) => {
  const status = systemCheck.runAll();
  const uptime = Math.floor(process.uptime());
  const cacheInfo = cache.stats();
  const queueInfo = { active: queue.active(), pending: queue.pending(), max: queue.MAX_CONCURRENT };

  const statusColor = status.allOk ? '#00c853' : '#ff1744';
  const statusText = status.allOk ? 'ALL SYSTEMS OPERATIONAL' : `${status.failed} CHECK(S) FAILED`;
  const statusEmoji = status.allOk ? '✅' : '❌';

  const checksHtml = status.checks.map((c) => {
    const icon = c.ok ? '✅' : '❌';
    const color = c.ok ? '#e8f5e9' : '#ffebee';
    const textColor = c.ok ? '#2e7d32' : '#c62828';
    return `
      <tr style="background:${color}">
        <td style="padding:10px 16px;font-size:15px">${icon}</td>
        <td style="padding:10px 16px;font-weight:600;color:#333">${esc(c.name)}</td>
        <td style="padding:10px 16px;color:${textColor};font-family:monospace">${esc(c.detail)}</td>
        <td style="padding:10px 16px;font-weight:600;color:${textColor}">${c.ok ? 'OK' : 'MISSING'}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMMPro Video Downloader API</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:40px 20px}
    .container{max-width:800px;width:100%}
    h1{font-size:28px;margin-bottom:4px;color:#fff}
    .version{color:#888;font-size:14px;margin-bottom:30px}
    .status-banner{padding:18px 24px;border-radius:12px;margin-bottom:30px;text-align:center;font-weight:700;font-size:18px;letter-spacing:1px;color:#fff}
    .card{background:#1a1d27;border-radius:12px;padding:0;margin-bottom:24px;overflow:hidden;border:1px solid #2a2d37}
    .card-header{padding:16px 20px;font-size:14px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #2a2d37}
    table{width:100%;border-collapse:collapse}
    table tr{border-bottom:1px solid #2a2d37}
    table tr:last-child{border-bottom:none}
    table td{padding:12px 16px;font-size:14px;color:#ccc}
    .api-link{display:block;padding:12px 16px;color:#64b5f6;text-decoration:none;font-family:monospace;font-size:14px;border-bottom:1px solid #2a2d37;transition:background .15s}
    .api-link:last-child{border-bottom:none}
    .api-link:hover{background:#222639}
    .api-link .method{color:#00e676;font-weight:700;margin-right:8px}
    .api-link .desc{color:#888;margin-left:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;padding:16px 20px}
    .stat-box{text-align:center;padding:12px}
    .stat-val{font-size:24px;font-weight:700;color:#fff}
    .stat-label{font-size:12px;color:#888;margin-top:4px}
    .footer{margin-top:30px;font-size:12px;color:#555;text-align:center}
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 SMMPro Video Downloader API</h1>
    <p class="version">v${pkg.version} &middot; Node ${process.version} &middot; Uptime ${formatUptime(uptime)}</p>

    <div class="status-banner" style="background:${statusColor}">
      ${statusEmoji} ${statusText}
    </div>

    <!-- System Checks -->
    <div class="card">
      <div class="card-header">System Checks (${status.passed}/${status.total} passed)</div>
      <table>
        <tr style="background:#12141c">
          <td style="padding:10px 16px;font-weight:600;color:#888;width:40px"></td>
          <td style="padding:10px 16px;font-weight:600;color:#888">Component</td>
          <td style="padding:10px 16px;font-weight:600;color:#888">Detail</td>
          <td style="padding:10px 16px;font-weight:600;color:#888;width:80px">Status</td>
        </tr>
        ${checksHtml}
      </table>
    </div>

    <!-- Runtime Stats -->
    <div class="card">
      <div class="card-header">Runtime</div>
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-val">${cacheInfo.activeEntries}</div><div class="stat-label">Cached URLs</div></div>
        <div class="stat-box"><div class="stat-val">${queueInfo.active}</div><div class="stat-label">Active Jobs</div></div>
        <div class="stat-box"><div class="stat-val">${queueInfo.pending}</div><div class="stat-label">Queue Pending</div></div>
        <div class="stat-box"><div class="stat-val">${queueInfo.max}</div><div class="stat-label">Max Concurrent</div></div>
      </div>
    </div>

    <!-- API Endpoints -->
    <div class="card">
      <div class="card-header">API Endpoints</div>
      <a class="api-link" href="/api/info?url=https://youtu.be/dQw4w9WgXcQ"><span class="method">GET</span>/api/info?url=...<span class="desc">Quick preview (title, thumbnail, duration)</span></a>
      <a class="api-link" href="/api/download?url=https://youtu.be/dQw4w9WgXcQ"><span class="method">GET</span>/api/download?url=...<span class="desc">Full metadata + download URLs</span></a>
      <a class="api-link" href="/api/check?url=https://youtu.be/dQw4w9WgXcQ"><span class="method">GET</span>/api/check?url=...<span class="desc">Detect platform for a URL</span></a>
      <a class="api-link" href="/api/platforms"><span class="method">GET</span>/api/platforms<span class="desc">All 50+ supported platforms</span></a>
      <a class="api-link" href="/api/health"><span class="method">GET</span>/api/health<span class="desc">Health check (JSON)</span></a>
      <a class="api-link" href="/api/stats"><span class="method">GET</span>/api/stats<span class="desc">Daily usage statistics</span></a>
      <a class="api-link" href="/api/version"><span class="method">GET</span>/api/version<span class="desc">API version & runtime info</span></a>
      <a class="api-link" href="/api/cache"><span class="method">GET</span>/api/cache<span class="desc">Cache statistics</span></a>
    </div>

    ${!status.allOk ? `
    <div class="card" style="border-color:#ff1744">
      <div class="card-header" style="color:#ff1744">⚠️ Fix Required</div>
      <table>
        ${status.checks.filter(c => !c.ok).map(c => `
        <tr style="background:#1c1214">
          <td style="padding:12px 16px;color:#ff8a80;font-weight:600">${esc(c.name)}</td>
          <td style="padding:12px 16px;color:#ff8a80;font-family:monospace">${esc(getFixHint(c.name))}</td>
        </tr>`).join('')}
      </table>
    </div>` : ''}

    <p class="footer">SMMPro Video Downloader API &middot; Powered by yt-dlp &middot; ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;

  const httpStatus = status.allOk ? 200 : 503;
  res.status(httpStatus).type('html').send(html);
});

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm ' + Math.floor(sec % 60) + 's';
}

function getFixHint(name) {
  const hints = {
    'Node.js': 'Install Node.js 18+ from https://nodejs.org',
    'npm': 'npm comes with Node.js — reinstall Node',
    'Python': 'Install Python 3.7+: apt install python3 / choco install python',
    'ffmpeg': 'Install ffmpeg: apt install ffmpeg / choco install ffmpeg / brew install ffmpeg',
    'yt-dlp': 'Run: npm install youtube-dl-exec  OR  npm run update-ytdlp',
    'youtube-dl-exec': 'Run: npm install',
    'express': 'Run: npm install',
    '.env file': 'Optional only. Startup now auto-applies defaults and API key generation.',
    'logs/ directory': 'Create logs/ folder and ensure write permissions: mkdir logs',
  };
  return hints[name] || 'Check the installation docs';
}

// --------------- API Key Authentication ---------------

const API_SECRET_KEY = boot.apiKey || '';

// Public routes that don't require an API key
const PUBLIC_PATHS = ['/api/health', '/api/version', '/api/deploy-info'];

app.use('/api', (req, res, next) => {
  // Skip auth only if key is truly missing
  if (!API_SECRET_KEY) return next();

  // Allow public endpoints without a key
  if (PUBLIC_PATHS.includes(req.baseUrl + req.path)) return next();

  // Check header first, then query param
  const provided = req.headers['x-api-key'] || req.query.apikey;

  if (!provided) {
    return res.status(401).json({
      success: false,
      errorCode: 'API_KEY_MISSING',
      error: 'Missing API key. Send it as x-api-key header or ?apikey= query parameter.',
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== API_SECRET_KEY.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(API_SECRET_KEY))) {
    return res.status(403).json({
      success: false,
      errorCode: 'API_KEY_INVALID',
      error: 'Invalid API key.',
    });
  }

  next();
});

// --------------- Routes ---------------

// Health check (public — no API key needed)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    cache: cache.stats(),
    queue: {
      active: queue.active(),
      pending: queue.pending(),
      maxConcurrent: queue.MAX_CONCURRENT,
    },
  });
});

// Deploy info (public — shows live URL and API key for deployment)
app.get('/api/deploy-info', (req, res) => {
  const fallbackUrl = `${req.protocol}://${req.get('host')}`;
  const liveUrl = boot.liveUrl || fallbackUrl;

  return res.json({
    success: true,
    name: pkg.name,
    version: pkg.version,
    platform: boot.deploymentPlatform,
    environment: process.env.NODE_ENV || 'development',
    liveUrl,
    apiAuthEnabled: Boolean(API_SECRET_KEY),
    apiKey: API_SECRET_KEY || null,
    endpoints: {
      health: `${liveUrl}/api/health`,
      version: `${liveUrl}/api/version`,
      info: `${liveUrl}/api/info?url=<video_url>`,
      download: `${liveUrl}/api/download?url=<video_url>`,
      platforms: `${liveUrl}/api/platforms`,
    },
  });
});

// Core API routes
app.use('/api', require('./routes/download'));

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({
    success: false,
    errorCode: 'ROUTE_NOT_FOUND',
    error: 'The requested route was not found.',
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_ERROR',
    error: 'Internal server error.',
  });
});

// --------------- yt-dlp auto-update on startup ---------------

(async () => {
  try {
    const { execSync } = require('child_process');
    console.log('🔄  Checking yt-dlp for updates…');
    execSync('node scripts/update-ytdlp.js', { cwd: __dirname, timeout: 120_000, stdio: 'inherit' });
  } catch {
    console.log('⚠️  yt-dlp auto-update skipped (run "npm run update-ytdlp" manually)');
  }
})();

// --------------- Start ---------------

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  const runningUrl = boot.liveUrl || `http://localhost:${PORT}`;
  console.log(`✅  Video Downloader API v${pkg.version} running on ${runningUrl}`);
  console.log(`🌐  Deployment platform: ${boot.deploymentPlatform}`);
  if (boot.apiAuthEnabled) {
    console.log(`🔐  Active API key: ${boot.apiKey}`);
  } else {
    console.log('🔓  API key auth disabled (local/dev mode).');
  }
  if (boot.apiKeyGenerated) {
    console.log('🔐  API_SECRET_KEY was auto-generated for this deployment.');
  }
  console.log(`📘  Deploy details: GET ${runningUrl}/api/deploy-info`);
  console.log(`📚  Health:     GET /api/health`);
  console.log(`📚  Info:       GET /api/info?url=<video_url>`);
  console.log(`📚  Download:   GET /api/download?url=<video_url>`);
  console.log(`📚  Check URL:  GET /api/check?url=<video_url>`);
  console.log(`📚  Platforms:  GET /api/platforms`);
  console.log(`📚  Stats:      GET /api/stats`);
  console.log(`📚  Version:    GET /api/version`);
  console.log(`📚  Cache:      GET /api/cache | DELETE /api/cache`);
  console.log(`⚡  Queue:      max ${queue.MAX_CONCURRENT} concurrent extractions`);
});

// --------------- Graceful Shutdown ---------------

function shutdown(signal) {
  console.log(`\n🛑  Received ${signal}. Shutting down gracefully…`);
  server.close(() => {
    console.log('✅  HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 10 seconds if connections don't close
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
