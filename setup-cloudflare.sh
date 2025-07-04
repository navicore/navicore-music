#!/bin/bash
# Initial setup script for Cloudflare deployment

set -e

echo "🔧 Setting up Navicore Music deployment tools"
echo "==========================================="

# Check for node/npm
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Install wrangler locally
echo "📦 Installing wrangler locally (no global npm mess)..."
npm install

# Create .gitignore entries
if ! grep -q "node_modules" .gitignore 2>/dev/null; then
    echo -e "\n# Node modules\nnode_modules/\npackage-lock.json" >> .gitignore
    echo "✓ Updated .gitignore"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Available commands:"
echo "  npm run wrangler login     - Login to Cloudflare"
echo "  npm run deploy            - Deploy everything" 
echo "  npm run deploy:api        - Deploy API only"
echo "  npm run deploy:pages      - Deploy frontend only"
echo "  npm run dev:api          - Run API locally with wrangler"
echo ""
echo "Or use wrangler directly:"
echo "  npx wrangler --help"
echo ""
echo "Next step: npm run wrangler login"