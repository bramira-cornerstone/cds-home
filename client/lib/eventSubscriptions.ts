import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;

export interface EventSubscription {
  wallet_address: string;
  edition_id: number;
  created_at: string;
}

export async function toggleEditionSubscription(
  walletAddress: string,
  editionId: number,
): Promise<{
  success: boolean;
  isSubscribed: boolean;
  error?: string;
}> {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        isSubscribed: false,
        error: "Supabase configuration missing",
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const normalizedWallet = walletAddress.toLowerCase();

    // Check if subscription already exists
    const { data: existingData, error: checkError } = await supabase
      .from("eventsubscriptions")
      .select("id")
      .eq("wallet_address", normalizedWallet)
      .eq("edition_id", editionId)
      .maybeSingle();

    if (checkError) {
      console.warn("Error checking subscription:", checkError);
      return {
        success: false,
        isSubscribed: false,
        error: checkError.message,
      };
    }

    const isCurrentlySubscribed = existingData != null;

    if (isCurrentlySubscribed) {
      // Delete the subscription record
      const { error: deleteError } = await supabase
        .from("eventsubscriptions")
        .delete()
        .eq("wallet_address", normalizedWallet)
        .eq("edition_id", editionId);

      if (deleteError) {
        console.warn("Error deleting subscription:", deleteError);
        return {
          success: false,
          isSubscribed: true,
          error: deleteError.message,
        };
      }

      return {
        success: true,
        isSubscribed: false,
      };
    } else {
      // Insert a new subscription record
      const { error: insertError } = await supabase
        .from("eventsubscriptions")
        .insert({
          wallet_address: normalizedWallet,
          edition_id: editionId,
        });

      if (insertError) {
        console.warn("Error inserting subscription:", insertError);
        return {
          success: false,
          isSubscribed: false,
          error: insertError.message,
        };
      }

      return {
        success: true,
        isSubscribed: true,
      };
    }
  } catch (err) {
    console.warn("Error toggling subscription:", err);
    return {
      success: false,
      isSubscribed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function checkEditionSubscription(
  walletAddress: string,
  editionId: number,
): Promise<boolean> {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const normalizedWallet = walletAddress.toLowerCase();

    const { data, error } = await supabase
      .from("eventsubscriptions")
      .select("id")
      .eq("wallet_address", normalizedWallet)
      .eq("edition_id", editionId)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Error checking subscription:", err);
    return false;
  }
}

export async function getSubscribedEditions(
  walletAddress: string,
): Promise<number[]> {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return [];
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const normalizedWallet = walletAddress.toLowerCase();

    const { data, error } = await supabase
      .from("eventsubscriptions")
      .select("edition_id")
      .eq("wallet_address", normalizedWallet)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => row.edition_id);
  } catch (err) {
    console.warn("Error getting subscribed editions:", err);
    return [];
  }
}
