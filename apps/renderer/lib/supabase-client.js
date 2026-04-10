import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables",
  );
}

if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

export async function getRelicsWithoutSnapshots(limit = 10) {
  const { data, error } = await supabaseAdmin
    .from("RelicSerialsJoined")
    .select("token_id, edition_id, serial")
    .not("token_id", "is", null)
    .limit(limit);

  if (error) {
    console.error("[Supabase] Error fetching relics:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  const tokenIds = data.map((r) => r.token_id);

  const { data: snapshots, error: snapshotsError } = await supabaseAdmin
    .from("relic_image_snapshots")
    .select("token_id")
    .in("token_id", tokenIds);

  if (snapshotsError) {
    console.error("[Supabase] Error fetching snapshots:", snapshotsError);
    throw snapshotsError;
  }

  const existingTokenIds = new Set((snapshots || []).map((s) => s.token_id));

  return data.filter((r) => !existingTokenIds.has(r.token_id));
}

export async function markSnapshotAsPending(tokenId) {
  const { error } = await supabaseAdmin.from("relic_image_snapshots").upsert({
    token_id: tokenId,
    status: "rendering",
    render_version: "1.0",
    r2_bucket: process.env.STORAGE_BUCKET || "relic-images",
    r2_key: `relics/${tokenId}.webp`,
    image_url: "", // Will be updated after successful render
  });

  if (error) {
    console.error("[Supabase] Error marking snapshot as pending:", error);
    throw error;
  }
}

export async function markSnapshotAsCompleted(tokenId, imageUrl, renderTimeMs) {
  const { error } = await supabaseAdmin
    .from("relic_image_snapshots")
    .update({
      status: "completed",
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
      render_time_ms: renderTimeMs,
      error_message: null,
    })
    .eq("token_id", tokenId);

  if (error) {
    console.error("[Supabase] Error updating snapshot:", error);
    throw error;
  }
}

export async function markSnapshotAsFailed(tokenId, errorMessage) {
  const { error } = await supabaseAdmin
    .from("relic_image_snapshots")
    .update({
      status: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("token_id", tokenId);

  if (error) {
    console.error("[Supabase] Error marking snapshot as failed:", error);
  }
}
