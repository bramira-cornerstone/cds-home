import {
  supabaseAdmin,
  markSnapshotAsPending,
  markSnapshotAsCompleted,
  markSnapshotAsFailed,
} from "../lib/supabase-client.js";
import { renderSnapshot } from "../lib/puppeteer-renderer.js";
import { uploadToR2 } from "../lib/r2-uploader.js";

const RENDERER_CONCURRENCY = parseInt(
  process.env.RENDERER_CONCURRENCY || "2",
  10,
);
const BATCH_SIZE = 100;

let processedCount = 0;
let successCount = 0;
let failureCount = 0;

async function renderWithRetry(tokenId, attempt = 1) {
  try {
    const { buffer, renderTime } = await renderSnapshot(tokenId);
    const publicUrl = await uploadToR2(tokenId, buffer);
    await markSnapshotAsCompleted(tokenId, publicUrl, renderTime);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markSnapshotAsFailed(tokenId, errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function processRelicsInBatch(batch) {
  const tasks = batch.map((relic) =>
    renderWithRetry(relic.token_id).then((result) => ({
      tokenId: relic.token_id,
      ...result,
    })),
  );

  const results = await Promise.all(tasks);

  for (const result of results) {
    processedCount++;
    if (result.success) {
      successCount++;
      console.log(
        `[Backfill] ✓ ${processedCount} - Token ${result.tokenId} rendered successfully`,
      );
    } else {
      failureCount++;
      console.log(
        `[Backfill] ✗ ${processedCount} - Token ${result.tokenId} failed: ${result.error}`,
      );
    }
  }
}

async function backfill() {
  console.log("[Backfill] Starting backfill process...");
  console.log(`[Backfill] Concurrency: ${RENDERER_CONCURRENCY}`);
  console.log(`[Backfill] Batch size: ${BATCH_SIZE}`);

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`[Backfill] Fetching batch at offset ${offset}...`);

      const { data: relics, error } = await supabaseAdmin
        .from("RelicSerialsJoined")
        .select("token_id")
        .not("token_id", "is", null)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error("[Backfill] Database error:", error);
        process.exit(1);
      }

      if (!relics || relics.length === 0) {
        hasMore = false;
        break;
      }

      const tokenIds = relics.map((r) => r.token_id);

      const { data: existingSnapshots } = await supabaseAdmin
        .from("relic_image_snapshots")
        .select("token_id")
        .in("token_id", tokenIds);

      const existingSet = new Set(
        (existingSnapshots || []).map((s) => s.token_id),
      );
      const relicsToRender = relics.filter((r) => !existingSet.has(r.token_id));

      if (relicsToRender.length === 0) {
        console.log(
          `[Backfill] All ${relics.length} relics in this batch already have snapshots`,
        );
        offset += BATCH_SIZE;
        continue;
      }

      console.log(
        `[Backfill] Processing ${relicsToRender.length}/${relics.length} relics in this batch`,
      );

      // Mark all as pending first
      for (const relic of relicsToRender) {
        try {
          await markSnapshotAsPending(relic.token_id);
        } catch (err) {
          console.error(
            `[Backfill] Failed to mark token ${relic.token_id} as pending:`,
            err,
          );
        }
      }

      // Process with concurrency limit
      for (let i = 0; i < relicsToRender.length; i += RENDERER_CONCURRENCY) {
        const chunk = relicsToRender.slice(i, i + RENDERER_CONCURRENCY);
        await processRelicsInBatch(chunk);
      }

      offset += BATCH_SIZE;
    } catch (error) {
      console.error("[Backfill] Unexpected error:", error);
      process.exit(1);
    }
  }

  console.log("\n[Backfill] ===== FINAL RESULTS =====");
  console.log(`[Backfill] Total processed: ${processedCount}`);
  console.log(`[Backfill] Successful: ${successCount}`);
  console.log(`[Backfill] Failed: ${failureCount}`);
  console.log("[Backfill] Backfill complete!");
  process.exit(failureCount > 0 ? 1 : 0);
}

backfill().catch((err) => {
  console.error("[Backfill] Fatal error:", err);
  process.exit(1);
});
