#!/bin/bash
set -e

echo "=== CSV Deploy ==="

echo "1. Pulling latest code..."
git pull origin main

echo "2. Installing dependencies..."
npm install

echo "3. Building..."
npm run build

echo "4. Running migrations..."
npx drizzle-kit migrate

echo "5. Seeding users (if needed)..."
npm run seed:users

echo "6. Restarting PM2..."
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

echo "=== Deploy complete ==="
