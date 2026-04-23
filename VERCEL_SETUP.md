# Vercel Deployment Setup

Deploy to Vercel with zero configuration — it just works.

---

## Quick Deploy

### Option 1: Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. That's it!

### Option 2: Vercel Dashboard (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click **New Project**
4. Select your GitHub repo
5. Click **Deploy**

Vercel auto-detects the Node.js setup and deploys.

---

## Environment Variables (Optional)

After deployment, add these in **Vercel Dashboard → Project Settings → Environment Variables**:

| Variable | Default | What It Does |
|----------|---------|--------------|
| `AUTO_GENERATE_API_KEY` | `true` | Auto-generate API key (set to `false` for custom key) |
| `API_SECRET_KEY` | _(auto-generated)_ | Custom API key (leave empty for auto-generation) |
| `RATE_LIMIT_MAX` | `100` | Requests per 15-minute window |
| `CACHE_TTL_MINUTES` | `60` | How long to cache video info |
| `MAX_CONCURRENT` | `3` | Parallel video extractions |
| `MAX_VIDEO_DURATION` | `7200` | Max video length in seconds (2 hours) |
| `MAX_FILE_SIZE_MB` | `500` | Max downloadable file size |
| `MAX_FORMATS` | `10` | Max quality options per video |

---

## After Deployment

Once deployed, you'll get a URL like: `https://your-project-abc123.vercel.app`

### Get Your API Key & Details

```bash
curl https://your-project-abc123.vercel.app/api/deploy-info
```

Response:
```json
{
  "success": true,
  "liveUrl": "https://your-project-abc123.vercel.app",
  "apiKey": "vdl_a1b2c3d4e5f6...",
  "apiAuthEnabled": true,
  "platform": "vercel",
  "endpoints": {
    "health": "https://your-project-abc123.vercel.app/api/health",
    "info": "https://your-project-abc123.vercel.app/api/info?url=<video_url>",
    "download": "https://your-project-abc123.vercel.app/api/download?url=<video_url>",
    ...
  }
}
```

---

## Usage Examples

### Test Health

```bash
curl https://your-project-abc123.vercel.app/api/health
```

### Get Video Info

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://your-project-abc123.vercel.app/api/info?url=https://youtu.be/dQw4w9WgXcQ"
```

### Download Full Details

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://your-project-abc123.vercel.app/api/download?url=https://youtu.be/dQw4w9WgXcQ"
```

### List All Platforms

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://your-project-abc123.vercel.app/api/platforms"
```

---

## Custom API Key

By default, a unique key is auto-generated per deployment. To use a custom key:

1. **Vercel Dashboard → Project Settings → Environment Variables**
2. Add: `API_SECRET_KEY` = `your-custom-key-here`
3. Redeploy (or wait for next deployment)
4. Use your custom key in all API requests

---

## Troubleshooting

### "502 Bad Gateway" or deployment fails

- Check **Deployment Logs** in Vercel dashboard
- Ensure Node 18+ selected (auto-detected)
- Try: **Redeploy from Git** button

### Can't find API key

Visit the public endpoint: `https://your-app.vercel.app/api/deploy-info`

### Authentication errors

- Copy the `apiKey` from `/api/deploy-info`
- Send it as header: `-H "x-api-key: YOUR_KEY"`
- Or query param: `?apikey=YOUR_KEY`

### yt-dlp not updating

- yt-dlp updates during build (`npm run build`)
- Check build logs if it fails
- Can be skipped; API still works with bundled version

---

## Advanced: Custom Domain

1. **Vercel Dashboard → Project Settings → Domains**
2. Add your custom domain
3. Update DNS records (Vercel shows how)
4. Use `https://your-domain.com` instead of vercel.app URL

---

## Performance Tips

- **Cache**: Videos are cached for 60 min by default (adjustable)
- **Rate Limit**: Set `RATE_LIMIT_MAX=200` for production use
- **Concurrency**: Increase `MAX_CONCURRENT=5` if you have traffic
- **Logs**: Check Vercel dashboard logs under **Deployments → Logs**

---

## What's Auto-Configured

✅ Node.js runtime (18+)  
✅ Environment auto-setup  
✅ API key auto-generation  
✅ Zero `.env` file needed  
✅ Security headers included  
✅ HTTPS enforced  
✅ Automatic yt-dlp updates on build  

---

## Rollback / Redeploy

**Vercel Dashboard → Deployments:**
- Click any previous deployment to redeploy
- Or push new code to trigger auto-deploy

---

## Questions?

- Check `/api/health` for system status
- Visit `/api/deploy-info` for config details
- See main `README.md` for full API docs
