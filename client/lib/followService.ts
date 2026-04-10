import { createClient } from "@supabase/supabase-js";

// Validate environment variables
if (
  !import.meta.env.SUPABASE_URL ||
  !import.meta.env.SUPABASE_ANON_KEY
) {
  console.warn("Supabase environment variables are not configured");
}

const supabase = createClient(
  import.meta.env.SUPABASE_URL || "",
  import.meta.env.SUPABASE_ANON_KEY || "",
);

// Rate limiting: Store last follow action timestamp per followee
const followRateLimitMap = new Map<string, number>();
const RATE_LIMIT_SECONDS = 2; // Prevent more than one follow/unfollow per 2 seconds

export async function updateFollowStatus(
  followerAddress: string,
  followeeAddress: string,
  newStatus: "Follow" | "Unfollow",
): Promise<{
  success: boolean;
  error?: string;
  data?: any;
}> {
  // Validate inputs
  if (!followeeAddress || !followerAddress) {
    return {
      success: false,
      error: "Missing wallet addresses",
    };
  }

  // Rate limiting check
  const lastActionTime = followRateLimitMap.get(followerAddress);
  const now = Date.now();

  if (lastActionTime && now - lastActionTime < RATE_LIMIT_SECONDS * 1000) {
    const waitTime = Math.ceil(
      (RATE_LIMIT_SECONDS * 1000 - (now - lastActionTime)) / 1000,
    );
    return {
      success: false,
      error: `Please wait ${waitTime} second(s) before following/unfollowing again`,
    };
  }

  try {
    // Get current timestamp
    const transactionTime = new Date().toISOString();

    // First, try to find an existing record for this followee/follower pair
    let existingData: any;
    let fetchError: any;

    try {
      const result = await supabase
        .from("followlists")
        .select("id")
        .eq("followee_address", followeeAddress)
        .eq("follower_address", followerAddress)
        .order("created_at", { ascending: false })
        .limit(1);

      existingData = result.data;
      fetchError = result.error;
    } catch (networkError) {
      console.warn(
        "Network error fetching existing follow record:",
        networkError,
      );
      return {
        success: false,
        error: "Network error - unable to reach database. Please try again.",
      };
    }

    if (fetchError) {
      // Get error message without trying to re-read response body
      let errorMsg = "Unknown error";
      if (typeof fetchError === "object" && fetchError !== null) {
        errorMsg =
          (fetchError as any).message ||
          (fetchError as any).code ||
          JSON.stringify(fetchError);
      }
      console.warn("Error fetching existing follow record:", errorMsg);

      // If table doesn't exist, provide helpful error message
      if (
        errorMsg.includes("does not exist") ||
        errorMsg.includes("relation")
      ) {
        return {
          success: false,
          error: "Follow system not yet initialized. Please contact support.",
        };
      }

      // Don't throw error object, return error response instead
      return {
        success: false,
        error: errorMsg,
      };
    }

    let result;

    try {
      if (existingData && existingData.length > 0) {
        // Update existing record
        result = await supabase
          .from("followlists")
          .update({
            status: newStatus,
            transaction_time: transactionTime,
            updated_at: transactionTime,
          })
          .eq("id", existingData[0].id)
          .select();
      } else {
        // Insert new record
        result = await supabase
          .from("followlists")
          .insert({
            followee_address: followeeAddress,
            follower_address: followerAddress,
            status: newStatus,
            transaction_time: transactionTime,
          })
          .select();
      }
    } catch (networkError) {
      console.warn("Network error updating follow status:", networkError);
      return {
        success: false,
        error: "Network error - unable to reach database. Please try again.",
      };
    }

    if (result.error) {
      let errorMsg = "Unknown error";
      if (typeof result.error === "object" && result.error !== null) {
        errorMsg =
          (result.error as any).message ||
          (result.error as any).code ||
          JSON.stringify(result.error);
      }
      console.warn("Error updating follow status:", errorMsg);

      // Provide helpful error messages
      if (
        errorMsg.includes("does not exist") ||
        errorMsg.includes("relation")
      ) {
        return {
          success: false,
          error: "Follow system not yet initialized. Please contact support.",
        };
      }

      // Return error response instead of throwing
      return {
        success: false,
        error: errorMsg,
      };
    }

    // Update rate limit
    followRateLimitMap.set(followerAddress, now);

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    let errorMessage = "Failed to update follow status";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (
      typeof error === "object" &&
      error !== null &&
      "message" in error
    ) {
      errorMessage = (error as any).message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    console.warn("Follow status update error:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function getFollowStatus(
  followerAddress: string,
  followeeAddress: string,
): Promise<"Follow" | "Unfollow" | null> {
  try {
    if (!followeeAddress || !followerAddress) {
      console.warn("Missing wallet addresses for follow status check");
      return null;
    }

    let data: any;
    let error: any;

    try {
      const result = await supabase
        .from("followlists")
        .select("status")
        .eq("followee_address", followeeAddress)
        .eq("follower_address", followerAddress)
        .order("created_at", { ascending: false })
        .limit(1);

      data = result.data;
      error = result.error;
    } catch (networkError) {
      console.warn("Network error fetching follow status:", networkError);
      // Return null on network error - follow button will default to "Follow"
      return null;
    }

    if (error) {
      let errorMsg = "Unknown error";
      if (typeof error === "object" && error !== null) {
        errorMsg =
          (error as any).message ||
          (error as any).code ||
          JSON.stringify(error);
      }
      console.warn("Error fetching follow status:", errorMsg);
      // Table might not exist yet, which is expected during initial setup
      // Return null instead of throwing to avoid stream errors
      return null;
    }

    if (data && data.length > 0) {
      return data[0].status as "Follow" | "Unfollow";
    }

    return null;
  } catch (error) {
    if ((error as any)?.name !== "AbortError") {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn("Error getting follow status:", errorMsg);
    }
    return null;
  }
}
