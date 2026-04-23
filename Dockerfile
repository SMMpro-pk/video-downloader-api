FROM node:20-slim

# Install yt-dlp runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies first (Docker layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Update yt-dlp at build time
RUN node scripts/update-ytdlp.js || true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
