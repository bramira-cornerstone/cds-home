# Relic Snapshot Renderer

Background service for generating WebP snapshot images of relic EditionSplineScene renders.

## Structure

- `index.js` - Entry point, orchestrates rendering jobs
- `Dockerfile` - Container configuration for Docker deployment
- `package.json` - Dependencies and scripts

## Running Locally

```bash
cd apps/renderer
npm install
npm start
```

## Building Docker Image

```bash
docker build -t relic-snapshot-renderer:latest -f apps/renderer/Dockerfile .
```

## Running in Docker

```bash
docker run --env-file .env relic-snapshot-renderer:latest
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

- `SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for privileged DB access)
- `SNAPSHOT_BASE_URL` - Base URL of snapshot endpoint (e.g., `https://mysite.com/snapshot/relic`)
- `STORAGE_BUCKET` - Supabase storage bucket name for images
- `RENDERER_CONCURRENCY` - Number of concurrent Puppeteer instances (recommended: 2-4)
- `RENDERER_RETRY_ATTEMPTS` - Number of retry attempts for failed renders
- `RENDERER_RETRY_DELAY_MS` - Delay between retries in milliseconds

## Deployment

Deploy to Render as a Background Worker:

1. Create new Background Worker
2. Connect this GitHub repo
3. Set root directory to `apps/renderer`
4. Add environment variables from `.env`
5. Deploy

## Note

This service does NOT run a web server. It is a long-running background worker that:

1. Polls Supabase for new relics
2. Renders snapshots using Puppeteer
3. Uploads WebP images to Supabase Storage
4. Updates tracking table with completion status

It has no impact on the main Cloudflare Pages deployment.
