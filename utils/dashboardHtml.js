/**
 * Modern, responsive, interactive Web Dashboard for SMMPro Video Downloader API.
 */

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(sec % 60)}s`;
}

function getFixHint(name) {
  const hints = {
    'Node.js': 'Install Node.js 18+ from https://nodejs.org',
    'npm': 'npm comes with Node.js — reinstall Node',
    'Python': 'Install Python 3.7+ or use bundled yt-dlp binary.',
    'ffmpeg': 'Install ffmpeg: apt install ffmpeg / choco install ffmpeg / brew install ffmpeg',
    'yt-dlp': 'Run: npm run update-ytdlp',
    'youtube-dl-exec': 'Run: npm install',
    'express': 'Run: npm install',
    'logs/ directory': 'Create logs/ folder and ensure write permissions.',
  };
  return hints[name] || 'Check the documentation';
}

function renderDashboard({ pkg, status, cacheInfo, queueInfo, boot, uptime }) {
  const statusColor = status.allOk ? '#10b981' : '#ef4444';
  const statusBg = status.allOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const statusBorder = status.allOk ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
  const statusText = status.allOk ? 'ALL SYSTEMS OPERATIONAL' : `${status.failed} CHECK(S) FAILED`;
  const statusEmoji = status.allOk ? '●' : '▲';

  const checksHtml = status.checks.map((c) => {
    const isOk = c.ok;
    const isOptional = !isOk && c.optional;
    const badgeBg = isOk ? 'rgba(16, 185, 129, 0.12)' : isOptional ? 'rgba(156, 163, 175, 0.12)' : 'rgba(239, 68, 68, 0.12)';
    const badgeColor = isOk ? '#10b981' : isOptional ? '#9ca3af' : '#f87171';
    return `
      <tr>
        <td style="padding:12px 16px;width:32px"><span style="color:${badgeColor};font-size:14px">${isOk ? '✔' : isOptional ? '–' : '✖'}</span></td>
        <td style="padding:12px 16px;font-weight:600;color:#f3f4f6">${esc(c.name)}</td>
        <td style="padding:12px 16px;color:#9ca3af;font-family:monospace;font-size:13px">${esc(c.detail)}</td>
        <td style="padding:12px 16px;text-align:right">
          <span style="background:${badgeBg};color:${badgeColor};padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600">${isOk ? 'ACTIVE' : isOptional ? 'OPTIONAL' : 'MISSING'}</span>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMMPro Video Downloader API — v${pkg.version}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f2937;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #06b6d4;
      --success: #10b981;
      --danger: #ef4444;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .wrapper { max-width: 960px; width: 100%; }
    
    /* Header */
    header {
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .brand h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #fff 40%, #a5b4fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .meta-tag {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      background: #1f2937;
      color: #9ca3af;
    }

    /* Status Banner */
    .status-banner {
      padding: 14px 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 1px solid ${statusBorder};
      background: ${statusBg};
      font-size: 14px;
      font-weight: 600;
      color: ${statusColor};
    }
    .status-left { display: flex; align-items: center; gap: 10px; }
    .pulse-dot { font-size: 10px; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    /* Interactive Tester */
    .tester-card {
      background: linear-gradient(180deg, #161e31 0%, #111827 100%);
      border: 1px solid #2d3748;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .tester-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #fff;
    }
    .input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .url-input {
      flex: 1;
      background: #0b0f19;
      border: 1px solid #374151;
      border-radius: 10px;
      padding: 12px 16px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border 0.15s, box-shadow 0.15s;
    }
    .url-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    .btn {
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 12px 22px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s, transform 0.05s;
      user-select: none;
    }
    .btn:hover { background: var(--primary-hover); }
    .btn:active { transform: translateY(1px); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .demo-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
      align-items: center;
    }
    .chip-label { font-size: 12px; color: var(--text-muted); }
    .chip {
      background: #1f2937;
      color: #93c5fd;
      border: 1px solid #374151;
      border-radius: 999px;
      padding: 3px 12px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .chip:hover { background: #283548; border-color: #60a5fa; }

    /* Result Preview Box */
    .result-container {
      margin-top: 20px;
      display: none;
      border-top: 1px solid #283548;
      padding-top: 20px;
    }
    .media-card {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      background: #0b0f19;
      border: 1px solid #1f2937;
      border-radius: 12px;
      padding: 16px;
      align-items: flex-start;
    }
    .thumb-wrap {
      position: relative;
      width: 220px;
      min-width: 180px;
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 16/9;
      background: #1f2937;
    }
    .thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .duration-badge {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--font-mono);
    }
    .media-details {
      flex: 1;
      min-width: 260px;
    }
    .media-title {
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 6px;
      line-height: 1.35;
    }
    .media-uploader {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .formats-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9ca3af;
      margin: 12px 0 8px;
    }
    .formats-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .format-btn {
      background: #1f2937;
      border: 1px solid #374151;
      color: #f3f4f6;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s, border-color 0.15s;
    }
    .format-btn:hover {
      background: #283548;
      border-color: var(--primary);
      color: #fff;
    }
    .badge-audio {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border-radius: 14px;
      padding: 0;
      margin-bottom: 24px;
      overflow: hidden;
      border: 1px solid var(--card-border);
    }
    .card-header {
      padding: 16px 20px;
      font-size: 13px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    table tr { border-bottom: 1px solid var(--card-border); }
    table tr:last-child { border-bottom: none; }
    table td { font-size: 14px; }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      padding: 20px;
    }
    .stat-box {
      background: #0b0f19;
      border: 1px solid #1f2937;
      border-radius: 10px;
      text-align: center;
      padding: 16px 12px;
    }
    .stat-val { font-size: 26px; font-weight: 800; color: #fff; font-family: var(--font-mono); }
    .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

    /* Endpoints */
    .api-item {
      padding: 14px 20px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 13px;
      transition: background 0.15s;
    }
    .api-item:last-child { border-bottom: none; }
    .api-item:hover { background: #172033; }
    .method-get {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: var(--font-mono);
      width: 48px;
      text-align: center;
    }
    .method-post {
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: var(--font-mono);
      width: 48px;
      text-align: center;
    }
    .api-path {
      font-family: var(--font-mono);
      color: #93c5fd;
      font-weight: 600;
      text-decoration: none;
    }
    .api-desc {
      color: var(--text-muted);
      margin-left: auto;
    }

    /* Footer */
    footer {
      margin-top: 20px;
      font-size: 13px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <div class="brand">
        <h1>⚡ SMMPro Video Downloader API</h1>
        <div class="meta-tag">
          <span>v${pkg.version}</span>
          <span>&bull;</span>
          <span>Node ${process.version}</span>
          <span>&bull;</span>
          <span>Uptime: ${formatUptime(uptime)}</span>
          <span class="badge">${boot.deploymentPlatform.toUpperCase()}</span>
        </div>
      </div>
    </header>

    <div class="status-banner">
      <div class="status-left">
        <span class="pulse-dot">${statusEmoji}</span>
        <span>${statusText}</span>
      </div>
      <span style="font-size:12px;opacity:0.8">${status.passed}/${status.total} checks passing</span>
    </div>

    <!-- Live Interactive Tester -->
    <div class="tester-card">
      <div class="tester-title">
        <span>🎯 Real-Time URL Extractor</span>
      </div>
      <div class="input-group">
        <input type="text" id="testUrl" class="url-input" placeholder="Paste any video URL (YouTube, TikTok, Instagram, Twitter, Facebook, etc.)..." value="https://youtu.be/dQw4w9WgXcQ" />
        <button id="btnExtract" class="btn" onclick="runExtraction()">Extract</button>
      </div>
      <div class="demo-chips">
        <span class="chip-label">Quick samples:</span>
        <span class="chip" onclick="setSample('https://youtu.be/dQw4w9WgXcQ')">YouTube</span>
        <span class="chip" onclick="setSample('https://www.tiktok.com/@tiktok/video/7106594312292453675')">TikTok</span>
        <span class="chip" onclick="setSample('https://www.instagram.com/reel/C5_8Q9_O8nU/')">Instagram</span>
        <span class="chip" onclick="setSample('https://x.com/Twitter/status/123456789')">Twitter / X</span>
      </div>

      <!-- Result Card -->
      <div id="resultBox" class="result-container">
        <div id="mediaCard" class="media-card">
          <div class="thumb-wrap">
            <img id="resThumb" class="thumb-img" src="" alt="Thumbnail" />
            <span id="resDuration" class="duration-badge"></span>
          </div>
          <div class="media-details">
            <div id="resTitle" class="media-title"></div>
            <div id="resUploader" class="media-uploader"></div>
            
            <div class="formats-title">Direct Video Downloads (with Audio)</div>
            <div id="resFormats" class="formats-grid"></div>

            <div class="formats-title" style="margin-top:14px">Audio & Streams</div>
            <div id="resAudio" class="formats-grid"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Checks -->
    <div class="card">
      <div class="card-header">
        <span>System Diagnostics</span>
        <span style="font-size:12px;color:#6b7280">${status.passed}/${status.total} Passed</span>
      </div>
      <table>
        ${checksHtml}
      </table>
    </div>

    <!-- Runtime Stats -->
    <div class="card">
      <div class="card-header">Runtime & Queue Engine</div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-val">${cacheInfo.activeEntries}</div>
          <div class="stat-label">Cached Queries</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${queueInfo.active}</div>
          <div class="stat-label">Active Workers</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${queueInfo.pending}</div>
          <div class="stat-label">Queue Pending</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${queueInfo.max}</div>
          <div class="stat-label">Max Parallel Tasks</div>
        </div>
      </div>
    </div>

    <!-- API Endpoints -->
    <div class="card">
      <div class="card-header">Core Endpoints</div>
      <div class="api-item">
        <span class="method-get">GET</span>
        <a class="api-path" href="/api/info?url=https://youtu.be/dQw4w9WgXcQ" target="_blank">/api/info?url=...</a>
        <span class="api-desc">Fast metadata preview (title, thumbnail, duration, chapters)</span>
      </div>
      <div class="api-item">
        <span class="method-get">GET</span>
        <a class="api-path" href="/api/download?url=https://youtu.be/dQw4w9WgXcQ" target="_blank">/api/download?url=...</a>
        <span class="api-desc">Full video & audio extraction + download streams</span>
      </div>
      <div class="api-item">
        <span class="method-post">POST</span>
        <span class="api-path">/api/download</span>
        <span class="api-desc">Extract with JSON body {"url": "..."}</span>
      </div>
      <div class="api-item">
        <span class="method-post">POST</span>
        <span class="api-path">/api/batch</span>
        <span class="api-desc">Extract multiple URLs concurrently in a batch</span>
      </div>
      <div class="api-item">
        <span class="method-get">GET</span>
        <span class="api-path">/api/stream?url=&lt;cdn_url&gt;&filename=video.mp4</span>
        <span class="api-desc">Stream/Proxy download to bypass CORS & hotlink protections</span>
      </div>
      <div class="api-item">
        <span class="method-get">GET</span>
        <a class="api-path" href="/api/check?url=https://youtu.be/dQw4w9WgXcQ" target="_blank">/api/check?url=...</a>
        <span class="api-desc">Detect platform & normalize redirect URL</span>
      </div>
      <div class="api-item">
        <span class="method-get">GET</span>
        <a class="api-path" href="/api/platforms" target="_blank">/api/platforms</a>
        <span class="api-desc">List all 50+ supported video platforms</span>
      </div>
      <div class="api-item">
        <span class="method-get">GET</span>
        <a class="api-path" href="/api/health" target="_blank">/api/health</a>
        <span class="api-desc">JSON health check monitor</span>
      </div>
      <div class="api-item">
        <span class="method-get">GET</span>
        <a class="api-path" href="/api/stats" target="_blank">/api/stats</a>
        <span class="api-desc">Daily request usage statistics & platform breakdown</span>
      </div>
    </div>

    ${!status.allOk ? `
    <div class="card" style="border-color:#ef4444">
      <div class="card-header" style="color:#ef4444">⚠️ Fix Required</div>
      <table>
        ${status.checks.filter(c => !c.ok && !c.optional).map(c => `
        <tr style="background:rgba(239, 68, 68, 0.08)">
          <td style="padding:12px 16px;color:#fca5a5;font-weight:600">${esc(c.name)}</td>
          <td style="padding:12px 16px;color:#fca5a5;font-family:monospace">${esc(getFixHint(c.name))}</td>
        </tr>`).join('')}
      </table>
    </div>` : ''}

    <footer>
      SMMPro Video Downloader API &bull; Built with yt-dlp &bull; ${new Date().getFullYear()}
    </footer>
  </div>

  <script>
    function setSample(url) {
      document.getElementById('testUrl').value = url;
      runExtraction();
    }

    async function runExtraction() {
      const url = document.getElementById('testUrl').value.trim();
      const btn = document.getElementById('btnExtract');
      const box = document.getElementById('resultBox');
      if (!url) return;

      btn.disabled = true;
      btn.textContent = 'Extracting…';
      box.style.display = 'none';

      try {
        const res = await fetch('/api/download?url=' + encodeURIComponent(url));
        const data = await res.json();

        if (!data.success) {
          alert('Error (' + (data.errorCode || 'FAILED') + '): ' + (data.error || 'Failed to extract'));
          return;
        }

        document.getElementById('resThumb').src = data.thumbnail || '';
        document.getElementById('resDuration').textContent = data.durationFormatted || (data.duration ? data.duration + 's' : '');
        document.getElementById('resTitle').textContent = data.title || 'Untitled';
        document.getElementById('resUploader').textContent = (data.uploader ? 'By ' + data.uploader + ' &bull; ' : '') + (data.platform || 'General');

        const formatsDiv = document.getElementById('resFormats');
        formatsDiv.innerHTML = '';
        if (data.downloads && data.downloads.length > 0) {
          data.downloads.forEach(d => {
            const a = document.createElement('a');
            a.className = 'format-btn';
            a.href = d.url;
            a.target = '_blank';
            a.rel = 'noreferrer';
            const sizeStr = d.filesizeFormatted ? ' (' + d.filesizeFormatted + ')' : '';
            a.innerHTML = '<strong>' + (d.quality || 'Video') + '</strong> ' + (d.format ? d.format.toUpperCase() : '') + sizeStr + (d.hasAudio ? ' <span class="badge-audio">Audio+Video</span>' : '');
            formatsDiv.appendChild(a);
          });
        } else {
          formatsDiv.innerHTML = '<span style="color:#888;font-size:12px">No direct video streams parsed</span>';
        }

        const audioDiv = document.getElementById('resAudio');
        audioDiv.innerHTML = '';
        if (data.audioDownloads && data.audioDownloads.length > 0) {
          data.audioDownloads.forEach(aItem => {
            const a = document.createElement('a');
            a.className = 'format-btn';
            a.href = aItem.url;
            a.target = '_blank';
            a.rel = 'noreferrer';
            const sizeStr = aItem.filesizeFormatted ? ' (' + aItem.filesizeFormatted + ')' : '';
            a.innerHTML = '🎵 ' + (aItem.quality || 'Audio') + ' ' + (aItem.format ? aItem.format.toUpperCase() : 'M4A') + sizeStr;
            audioDiv.appendChild(a);
          });
        }

        box.style.display = 'block';
      } catch (err) {
        alert('Network or server error while extracting.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Extract';
      }
    }
  </script>
</body>
</html>`;
}

module.exports = { renderDashboard };
