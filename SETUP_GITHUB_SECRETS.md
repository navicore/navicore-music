# GitHub Actions Secrets Setup

To enable automatic deployments via GitHub Actions, you need to set up the following secrets in your GitHub repository:

## Required Secrets

### 1. CLOUDFLARE_API_TOKEN

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom token" template with these permissions:
   - **Account permissions:**
     - Cloudflare Workers Scripts: Edit
     - Cloudflare Pages: Edit  
     - D1: Edit
     - R2: Edit
   - **Zone permissions for navicore.tech:**
     - Zone: Read
     - Workers Routes: Edit
   - **User permissions (optional but recommended):**
     - User Details: Read
4. Copy the token and add it as `CLOUDFLARE_API_TOKEN` in GitHub Secrets

### 2. CLOUDFLARE_ACCOUNT_ID

1. Go to Cloudflare dashboard
2. Select any domain in your account
3. Find "Account ID" in the right sidebar
4. Copy and add it as `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets

## Adding Secrets to GitHub

1. Go to your repository on GitHub
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the exact names above

## Testing

Once secrets are configured, you can:
- Push to main branch to trigger automatic deployment
- Or manually trigger via Actions tab → Deploy to Cloudflare → Run workflow

## Deployment Details

The workflow will:
1. Deploy the Worker API to `api.navicore.tech`
2. Deploy the Pages frontend to `music.navicore.tech`

Both deployments use the same configuration as our manual `npm run deploy` command.