import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

// Standalone yt-dlp build (embeds Python) fetched at build time by scripts/fetch-ytdlp-standalone.js
const YTDLP_FILENAME = 'yt-dlp_linux';

let serverPromise;

// Netlify Functions ship a read-only filesystem and no Python, so point the app at /tmp
// and at the standalone yt-dlp binary before any app module is loaded.
function prepareEnvironment(context) {
  process.env.NETLIFY = 'true';
  process.env.LOG_DIR = process.env.LOG_DIR || '/tmp/logs';
  if (!process.env.URL && context?.site?.url) process.env.URL = context.site.url;

  const bundledDir = path.join(path.dirname(require.resolve('youtube-dl-exec/package.json')), 'bin');
  const bundledBin = path.join(bundledDir, YTDLP_FILENAME);
  if (!fs.existsSync(bundledBin)) return;

  process.env.YOUTUBE_DL_FILENAME = YTDLP_FILENAME;
  try {
    fs.accessSync(bundledBin, fs.constants.X_OK);
    process.env.YOUTUBE_DL_DIR = bundledDir;
  } catch {
    // Execute bit lost during packaging — copy into /tmp and restore it
    const tmpBin = path.join('/tmp', YTDLP_FILENAME);
    if (!fs.existsSync(tmpBin)) {
      fs.copyFileSync(bundledBin, tmpBin);
      fs.chmodSync(tmpBin, 0o755);
    }
    process.env.YOUTUBE_DL_DIR = '/tmp';
  }
}

// Boot the Express app once per function instance on a local port and proxy requests to it
function startServer(context) {
  if (!serverPromise) {
    serverPromise = new Promise((resolve, reject) => {
      prepareEnvironment(context);
      const app = require('../../index.js');
      const server = app.listen(0, '127.0.0.1', () => resolve(server.address().port));
      server.on('error', reject);
    }).catch((err) => {
      serverPromise = undefined;
      throw err;
    });
  }
  return serverPromise;
}

export default async (req, context) => {
  const port = await startServer(context);
  const url = new URL(req.url);

  const headers = new Headers(req.headers);
  headers.set('x-forwarded-for', context.ip || headers.get('x-forwarded-for') || '');
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
  headers.set('x-forwarded-host', url.host);

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const upstream = await fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
};

export const config = {
  path: '/*',
};
