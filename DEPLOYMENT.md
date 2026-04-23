# Deployment Guide

## Zero-Config Deployment

This API requires **zero configuration** for deployment. Push to GitHub and deploy on any platform. Defaults and API keys are auto-generated.

---

## Deployment Platforms

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repo to Vercel dashboard
3. Deploy — defaults apply automatically
4. Visit `https://<your-deployment>.vercel.app/api/deploy-info` to see:
   - Live URL
   - Auto-generated API key
   - All available endpoints

**Environment variables (optional):**
```
AUTO_GENERATE_API_KEY=true
RATE_LIMIT_MAX=100
CACHE_TTL_MINUTES=60
MAX_CONCURRENT=5
```

---

### Koyeb

1. Connect GitHub repo in Koyeb dashboard
2. Deploy from `main` branch
3. Visit `https://<service-name>-<username>.koyeb.app/api/deploy-info`

**Set optional env vars in Koyeb dashboard:**
```
AUTO_GENERATE_API_KEY=true
NODE_ENV=production
```

---

### Render

1. Create new Web Service → Connect GitHub repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Deploy
5. Visit `https://<service-name>.onrender.com/api/deploy-info`

---

### Railway / Fly.io / Other Platforms

Push your code and deploy — all platforms work the same way. No env file needed.

After deployment, visit `/api/deploy-info` endpoint on your live domain to see deployment details.

---

## What Gets Auto-Generated

On deployment (when `NODE_ENV=production` or platform is detected):

- **API Key**: If missing or placeholder (`your-secret-key-change-me`), a secure key is generated
- **Defaults**: All config values get sensible defaults
- **.env file**: May be created locally with these values (for next restart)

---

## Getting Deployment Info

After deploying, GET the public endpoint:

```bash
curl https://your-app.example.com/api/deploy-info
```

Response includes:
- `liveUrl` — Your live API URL
- `apiKey` — The active API key (if auth enabled)
- `apiAuthEnabled` — Whether authentication is active
- `platform` — Detected deployment platform
- `endpoints` — All available API routes

---

## Local Development (No Deployment)

```bash
npm install
npm start
```

- Placeholder API key (`your-secret-key-change-me`) disables auth
- Access at `http://localhost:3000`
- Check status: `GET /api/health`

---

## Override Defaults

Pass environment variables to any platform:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server port |
| `AUTO_GENERATE_API_KEY` | `false` (true on production) | Force API key generation |
| `API_SECRET_KEY` | _(auto-generated on production)_ | Custom API key |
| `RATE_LIMIT_MAX` | `50` | Requests per 15 minutes |
| `CACHE_TTL_MINUTES` | `60` | Cache duration |
| `MAX_CONCURRENT` | `3` | Parallel extractions |
| `MAX_FORMATS` | `10` | Download formats per video |

---

## Security

- API key is auto-generated and **unique per deployment**
- Key comparison uses constant-time to prevent timing attacks
- Public endpoints (`/api/health`, `/api/version`, `/api/deploy-info`) never require auth
- HTTPS enforced in production
- Security headers included by default

---

## Troubleshooting

**Seeing "Missing API key" on deploy?**
- Visit `/api/deploy-info` (public endpoint) to get your key
- Pass it as header: `x-api-key: <your-key>`

**API key keeps changing?**
- On Vercel: Auth is enabled and key is stable within deployments
- Across deployments: Each new deployment gets a new key (by design)
- To keep the same key: Set `API_SECRET_KEY` as an environment variable

**Getting 500 errors?**
- Check logs in platform dashboard
- Ensure Node 18+ is installed
- Verify platform supports Node apps

---

## First Steps After Deploy

1. Visit `https://your-app.example.com/api/deploy-info`
2. Copy the `apiKey` value
3. Use it in all API requests: `curl -H "x-api-key: YOUR_KEY" ...`
4. Check `/api/health` for system status
5. Test with `/api/platforms` to list supported video platforms
