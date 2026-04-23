#!/usr/bin/env node
/**
 * Update yt-dlp binary to the latest version.
 * Usage:  node scripts/update-ytdlp.js
 *         npm run update-ytdlp
 */
const { execSync } = require('child_process');
const path = require('path');

// youtube-dl-exec stores its binary here
const binDir = path.dirname(require.resolve('youtube-dl-exec'));

console.log('🔄  Checking for yt-dlp updates...');

try {
  const ytdlp = path.join(binDir, '..', 'bin', 'yt-dlp');
  const output = execSync(`"${ytdlp}" -U`, {
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
    console.log('✅  youtube-dl-exec reinstalled with latest yt-dlp binary.');
  } catch (err2) {
    console.error('❌  Failed to update yt-dlp:', err2.message);
    process.exit(1);
  }
}
