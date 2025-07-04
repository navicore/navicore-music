# Add DNS Records for navicore.tech

## Quick DNS Setup

You need to add these DNS records in your Cloudflare dashboard:

1. **Go to**: https://dash.cloudflare.com
2. **Select**: navicore.tech domain
3. **Click**: DNS (in left sidebar)
4. **Add these records**:

### For the API:
```
Type: CNAME
Name: api
Target: navicore-music-api.workers.dev
Proxy: ✓ (Orange cloud ON)
```

### For the Music App:
```
Type: CNAME  
Name: music
Target: navicore-music.pages.dev
Proxy: ✓ (Orange cloud ON)
```

## After Adding DNS:

Your app will be available at:
- API: https://api.navicore.tech/health
- App: https://music.navicore.tech

DNS propagation is instant with Cloudflare!

## Alternative: Use Root Domain

If you want the app at navicore.tech instead of music.navicore.tech:
```
Type: CNAME
Name: @ (or navicore.tech)
Target: navicore-music.pages.dev
Proxy: ✓ (Orange cloud ON)
```