#!/bin/bash
set -e

# Load .env if it exists
if [ -f /home/container/artifacts/api-server/.env ]; then
  export $(grep -v '^#' /home/container/artifacts/api-server/.env | xargs)
fi

export NODE_ENV=production

cd /home/container/artifacts/api-server
node dist/index.mjs
