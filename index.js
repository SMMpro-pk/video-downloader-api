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

// Normalize Vercel Serverless Function rewrites if req.url starts with /index.js or /api/index.js
app.use((req, res, next) => {
  if (req.url.startsWith('/index.js') || req.url.startsWith('/api/index.js')) {
    const raw = req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.originalUrl;
    if (raw && !raw.startsWith('/index.js') && !raw.startsWith('/api/index.js')) {
      req.url = raw;
    } else {
      req.url = req.url.replace(/^\/(?:api\/)?index\.js/, '') || '/';
    }
  }
  next();
});

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
const PUBLIC_PATHS = [
  '/api/health', '/api/version', '/api/deploy-info',
  '/health', '/version', '/deploy-info',
];

app.use(['/api', '/download', '/info', '/batch', '/stream', '/check', '/platforms', '/stats', '/cache'], (req, res, next) => {
  // Skip auth only if key is truly disabled or empty
  if (!API_SECRET_KEY) return next();

  // Allow public endpoints without a key
  const fullPath = (req.baseUrl || '') + (req.path || '');
  if (PUBLIC_PATHS.includes(fullPath) || PUBLIC_PATHS.includes(req.path)) return next();

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
const handleHealth = (req, res) => {
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
};
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// Deploy info (public — shows live URL and environment info)
const handleDeployInfo = (req, res) => {
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
};
app.get('/api/deploy-info', handleDeployInfo);
app.get('/deploy-info', handleDeployInfo);

// Core API routes (mounted on /api and root for maximum proxy compatibility)
const downloadRoutes = require('./routes/download');
app.use('/api', downloadRoutes);
app.use('/', downloadRoutes);

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

// --------------- Start ---------------

const PORT = process.env.PORT || 3000;
let server;

// Start server if running directly (or in container/PaaS like Render/Railway/Fly/Koyeb)
if (require.main === module) {
  server = app.listen(PORT, () => {
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

    // Async yt-dlp check after server starts listening (never blocks the port listener or healthchecks)
    if (process.env.AUTO_UPDATE_YTDLP !== 'false') {
      const { exec } = require('child_process');
      exec('node scripts/update-ytdlp.js', { cwd: __dirname }, (err, stdout) => {
        if (!err && stdout && stdout.includes('yt-dlp is up to date')) {
          console.log('✅  yt-dlp binary is verified up to date.');
        }
      });
    }
  });
}

// --------------- Graceful Shutdown ---------------

function shutdown(signal) {
  console.log(`\n🛑  Received ${signal}. Shutting down gracefully…`);
  if (server) {
    server.close(() => {
      console.log('✅  HTTP server closed.');
      process.exit(0);
    });
    // Force exit after 10 seconds if connections don't close
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000).unref();
  } else {
    process.exit(0);
  }
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

module.exports = app;

