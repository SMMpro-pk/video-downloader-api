# SMMPro Video Downloader API

All-in-one backend API to download videos from **50+ social media platforms** using a single endpoint. Supports **every URL type** — short URLs, mobile URLs, regional domains, CDN links, and custom domains via environment variables.

**Key features:** Fast preview endpoint (`/api/info`), format limiting (best N qualities), 3-step fallback extraction with retries, concurrency queue protection, API key authentication, detailed error codes, daily usage stats, in-memory caching with auto-eviction, yt-dlp auto-updates, security headers, graceful shutdown, and a live system status dashboard.

Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and Node.js.

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?name=video-downloader-api&type=git&repository=SMMpro-pk%2Fvideo-downloader-api&branch=main&builder=dockerfile&instance_type=free&regions=fra&instances_min=0&autoscaling_sleep_idle_delay=3900)

---

## ⚡ 1-Click Cloud Deployment

### Koyeb (Free Tier & Docker Builder)

Click the button below to deploy immediately to Koyeb with zero configuration:

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?name=video-downloader-api&type=git&repository=SMMpro-pk%2Fvideo-downloader-api&branch=main&builder=dockerfile&instance_type=free&regions=fra&instances_min=0&autoscaling_sleep_idle_delay=3900)

---

### Vercel (Serverless)

```bash
# Clone and deploy
git clone https://github.com/SMMpro-pk/video-downloader-api.git
cd video-downloader-api
vercel
```

Or use **Vercel Dashboard** → **Add New Project** → Select GitHub repo → **Deploy**.

After deployment, get your API key:
```bash
curl https://your-app.vercel.app/api/deploy-info
```

➜ **[Full Deployment Guide & More Platforms →](./DEPLOYMENT.md)**

---

## Table of Contents

