# Cloudflare Authentication & Security

## How Wrangler Authentication Works

### 1. OAuth Login (Recommended)
When you run `npx wrangler login`:
- Opens your browser to Cloudflare's OAuth page
- You login with your Cloudflare account
- Cloudflare generates an OAuth token
- Token is stored locally in `~/.wrangler/config/default.toml`
- **Your password is NEVER stored or seen by wrangler**

### 2. What Gets Stored Locally
```toml
# ~/.wrangler/config/default.toml
[oauth_token]
token = "your-oauth-token-here"
expiration_time = "2024-12-31T00:00:00Z"
```

### 3. API Token (Alternative for CI/CD)
For automated deployments, you can use a scoped API token:
```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

## Security Best Practices

### ✅ DO:
1. **Use OAuth for local development**
   - Most secure for interactive use
   - Tokens expire and can be revoked

2. **Use API tokens for CI/CD**
   - Create tokens with minimal permissions
   - Scope to specific zones/accounts

3. **Store tokens securely**
   - Never commit tokens to git
   - Use GitHub secrets for CI/CD
   - Use environment variables

### ❌ DON'T:
1. **Never use Global API Key**
   - Too much access
   - Use scoped API tokens instead

2. **Never commit credentials**
   - Add `~/.wrangler` to global gitignore
   - Check `.env` files before committing

## Creating a Scoped API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom token" template
4. Set permissions:
   ```
   Account Resources:
   - Cloudflare Pages:Edit
   - Cloudflare Workers Routes:Edit
   - D1:Edit
   - R2:Edit
   
   Zone Resources:
   - Zone:Read (for navicore.tech)
   - Workers Routes:Edit (for navicore.tech)
   ```

## Local Development Setup

```bash
# Option 1: Interactive OAuth (Recommended)
npx wrangler login
# This opens browser, you login, token stored locally

# Option 2: API Token (for scripts/CI)
export CLOUDFLARE_API_TOKEN="your-token"
npx wrangler deploy
```

## Where Credentials Are Used

1. **Wrangler Commands**:
   - Deploy Workers/Pages
   - Create/manage R2 buckets
   - Create/manage D1 databases
   - Read zone information

2. **What Wrangler CANNOT Do**:
   - Access your Cloudflare password
   - Modify billing information
   - Delete your account
   - Access other Cloudflare accounts

## Revoking Access

### OAuth Tokens:
```bash
npx wrangler logout
```

### API Tokens:
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Revoke" next to the token

## For Your Deployment

The `deploy-navicore-tech.sh` script will:
1. Check if you're logged in
2. Prompt for OAuth login if needed
3. Use your credentials to:
   - Create R2 bucket (navicore-music-files)
   - Create D1 database (navicore-music)
   - Deploy Worker API
   - Deploy Pages frontend
   - All within YOUR account only

## Token Storage Locations

- **OAuth Token**: `~/.wrangler/config/default.toml`
- **Temp Auth**: `~/.wrangler/.auth`
- **Never in**: Your project directory

## Verification

Check what account you're using:
```bash
npx wrangler whoami
```

Output shows:
```
Getting User settings...
👤 You are logged in with an OAuth Token as:
├ Email: your-email@example.com
├ Account ID: your-account-id
└ Account Name: Your Account Name
```