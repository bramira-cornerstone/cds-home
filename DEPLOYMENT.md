# Deployment Guide - Cloudflare Pages

## Overview

This project is configured to deploy on Cloudflare Pages. The application uses environment variables split into two categories:

1. **Safe to commit** (`VITE_*` prefixed): Client-side variables stored in `.env`
2. **Sensitive** (non-`VITE_` prefixed): Server-side secrets managed by Cloudflare Pages

## Environment Variables Setup

### Step 1: Commit Safe Variables

The `.env` file contains only `VITE_*` prefixed variables that are safe to commit to GitHub:

```env
SUPABASE_URL=...
VITE_MARKETPLACE_ADDRESS=...
VITE_ERC721_ADDRESS=...
VITE_ERC1155_ADDRESS=...
GOOGLE_ANALYTICS_TOKEN=...
MIXPANEL_TOKEN=...
```

These are injected at **build time** via `vite.config.ts` and are included in the production bundle.

### Step 2: Set Sensitive Variables in Cloudflare Pages

The following variables **must be set in Cloudflare Pages dashboard** (not in `.env` file):

#### Required for Production:
- `SUPABASE_ANON_KEY` - Supabase anonymous API key
- `THIRDWEB_CLIENT_ID` - Thirdweb client ID
- `RPC_KEY` - Alchemy RPC key (optional)

#### How to Set in Cloudflare Pages:

1. Go to your Cloudflare Pages project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Click **Add variable**
4. For each variable:
   - **Variable name**: (e.g., `SUPABASE_ANON_KEY`)
   - **Value**: (paste the actual secret value)
   - **Environments**: Select "Production" (and optionally "Preview" for testing)
5. Click **Save**

#### Production Build Process:

When Cloudflare Pages builds your project:
1. It reads `VITE_*` variables from `.env` (committed to GitHub)
2. It reads sensitive variables from Cloudflare Environment Variables
3. `vite.config.ts` reads both sources: `envVars.VAR_NAME || process.env.VAR_NAME`
4. Build-time injection via `define` plugin embeds these in the production bundle

## Why This Approach?

- ✅ **Safe secrets**: Sensitive values never committed to Git
- ✅ **No .env bloat**: Only necessary variables in repository
- ✅ **Build-time injection**: Variables embedded during Cloudflare's build
- ✅ **Fallback support**: Code falls back to empty strings if variables missing
- ✅ **Easy updates**: Change secrets in Cloudflare dashboard without redeploying code

## Troubleshooting

### Issue: "Site won't load in production"
**Solution**: Verify all `SUPABASE_ANON_KEY`, `THIRDWEB_CLIENT_ID` are set in Cloudflare Pages environment variables.

### Issue: "API calls failing with 401/403"
**Solution**: Check that the values in Cloudflare Pages match your actual API credentials (not placeholders).

### Issue: "Local dev works but production fails"
**Solution**: Ensure `.env` file exists locally with `VITE_*` variables. Cloudflare Pages will override with its own environment variables during build.

## Local Development

For local development:
1. Copy `.env.example` to `.env`
2. Fill in `VITE_*` values (from `.env.example`)
3. Fill in sensitive values (from your Cloudflare Pages environment variables)
4. Run `npm run dev`

The `vite.config.ts` will load these from your local `.env` file during development.
