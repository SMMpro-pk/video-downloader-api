#!/usr/bin/env node
/**
 * Download the standalone yt-dlp Linux build (embeds its own Python) next to the
 * default youtube-dl-exec binary. Used by the Netlify build, since Netlify Functions
 * have no system Python to run the regular yt-dlp zipapp.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const postinstall = require.resolve('youtube-dl-exec/scripts/postinstall.js');

console.log('🔄  Downloading standalone yt-dlp (yt-dlp_linux)...');
execFileSync(process.execPath, [postinstall], {
  stdio: 'inherit',
  env: { ...process.env, YOUTUBE_DL_FILENAME: 'yt-dlp_linux', YOUTUBE_DL_SKIP_DOWNLOAD: '' },
  cwd: path.join(__dirname, '..'),
});
console.log('✅  Standalone yt-dlp ready.');
