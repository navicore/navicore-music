# DNS Setup for navicore.tech

## Recommended Subdomain Structure

Since your domain is already on Cloudflare, setting up DNS is easy!

### Option 1: Subdomains (Recommended)

Add these DNS records in your Cloudflare dashboard:

```
Type  Name    Content                          Proxy
CNAME music   navicore-music.pages.dev         ✓ Proxied
CNAME api     navicore-music-api.navicore.workers.dev  ✓ Proxied
```

This gives you:
- `https://music.navicore.tech` - Your music app
- `https://api.navicore.tech` - Your API endpoints

### Option 2: Root Domain

If you want the app at `navicore.tech`:

```
Type  Name    Content                          Proxy
CNAME @       navicore-music.pages.dev         ✓ Proxied
CNAME api     navicore-music-api.navicore.workers.dev  ✓ Proxied
```

### Option 3: Different Subdomain

Maybe you prefer `play.navicore.tech` or `stream.navicore.tech`:

```
Type  Name    Content                          Proxy
CNAME play    navicore-music.pages.dev         ✓ Proxied
CNAME api     navicore-music-api.navicore.workers.dev  ✓ Proxied
```

## Manual Setup Steps

1. Go to your Cloudflare Dashboard
2. Select `navicore.tech`
3. Click on "DNS" in the sidebar
4. Add the CNAME records above

## Automatic Setup (After Deployment)

The deployment script will give you direct links to:
1. Configure custom domain for Pages
2. Configure routes for Workers

## SSL/TLS

Since you're using Cloudflare, you automatically get:
- Free SSL certificates
- Automatic HTTPS
- HTTP/3 support
- DDoS protection

## Testing

After DNS propagation (usually instant with Cloudflare):

```bash
# Test API
curl https://api.navicore.tech/health

# Visit app
open https://music.navicore.tech
```