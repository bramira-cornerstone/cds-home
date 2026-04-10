# Cloudflare R2 Setup Guide

This guide explains how to set up Cloudflare R2 for storing relic snapshot images.

## Prerequisites

- Cloudflare account with R2 enabled
- Access to Cloudflare dashboard

## Step 1: Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the left sidebar
3. Click **Create bucket**
4. Name it `relic-images`
5. Choose your preferred region
6. Click **Create bucket**

## Step 2: Create R2 API Token

1. In the R2 dashboard, click **API Tokens** in the left sidebar (under "Settings")
2. Click **Create API token**
3. Name it something like `renderer-service`
4. Select **Read and Write** permissions
5. For "Object path prefix", you can leave it empty or specify `relics/*`
6. Click **Create API token**
7. Copy and save:
   - **Access Key ID**
   - **Secret Access Key**
   - **S3 API Endpoint** (format: `https://your-account-id.r2.cloudflarestorage.com`)

## Step 3: Set Up Public Access (Optional)

To serve images via a custom domain:

1. In your R2 bucket settings, click **Settings**
2. Scroll to **Bucket details**
3. Copy your **S3 API Endpoint** and **R2.dev URL** (if available)
4. For custom domain, you can:
   - Use Cloudflare Pages custom domain with a redirect
   - Use a separate subdomain with CNAME pointing to R2

### Option A: Cloudflare Pages Redirect

If your main site is on Cloudflare Pages, you can add a `_redirects` file:

```
/images/relics/*  https://yourbucket.r2.cloudflarestorage.com/relics/:splat  200
```

### Option B: Custom Domain (CNAME)

1. Create a CNAME record in your DNS pointing to R2:
   - Name: `images.yourdomain.com`
   - Target: `yourbucket.r2.cloudflarestorage.com`

2. Configure CORS in R2 bucket settings if needed

## Step 4: Configure Renderer Service

1. Copy `apps/renderer/.env.example` to `apps/renderer/.env`
2. Fill in the values:

```env
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFLARE_R2_PUBLIC_URL=https://images.yourdomain.com
SNAPSHOT_BASE_URL=https://yourdomain.com/snapshot/relic
```

## Step 5: Verify Upload

After running the renderer, you should see:

- Files in R2 bucket at `relics/{token_id}.webp`
- Database records updated with image URLs

### Verify via CLI

```bash
aws s3 ls s3://relic-images/relics/ \
  --endpoint-url https://your-account-id.r2.cloudflarestorage.com \
  --region auto \
  --access-key=YOUR_ACCESS_KEY \
  --secret-key=YOUR_SECRET_KEY
```

## Troubleshooting

### 403 Forbidden Errors

- Check that your R2 API token has **Read and Write** permissions
- Verify the endpoint URL is correct
- Check that bucket name matches in code

### Images Not Loading

- Verify `CLOUDFLARE_R2_PUBLIC_URL` is correct
- Check R2 bucket public access settings
- Verify DNS configuration if using custom domain

### Slow Uploads

- Consider R2's rate limits (check Cloudflare docs)
- Increase `RENDERER_CONCURRENCY` carefully (uses more bandwidth)
- Monitor R2 usage in the Cloudflare dashboard

## Cost Optimization

R2 pricing (as of 2024):

- **Storage**: $0.015/GB/month (first 100GB/month free)
- **API Requests**: $0.36 per million requests (first 3M free)
- **Egress**: Free (unlike AWS S3)

Tips:

- Images are cached via `Cache-Control: max-age=31536000, immutable`
- CDN caching reduces API requests
- Consider setting a lifecycle policy to delete old images if needed

## Integration with CDN

### Cloudflare Pages

If using Cloudflare Pages for your main site, configure the `_redirects` file:

```
# Serve static relic images from R2
/images/relics/*  https://relic-images.r2.cloudflarestorage.com/relics/:splat  200
```

### Custom CDN

You can use any CDN in front of R2:

1. Point CDN origin to your R2 endpoint or custom domain
2. Update `CLOUDFLARE_R2_PUBLIC_URL` to CDN URL
3. CDN will cache immutable WebP files for best performance
