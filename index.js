const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { bootstrapConfig } = require('./utils/bootstrapConfig');
const cache = require('./utils/cache');
const queue = require('./utils/queue');
const systemCheck = require('./utils/systemCheck');
const { renderDashboard } = require('./utils/dashboardHtml');
const pkg = require('./package.json');

const boot = bootstrapConfig();

const app = express();

// Trust reverse proxy for accurate client IP tracking on Vercel, Render, Railway, Fly.io, Cloudflare, Nginx
app.set('trust proxy', 1);

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
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: 'RATE_LIMITED',
    error: 'Too many requests. Try again later.',
  },
});
app.use(limiter);

// --------------- Index / Interactive Dashboard ---------------

app.get('/', (req, res) => {
  const status = systemCheck.runAll();
  const uptime = Math.floor(process.uptime());
  const cacheInfo = cache.stats();
  const queueInfo = { active: queue.active(), pending: queue.pending(), max: queue.MAX_CONCURRENT };

  const html = renderDashboard({
    pkg,
    status,
    cacheInfo,
    queueInfo,
    boot,
    uptime,
  });

  const httpStatus = status.allOk ? 200 : 503;
  res.status(httpStatus).type('html').send(html);
});

// --------------- API Key Authentication ---------------

const API_SECRET_KEY = boot.apiKey || '';

// Public routes that don't require an API key
const PUBLIC_PATHS = ['/api/health', '/api/version', '/api/deploy-info'];

app.use('/api', (req, res, next) => {
  // Skip auth only if key is truly disabled or empty
  if (!API_SECRET_KEY) return next();

  // Allow public endpoints without a key
  if (PUBLIC_PATHS.includes(req.baseUrl + req.path)) return next();

  // Check header first (x-api-key or Authorization: Bearer <key>), then query param
  let provided = req.headers['x-api-key'] || req.query.apikey;
  if (!provided && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      provided = parts[1];
    }
  }

  if (!provided) {
    return res.status(401).json({
      success: false,
      errorCode: 'API_KEY_MISSING',
      error: 'Missing API key. Send it as x-api-key header, Authorization: Bearer <key>, or ?apikey= query parameter.',
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (
    provided.length !== API_SECRET_KEY.length ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(API_SECRET_KEY))
  ) {
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

// Deploy info (public — shows live URL and environment info)
app.get('/api/deploy-info', (req, res) => {
  const fallbackUrl = `${req.protocol}://${req.get('host')}`;
  const liveUrl = boot.liveUrl || fallbackUrl;
  const isDev = process.env.NODE_ENV !== 'production';

  // Securely mask API key in production so it cannot be scraped
  const displayedApiKey = API_SECRET_KEY
    ? (isDev ? API_SECRET_KEY : `${API_SECRET_KEY.slice(0, 8)}...${API_SECRET_KEY.slice(-4)}`)
    : null;

  return res.json({
    success: true,
    name: pkg.name,
    version: pkg.version,
    platform: boot.deploymentPlatform,
    environment: process.env.NODE_ENV || 'development',
    liveUrl,
    apiAuthEnabled: Boolean(API_SECRET_KEY),
    apiKey: displayedApiKey,
    endpoints: {
      health: `${liveUrl}/api/health`,
      version: `${liveUrl}/api/version`,
      info: `${liveUrl}/api/info?url=<video_url>`,
      download: `${liveUrl}/api/download?url=<video_url>`,
      batch: `${liveUrl}/api/batch`,
      stream: `${liveUrl}/api/stream?url=<media_url>&filename=video.mp4`,
      platforms: `${liveUrl}/api/platforms`,
      stats: `${liveUrl}/api/stats`,
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

module.exports = app;

// When imported (e.g. by the Netlify Function), skip auto-update and server startup
if (require.main === module) {

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
  console.log(`📚  Info:       GET/POST /api/info?url=<video_url>`);
  console.log(`📚  Download:   GET/POST /api/download?url=<video_url>`);
  console.log(`📚  Batch:      POST /api/batch`);
  console.log(`📚  Stream:     GET /api/stream?url=<media_url>`);
  console.log(`📚  Check URL:  GET/POST /api/check?url=<video_url>`);
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

}
