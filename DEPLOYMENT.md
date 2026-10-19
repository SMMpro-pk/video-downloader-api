# SMMPro Video Downloader API — Deployment Guide

Deploy anywhere in under 60 seconds with **zero configuration**. The API automatically applies secure defaults, provisions API authentication keys, detects hosting environments, and monitors system health.

---

## 🚀 Choose Your Deployment Method

| Method | Best For | Deploy Time | Command / Action |
|---|---|---|---|
| **[Vercel](#1-vercel-serverless--recommended)** | Serverless, Global CDN | 30 seconds | Connect GitHub → Deploy |
| **[Docker Compose](#2-docker-compose-any-vps--server)** | VPS, Ubuntu, DigitalOcean, Hetzner | 1 minute | `docker compose up -d` |
| **[Render](#3-render-one-click-blueprint)** | Cloud PaaS, Free Tier | 1 minute | Connect GitHub (auto `render.yaml`) |
| **[Railway](#4-railway-one-click)** | High performance PaaS | 1 minute | Connect GitHub (auto `railway.json`) |
| **[Fly.io](#5-flyio)** | Edge Containers | 1 minute | `fly launch` (auto `fly.toml`) |
| **[Koyeb](#6-koyeb)** | Global MicroVMs | 1 minute | Connect GitHub repo |
| **[Linux VPS Script](#7-linux-vps-installer-script)** | Dedicated Server / Bare Metal | 2 minutes | `bash scripts/deploy.sh` |
| **[PM2 Process Manager](#8-pm2-cluster-deployment)** | Node.js production servers | 30 seconds | `pm2 start ecosystem.config.js` |

---

## 1. Vercel (Serverless — Recommended)

Vercel deployment is pre-configured with `vercel.json` rewrites and automated build hooks.

### Steps:
1. Push your repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
3. In **Framework Preset**, keep **"Other"**.
4. Click **Deploy**.

After deployment, fetch your live API key:
```bash
curl https://your-deployment.vercel.app/api/deploy-info
```

*(See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for full instructions)*

---

## 2. Docker Compose (Any VPS / Server)

Pre-configured multi-stage container deployment with persistent logging, curl health checks, and auto-restart.

### 1-Command Run:
```bash
# Clone the repository
git clone https://github.com/YOUR_USER/video-downloader-api.git
cd video-downloader-api

# Start in background
docker compose up -d
```

### Verify:
```bash
docker compose ps
curl http://localhost:3000/api/health
```

To view logs:
```bash
docker compose logs -f
```

---

## 3. Render (One-Click Blueprint)

Deploy to Render Web Services with zero manual clicking using the included [`render.yaml`](./render.yaml).

### Steps:
1. Push this repo to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com) → Click **Blueprints** → **New Blueprint Instance**.
3. Select this repository.
4. Click **Apply**.
5. Render automatically creates the Web Service, configures health checks on `/api/health`, and launches.

---

## 4. Railway (One-Click)

The repository includes [`railway.json`](./railway.json) and [`Procfile`](./Procfile) for automatic Nixpacks deployment.

### Steps:
1. Go to [railway.app](https://railway.app) → **New Project**.
2. Select **Deploy from GitHub repo**.
3. Select your repository.
4. Railway detects `railway.json`, provisions Node 20+, installs dependencies, and deploys.

---

## 5. Fly.io

The repository includes a ready-to-use [`fly.toml`](./fly.toml).

### Steps:
```bash
# Install flyctl if needed
curl -L https://fly.io/install.sh | sh

# Launch
fly launch

# Deploy
fly deploy
```

---

## 6. Koyeb

1. Go to [app.koyeb.com](https://app.koyeb.com) → **Create App**.
2. Choose **GitHub** as the deployment method.
3. Select your repository and `main` branch.
4. Click **Deploy**. Koyeb auto-detects Node.js and starts the app.

---

## 7. Linux VPS Installer Script

Deploy directly onto any clean Ubuntu, Debian, CentOS, or AlmaLinux server using our turnkey installer script:

```bash
cd video-downloader-api
sudo bash scripts/deploy.sh
```

### What the script does:
- Installs `ffmpeg`, `python3`, `curl`, and `ca-certificates`.
- Verifies Node.js 20+ runtime.
- Installs npm packages and latest `yt-dlp` binary.
- Registers and starts a background `systemd` service (`systemctl status video-downloader-api`).
- Automatically starts on system reboots.

---

## 8. PM2 Cluster Deployment

For production VPS hosting with clustering across all CPU cores:

```bash
# Install PM2 globally
npm install -g pm2

# Start cluster using ecosystem config
pm2 start ecosystem.config.js

# Save process list for system reboot
pm2 save
pm2 startup
```

---

## 🔑 Environment Variables

All settings have built-in production defaults. To customize, copy `.env.example` to `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP listening port |
| `NODE_ENV` | `production` | Runtime mode |
| `API_SECRET_KEY` | *(auto-generated)* | Secret key for API authentication |
| `AUTO_GENERATE_API_KEY` | `true` | Auto-generate secure key on startup |
| `RATE_LIMIT_MAX` | `100` | Requests allowed per 15 min per IP |
| `MAX_CONCURRENT` | `5` | Maximum parallel yt-dlp extractions |
| `CACHE_TTL_MINUTES` | `60` | Cache retention time |
| `CACHE_MAX_SIZE` | `500` | Max entries in memory cache |
| `MAX_VIDEO_DURATION` | `7200` | Max video duration in seconds (2h) |
| `MAX_FILE_SIZE_MB` | `500` | Max file size filter in MB |
| `MAX_FORMATS` | `10` | Max format qualities returned |
| `PROXY_URL` | *(none)* | Route yt-dlp through residential/datacenter proxy |
| `YTDLP_COOKIES_FILE` | *(none)* | Path to cookies.txt for member/auth videos |

---

## 🩺 Post-Deployment Verification

After deploying, verify your setup:

1. **Dashboard:** Visit `https://your-domain/` to view system health and test extraction live.
2. **Health Check:** `curl https://your-domain/api/health`
3. **Deploy Info:** `curl https://your-domain/api/deploy-info`
4. **Test Video:** `curl "https://your-domain/api/info?url=https://youtu.be/dQw4w9WgXcQ"`
