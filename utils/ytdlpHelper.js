const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, execSync } = require('child_process');

let _cachedBin = null;
let _cachedInstance = null;

/**
 * Returns a working yt-dlp binary path.
 * Handles Windows, local dev, Docker, and serverless environments (e.g. Vercel/AWS Lambda).
 * On read-only filesystems (Vercel), copies the bundled binary into /tmp and grants execute permissions.
 */
function getYtdlpBinary() {
  if (_cachedBin && fs.existsSync(_cachedBin)) {
    return _cachedBin;
  }

  const ytdlp = require('youtube-dl-exec');
  const defaultBin = ytdlp.constants?.YOUTUBE_DL_PATH;

  // 1. If running on Windows and bundled .exe exists
  if (process.platform === 'win32') {
    if (defaultBin && fs.existsSync(defaultBin)) {
      _cachedBin = defaultBin;
      return _cachedBin;
    }
  }

  // 2. Check if yt-dlp is globally installed in system PATH
  try {
    execSync('yt-dlp --version', { stdio: 'ignore', timeout: 5000 });
    _cachedBin = 'yt-dlp';
    return _cachedBin;
  } catch {}

  // 3. For Serverless / Linux / Docker: check /tmp/yt-dlp
  const tmpBin = path.join(os.tmpdir(), 'yt-dlp');
  if (fs.existsSync(tmpBin)) {
    try {
      fs.chmodSync(tmpBin, 0o755);
      execFileSync(tmpBin, ['--version'], { stdio: 'ignore', timeout: 5000 });
      _cachedBin = tmpBin;
      return _cachedBin;
    } catch {}
  }

  // 4. If bundled binary exists, attempt to make it executable or copy to /tmp
  if (defaultBin && fs.existsSync(defaultBin)) {
    // Try executing directly
    try {
      fs.chmodSync(defaultBin, 0o755);
      execFileSync(defaultBin, ['--version'], { stdio: 'ignore', timeout: 5000 });
      _cachedBin = defaultBin;
      return _cachedBin;
    } catch {
      // Read-only filesystem (Vercel) — copy to /tmp and chmod
      try {
        fs.copyFileSync(defaultBin, tmpBin);
        fs.chmodSync(tmpBin, 0o755);
        execFileSync(tmpBin, ['--version'], { stdio: 'ignore', timeout: 5000 });
        _cachedBin = tmpBin;
        return _cachedBin;
      } catch (err) {
        console.warn('⚠️ Could not copy yt-dlp binary to /tmp:', err.message);
      }
    }
  }

  // Fallback to defaultBin or yt-dlp
  _cachedBin = defaultBin || 'yt-dlp';
  return _cachedBin;
}

/**
 * Returns a configured youtubedl runner instance pointing to the verified binary.
 */
function getYtdlpInstance() {
  if (_cachedInstance) return _cachedInstance;
  const ytdlp = require('youtube-dl-exec');
  const bin = getYtdlpBinary();
  _cachedInstance = ytdlp.create(bin);
  return _cachedInstance;
}

module.exports = {
  getYtdlpBinary,
  getYtdlpInstance,
};
