const crypto = require('crypto');
const dotenv = require('dotenv');
const pkg = require('../package.json');
const PLACEHOLDER_KEY = 'your-secret-key-change-me';

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeInt(value, fallback, min = 1) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min) return String(fallback);
  return String(n);
}

function defaultEnv() {
  return {
    PORT: '3000',
    RATE_LIMIT_MAX: '50',
    MAX_REDIRECTS: '10',
    REDIRECT_TIMEOUT: '8000',
    CACHE_TTL_MINUTES: '60',
    CACHE_MAX_SIZE: '500',
    MAX_CONCURRENT: '3',
    MAX_VIDEO_DURATION: '7200',
    MAX_FILE_SIZE_MB: '500',
    MAX_FORMATS: '10',
    EXTRA_DOMAINS: '',
  };
}

function createApiKey() {
  // Keep key stable across instances within the same deployment when metadata is available.
  const deploymentSeed = [
    process.env.VERCEL_PROJECT_ID,
    process.env.VERCEL_ENV,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.VERCEL_URL,
    pkg.name,
  ].filter(Boolean).join('|');

  if (deploymentSeed) {
    return `vdl_${crypto.createHash('sha256').update(deploymentSeed).digest('hex').slice(0, 48)}`;
  }

  return `vdl_${crypto.randomBytes(24).toString('hex')}`;
}

function detectDeployment() {
  if (process.env.VERCEL === '1') {
    const host = process.env.VERCEL_URL;
    return {
      platform: 'vercel',
      liveUrl: host ? `https://${host}` : null,
    };
  }

  if (process.env.KOYEB_PUBLIC_DOMAIN) {
    return {
      platform: 'koyeb',
      liveUrl: `https://${process.env.KOYEB_PUBLIC_DOMAIN}`,
    };
  }

  if (process.env.RENDER_EXTERNAL_URL) {
    return {
      platform: 'render',
      liveUrl: process.env.RENDER_EXTERNAL_URL,
    };
  }

  if (process.env.RAILWAY_STATIC_URL) {
    return {
      platform: 'railway',
      liveUrl: process.env.RAILWAY_STATIC_URL,
    };
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return {
      platform: 'railway',
      liveUrl: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
    };
  }

  if (process.env.FLY_APP_NAME) {
    return {
      platform: 'fly.io',
      liveUrl: `https://${process.env.FLY_APP_NAME}.fly.dev`,
    };
  }

  return {
    platform: process.env.NODE_ENV === 'production' ? 'generic-production' : 'local',
    liveUrl: null,
  };
}

function bootstrapConfig() {
  dotenv.config();

  const defaults = defaultEnv();
  for (const [key, value] of Object.entries(defaults)) {
    if (isMissing(process.env[key])) {
      process.env[key] = value;
    }
  }

  process.env.PORT = normalizeInt(process.env.PORT, 3000, 1);
  process.env.RATE_LIMIT_MAX = normalizeInt(process.env.RATE_LIMIT_MAX, 50, 1);
  process.env.MAX_REDIRECTS = normalizeInt(process.env.MAX_REDIRECTS, 10, 1);
  process.env.REDIRECT_TIMEOUT = normalizeInt(process.env.REDIRECT_TIMEOUT, 8000, 1);
  process.env.CACHE_TTL_MINUTES = normalizeInt(process.env.CACHE_TTL_MINUTES, 60, 1);
  process.env.CACHE_MAX_SIZE = normalizeInt(process.env.CACHE_MAX_SIZE, 500, 1);
  process.env.MAX_CONCURRENT = normalizeInt(process.env.MAX_CONCURRENT, 3, 1);
  process.env.MAX_VIDEO_DURATION = normalizeInt(process.env.MAX_VIDEO_DURATION, 7200, 1);
  process.env.MAX_FILE_SIZE_MB = normalizeInt(process.env.MAX_FILE_SIZE_MB, 500, 1);
  process.env.MAX_FORMATS = normalizeInt(process.env.MAX_FORMATS, 10, 1);

  const rawKey = process.env.API_SECRET_KEY;
  const needsGeneratedKey = isMissing(rawKey) || rawKey === PLACEHOLDER_KEY;
  const shouldGenerateKey =
    process.env.AUTO_GENERATE_API_KEY === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.NODE_ENV === 'production';

  let apiKeyGenerated = false;
  if (needsGeneratedKey && shouldGenerateKey) {
    process.env.API_SECRET_KEY = createApiKey();
    apiKeyGenerated = true;
  } else if (rawKey === PLACEHOLDER_KEY) {
    process.env.API_SECRET_KEY = '';
  }

  const deployment = detectDeployment();

  return {
    apiKeyGenerated,
    deploymentPlatform: deployment.platform,
    liveUrl: deployment.liveUrl,
    apiAuthEnabled: !isMissing(process.env.API_SECRET_KEY),
    apiKey: process.env.API_SECRET_KEY || '',
  };
}

module.exports = { bootstrapConfig };