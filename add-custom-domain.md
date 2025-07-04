# Add Custom Domain to Cloudflare Pages

The frontend is deployed but the custom domain `music.navicore.tech` isn't connected to Pages yet.

## Steps to Fix:

1. **Go to Cloudflare Dashboard**
   - https://dash.cloudflare.com

2. **Navigate to Pages**
   - Click on "Workers & Pages" in the left sidebar
   - Find and click on "navicore-music"

3. **Add Custom Domain**
   - Go to the "Custom domains" tab
   - Click "Set up a custom domain"
   - Enter: `music.navicore.tech`
   - Click "Continue"
   - It should automatically validate since you already have the CNAME set up

## Verify

Once added, the site should be accessible at:
- https://music.navicore.tech

The API is already working at:
- https://api.navicore.tech

## Current Status:
- ✅ Pages deployment works: https://navicore-music.pages.dev
- ✅ DNS CNAME configured: music.navicore.tech → navicore-music.pages.dev
- ❌ Custom domain not added to Pages project (causing 522 error)