- [Supported Platforms (53)](#supported-platforms-53)
- [Supported URL Types Per Platform](#supported-url-types-per-platform)
- [Generic URL Shorteners (Auto-Resolved)](#generic-url-shorteners-auto-resolved)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Authentication](#api-authentication)
- [API Endpoints](#api-endpoints)
- [cURL Examples](#curl-examples)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [System Status Dashboard](#system-status-dashboard)
- [Caching](#caching)
- [Extraction Fallback Logic](#extraction-fallback-logic)
- [Error Codes](#error-codes)
- [Logging](#logging)
- [Security](#security)
- [yt-dlp Auto-Updates](#yt-dlp-auto-updates)
- [Platform Support Notes](#platform-support-notes)
- [Cloud Hosting](#cloud-hosting)
- [Changelog](#changelog)
- [License](#license)

---

## Supported Platforms (53)

| #  | Platform         | URL Types Supported |
|----|------------------|---------------------|
| 1  | YouTube          | youtube.com, youtu.be, m.youtube.com, music.youtube.com, youtube-nocookie.com, yt.be |
| 2  | Facebook         | facebook.com, m.facebook.com, fb.watch, fb.com, fb.gg, web.facebook.com, touch.facebook.com, mbasic.facebook.com, l.facebook.com |
| 3  | Instagram        | instagram.com, m.instagram.com, instagr.am, ig.me, ddinstagram.com |
| 4  | TikTok           | tiktok.com, m.tiktok.com, vm.tiktok.com, vt.tiktok.com, t.tiktok.com, lite.tiktok.com, musical.ly |
| 5  | Twitter / X      | twitter.com, x.com, m.twitter.com, mobile.twitter.com, t.co, nitter.net |
| 6  | Vimeo            | vimeo.com, player.vimeo.com, vimeopro.com |
| 7  | Pinterest        | pinterest.com, pin.it, pinterest.co.uk, pinterest.de, pinterest.fr + 15 regional |
| 8  | Dailymotion      | dailymotion.com, m.dailymotion.com, dai.ly |
| 9  | Reddit           | reddit.com, old.reddit.com, m.reddit.com, v.redd.it, redd.it, new.reddit.com |
| 10 | LinkedIn         | linkedin.com, m.linkedin.com, lnkd.in |
| 11 | Snapchat         | snapchat.com, story.snapchat.com, t.snapchat.com, snap.com, play.snapchat.com |
| 12 | Twitch           | twitch.tv, clips.twitch.tv, m.twitch.tv, player.twitch.tv |
| 13 | Tumblr           | tumblr.com, tmblr.co, t.umblr.com |
| 14 | Bilibili         | bilibili.com, m.bilibili.com, b23.tv, bilibili.tv |
| 15 | SoundCloud       | soundcloud.com, m.soundcloud.com, on.soundcloud.com |
| 16 | Bandcamp         | bandcamp.com, *.bandcamp.com |
| 17 | Rumble           | rumble.com |
| 18 | Likee            | likee.video, l.likee.video, likee.com |
| 19 | TED              | ted.com, embed.ted.com |
| 20 | OK.ru            | ok.ru, m.ok.ru |
| 21 | VKontakte        | vk.com, m.vk.com, vkvideo.ru, vk.cc, vk.me |
| 22 | Threads          | threads.net |
| 23 | CapCut           | capcut.com |
| 24 | Douyin           | douyin.com, v.douyin.com, iesdouyin.com |
| 25 | Kwai             | kwai.com, m.kwai.com, kw.ai, s.kw.ai |
| 26 | Loom             | loom.com |
| 27 | Streamable       | streamable.com |
| 28 | BitChute         | bitchute.com, old.bitchute.com |
| 29 | Izlesene         | izlesene.com |
| 30 | IMDb             | imdb.com, m.imdb.com |
| 31 | WhatsApp         | whatsapp.com, wa.me, web.whatsapp.com |
| 32 | Telegram         | telegram.org, t.me, telegram.me |
| 33 | Spotify          | open.spotify.com, spotify.com, spoti.fi |
| 34 | Aparat           | aparat.com |
| 35 | Odysee / LBRY    | odysee.com, lbry.tv |
| 36 | Rutube           | rutube.ru |
| 37 | Mixcloud         | mixcloud.com |
| 38 | Triller          | triller.co, v.triller.co |
| 39 | Kick             | kick.com |
| 40 | Clapper          | clapperapp.com |
| 41 | Chingari         | chingari.io |
| 42 | Josh             | myjosh.in, share.myjosh.in |
| 43 | Moj              | mojapp.in |
| 44 | MX TakaTak       | mxtakatak.com |
| 45 | Coub             | coub.com |
| 46 | Vidio            | vidio.com |
| 47 | Naver TV         | tv.naver.com |
| 48 | Weibo            | weibo.com, m.weibo.cn, video.weibo.com |
| 49 | Niconico         | nicovideo.jp, nico.ms |
| 50 | V LIVE           | vlive.tv |
| 51 | PeerTube         | joinpeertube.org + federated instances |
| 52 | Veoh             | veoh.com |
| 53 | Metacafe         | metacafe.com |

> **Plus:** Any URL supported by [yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) (1,800+ sites) works even if not listed above.

---

## Supported URL Types Per Platform

Every platform supports **multiple URL formats**. The API auto-detects all of them:

### YouTube
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ                         <- short URL
https://m.youtube.com/watch?v=dQw4w9WgXcQ             <- mobile
https://music.youtube.com/watch?v=dQw4w9WgXcQ         <- YouTube Music
https://youtube-nocookie.com/embed/dQw4w9WgXcQ        <- embed / privacy
https://youtube.com/shorts/dQw4w9WgXcQ                <- Shorts
```

### Facebook
```
https://www.facebook.com/watch/?v=123456
https://www.facebook.com/user/videos/123456
https://fb.watch/abcdef/                               <- short URL
https://fb.com/video/123456
https://m.facebook.com/story.php?id=123                <- mobile
https://web.facebook.com/watch/?v=123                  <- web variant
https://www.facebook.com/reel/123456                   <- Reels
https://fb.gg/v/abcdef                                 <- gaming
```

### Instagram
```
https://www.instagram.com/reel/ABC123/
https://www.instagram.com/p/ABC123/                    <- post
https://www.instagram.com/stories/user/123             <- stories
https://instagr.am/p/ABC123/                           <- short domain
https://ig.me/ABC123                                   <- short URL
https://m.instagram.com/reel/ABC123/                   <- mobile
https://www.instagram.com/tv/ABC123/                   <- IGTV
```

### TikTok
```
https://www.tiktok.com/@user/video/123456
https://vm.tiktok.com/ZMxxxxxx/                        <- short URL (most common)
https://vt.tiktok.com/ZSxxxxxx/                        <- short URL variant
https://t.tiktok.com/xxxxxx                            <- short URL
https://m.tiktok.com/@user/video/123456                <- mobile
https://lite.tiktok.com/@user/video/123456             <- lite app
```

### Twitter / X
```
https://twitter.com/user/status/123456
https://x.com/user/status/123456                       <- X rebrand
https://t.co/AbCdEfGhIj                               <- short URL (auto-resolved)
https://mobile.twitter.com/user/status/123456          <- mobile
https://nitter.net/user/status/123456                  <- Nitter mirror
```

### Reddit
```
https://www.reddit.com/r/videos/comments/abc123/
https://old.reddit.com/r/videos/comments/abc123/       <- old Reddit
https://v.redd.it/abcdef123                            <- short video URL
https://redd.it/abc123                                 <- short URL
https://m.reddit.com/r/videos/comments/abc123/         <- mobile
```

### Pinterest
```
https://www.pinterest.com/pin/123456/
https://pin.it/AbCdEfG                                <- short URL
https://pinterest.co.uk/pin/123456/                    <- UK domain
https://pinterest.de/pin/123456/                       <- German domain
https://br.pinterest.com/pin/123456/                   <- Brazil
```

### LinkedIn
```
https://www.linkedin.com/posts/activity-123456
https://lnkd.in/aBcDeFg                               <- short URL
https://m.linkedin.com/posts/activity-123456           <- mobile
```

### More Short URLs (all auto-resolved)
```
https://dai.ly/x8abc                                   <- Dailymotion
https://tmblr.co/abc123                                <- Tumblr
https://b23.tv/abc123                                  <- Bilibili
https://vk.cc/abc123                                   <- VK
https://kw.ai/abc123                                   <- Kwai
https://nico.ms/sm12345                                <- Niconico
https://wa.me/status/123                               <- WhatsApp
https://t.me/channel/123                               <- Telegram
https://spoti.fi/abc123                                <- Spotify
https://on.soundcloud.com/abc                          <- SoundCloud
https://story.snapchat.com/s/abc123                    <- Snapchat
```

---

## Generic URL Shorteners (Auto-Resolved)

The API automatically follows redirects from these shortener services to find the real video URL:

`bit.ly` - `tinyurl.com` - `goo.gl` - `ow.ly` - `is.gd` - `buff.ly` - `tiny.cc` - `rb.gy` - `cutt.ly` - `shorturl.at` - `surl.li` - `rebrand.ly` - `t.ly` - `clck.ru` - `s.id` - and more

---

## Project Structure

```
video-downloader-api/
├── index.js                 # Express server, middleware, auth, status dashboard
├── package.json             # Dependencies & scripts
├── vercel.json              # Vercel deployment config
├── .vercelignore            # Vercel build ignore
├── Dockerfile               # Docker container config
├── .gitignore
├── .dockerignore
├── DEPLOYMENT.md            # Multi-platform deployment guide
├── VERCEL_SETUP.md          # Vercel-specific setup & config
├── routes/
│   └── download.js          # API route handlers (info, download, check, stats, version…)
├── utils/
│   ├── bootstrapConfig.js   # Auto-config & zero-env setup
│   ├── cache.js             # In-memory TTL cache with auto-expiry & eviction
│   ├── detectPlatform.js    # Platform detection (53 platforms, 300+ domains)
│   ├── extractVideo.js      # yt-dlp extraction — fallback chain, error codes, limits
│   ├── normalizeUrl.js      # Short URL resolver + tracking param cleaner
│   ├── queue.js             # Concurrency limiter (max parallel extractions)
│   ├── stats.js             # Daily request & cache-hit statistics tracker
│   └── systemCheck.js       # System dependency checker (cached, 60s TTL)
├── scripts/
│   └── update-ytdlp.js     # yt-dlp binary updater (npm run update-ytdlp)
└── logs/                    # Daily JSON log files (auto-created)
```

---

## Getting Started

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 18+     | Runtime |
| **npm**     | 9+      | Package manager |
| **Python**  | 3.7+    | Required by yt-dlp |
| **ffmpeg**  | any     | Media processing |

### Step 1 — Install Dependencies

```bash
cd video-downloader-api
npm install
```

### Step 2 — Optional Environment Configuration

No `.env` file is required.

- Startup auto-applies safe defaults.
- In production/deployment, missing `API_SECRET_KEY` is auto-generated.
- In local development, missing/placeholder key keeps auth disabled for convenience.

If you want custom values, set environment variables directly in your hosting platform (Vercel, Koyeb, Railway, Render, etc.).

### Step 3 — Start the Server

```bash
# Production
npm start

# Development (auto-restart on file changes — Node 18+)
npm run dev
```

Output:

```
🔄  Checking yt-dlp for updates…
✅  yt-dlp is up to date.
✅  Video Downloader API v3.1.0 running on http://localhost:3000
📚  Health:     GET /api/health
📚  Info:       GET /api/info?url=<video_url>
📚  Download:   GET /api/download?url=<video_url>
📚  Check URL:  GET /api/check?url=<video_url>
📚  Platforms:  GET /api/platforms
📚  Stats:      GET /api/stats
📚  Version:    GET /api/version
📚  Cache:      GET /api/cache | DELETE /api/cache
⚡  Queue:      max 3 concurrent extractions
```

---

## API Authentication

All `/api/*` endpoints (except `/api/health` and `/api/version`) require an API key whenever `API_SECRET_KEY` is set.

### Sending your API key

**Option 1 — Header (recommended):**
```bash
curl -H "x-api-key: YOUR_SECRET_KEY" "http://localhost:3000/api/download?url=..."
# OR standard Authorization Bearer header:
curl -H "Authorization: Bearer YOUR_SECRET_KEY" "http://localhost:3000/api/download?url=..."
```

**Option 2 — Query parameter:**
```bash
curl "http://localhost:3000/api/download?url=...&apikey=YOUR_SECRET_KEY"
```

### Authentication responses

**Missing key (401):**
```json
{
  "success": false,
  "errorCode": "API_KEY_MISSING",
  "error": "Missing API key. Send it as x-api-key header or ?apikey= query parameter."
}
```

**Invalid key (403):**
```json
{
  "success": false,
  "errorCode": "API_KEY_INVALID",
  "error": "Invalid API key."
}
```

### Disabling authentication

Leave `API_SECRET_KEY` empty (or use placeholder `your-secret-key-change-me`) in local development to disable authentication. In production/deployment, a missing or placeholder key is auto-generated.

### Deployment details endpoint

After startup, the API exposes:

`GET /api/deploy-info`

It returns platform, live URL, active API key, and useful endpoint URLs so deployment setup is copy-paste friendly.

### Security notes

- API key comparison uses constant-time (`crypto.timingSafeEqual`) to prevent timing attacks
- Public endpoints (`/api/health`, `/api/version`) never require a key
- The system status dashboard at `GET /` does not require a key

---

## API Endpoints

### 1. `GET /api/info?url=<video_url>` — Quick Preview

Fast metadata-only endpoint — returns title, thumbnail, duration, platform. **No download URLs.** Use this to show a preview in your frontend before loading formats.

```bash
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/info?url=https://youtu.be/dQw4w9WgXcQ"
```

**Response:**

```json
{
  "success": true,
  "cached": false,
  "processingTime": "1200ms",
  "originalUrl": "https://youtu.be/dQw4w9WgXcQ",
  "resolvedUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "wasRedirected": true,
  "platform": "youtube",
  "platformDescription": "YouTube & YouTube Music",
  "title": "Amazing Video",
  "thumbnail": "https://...jpg",
  "duration": 120,
  "durationFormatted": "2:00",
  "uploader": "user",
  "uploadDate": "20240115",
  "viewCount": 15000,
  "likeCount": 500,
  "isShortVideo": false,
  "isAudioOnly": false,
  "isLiveStream": false
}
```

---

### 2. `GET /api/download?url=<video_url>` — Full Download

Full extraction — metadata + download URLs. Returns the **best N formats** (configurable via `MAX_FORMATS`, default 10). Automatically resolves short URLs and strips tracking parameters.

```bash
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://vm.tiktok.com/ZMxxxxxx/"
```

**Response:**

```json
{
  "success": true,
  "cached": false,
  "processingTime": "2340ms",
  "originalUrl": "https://vm.tiktok.com/ZMxxxxxx/",
  "resolvedUrl": "https://www.tiktok.com/@user/video/123456",
  "wasRedirected": true,
  "platform": "tiktok",
  "platformDescription": "TikTok Videos & Slideshows",
  "title": "Amazing Video",
  "thumbnail": "https://...jpg",
  "duration": 120,
  "durationFormatted": "2:00",
  "uploader": "user",
  "uploadDate": "20240115",
  "viewCount": 15000,
  "likeCount": 500,
  "isShortVideo": false,
  "isAudioOnly": false,
  "isLiveStream": false,
  "bestQuality": "1080p",
  "qualities": ["1080p", "720p", "480p", "360p"],
  "downloads": [
    {
      "quality": "1080p",
      "format": "mp4",
      "filesize": 52428800,
      "hasAudio": true,
      "url": "https://...mp4"
    }
  ],
  "audioDownloads": [
    {
      "quality": "128kbps",
      "format": "m4a",
      "filesize": 1048576,
      "url": "https://...m4a"
    }
  ]
}
```

> **Tip:** You can also call both `/api/download` and `/api/info` via `POST` with JSON body:
> ```bash
> curl -X POST -H "Content-Type: application/json" -d '{"url":"https://youtu.be/dQw4w9WgXcQ"}' http://localhost:3000/api/download
> ```

---

### 3. `POST /api/batch` — Batch Video Extraction

Extract multiple videos simultaneously in a single call (up to 10 URLs). Requests run through the concurrency queue to prevent server overloading.

```bash
curl -X POST http://localhost:3000/api/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"urls": ["https://youtu.be/dQw4w9WgXcQ", "https://vm.tiktok.com/ZM8abc/"]}'
```

**Response:**
```json
{
  "success": true,
  "total": 2,
  "successful": 2,
  "failed": 0,
  "processingTime": "3210ms",
  "results": [
    { "url": "https://youtu.be/dQw4w9WgXcQ", "success": true, "cached": true, "data": { "title": "..." } },
    { "url": "https://vm.tiktok.com/ZM8abc/", "success": true, "cached": false, "data": { "title": "..." } }
  ]
}
```

---

### 4. `GET /api/stream?url=<media_url>&filename=video.mp4` — Direct Streaming Proxy

Solves CORS restrictions, IP expiration, and hotlink referer checks on TikTok, Instagram, Twitter/X, and YouTube CDN streams. Proxies media directly to the client browser with `Range` header support (seeking & resume) and forces an attachment download.

```bash
# Direct in-browser download
<a href="/api/stream?url=https%3A%2F%2Fcdn.example.com%2Fvideo.mp4&filename=my_video.mp4">Download MP4</a>
```

---

### 5. `GET /api/check?url=<video_url>` — Check URL Platform

Quickly check which platform a URL belongs to. Resolves short URLs before detection.

```bash
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/check?url=https://vm.tiktok.com/ZMxxxxxx/"
```

```json
{
  "success": true,
  "originalUrl": "https://vm.tiktok.com/ZMxxxxxx/",
  "resolvedUrl": "https://www.tiktok.com/@user/video/123456",
  "wasRedirected": true,
  "supported": true,
  "platform": "tiktok",
  "description": "TikTok Videos & Slideshows"
}
```

---

### 6. `GET /api/platforms` — List Supported Platforms

```json
{
  "success": true,
  "count": 56,
  "platforms": [
    {
      "name": "youtube",
      "description": "YouTube & YouTube Music",
      "domains": ["youtube.com", "youtu.be", "m.youtube.com"],
      "totalDomainVariants": 12
    }
  ]
}
```

---

### 7. `GET /api/health` — Health Check (Public, No Key Required)

```json
{
  "success": true,
  "status": "running",
  "uptime": "3600s",
  "timestamp": "2026-04-19T12:00:00.000Z",
  "cache": { "totalEntries": 12, "activeEntries": 10, "maxSize": 500, "ttlMinutes": 60 },
  "queue": { "active": 1, "pending": 0, "maxConcurrent": 3 }
}
```

---

### 8. `GET /api/stats` — Daily Usage Statistics

```json
{
  "success": true,
  "date": "2026-04-19",
  "requestsToday": 1240,
  "cacheHitsToday": 340,
  "cacheMissesToday": 900,
  "topPlatform": "tiktok",
  "topPlatformRequests": 420,
  "platformBreakdown": { "tiktok": 420, "youtube": 380, "instagram": 240 },
  "queue": { "active": 2, "pending": 1, "maxConcurrent": 3 },
  "cache": { "totalEntries": 12, "activeEntries": 10, "maxSize": 500, "ttlMinutes": 60 }
}
```

---

### 9. `GET /api/version` — Version & Runtime Info (Public, No Key Required)

```json
{
  "success": true,
  "name": "smmpro-video-downloader-api",
  "version": "3.2.0",
  "node": "v20.12.0",
  "platform": "linux",
  "uptime": "3600s"
}
```

---

### 10. `GET /api/cache` — Cache Statistics

```json
{
  "success": true,
  "totalEntries": 12,
  "activeEntries": 10,
  "expiredPending": 2,
  "maxSize": 500,
  "ttlMinutes": 60
}
```

---

### 11. `DELETE /api/cache` — Clear Cache

```json
{
  "success": true,
  "message": "Cache cleared."
}
```

---

## cURL Examples

```bash
# ── Authentication (add to all non-public requests) ──
# Option A: Header
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=..."
# Option B: Query param
curl "http://localhost:3000/api/download?url=...&apikey=YOUR_KEY"

# ── YouTube ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://youtu.be/dQw4w9WgXcQ"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://youtube.com/shorts/dQw4w9WgXcQ"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://music.youtube.com/watch?v=dQw4w9WgXcQ"

# ── Facebook ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://www.facebook.com/watch/?v=123456"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://fb.watch/abcdef/"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://www.facebook.com/reel/123456"

# ── Instagram ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://www.instagram.com/reel/ABC123/"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://ig.me/ABC123"

# ── TikTok ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://www.tiktok.com/@user/video/123456"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://vm.tiktok.com/ZMxxxxxx/"

# ── Twitter / X ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://twitter.com/user/status/123456"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://x.com/user/status/123456"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://t.co/AbCdEfGhIj"

# ── Reddit ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://www.reddit.com/r/videos/comments/abc123/"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://v.redd.it/abcdef123"

# ── Pinterest ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://www.pinterest.com/pin/123456/"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://pin.it/AbCdEfG"

# ── LinkedIn ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://www.linkedin.com/posts/activity-123456"
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://lnkd.in/aBcDeFg"

# ── Snapchat ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://story.snapchat.com/s/abc123"

# ── Twitch ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://clips.twitch.tv/ExampleClip"

# ── Dailymotion ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://dai.ly/x8abc"

# ── Bilibili ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://b23.tv/abc123"

# ── VK ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://vk.com/video-123_456"

# ── Telegram ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://t.me/channel/123"

# ── SoundCloud ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://soundcloud.com/artist/track"

# ── Kick ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://kick.com/user/clips/clip_abc"

# ── Rumble ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://rumble.com/v1abc.html"

# ── Spotify (podcasts) ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://open.spotify.com/episode/abc123"

# ── Niconico ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://nico.ms/sm12345"

# ── Generic short URL (auto-resolved) ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/download?url=https://bit.ly/some-video"

# ── Quick preview (info only — no download URLs) ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/info?url=https://youtu.be/dQw4w9WgXcQ"

# ── Cache management ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/cache"
curl -H "x-api-key: YOUR_KEY" -X DELETE "http://localhost:3000/api/cache"

# ── Public endpoints (no key needed) ──
curl "http://localhost:3000/api/health"
curl "http://localhost:3000/api/version"

# ── Stats (key needed) ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/stats"

# ── List all platforms ──
curl -H "x-api-key: YOUR_KEY" "http://localhost:3000/api/platforms"
```

---

## Environment Variables

All configuration can be provided through environment variables. `.env` is optional.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `API_SECRET_KEY` | auto-generated in production | API key for authentication. Empty/placeholder disables auth in local dev |
| `RATE_LIMIT_MAX` | `50` | Max requests per 15-minute window per IP |
| `MAX_REDIRECTS` | `10` | Max redirect hops when resolving short URLs |
| `REDIRECT_TIMEOUT` | `8000` | Timeout per redirect hop in ms |
| `CACHE_TTL_MINUTES` | `60` | Minutes to keep cached results before auto-delete |
| `CACHE_MAX_SIZE` | `500` | Max cached entries before oldest are evicted |
| `MAX_CONCURRENT` | `3` | Max parallel yt-dlp extractions (queue protection) |
| `MAX_VIDEO_DURATION` | `7200` | Max video duration in seconds (2h). Rejects longer videos |
| `MAX_FILE_SIZE_MB` | `500` | Max file size in MB. Larger formats are excluded from results |
| `MAX_FORMATS` | `10` | Max download formats returned per request (best N) |
| `EXTRA_DOMAINS` | _(empty)_ | Add custom platform domains (see below) |

### Adding Custom Domains

Add platform domains without touching code:

```env
# Format: platformname:domain1,domain2;platformname2:domain3
EXTRA_DOMAINS=youtube:invidious.io,piped.video;tiktok:tikwm.com;mycustom:example.com
```

- Adds domains to an **existing** platform (e.g. `youtube:invidious.io`)
- Or creates a **new** platform entry (e.g. `mycustom:example.com`)
- Changes take effect on server restart

---

## Docker Deployment

### Build & Run

```bash
# Build
docker build -t video-downloader-api .

# Run
docker run -d -p 3000:3000 --name video-dl video-downloader-api

# Run with custom env vars
docker run -d -p 3000:3000 \
  -e API_SECRET_KEY=my-production-key \
  -e RATE_LIMIT_MAX=100 \
  -e EXTRA_DOMAINS="youtube:invidious.io" \
  --name video-dl video-downloader-api
```

### Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - API_SECRET_KEY=change-this-to-a-strong-key
      - RATE_LIMIT_MAX=50
      - MAX_REDIRECTS=10
      - MAX_CONCURRENT=3
      - MAX_VIDEO_DURATION=7200
      - MAX_FILE_SIZE_MB=500
      - MAX_FORMATS=10
      - CACHE_TTL_MINUTES=60
      - CACHE_MAX_SIZE=500
      - EXTRA_DOMAINS=
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

### What the Docker image includes

- Node.js 20 (slim)
- Python 3, ffmpeg, ca-certificates
- yt-dlp updated at build time
- Health check built in (every 30s)

---

## System Status Dashboard

Visit `GET /` in your browser to see a live system status page showing:

- Server uptime, Node.js version, API version
- Cache statistics (entries, hit rate)
- Queue status (active/pending extractions)
- Dependency checks: Node.js, npm, Python, ffmpeg, yt-dlp, express, logs/
- Fix hints for any missing dependencies

The dashboard **does not require an API key**. System check results are cached for 60 seconds to avoid blocking the server with repeated `execSync` calls.

If any dependency is missing, the dashboard returns HTTP 503 with fix instructions.

---

## Caching

Built-in in-memory cache — zero dependencies, no Redis required.

### How it works

1. When a URL is requested, the result is stored in memory
2. Subsequent requests for the **same URL** return the cached result instantly (< 5ms)
3. After the TTL expires (default 60 min), the entry is **automatically deleted**
4. A background sweep runs every 60 seconds to purge expired entries
5. If the cache exceeds `CACHE_MAX_SIZE` (default 500), the oldest entry is evicted

### Response indicator

Every `/api/download` and `/api/info` response includes a `cached` field:

```json
{ "cached": true, "processingTime": "2ms" }
{ "cached": false, "processingTime": "2340ms" }
```

### Configuration

```env
CACHE_TTL_MINUTES=60    # TTL in minutes. Set to 0 to disable caching.
CACHE_MAX_SIZE=500      # Max entries before eviction
```

### Management endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cache` | View cache statistics |
| DELETE | `/api/cache` | Flush entire cache |

---

## Extraction Fallback Logic

When a video fails to extract, the API automatically retries with different strategies:

```
1. Native extractor      ->  platform-specific (e.g. YouTube, TikTok)
2. Retry once            ->  same options, second attempt
3. Generic extractor     ->  yt-dlp --force-generic-extractor
4. Return detailed error ->  VIDEO_PRIVATE, GEO_RESTRICTED, etc.
```

This dramatically improves success rates for flaky or rate-limited platforms.

---

## Error Codes

Every error response includes a machine-readable `errorCode`:

| Error Code | HTTP | Description |
|------------|------|-------------|
| `MISSING_URL` | 400 | No `url` query parameter provided |
| `INVALID_URL` | 400 | Not a valid HTTP/HTTPS URL |
| `PLATFORM_UNSUPPORTED` | 400 | URL not recognized by yt-dlp |
| `VIDEO_PRIVATE` | 403 | Video is set to private |
| `LOGIN_REQUIRED` | 403 | Platform requires authentication |
| `GEO_RESTRICTED` | 403 | Video blocked in your region |
| `VIDEO_REMOVED` | 410 | Video has been taken down |
| `VIDEO_TOO_LONG` | 413 | Duration exceeds `MAX_VIDEO_DURATION` |
| `RATE_LIMITED_BY_PLATFORM` | 429 | Platform is throttling requests |
| `RATE_LIMITED` | 429 | API rate limit exceeded (try again in 15 min) |
| `API_KEY_MISSING` | 401 | No API key provided |
| `API_KEY_INVALID` | 403 | Wrong API key |
| `EXTRACTION_FAILED` | 500 | Generic failure — URL may be broken or expired |
| `ROUTE_NOT_FOUND` | 404 | Wrong endpoint |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

**Example:**

```json
{
  "success": false,
  "errorCode": "GEO_RESTRICTED",
  "error": "This video is not available in your country."
}
```

---

## Logging

Daily JSON log files in `logs/`:

```json
{
  "timestamp": "2026-04-19T12:00:00.000Z",
  "level": "info",
  "message": "Extraction started",
  "originalUrl": "https://vm.tiktok.com/ZMxxxxxx/",
  "resolvedUrl": "https://www.tiktok.com/@user/video/123456",
  "wasRedirected": true,
  "platform": "tiktok"
}
```

Log levels: `info`, `warn`, `error`. Warnings and errors are printed to the console. Log files auto-create in the `logs/` directory.

---

## Security

| Feature | Description |
|---------|-------------|
| **API key authentication** | Constant-time comparison (`crypto.timingSafeEqual`) prevents timing attacks |
| **Rate limiting** | Configurable per-IP limit (default 50 req / 15 min) |
| **Security headers** | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy` |
| **Request body limit** | JSON and URL-encoded bodies limited to 1 MB |
| **XSS prevention** | All user-supplied data HTML-escaped in the status dashboard |
| **No `x-powered-by`** | Express fingerprint header disabled |
| **TLS certificate validation** | Enforced on all yt-dlp requests (no `--no-check-certificates`) |
| **Request caching** | In-memory with auto-eviction — no data persisted to disk |
| **Queue protection** | Max parallel extractions (default 3) — prevents resource exhaustion |
| **Size limits** | Videos exceeding duration/size limits are rejected |
| **URL validation** | Only `http://` and `https://` URLs accepted |
| **Short URL resolution** | Follows redirects with timeout + hop limit |
| **Tracking param removal** | Strips UTM, fbclid, igshid, etc. automatically |
| **Graceful shutdown** | SIGTERM/SIGINT handlers close connections cleanly with 10s timeout |
| **Crash prevention** | `unhandledRejection` and `uncaughtException` handlers |
| **CORS enabled** | Callable from any frontend |

---

## yt-dlp Auto-Updates

Social platforms frequently change their APIs, breaking extraction. Keep yt-dlp updated:

```bash
# Manual update
npm run update-ytdlp

# The API also checks for updates automatically on startup
```

The updater tries:
1. `yt-dlp -U` (direct binary update)
2. Falls back to `npm install youtube-dl-exec@latest` (full reinstall)

---

## Platform Support Notes

Not all platforms are equal. Important limitations:

| Platform | Note |
|----------|------|
| **Instagram** | Stories/Reels may require cookies for full quality |
| **Facebook** | Private videos require login cookies |
| **TikTok** | Some regions return watermarked video without cookies |
| **Twitter/X** | DM videos are not accessible |
| **Spotify** | Only podcast episodes — music tracks are DRM-protected |
| **SoundCloud** | Audio-only platform — `isAudioOnly: true` in response |
| **Bandcamp** | Audio-only — may need cookies for paid tracks |
| **Bilibili** | Higher qualities may require login |
| **LinkedIn** | Only public videos — login required for private posts |
| **Snapchat** | Only public stories — private snaps not accessible |
| **Telegram** | Only public channel videos |
| **Twitch** | VODs may require subscriber cookies |
| **VK** | Some videos are age-restricted — login needed |
| **Niconico** | Premium content requires login cookies |

### Using cookies (advanced)

For platforms that require login, you can pass cookies to yt-dlp:

1. Export cookies from your browser using a cookies.txt extension
2. Place the file at `cookies.txt` in the project root
3. yt-dlp will automatically detect and use it

---

## Cloud Hosting

Deploy on any platform with zero configuration. Choose based on your needs:

| Provider | Free Tier | Setup | Best For | Docs |
|----------|-----------|-------|----------|------|
| **Vercel** ⭐ | Yes | 30 sec | Easiest, Node.js optimized | [VERCEL_SETUP.md](./VERCEL_SETUP.md) |
| **Railway** | Yes | 2 min | Simple Git auto-deploy | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **Render** | Yes | 3 min | Auto-deploy from Git | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **Koyeb** | Yes | 2 min | Global edge, auto-scale | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **Fly.io** | Yes | 3 min | Low latency worldwide | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **DigitalOcean** | $5/mo | 5 min | Full control, Docker | [DEPLOYMENT.md](./DEPLOYMENT.md) |

### Recommended: Vercel

For Node.js APIs, **Vercel is the easiest:**
- Zero configuration (detects Node.js automatically)
- Auto-generates API key on deploy
- Shows live URL + key in response
- Built-in HTTPS, CDN, analytics
- Free for small projects

**Deploy in 30 seconds:**
```bash
vercel
```

Or use **Vercel Dashboard** → **Add Project** → Select GitHub repo → **Deploy**

➜ See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed guide

---

## Changelog

### v3.1.0 — Audit & Hardening
- **Security:** Moved `crypto` import to top level (was inline per-request)
- **Security:** Added security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)
- **Security:** Added request body size limit (1 MB)
- **Security:** Disabled `x-powered-by` header
- **Security:** HTML-escaped all user-supplied data in status dashboard (XSS fix)
- **Security:** Removed `noCheckCertificates: true` from yt-dlp options (certificate validation now enforced)
- **Security:** Removed user input reflection in 404 error messages
- **Stability:** Added graceful shutdown (SIGTERM/SIGINT handlers with 10s timeout)
- **Stability:** Added `unhandledRejection` and `uncaughtException` handlers
- **Stability:** System check results now cached for 60s (was running `execSync` on every dashboard request)
- **Stability:** Warn-level log messages now output to console (was silent)
- **Cleanup:** Removed unused `KNOWN_SHORTENERS` import from routes
- **Cleanup:** Removed unused `binDir` variable from auto-update
- **Cleanup:** Removed duplicate `require('./package.json')` calls
- **Infra:** Removed required `.env` setup (environment-only config supported)
- **Infra:** Improved `.dockerignore` (excludes node_modules, .git, README)
- **Infra:** Fixed `.gitignore` pattern (`logs/` instead of `logs/*.log`)
- **Docs:** Complete README rewrite with table of contents, auth section, security table, changelog

### v3.0.0 — Major Feature Release
- API key authentication with constant-time comparison
- System status dashboard at `GET /`
- `/api/info` endpoint (fast preview)
- `/api/stats` endpoint (daily usage)
- `/api/version` endpoint
- Format limiting, size limits, queue protection
- 3-step fallback extraction with error classification
- In-memory caching with TTL and auto-eviction
- 53 platforms, 300+ domain variants
- Short URL resolution + tracking param removal
- yt-dlp auto-updater

---

## License

MIT
