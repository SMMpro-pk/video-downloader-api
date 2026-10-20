#!/usr/bin/env node
/**
 * Update yt-dlp binary to the latest version.
 * Usage:  node scripts/update-ytdlp.js
 *         npm run update-ytdlp
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let ytdlpBin;
try {
  const ytdlpExec = require('youtube-dl-exec');
  ytdlpBin = ytdlpExec.constants?.YOUTUBE_DL_PATH;
} catch {
  // fallback if module not found yet
}
if (!ytdlpBin) {
  const binDir = path.dirname(require.resolve('youtube-dl-exec'));
  const exeName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  ytdlpBin = path.join(binDir, '..', 'bin', exeName);
}

// Ensure execution permission on Linux / macOS
if (process.platform !== 'win32' && ytdlpBin && fs.existsSync(ytdlpBin)) {
  try {
    fs.chmodSync(ytdlpBin, 0o755);
  } catch {}
}

console.log('🔄  Checking for yt-dlp updates...');

try {
  const output = execSync(`"${ytdlpBin}" -U`, {
    encoding: 'utf8',
    timeout: 60_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log(output.trim());
  console.log('✅  yt-dlp is up to date.');
} catch (err) {
  // Fallback: reinstall the npm package to pull the latest binary
  console.log('⚠️  Direct update failed, reinstalling youtube-dl-exec...');
  try {
    execSync('npm install youtube-dl-exec@latest', {
      encoding: 'utf8',
      timeout: 120_000,
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    if (process.platform !== 'win32' && ytdlpBin && fs.existsSync(ytdlpBin)) {
      try {
        fs.chmodSync(ytdlpBin, 0o755);
      } catch {}
    }
    console.log('✅  youtube-dl-exec reinstalled with latest yt-dlp binary.');
  } catch (err2) {
    console.warn('⚠️  Could not update yt-dlp binary during build (using existing binary):', err2.message);
    process.exit(0);
  }
}
