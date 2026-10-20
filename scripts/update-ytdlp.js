#!/usr/bin/env node
/**
 * Update and ensure yt-dlp binary is installed and executable.
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
  try {
    const binDir = path.dirname(require.resolve('youtube-dl-exec'));
    const exeName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    ytdlpBin = path.join(binDir, '..', 'bin', exeName);
  } catch {
    const exeName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    ytdlpBin = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', exeName);
  }
}

const binDir = path.dirname(ytdlpBin);
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// Ensure binary exists: download if missing
if (!fs.existsSync(ytdlpBin)) {
  console.log('⬇️  yt-dlp binary not found, attempting download...');
  try {
    const postinstallScript = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'scripts', 'postinstall.js');
    if (fs.existsSync(postinstallScript)) {
      execSync(`node "${postinstallScript}"`, { stdio: 'inherit', timeout: 60_000 });
    }
  } catch (err) {
    console.warn('⚠️  youtube-dl-exec postinstall download failed, trying direct curl fallback...', err.message);
  }

  // Direct curl fallback if postinstall was rate-limited or failed
  if (!fs.existsSync(ytdlpBin)) {
    try {
      const downloadName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
      const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${downloadName}`;
      console.log(`⬇️  Downloading yt-dlp directly from ${downloadUrl}...`);
      execSync(`curl -sL "${downloadUrl}" -o "${ytdlpBin}"`, { timeout: 120_000 });
    } catch (curlErr) {
      console.warn('⚠️  Direct curl download failed:', curlErr.message);
    }
  }
}

// Ensure execution permission on Linux / macOS
if (process.platform !== 'win32' && fs.existsSync(ytdlpBin)) {
  try {
    fs.chmodSync(ytdlpBin, 0o755);
  } catch {}
}

if (fs.existsSync(ytdlpBin)) {
  console.log('🔄  Checking for yt-dlp updates...');
  try {
    const output = execSync(`"${ytdlpBin}" -U`, {
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(output.trim());
    console.log('✅  yt-dlp is verified and up to date.');
  } catch (err) {
    console.log('ℹ️  yt-dlp binary is installed and ready.');
  }
} else {
  console.warn('⚠️  yt-dlp binary not found in node_modules; will use system or dynamic binary.');
}
