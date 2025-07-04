# Quick Start Guide

## 🚀 Deploy Your Music App in 10 Minutes

### Prerequisites
- Cloudflare account (free tier works!)
- Node.js installed (for wrangler CLI)

### Step 1: Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### Step 2: Create Your Resources
```bash
# Create R2 bucket for music files
wrangler r2 bucket create navicore-music-files

# Create D1 database
wrangler d1 create navicore-music
# Copy the database_id from output
```

### Step 3: Update Configuration
Edit `wrangler.toml` and replace:
- `YOUR_DATABASE_ID` with the ID from step 2
- `YOUR_SUBDOMAIN` with your workers subdomain

### Step 4: Set Up Database
```bash
# Apply database schema
wrangler d1 execute navicore-music --file=schema.sql --remote
```

### Step 5: Deploy!
```bash
# Deploy backend API
./build-worker.sh
wrangler deploy

# Deploy frontend
./build-pages.sh
wrangler pages deploy dist --project-name navicore-music
```

### Step 6: Upload Your First Song

Use the Cloudflare dashboard to upload an MP3 to your R2 bucket, or:

```bash
# Upload a test file
wrangler r2 object put navicore-music-files/test-song.mp3 --file=/path/to/song.mp3
```

## 🎉 That's It!

Your personal music streaming service is now live on Cloudflare's edge network!

- **API**: `https://navicore-music-api.YOUR_SUBDOMAIN.workers.dev`
- **Frontend**: `https://navicore-music.pages.dev`

## Next Steps

1. **Add Music**: Upload your music collection to R2
2. **Customize**: Modify the UI in `backend/templates/`
3. **Secure**: Add authentication (see DEPLOYMENT.md)
4. **Monitor**: Check analytics in Cloudflare dashboard

## Local Development

```bash
# Run locally
cargo run -p navicore-music-backend

# In another terminal
cd frontend && wasm-pack build --dev --target web
python3 -m http.server 8080
```

## Costs

For personal use, you'll likely stay in free tiers:
- **Workers**: 100k requests/day free
- **Pages**: Unlimited requests
- **R2**: 10GB storage free
- **D1**: 5GB database free

## Troubleshooting

- **CORS errors**: Check `wrangler.toml` has correct domain
- **404 errors**: Ensure `_redirects` file is deployed
- **Build fails**: Run `cargo clean` and try again

Happy streaming! 🎵