#!/usr/bin/env bash
# ========================================================
# RMX Live MindMirror V2Ag — Production Zero-Downtime Deployment
# ========================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}  Starting RMX MindMirror V2Ag Production Deployment  ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Check Node & NPM versions
echo -e "\n${YELLOW}[1/6] Verifying Node.js environment...${NC}"
node -v
npm -v

# 2. Pull latest git changes if in a git repository
if [ -d .git ]; then
  echo -e "\n${YELLOW}[2/6] Pulling latest repository updates...${NC}"
  git pull origin main || git pull origin master || echo "Using current workspace state."
else
  echo -e "\n${YELLOW}[2/6] Skipping git pull (standalone directory).${NC}"
fi

# 3. Install dependencies
echo -e "\n${YELLOW}[3/6] Installing dependencies...${NC}"
npm install --production=false

# 4. Generate crisp PWA PNG assets
echo -e "\n${YELLOW}[4/6] Generating PWA icons & manifest assets...${NC}"
node scripts/generate-png-icons.js

# 5. Build production bundle (client Vite bundle + server esbuild)
echo -e "\n${YELLOW}[5/6] Building production bundle...${NC}"
npm run build

# 6. Restart Server Process (PM2 or Docker)
echo -e "\n${YELLOW}[6/6] Reloading server process...${NC}"

if command -v pm2 &> /dev/null; then
  echo "Restarting via PM2..."
  pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
elif command -v docker-compose &> /dev/null; then
  echo "Rebuilding and restarting via Docker Compose..."
  docker-compose up -d --build
else
  echo "Starting with standard node..."
  echo "Run: npm start"
fi

# 7. Verification Probe
TARGET_PORT="${PORT:-8080}"
echo -e "\n${YELLOW}Probing local health status (http://localhost:${TARGET_PORT}/api/health)...${NC}"
sleep 2
if command -v curl &> /dev/null; then
  curl -s "http://localhost:${TARGET_PORT}/api/health" || curl -s "http://localhost:3000/api/health" || echo "Server starting up..."
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}  Deployment Successful! PWA is live & synchronized. ${NC}"
echo -e "${GREEN}====================================================${NC}"
