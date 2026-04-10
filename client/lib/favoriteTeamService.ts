import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.SUPABASE_URL || "",
  import.meta.env.SUPABASE_ANON_KEY || "",
);

export async function getFavoriteTeam(
  walletAddress: string,
): Promise<string | null> {
  if (!walletAddress) {
    return null;
  }

  try {
    const normalizedAddress = walletAddress.toLowerCase();
    console.log("[getFavoriteTeam] Looking up favorite team for:", normalizedAddress);

    // Use ilike for case-insensitive comparison since data might be stored with different case
    const { data, error } = await supabase
      .from("profiles")
      .select("favorite_team")
      .ilike("wallet_address", normalizedAddress)
      .maybeSingle();

    if (error) {
      console.warn("[getFavoriteTeam] Query error:", error);
      return null;
    }

    console.log("[getFavoriteTeam] Result:", data?.favorite_team);
    return data?.favorite_team || null;
  } catch (err) {
    console.warn("[getFavoriteTeam] Exception:", err);
    return null;
  }
}

export async function updateFavoriteTeam(
  walletAddress: string,
  teamName: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (!walletAddress) {
    return { success: false, error: "Wallet address is required" };
  }

  try {
    const normalizedAddress = walletAddress.toLowerCase();
    console.log("[updateFavoriteTeam] Updating favorite team for:", normalizedAddress, "to:", teamName);

    const { error } = await supabase
      .from("profiles")
      .update({ favorite_team: teamName })
      .ilike("wallet_address", normalizedAddress);

    if (error) {
      console.warn("Error updating favorite team:", error);
      return { success: false, error: error.message };
    }

    console.log("[updateFavoriteTeam] Successfully updated favorite team");
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn("Error updating favorite team:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
