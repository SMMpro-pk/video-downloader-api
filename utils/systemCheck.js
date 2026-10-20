/**
 * System dependency checker.
 * Verifies that all required binaries and modules are available.
 * Returns an array of check results for the status dashboard.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Serverless runtimes (Netlify Functions) don't ship npm or ffmpeg — treat them as optional there
const IS_SERVERLESS = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTION);

function check(name, fn, { optional = false, optionalNote } = {}) {
  try {
    const detail = fn();
    return { name, ok: true, detail };
  } catch (err) {
    if (optional && optionalNote) return { name, ok: false, optional, detail: optionalNote };
    return { name, ok: false, optional, detail: err.message || 'Not found' };
  }
}

function runAll() {
  const results = [];

  // 1. Node.js
  results.push(check('Node.js', () => process.version));

  // 2. npm
  results.push(check('npm', () => {
    return execSync('npm --version', { encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  }, { optional: IS_SERVERLESS, optionalNote: 'Not available in serverless runtime (not required)' }));

  // 3. Python
  results.push(check('Python', () => {
    try {
      return execSync('python3 --version', { encoding: 'utf8', timeout: 5_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
      try {
        return execSync('python --version', { encoding: 'utf8', timeout: 5_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      } catch {
        // Standalone yt-dlp binary includes its own embedded Python environment
        try {
          const ytdlp = require('youtube-dl-exec');
          const bin = ytdlp.constants?.YOUTUBE_DL_PATH;
          if (bin && fs.existsSync(bin)) {
            return 'Embedded (bundled with yt-dlp)';
          }
        } catch {}
        throw new Error('Python not found in system PATH');
      }
    }
  }));

  // 4. ffmpeg
  results.push(check('ffmpeg', () => {
    const out = execSync('ffmpeg -version', { encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] });
    const match = out.match(/ffmpeg version (\S+)/);
    return match ? match[1] : 'installed';
    // The API only extracts metadata and proxies direct media URLs — it never merges or transcodes
  }, { optional: true, optionalNote: 'Not installed (optional — only needed for merging/transcoding, which this API does not do)' }));

  // 5. yt-dlp binary
  results.push(check('yt-dlp', () => {
    try {
      const ytdlp = require('youtube-dl-exec');
      const binPath = ytdlp.constants?.YOUTUBE_DL_PATH || (ytdlp.getBinaryPath ? ytdlp.getBinaryPath() : 'yt-dlp');
      const { execFileSync } = require('child_process');
      const out = execFileSync(binPath, ['--version'], { encoding: 'utf8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      return out || 'installed';
    } catch {
      // Fallback: try global yt-dlp
      return execSync('yt-dlp --version', { encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }
  }));

  // 6. youtube-dl-exec module
  results.push(check('youtube-dl-exec', () => {
    const pkg = require('youtube-dl-exec/package.json');
    return `v${pkg.version}`;
  }));

  // 7. Express
  results.push(check('express', () => {
    const pkg = require('express/package.json');
    return `v${pkg.version}`;
  }));

  // 8. logs directory writable
  results.push(check('logs/ directory', () => {
    const logDir = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    // Test write
    const testFile = path.join(logDir, '.write-test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return 'writable';
  }));

  // Summary
  const allOk = results.every((r) => r.ok || r.optional);
  const failed = results.filter((r) => !r.ok && !r.optional).length;
  const passed = results.length - failed;

  return { allOk, passed, failed, total: results.length, checks: results };
}

// Cache results for 60 seconds — avoid running execSync on every dashboard request
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 60_000;

function runAllCached() {
  const now = Date.now();
  if (_cache && now - _cacheTs < CACHE_TTL) return _cache;
  _cache = runAll();
  _cacheTs = now;
  return _cache;
}

module.exports = { runAll: runAllCached };
