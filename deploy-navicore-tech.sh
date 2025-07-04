#!/bin/bash
# Deployment script for navicore.tech

set -e

echo "🎵 Deploying Navicore Music to navicore.tech"
echo "============================================"

# Install local wrangler if needed
if [ ! -d "node_modules/wrangler" ]; then
    echo "Installing wrangler locally..."
    npm install
fi

# Use local wrangler directly
WRANGLER="./node_modules/.bin/wrangler"

# Login check
echo "Checking Cloudflare authentication..."
if ! $WRANGLER whoami &> /dev/null 2>&1; then
    echo "Please login to Cloudflare:"
    $WRANGLER login
fi

# Create R2 bucket
echo ""
echo "Step 1: Creating R2 bucket for music storage..."
if $WRANGLER r2 bucket list | grep -q "navicore-music-files"; then
    echo "✓ R2 bucket already exists"
else
    $WRANGLER r2 bucket create navicore-music-files
    echo "✓ R2 bucket created"
fi

# Create D1 database
echo ""
echo "Step 2: Creating D1 database..."
if $WRANGLER d1 list | grep -q "navicore-music"; then
    echo "✓ D1 database already exists"
    DB_ID=$($WRANGLER d1 list | grep "navicore-music" | awk '{print $2}')
else
    DB_OUTPUT=$($WRANGLER d1 create navicore-music)
    DB_ID=$(echo "$DB_OUTPUT" | grep -o '"id":\s*"[^"]*"' | sed 's/"id":\s*"//' | sed 's/"//')
    echo "✓ D1 database created with ID: $DB_ID"
fi

# Update wrangler.toml with the database ID
echo ""
echo "Step 3: Updating configuration..."
sed -i.bak "s/YOUR_DATABASE_ID/$DB_ID/g" wrangler.toml
echo "✓ Updated wrangler.toml with database ID"

# Apply database schema
echo ""
echo "Step 4: Setting up database schema..."
$WRANGLER d1 execute navicore-music --file=schema.sql --remote
echo "✓ Database schema applied"

# Generate JWT secret
echo ""
echo "Step 5: Setting up secrets..."
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "Generated JWT secret"
fi

echo "$JWT_SECRET" | $WRANGLER secret put JWT_SECRET
echo "✓ JWT secret configured"

# Deploy Worker API
echo ""
echo "Step 6: Deploying API to Workers..."
./build-worker.sh
$WRANGLER deploy
echo "✓ API deployed to Workers"

# Build and deploy Pages
echo ""
echo "Step 7: Deploying frontend to Pages..."
./build-pages.sh

# Update the redirects file with the correct worker URL
sed -i.bak "s|YOUR_SUBDOMAIN|navicore|g" dist/_redirects

$WRANGLER pages deploy dist --project-name navicore-music
echo "✓ Frontend deployed to Pages"

# Set up custom domains
echo ""
echo "Step 8: Setting up custom domains..."
echo "Please configure these in your Cloudflare dashboard:"
echo ""
echo "1. Go to Workers & Pages > navicore-music-api > Settings > Domains & Routes"
echo "   Add route: api.navicore.tech/*"
echo ""
echo "2. Go to Workers & Pages > navicore-music (Pages) > Custom domains"
echo "   Add domain: music.navicore.tech"
echo ""
echo "Or use the root domain:"
echo "   Add domain: navicore.tech"

echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
echo "Your music streaming service is available at:"
echo "- API: https://navicore-music-api.navicore.workers.dev"
echo "- Frontend: https://navicore-music.pages.dev"
echo ""
echo "With custom domains configured:"
echo "- API: https://api.navicore.tech"
echo "- App: https://music.navicore.tech (or https://navicore.tech)"
echo ""
echo "Next steps:"
echo "1. Upload music to R2: $WRANGLER r2 object put navicore-music-files/songs/song.mp3 --file=/path/to/song.mp3"
echo "2. Configure custom domains in Cloudflare dashboard"
echo "3. Test the health endpoint: curl https://api.navicore.tech/health"
echo ""