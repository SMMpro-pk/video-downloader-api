const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

// Modules under test
const { isPrivateIp, validateSafeUrl } = require('../utils/security');
const { detectPlatform, isShortUrl, getSupportedPlatforms } = require('../utils/detectPlatform');
const { normalizeUrl, stripTrackingParams, ensureProtocol } = require('../utils/normalizeUrl');
const cache = require('../utils/cache');
const queue = require('../utils/queue');
const stats = require('../utils/stats');
const systemCheck = require('../utils/systemCheck');

describe('Security & SSRF Guard', () => {
  test('correctly flags private and loopback IPv4/IPv6 addresses', () => {
    assert.equal(isPrivateIp('127.0.0.1'), true);
    assert.equal(isPrivateIp('127.0.0.5'), true);
    assert.equal(isPrivateIp('10.0.0.1'), true);
    assert.equal(isPrivateIp('172.16.0.1'), true);
    assert.equal(isPrivateIp('172.31.255.255'), true);
    assert.equal(isPrivateIp('192.168.1.1'), true);
    assert.equal(isPrivateIp('169.254.169.254'), true); // Cloud metadata
    assert.equal(isPrivateIp('0.0.0.0'), true);
    assert.equal(isPrivateIp('::1'), true);
    assert.equal(isPrivateIp('fc00::1'), true);
    assert.equal(isPrivateIp('fe80::1'), true);

    // Public IPs
    assert.equal(isPrivateIp('8.8.8.8'), false);
    assert.equal(isPrivateIp('1.1.1.1'), false);
    assert.equal(isPrivateIp('142.250.190.46'), false);
  });

  test('validateSafeUrl rejects private, loopback, or invalid URLs', async () => {
    const r1 = await validateSafeUrl('http://127.0.0.1:3000/api/health');
    assert.equal(r1.ok, false);

    const r2 = await validateSafeUrl('http://localhost/secret');
    assert.equal(r2.ok, false);

    const r3 = await validateSafeUrl('http://169.254.169.254/latest/meta-data/');
    assert.equal(r3.ok, false);

    const r4 = await validateSafeUrl('file:///etc/passwd');
    assert.equal(r4.ok, false);

    const r5 = await validateSafeUrl('javascript:alert(1)');
    assert.equal(r5.ok, false);

    const r6 = await validateSafeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(r6.ok, true);
    assert.equal(r6.parsedUrl.hostname, 'www.youtube.com');

    // DNS-resolved private / loopback domains
    const r7 = await validateSafeUrl('http://127.0.0.1.nip.io/secret');
    assert.equal(r7.ok, false);
  });
});

describe('Platform Detection', () => {
  test('rejects platform spoofing via query params, hash or path', () => {
    assert.equal(detectPlatform('https://attacker.com/watch?fake=youtube.com'), null);
    assert.equal(detectPlatform('https://attacker.com/instagram.com/reel/123'), null);
    assert.equal(detectPlatform('https://attacker.com/#tiktok.com'), null);
  });

  test('detects major video platforms correctly', () => {
    assert.equal(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.name, 'youtube');
    assert.equal(detectPlatform('https://youtu.be/dQw4w9WgXcQ')?.name, 'youtube');
    assert.equal(detectPlatform('https://www.tiktok.com/@tiktok/video/12345')?.name, 'tiktok');
    assert.equal(detectPlatform('https://www.instagram.com/reel/C5_8Q9_O8nU/')?.name, 'instagram');
    assert.equal(detectPlatform('https://twitter.com/user/status/12345')?.name, 'twitter');
    assert.equal(detectPlatform('https://x.com/user/status/12345')?.name, 'twitter');
    assert.equal(detectPlatform('https://www.facebook.com/watch/?v=12345')?.name, 'facebook');
    assert.equal(detectPlatform('https://bsky.app/profile/user.bsky.social/post/123')?.name, 'bluesky');
    assert.equal(detectPlatform('https://www.xiaohongshu.com/discovery/item/123')?.name, 'xiaohongshu');
    assert.equal(detectPlatform('https://www.kuaishou.com/short-video/123')?.name, 'kuaishou');
  });

  test('identifies short URLs needing redirect resolution', () => {
    assert.equal(isShortUrl('https://youtu.be/dQw4w9WgXcQ'), true);
    assert.equal(isShortUrl('https://vm.tiktok.com/ZM8abc/'), true);
    assert.equal(isShortUrl('https://t.co/xyz123'), true);
    assert.equal(isShortUrl('https://bit.ly/video1'), true);
    assert.equal(isShortUrl('https://xhslink.com/abc'), true);
    assert.equal(isShortUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), false);
  });

  test('getSupportedPlatforms returns list of platforms with descriptions', () => {
    const list = getSupportedPlatforms();
    assert.ok(list.length >= 50);
    const yt = list.find((p) => p.name === 'youtube');
    assert.ok(yt);
    assert.ok(yt.description.includes('YouTube'));
  });
});

