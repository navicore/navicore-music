#!/bin/bash
# Test the application locally before deploying to Cloudflare

set -e

echo "Starting local test environment..."

# Check if backend is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "Starting backend server..."
    cargo run -p navicore-music-backend &
    BACKEND_PID=$!
    
    # Wait for backend to start
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

# Test health endpoint
echo "Testing health endpoint..."
curl http://localhost:3000/health | jq .

# Build frontend for testing
echo "Building frontend..."
./build-pages.sh

# Serve frontend locally
echo "Frontend built in 'dist' directory"
echo "You can serve it with: python3 -m http.server 8080 --directory dist"

# Cleanup function
cleanup() {
    if [ ! -z "$BACKEND_PID" ]; then
        echo "Stopping backend server..."
        kill $BACKEND_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

echo ""
echo "Local test environment ready!"
echo "Backend API: http://localhost:3000"
echo "Health check: http://localhost:3000/health"
echo ""
echo "To deploy to Cloudflare:"
echo "1. Set up your Cloudflare credentials"
echo "2. Run: wrangler login"
echo "3. Follow the instructions in DEPLOYMENT.md"