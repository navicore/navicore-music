#!/bin/bash
# Build script for Cloudflare Workers deployment

set -e

echo "Building Rust worker for Cloudflare Workers..."

# Install wrangler if needed
if [ ! -d "node_modules/wrangler" ]; then
    echo "Installing wrangler locally..."
    npm install
fi

# Build the worker using wrangler
echo "Building worker with wrangler..."
cd worker
../node_modules/.bin/wrangler build

# Move build output to the expected location
cd ..
mkdir -p build/worker
cp worker/build/worker/* build/worker/ 2>/dev/null || true

echo "Worker build complete!"