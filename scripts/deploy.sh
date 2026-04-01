#!/bin/bash
set -e

echo "=== CSV Deploy ==="

echo "1. Pulling latest code..."
git pull origin main

echo "2. Installing dependencies..."
npm install
cd backend
uv sync
cd ..

echo "3. Building..."
npm run build

echo "4. Running migrations..."
cd backend
uv run alembic upgrade head
cd ..

echo "5. Health checks..."
curl --fail http://localhost:3000 >/dev/null
curl --fail http://localhost:8000/api/v1/health >/dev/null

echo "=== Deploy complete ==="
