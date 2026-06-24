#!/bin/bash
set -e

# Load .env if it exists
if [ -f /home/container/artifacts/api-server/.env ]; then
  export $(grep -v '^#' /home/container/artifacts/api-server/.env | xargs)
fi

# Install pnpm globally
npm install -g pnpm

# Install all workspace dependencies from repo root
cd /home/container
pnpm install

# Build with correct paths for this machine
cd /home/container/artifacts/api-server
node build.mjs

# Start the bot
node dist/index.mjs
