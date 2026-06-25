#!/bin/bash
set -e

export NODE_ENV=production

cd /home/container/artifacts/api-server
node dist/index.mjs
