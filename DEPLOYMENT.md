# Cloudflare Deployment Guide

## Prerequisites

1. Cloudflare account with:
   - Workers & Pages enabled
   - R2 storage enabled
   - D1 database access

2. Install Wrangler CLI:
```bash
npm install -g wrangler
wrangler login
```

## Step 1: Create R2 Bucket

```bash
wrangler r2 bucket create navicore-music-files
```

## Step 2: Create D1 Database

```bash
# Create database
wrangler d1 create navicore-music

# Note the database_id from the output and update wrangler.toml
```

## Step 3: Create Database Schema

Create `schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT NOT NULL,
    duration INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    cover_art_path TEXT,
    genre TEXT,
    year INTEGER,
    track_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id),
    FOREIGN KEY (track_id) REFERENCES tracks(id),
    PRIMARY KEY (playlist_id, track_id)
);

CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_album ON tracks(album);
CREATE INDEX idx_tracks_created ON tracks(created_at);
```

Apply schema:
```bash
wrangler d1 execute navicore-music --file=schema.sql
```

## Step 4: Deploy Workers API

```bash
# Set secrets
wrangler secret put JWT_SECRET
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY

# Deploy
./build-worker.sh
wrangler deploy
```

## Step 5: Deploy Pages Frontend

```bash
# Build frontend
./build-pages.sh

# Deploy with Pages
wrangler pages deploy dist --project-name navicore-music
```

## Step 6: Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your project
3. Go to Custom Domains
4. Add your domain

## Environment Variables

Set these in the Cloudflare Dashboard:

- `JWT_SECRET`: Generate with `openssl rand -base64 32`
- `R2_ACCESS_KEY_ID`: From R2 API tokens
- `R2_SECRET_ACCESS_KEY`: From R2 API tokens
- `R2_ENDPOINT`: Your R2 endpoint URL

## GitHub Actions Deployment

Add these secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The CI/CD pipeline will automatically deploy on push to main.

## Monitoring

- Workers Analytics: Dashboard > Workers & Pages > Analytics
- R2 Metrics: Dashboard > R2 > Overview
- D1 Metrics: Dashboard > D1 > Your Database

## Costs

With typical usage for personal music streaming:
- Workers: Free tier (100k requests/day)
- Pages: Free tier (500 builds/month)
- R2: ~$0.015/GB/month storage
- D1: Free tier (5GB storage)