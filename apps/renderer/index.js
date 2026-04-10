/******************************************************************
 * Background Renderer Worker
 *
 * Purpose:
 * - Runs continuously on Render
 * - Polls Supabase for relics missing snapshots
 * - Renders snapshots via Puppeteer
 * - Uploads images to Cloudflare R2
 * - Marks success/failure in Supabase
 *
 * This process MUST stay alive at all times.
 ******************************************************************/

import {
  getRelicsWithoutSnapshots,
  markSnapshotAsPending,
  markSnapshotAsCompleted,
  markSnapshotAsFailed,
} from "./lib/supabase-client.js";

import { renderSnapshot } from "./lib/puppeteer-renderer.js";
import { uploadToR2 } from "./lib/r2-uploader.js";

/******************************************************************
 * Configuration (from environment variables)
 ******************************************************************/

const RENDERER_CONCURRENCY = Number(process.env.RENDERER_CONCURRENCY || 2);
const RETRY_ATTEMPTS = Number(process.env.RENDERER_RETRY_ATTEMPTS || 3);
const RETRY_DELAY_MS = Number(process.env.RENDERER_RETRY_DELAY_MS || 5000);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 60000);

/******************************************************************
 * Heartbeat
 * Render needs continuous logs to know this worker is alive.
 ******************************************************************/

function startHeartbeat() {
  console.log("[RENDERER] Heartbeat started");

  return setInterval(() => {
    console.log("[RENDERER] Heartbeat @", new Date().toISOString());
  }, 30000);
}

/******************************************************************
 * Sleep helper
 ******************************************************************/

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/******************************************************************
 * Render one token with retry logic
 ******************************************************************/

async function renderTokenWithRetry(tokenId) {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(
        `[RENDERER] Rendering token ${tokenId} (attempt ${attempt}/${RETRY_ATTEMPTS})`,
      );

      const { buffer, renderTime } = await renderSnapshot(tokenId);
      const publicUrl = await uploadToR2(tokenId, buffer);

      await markSnapshotAsCompleted(tokenId, publicUrl, renderTime);

      console.log(`[RENDERER] ✓ Completed token ${tokenId}`);
      return;
    } catch (error) {
      const message = error?.message || String(error);
      console.error(`[RENDERER] Error rendering token ${tokenId}:`, message);

      if (attempt < RETRY_ATTEMPTS) {
        console.log(`[RENDERER] Retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        console.error(`[RENDERER] ✗ Failed token ${tokenId}`);
        await markSnapshotAsFailed(tokenId, message);
      }
    }
  }
}

/******************************************************************
 * Main queue processor
 ******************************************************************/

let isProcessing = false;

async function processQueue() {
  if (isProcessing) {
    console.log("[RENDERER] Queue already processing, skipping cycle");
    return;
  }

  isProcessing = true;

  try {
    console.log(
      `[RENDERER] Polling for relics (limit ${RENDERER_CONCURRENCY})`,
    );

    const relics = await getRelicsWithoutSnapshots(RENDERER_CONCURRENCY);

    if (!relics || relics.length === 0) {
      console.log("[RENDERER] No relics found");
      return;
    }

    console.log(`[RENDERER] Found ${relics.length} relic(s)`);

    const tasks = relics.map(async (relic) => {
      const tokenId = relic.token_id;

      try {
        await markSnapshotAsPending(tokenId);
        await renderTokenWithRetry(tokenId);
      } catch (error) {
        console.error(`[RENDERER] Fatal error for token ${tokenId}`, error);
        await markSnapshotAsFailed(tokenId, error?.message || String(error));
      }
    });

    await Promise.all(tasks);

    console.log("[RENDERER] Batch completed");
  } catch (error) {
    console.error("[RENDERER] Queue error:", error);
  } finally {
    isProcessing = false;
  }
}

/******************************************************************
 * Startup
 ******************************************************************/

console.log("==================================================");
console.log("[RENDERER] Background Renderer Service Starting");
console.log("==================================================");

console.log("[RENDERER] Configuration:");
console.log("  Concurrency:", RENDERER_CONCURRENCY);
console.log("  Retry attempts:", RETRY_ATTEMPTS);
console.log("  Retry delay (ms):", RETRY_DELAY_MS);
console.log("  Poll interval (ms):", POLL_INTERVAL_MS);

const heartbeatInterval = startHeartbeat();

/******************************************************************
 * Run immediately, then on an interval
 ******************************************************************/

processQueue().catch((err) => {
  console.error("[RENDERER] Initial run error:", err);
});

const pollInterval = setInterval(() => {
  processQueue().catch((err) => {
    console.error("[RENDERER] Polling error:", err);
  });
}, POLL_INTERVAL_MS);

function shutdown(signal) {
  console.log(`[RENDERER] ${signal} received. Shutting down.`);
  clearInterval(pollInterval);
  clearInterval(heartbeatInterval);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
