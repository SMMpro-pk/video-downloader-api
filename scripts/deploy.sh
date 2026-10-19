#!/usr/bin/env bash
# ==============================================================================
# SMMPro Video Downloader API — Automated Linux VPS Setup & Deployment Script
# Supports: Ubuntu, Debian, CentOS, RHEL, AlmaLinux, Rocky
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}  🚀 SMMPro Video Downloader API — Auto Deployer    ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Check Root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Running without root privileges. If package installation fails, run with sudo.${NC}"
fi

# 2. Detect Package Manager & Install Dependencies
echo -e "\n${BLUE}📦 Step 1: Installing System Dependencies (ffmpeg, python3, curl)...${NC}"
if command -v apt-get &> /dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl ffmpeg python3 python3-pip ca-certificates git
elif command -v dnf &> /dev/null; then
  dnf install -y curl ffmpeg python3 git
elif command -v yum &> /dev/null; then
  yum install -y curl ffmpeg python3 git
elif command -v apk &> /dev/null; then
  apk add --no-cache curl ffmpeg python3 git nodejs npm
fi

# 3. Ensure Node.js (20+) is installed
echo -e "\n${BLUE}🟢 Step 2: Checking Node.js runtime...${NC}"
if ! command -v node &> /dev/null; then
  echo "Node.js not found. Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  NODE_VER=$(node -v)
  echo "Found Node.js $NODE_VER"
fi

# 4. Install Project Dependencies
echo -e "\n${BLUE}📥 Step 3: Installing NPM packages & yt-dlp...${NC}"
export YOUTUBE_DL_SKIP_PYTHON_CHECK=1
npm install --omit=dev

# 5. Build & Update yt-dlp binary
echo -e "\n${BLUE}🔄 Step 4: Ensuring latest yt-dlp binary...${NC}"
npm run update-ytdlp || true

# 6. Verify System Checks
echo -e "\n${BLUE}🩺 Step 5: Running diagnostics...${NC}"
node -e "const res = require('./utils/systemCheck').runAll(); console.log(res.allOk ? '✅ All checks passed!' : '⚠️ Some checks failed.');"

# 7. Setup Systemd Service (Optional on Linux)
SERVICE_NAME="video-downloader-api"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
APP_DIR="$(pwd)"

if [ -d "/etc/systemd/system" ] && [ "$EUID" -eq 0 ]; then
  echo -e "\n${BLUE}⚙️  Step 6: Setting up systemd service (${SERVICE_NAME})...${NC}"
  cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=SMMPro Video Downloader API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=$(which node) index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=AUTO_GENERATE_API_KEY=true

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"

  echo -e "${GREEN}✅ Systemd service enabled and started!${NC}"
  echo "Manage service with: systemctl status ${SERVICE_NAME}"
else
  echo -e "\n${YELLOW}ℹ️  Skipped systemd auto-registration (run with sudo to auto-register).${NC}"
  echo "You can start the server with: npm start  OR  pm2 start index.js"
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}  🎉 Deployment Complete!                           ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "API Endpoint:  http://localhost:3000"
echo -e "Status Page:   http://localhost:3000/"
echo -e "Health Check:  http://localhost:3000/api/health"
echo -e "Deploy Info:   http://localhost:3000/api/deploy-info"
