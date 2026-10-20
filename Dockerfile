FROM node:20-slim

# Install system dependencies (ffmpeg, python3, certificates, curl)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 python-is-python3 ca-certificates curl && \
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

# Create logs directory with permissive permissions for non-root containers
RUN mkdir -p logs && chmod 777 logs

# Ensure yt-dlp binary is executable and updated
RUN chmod -R +x node_modules/youtube-dl-exec/bin || true
RUN node scripts/update-ytdlp.js || true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
