/**
 * System dependency checker.
 * Verifies that all required binaries and modules are available.
 * Returns an array of check results for the status dashboard.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function check(name, fn) {
  try {
    const detail = fn();
    return { name, ok: true, detail };
  } catch (err) {
    return { name, ok: false, detail: err.message || 'Not found' };
  }
}

function runAll() {
  const results = [];

  // 1. Node.js
  results.push(check('Node.js', () => process.version));

  // 2. npm
  results.push(check('npm', () => {
    return execSync('npm --version', { encoding: 'utf8', timeout: 10_000 }).trim();
  }));

  // 3. Python
  results.push(check('Python', () => {
    try {
      return execSync('python3 --version', { encoding: 'utf8', timeout: 10_000 }).trim();
    } catch {
      return execSync('python --version', { encoding: 'utf8', timeout: 10_000 }).trim();
    }
  }));

  // 4. ffmpeg
  results.push(check('ffmpeg', () => {
    const out = execSync('ffmpeg -version', { encoding: 'utf8', timeout: 10_000 });
    const match = out.match(/ffmpeg version (\S+)/);
    return match ? match[1] : 'installed';
  }));

  // 5. yt-dlp binary
  results.push(check('yt-dlp', () => {
    try {
      const ytdlp = require('youtube-dl-exec');
      const binPath = ytdlp.getBinaryPath ? ytdlp.getBinaryPath() : 'bundled';
      const out = execSync(`"${binPath}" --version`, { encoding: 'utf8', timeout: 15_000 }).trim();
      return out || 'installed';
    } catch {
      // Fallback: try global yt-dlp
      return execSync('yt-dlp --version', { encoding: 'utf8', timeout: 10_000 }).trim();
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
    const logDir = path.join(__dirname, '..', 'logs');
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
  const allOk = results.every((r) => r.ok);
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

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