describe('URL Normalization', () => {
  test('strips tracking and analytics parameters', () => {
    const raw = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=tracking123&utm_source=share';
    const cleaned = stripTrackingParams(raw);
    assert.equal(cleaned, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  test('ensures protocol is added if missing', () => {
    assert.equal(ensureProtocol('youtube.com/watch?v=123'), 'https://youtube.com/watch?v=123');
    assert.equal(ensureProtocol('//youtube.com/watch?v=123'), 'https://youtube.com/watch?v=123');
    assert.equal(ensureProtocol('http://youtube.com/watch?v=123'), 'http://youtube.com/watch?v=123');
  });

  test('normalizeUrl handles protocol, tracking params, and shorteners', async () => {
    const res = await normalizeUrl('https://youtu.be/dQw4w9WgXcQ?si=test&utm_medium=social');
    assert.ok(res.resolvedUrl.startsWith('https://'));
    assert.equal(res.resolvedUrl.includes('utm_medium'), false);
  });
});

describe('In-Memory Cache', () => {
  test('set, get, has, del, clear, and stats work properly', () => {
    cache.clear();
    assert.equal(cache.get('test_key'), null);
    assert.equal(cache.has('test_key'), false);

    cache.set('test_key', { title: 'Test Video' });
    assert.equal(cache.has('test_key'), true);
    assert.deepEqual(cache.get('test_key'), { title: 'Test Video' });

    const statsData = cache.stats();
    assert.equal(statsData.activeEntries, 1);

    cache.del('test_key');
    assert.equal(cache.has('test_key'), false);

    cache.set('k1', { val: 1 });
    cache.set('k2', { val: 2 });
    assert.equal(cache.stats().activeEntries, 2);
    cache.clear();
    assert.equal(cache.stats().activeEntries, 0);
  });
});

describe('Concurrency Queue', () => {
  test('limits concurrent tasks and executes all', async () => {
    let running = 0;
    let maxObserved = 0;

    const task = () =>
      queue.run(
        () =>
          new Promise((resolve) => {
            running++;
            maxObserved = Math.max(maxObserved, running);
            setTimeout(() => {
              running--;
              resolve();
            }, 30);
          })
      );

    await Promise.all([task(), task(), task(), task(), task(), task()]);
    assert.ok(maxObserved <= queue.MAX_CONCURRENT);
    assert.equal(queue.active(), 0);
    assert.equal(queue.pending(), 0);
  });
});

describe('Stats Tracker', () => {
  test('tracks requests, cache hits/misses, and platform counts', () => {
    stats.trackRequest('youtube');
    stats.trackRequest('youtube');
    stats.trackRequest('tiktok');
    stats.trackCacheHit();
    stats.trackCacheMiss();

    const currentStats = stats.getStats();
    assert.ok(currentStats.requestsToday >= 3);
    assert.ok(currentStats.cacheHitsToday >= 1);
    assert.ok(currentStats.cacheMissesToday >= 1);
    assert.equal(currentStats.topPlatform, 'youtube');
  });
});

describe('System Diagnostic Checks', () => {
  test('all required system dependencies pass', () => {
    const res = systemCheck.runAll();
    assert.equal(res.allOk, true);
    assert.equal(res.failed, 0);
    assert.ok(res.passed >= 7);
  });
});

describe('HTTP API Endpoints Integration', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api', require('../routes/download'));

  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/platforms returns platform list', async () => {
    const res = await fetch(`${baseUrl}/api/platforms`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.count >= 50);
  });

  test('GET /api/version returns version info', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.version, '3.2.0');
  });

  test('GET and POST /api/check detect platforms correctly', async () => {
    const getRes = await fetch(`${baseUrl}/api/check?url=https://youtu.be/dQw4w9WgXcQ`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.success, true);
    assert.equal(getData.platform, 'youtube');

    const postRes = await fetch(`${baseUrl}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.tiktok.com/@test/video/12345' }),
    });
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.success, true);
    assert.equal(postData.platform, 'tiktok');
  });

  test('POST /api/batch validates input properly', async () => {
    const badRes = await fetch(`${baseUrl}/api/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(badRes.status, 400);
    const badData = await badRes.json();
    assert.equal(badData.errorCode, 'MISSING_URLS');
  });

  test('GET /api/stream rejects SSRF target URLs', async () => {
    const res = await fetch(`${baseUrl}/api/stream?url=http://127.0.0.1:8080/secret.mp4`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.errorCode, 'INVALID_MEDIA_URL');
  });
});

describe('Instagram & Error Handling', () => {
  const extractVideo = require('../utils/extractVideo');

  test('correctly classifies Instagram empty media response as LOGIN_REQUIRED', () => {
    const stderr = 'ERROR: [Instagram] C5_8Q9_O8nU: Instagram sent an empty media response. Check if this post is accessible in your browser without being logged-in.';
    const classified = extractVideo.classifyError(stderr);
    assert.equal(classified.code, 'LOGIN_REQUIRED');
    assert.ok(classified.message.includes('Instagram requires authentication or session cookies'));
  });

  test('correctly classifies Instagram checkpoint verification', () => {
    const stderr = 'ERROR: [Instagram] checkpoint_required: Please confirm your account';
    const classified = extractVideo.classifyError(stderr);
    assert.equal(classified.code, 'BOT_VERIFICATION_REQUIRED');
  });

  test('classifies timeout and challenge errors properly', () => {
    assert.equal(extractVideo.classifyError('Request timed out').code, 'EXTRACTION_TIMEOUT');
    assert.equal(extractVideo.classifyError('YouTube said: please provide po-token').code, 'BOT_VERIFICATION_REQUIRED');
  });

  test('resolveCookiesFile returns null when no cookies exist', () => {
    delete process.env.YTDLP_COOKIES_FILE;
    delete process.env.COOKIES_PATH;
    delete process.env.YTDLP_COOKIES_CONTENT;
    assert.equal(typeof extractVideo.resolveCookiesFile, 'function');
  });

  test('root index.js exports the express application for serverless/Vercel', () => {
    const rootApp = require('../index');
    assert.equal(typeof rootApp, 'function');
    assert.equal(typeof rootApp.use, 'function');
    assert.equal(typeof rootApp.get, 'function');
  });
});


