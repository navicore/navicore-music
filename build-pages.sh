#!/bin/bash
# Build script for Cloudflare Pages deployment

set -e

echo "Building frontend for Cloudflare Pages..."

# Install wasm-pack if not installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build frontend WASM
cd frontend
wasm-pack build --target web --out-dir ../dist/wasm
cd ..

# Copy static files
echo "Copying static files..."
mkdir -p dist/static
cp -r backend/static/* dist/static/ 2>/dev/null || true

# Copy templates as the base HTML
cp backend/templates/base.html dist/index.html

# Create a simple routing file for Pages
cat > dist/_redirects << 'EOF'
/api/* https://navicore-music-api.YOUR_SUBDOMAIN.workers.dev/api/:splat 200
/* /index.html 200
EOF

# Copy headers
cp _headers dist/

echo "Pages build complete! Deploy the 'dist' directory to Cloudflare Pages"