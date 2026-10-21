# SMMPro Video Downloader API — Developer Integration Guide

A complete, production-ready integration guide for integrating the **SMMPro Video Downloader API** into web applications, mobile apps, SaaS platforms, CMS plugins (WordPress), and backend services.

---

## Table of Contents

1. [Quick Start & Architecture](#1-quick-start--architecture)
2. [Authentication](#2-authentication)
3. [Core Integration Workflows](#3-core-integration-workflows)
   - [Workflow A: Fast Video Preview](#workflow-a-fast-video-preview)
   - [Workflow B: Video Download with Guaranteed Audio](#workflow-b-video-download-with-guaranteed-audio)
   - [Workflow C: High-Resolution (1080p / 4K) Video with Audio](#workflow-c-high-resolution-1080p--4k-video-with-audio)
   - [Workflow D: Pure Audio / MP3 Extraction](#workflow-d-pure-audio--mp3-extraction)
   - [Workflow E: Batch URL Extraction](#workflow-e-batch-url-extraction)
   - [Workflow F: In-Browser HTML5 Video/Audio Playback](#workflow-f-in-browser-html5-videoaudio-playback)
4. [Understanding Media Formats & CDN Protections](#4-understanding-media-formats--cdn-protections)
   - [Muxed vs. DASH Video-Only Tracks](#muxed-vs-dash-video-only-tracks)
   - [CORS, IP Binding & 403 Forbidden Solutions](#cors-ip-binding--403-forbidden-solutions)
   - [`url` vs `streamUrl` vs `mergedStreamUrl`](#url-vs-streamurl-vs-mergedstreamurl)
5. [Code Examples by Language & Framework](#5-code-examples-by-language--framework)
   - [JavaScript / TypeScript (Browser / Fetch)](#javascript--typescript-browser--fetch)
   - [React / Next.js Hook & Component](#react--nextjs-hook--component)
   - [Node.js / Express](#nodejs--express)
   - [Python (Requests)](#python-requests)
   - [PHP / cURL](#php--curl)
   - [Go](#go)
6. [Error Handling & Status Codes](#6-error-handling--status-codes)
7. [Production Best Practices & Concurrency](#7-production-best-practices--concurrency)

---

## 1. Quick Start & Architecture

The API operates on a 2-stage or 1-stage model depending on your frontend UX requirements:

```
[User Pastes URL]
       │
       ▼
 [Stage 1: Preview] ──► GET /api/info?url=...
       │                (Instant title, thumbnail, duration, author)
       ▼
 [Stage 2: Options] ──► GET /api/download?url=...
       │                (Parses resolutions, muxed streams, audio formats)
       │
       ├─► Direct CDN Link:      format.url (Fastest, direct from platform CDN)
       ├─► Proxy Stream Link:   format.streamUrl (Bypasses CORS & hotlinking)
       └─► On-the-fly Merge:    result.mergedDownloadUrl (1080p/4K with audio)
```

### Base URL

- **Local:** `http://localhost:3000`
- **Production:** e.g. `https://your-api.koyeb.app` or `https://your-api.vercel.app`

Test API liveness and auto-discovered configuration:
```bash
curl https://your-api-domain.com/api/deploy-info
```

---

## 2. Authentication

When `API_SECRET_KEY` is configured in your deployment environment, all media endpoints require your secret key.

### Supported Authentication Methods

You can authenticate in any of 3 ways:

#### 1. Custom HTTP Header (Recommended for backend requests):
```http
x-api-key: YOUR_SECRET_KEY
```

#### 2. Standard Authorization Bearer Header:
```http
Authorization: Bearer YOUR_SECRET_KEY
```

#### 3. URL Query Parameter (Recommended for direct browser links & downloads):
```
https://api.yourdomain.com/api/download?url=...&apikey=YOUR_SECRET_KEY
```

> **Note:** Public endpoints do **not** require an API key:
> - `GET /api/health`
> - `GET /api/version`
> - `GET /api/deploy-info`
> - `GET /` (Interactive status dashboard)

---

## 3. Core Integration Workflows

### Workflow A: Fast Video Preview

Use `/api/info` to immediately show a video card with title, author, and thumbnail without waiting for all media formats to resolve.

```http
GET /api/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
x-api-key: YOUR_SECRET_KEY
```

#### Response:
```json
{
  "success": true,
  "cached": false,
  "processingTime": "1100ms",
  "platform": "youtube",
  "title": "Rick Astley - Never Gonna Give You Up",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "duration": 213,
  "durationFormatted": "3:33",
  "uploader": "Rick Astley",
  "viewCount": 1600000000,
  "isShortVideo": false
}
```

---

### Workflow B: Video Download with Guaranteed Audio

On platforms like YouTube, formats above 720p (such as 1080p, 1440p, and 4K) are stored as separate silent video streams (DASH).

To guarantee you only get video files with **sound attached**:

```http
GET /api/download?url=https://youtu.be/dQw4w9WgXcQ&hasAudio=true
x-api-key: YOUR_SECRET_KEY
```

Or inspect the `bestVideoWithAudio` object or `muxedDownloads` array directly:

```javascript
// Access the best format that has both video and sound
const playableFormat = response.bestVideoWithAudio;
console.log(`Resolution: ${playableFormat.quality}, URL: ${playableFormat.streamUrl}`);
```

---

### Workflow C: High-Resolution (1080p / 4K) Video with Audio

When your users demand 1080p, 1440p, or 4K with audio from YouTube, use the on-the-fly streaming merger:

1. **Direct merged URL provided in API response:**
   Use `response.mergedDownloadUrl` or each format's `format.mergedStreamUrl`.
2. **Or call `/api/stream` with `merge=true`:**
   ```
   GET /api/stream?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&merge=true&quality=1080&filename=video.mp4
   ```

The API streams the resulting video with audio directly to the browser on the fly without storing gigabytes on server disk.

---

### Workflow D: Pure Audio / MP3 Extraction

Use the dedicated `/api/audio` endpoint or request pure audio from `/api/download`:

```http
GET /api/audio?url=https://youtu.be/dQw4w9WgXcQ
x-api-key: YOUR_SECRET_KEY
```

Or direct browser one-click MP3 download:
```html
<a href="https://your-api.com/api/stream?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ&type=audio&filename=song.mp3&apikey=YOUR_KEY">
  Download MP3
</a>
```

> **Universal Compatibility:** Even if the source platform (like Instagram Reels or TikTok) only has video files, the API synthesizes and extracts audio streams automatically.

---

### Workflow E: Batch URL Extraction

Process up to 10 URLs in parallel with queue protection:

```http
POST /api/batch
Content-Type: application/json
x-api-key: YOUR_SECRET_KEY

{
  "urls": [
    "https://www.instagram.com/reel/C8...",
    "https://www.tiktok.com/@user/video/123...",
    "https://youtu.be/dQw4w9WgXcQ"
  ]
}
```

#### Response:
```json
{
  "success": true,
  "total": 3,
  "successful": 3,
  "failed": 0,
  "processingTime": "3420ms",
  "results": [
    { "url": "https://...", "success": true, "data": { "title": "...", "downloads": [...] } }
  ]
}
```

---

### Workflow F: In-Browser HTML5 Video/Audio Playback

Because the streaming proxy supports HTTP `Range` requests (byte-range seeking), you can stream media directly inside HTML5 `<video>` or `<audio>` elements:

```html
<video controls width="640" poster="https://...thumbnail.jpg">
  <!-- Use streamUrl so seeking and pause/resume work seamlessly -->
  <source src="https://your-api.com/api/stream?url=https%3A%2F%2F...&filename=preview.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
```

---

## 4. Understanding Media Formats & CDN Protections

### Muxed vs. DASH Video-Only Tracks

| Category | Field Name | Description | Sound Included? |
|---|---|---|---|
| **Muxed Streams** | `muxedDownloads` | Standard video with embedded audio (usually up to 720p or 1080p on TikTok/IG). | ✅ Yes |
| **Video-Only (DASH)** | `videoOnlyDownloads` | High-res streams (1080p, 1440p, 4K) hosted separately on CDNs without audio. | ❌ No |
| **On-the-Fly Merged** | `mergedDownloadUrl` | Merges high-res video track + audio track on-the-fly via streaming proxy. | ✅ Yes |
| **Audio-Only** | `audioDownloads` | Extracted or native MP3/M4A audio tracks. | 🎵 Audio Only |

### CORS, IP Binding & 403 Forbidden Solutions

Social media CDNs (Instagram `cdninstagram.com`, TikTok `tiktokcdn.com`, Twitter `twimg.com`, YouTube `googlevideo.com`) use protections that cause direct client downloads to fail:
1. **CORS Restrictions:** Browsers block requests made directly via `fetch()` or `XHR`.
2. **Missing Referer Checks:** CDNs return `403 Forbidden` if the `Referer` header does not match the source website.
3. **IP-Locked URLs:** Some CDNs bind download URLs to the IP address that queried them.

### `url` vs `streamUrl` vs `mergedStreamUrl`

Each format in `downloads` provides three URL properties:

| Property | Example Value | When to Use |
|---|---|---|
| `url` | `https://rr---sn.googlevideo.com/...` | Backend server download or direct browser download where CDN allows direct access. |
| `streamUrl` | `/api/stream?url=https%3A%2F%2F...&filename=video.mp4` | **Recommended:** In frontend `<a>` download tags, HTML5 `<video>` players, or when bypassing CORS/Referer blocks. |
| `mergedStreamUrl` | `/api/stream?url=https%3A%2F%2F...&merge=true&quality=1080...` | For high-resolution formats (1080p/4K) that require live audio merging. |

---

## 5. Code Examples by Language & Framework

### JavaScript / TypeScript (Browser / Fetch)

```javascript
const API_BASE = 'https://your-api.com';
const API_KEY = 'YOUR_SECRET_KEY';

async function fetchVideoFormats(videoUrl) {
  const params = new URLSearchParams({
    url: videoUrl,
    hasAudio: 'true', // Only return formats with sound
  });

  const response = await fetch(`${API_BASE}/api/download?${params.toString()}`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to extract video');
  }

  const data = await response.json();
  return {
    title: data.title,
    thumbnail: data.thumbnail,
    duration: data.durationFormatted,
    bestVideo: data.bestVideoWithAudio,
    formats: data.downloads,
    audioOptions: data.audioDownloads,
  };
}
```

---

### React / Next.js Hook & Component

```tsx
import React, { useState } from 'react';

interface VideoFormat {
  quality: string;
  format: string;
  filesizeFormatted?: string;
  hasAudio: boolean;
  streamUrl: string;
}

export function useVideoDownloader(apiBase: string, apiKey: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<any>(null);

  const extract = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/download?url=${encodeURIComponent(url)}`, {
        headers: { 'x-api-key': apiKey },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setVideoData(json);
    } catch (err: any) {
      setError(err.message || 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  return { extract, loading, error, videoData };
}

// Example Component
export function DownloaderWidget() {
  const [inputUrl, setInputUrl] = useState('');
  const { extract, loading, error, videoData } = useVideoDownloader('https://your-api.com', 'YOUR_KEY');

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Video Downloader</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="url"
          placeholder="Paste YouTube, TikTok, IG link..."
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button onClick={() => extract(inputUrl)} disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? 'Processing...' : 'Download'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {videoData && (
        <div style={{ marginTop: 20, border: '1px solid #ccc', padding: 15, borderRadius: 8 }}>
          <img src={videoData.thumbnail} alt={videoData.title} style={{ width: '100%', borderRadius: 6 }} />
          <h3>{videoData.title}</h3>
          <p>Duration: {videoData.durationFormatted} | Platform: {videoData.platform}</p>

          <h4>Available Qualities (with Sound):</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {videoData.muxedDownloads.map((fmt: VideoFormat, idx: number) => (
              <a
                key={idx}
                href={`https://your-api.com${fmt.streamUrl}&apikey=YOUR_KEY`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '8px 14px',
                  background: '#0070f3',
                  color: '#fff',
                  borderRadius: 4,
                  textDecoration: 'none',
                }}
              >
                {fmt.quality} ({fmt.filesizeFormatted || fmt.format.toUpperCase()})
              </a>
            ))}
            {/* Audio MP3 Download */}
            <a
              href={`https://your-api.com${videoData.audioDownloadUrl}&apikey=YOUR_KEY`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '8px 14px',
                background: '#10b981',
                color: '#fff',
                borderRadius: 4,
                textDecoration: 'none',
              }}
            >
              🎵 Audio (MP3)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Node.js / Express

```javascript
const axios = require('axios');

const API_BASE = 'https://your-api.com';
const API_KEY = process.env.VIDEO_API_KEY;

async function getVideoDownload(targetUrl) {
  try {
    const response = await axios.get(`${API_BASE}/api/download`, {
      params: { url: targetUrl, hasAudio: true },
      headers: { 'x-api-key': API_KEY },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`API Error [${error.response.data.errorCode}]: ${error.response.data.error}`);
    }
    throw error;
  }
}
```

---

### Python (Requests)

```python
import requests

API_BASE = "https://your-api.com"
API_KEY = "YOUR_SECRET_KEY"

def extract_video(url: str, has_audio_only: bool = True):
    headers = {"x-api-key": API_KEY}
    params = {
        "url": url,
        "hasAudio": "true" if has_audio_only else "false"
    }

    response = requests.get(f"{API_BASE}/api/download", headers=headers, params=params, timeout=30)
    data = response.json()

    if not data.get("success"):
        raise Exception(f"Extraction failed [{data.get('errorCode')}]: {data.get('error')}")

    print(f"Title: {data['title']}")
    print(f"Platform: {data['platform']}")
    print(f"Best Quality with Audio: {data['bestMuxedQuality']}")

    # Print download links
    for fmt in data.get("downloads", []):
        stream_link = f"{API_BASE}{fmt['streamUrl']}&apikey={API_KEY}"
        print(f"Quality: {fmt['quality']} | Format: {fmt['format']} | URL: {stream_link}")

    return data

if __name__ == "__main__":
    extract_video("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
```

---

### PHP / cURL

```php
<?php
$apiBase = "https://your-api.com";
$apiKey = "YOUR_SECRET_KEY";
$videoUrl = "https://www.tiktok.com/@user/video/123456";

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $apiBase . "/api/download?url=" . urlencode($videoUrl) . "&hasAudio=true",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "x-api-key: " . $apiKey,
        "Accept: application/json"
    ],
    CURLOPT_TIMEOUT => 30
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);

if ($httpCode === 200 && $result['success']) {
    echo "Title: " . $result['title'] . "\n";
    echo "Best Audio: " . $result['audioDownloadUrl'] . "\n";
    foreach ($result['downloads'] as $download) {
        echo "Resolution: " . $download['quality'] . " -> " . $apiBase . $download['streamUrl'] . "&apikey=" . $apiKey . "\n";
    }
} else {
    echo "Error: " . ($result['error'] ?? 'Unknown error occurred') . "\n";
}
?>
```

---

### Go

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type DownloadResponse struct {
	Success          bool   `json:"success"`
	Title            string `json:"title"`
	Platform         string `json:"platform"`
	BestMuxedQuality string `json:"bestMuxedQuality"`
	ErrorCode        string `json:"errorCode"`
	Error            string `json:"error"`
}

func GetVideo(apiBase, apiKey, targetUrl string) (*DownloadResponse, error) {
	endpoint := fmt.Sprintf("%s/api/download?url=%s&hasAudio=true", apiBase, url.QueryEscape(targetUrl))

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data DownloadResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	if !data.Success {
		return nil, fmt.Errorf("API error [%s]: %s", data.ErrorCode, data.Error)
	}

	return &data, nil
}
```

---

## 6. Error Handling & Status Codes

All errors return `success: false` and a distinct machine-readable `errorCode`:

```json
{
  "success": false,
  "errorCode": "VIDEO_PRIVATE",
  "error": "This video is private or requires authentication."
}
```

### Complete Error Code Mapping

| Status Code | `errorCode` | Cause | Suggested Frontend Handling |
|---|---|---|---|
| **400** | `MISSING_URL` | No URL passed in query or body. | Prompt user to enter a URL. |
| **400** | `INVALID_URL` | Malformed URL or non-HTTP scheme. | Check user input format. |
| **400** | `PLATFORM_UNSUPPORTED` | Domain is unsupported or invalid. | Display list of supported domains. |
| **401** | `API_KEY_MISSING` | No key supplied when auth is active. | Verify environment API key. |
| **403** | `API_KEY_INVALID` | Incorrect secret key provided. | Check credentials. |
| **403** | `FORBIDDEN_URL` | Loopback, local IP, or private host. | Security SSRF protection. |
| **403** | `VIDEO_PRIVATE` | Video is set to private by creator. | Inform user video is not public. |
| **403** | `LOGIN_REQUIRED` | Requires account login or session cookies. | Setup cookies in server configuration. |
| **403** | `MEMBERS_ONLY` | YouTube members-only or subscription. | Inform user post requires membership. |
| **403** | `AGE_RESTRICTED` | Content marked 18+ by platform. | Configure cookies or auth tokens. |
| **403** | `GEO_RESTRICTED` | Platform blocked in server region. | Use `YTDLP_PROXY` setting. |
| **410** | `VIDEO_REMOVED` | Video deleted or unavailable. | Notify user content was deleted. |
| **413** | `VIDEO_TOO_LONG` | Video exceeds configured maximum duration. | Limit allowed video duration. |
| **429** | `RATE_LIMITED` | API rate limit exceeded (100 req/15min). | Implement client retry backoff. |
| **429** | `RATE_LIMITED_BY_PLATFORM`| Upstream platform temporarily blocked IP. | Configure residential/rotating proxies. |
| **429** | `BOT_VERIFICATION_REQUIRED`| Platform challenged request with CAPTCHA/PO-Token. | Update yt-dlp or supply session cookies. |
| **451** | `COPYRIGHT_TAKEDOWN` | Removed due to DMCA or copyright claim. | Inform user of legal takedown. |
| **504** | `EXTRACTION_TIMEOUT` | Platform took longer than 60s to respond. | Offer retry button. |
| **500** | `EXTRACTION_FAILED` | Internal yt-dlp extraction failure. | Auto-retry with clean parameters. |

---

## 7. Production Best Practices & Concurrency

1. **Always Use `streamUrl` on Web Frontends:**
   Avoid directly passing CDN URLs (such as `googlevideo.com` or `tiktokcdn.com`) to end users in browser `<a href="...">` links. They expire and block CORS. Use `https://your-api.com${format.streamUrl}&apikey=KEY` instead.
2. **Take Advantage of Built-in Caching:**
   The API caches results in memory for 60 minutes (`CACHE_TTL_MINUTES`). Subsequent requests for the same video return instantly in `~2ms` with `"cached": true`.
3. **Queue Concurrency:**
   The internal queue defaults to 3 concurrent extractions (`QUEUE_CONCURRENT_LIMIT=3`). If more than 3 requests arrive simultaneously, they wait in FIFO order to prevent memory spikes and CPU throttling.
4. **Platform Cookies:**
   For private accounts, Instagram challenges, or YouTube bot detection, supply cookies via `YTDLP_COOKIES_CONTENT` or `YTDLP_COOKIES_FILE`.
5. **Proxy Support:**
   If running on a cloud data center IP (AWS, DigitalOcean, Hetzner) that gets IP-blocked by Instagram or TikTok, set `YTDLP_PROXY=http://user:pass@proxy-server:port`.
