FROM node:20-slim

# Install system dependencies (ffmpeg, python3, certificates)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install Node dependencies first (Docker layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Update yt-dlp binary at build time
RUN node scripts/update-ytdlp.js || true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
