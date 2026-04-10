import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.SUPABASE_URL || "",
  import.meta.env.SUPABASE_ANON_KEY || "",
);

export interface Followee {
  followeeAddress: string;
  username: string | null;
  favoriteTeam: string | null;
  rmvHeld?: number;
}

export async function fetchFollowees(
  followerAddress: string,
): Promise<Followee[]> {
  if (!followerAddress) {
    return [];
  }

  // Fetch all followees where this user is the follower and status is "Follow"
  // Use ilike for case-insensitive wallet address matching
  const { data: followData, error: followError } = await supabase
    .from("followlists")
    .select("followee_address")
    .ilike("follower_address", followerAddress)
    .eq("status", "Follow");

  if (followError) {
    console.warn("Could not fetch follows - returning empty list");
    return [];
  }

  if (!followData || followData.length === 0) {
    return [];
  }

  // Get unique followee addresses
  const followeeAddresses = [
    ...new Set(followData.map((f) => f.followee_address)),
  ];

  // Fetch profiles for all followees (normalize to lowercase for matching)
  const normalizedAddresses = followeeAddresses.map((addr) => addr.toLowerCase());
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("wallet_address, username, favorite_team")
    .in("wallet_address", normalizedAddresses);

  if (profileError) {
    console.warn("Could not fetch profiles - using wallet addresses as names");
    // Return partial data with just wallet addresses if profile fetch fails
    return followeeAddresses.map((address) => ({
      followeeAddress: address,
      username: address.slice(0, 8) + "...",
      favoriteTeam: null,
    }));
  }

  // Map profiles to followees (case-insensitive matching)
  const followees: Followee[] = followeeAddresses.map((address) => {
    const profile = profileData?.find(
      (p) => p.wallet_address.toLowerCase() === address.toLowerCase(),
    );
    return {
      followeeAddress: address,
      username: profile?.username || address.slice(0, 8) + "...",
      favoriteTeam: profile?.favorite_team || null,
    };
  });

  return followees;
}

export async function getUsernameForWalletAddress(
  walletAddress: string,
): Promise<string | null> {
  if (!walletAddress) {
    return null;
  }

  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .ilike("wallet_address", walletAddress)
      .limit(1)
      .single();

    if (profileError) {
      // User not found or error - return null to fall back to wallet address
      console.warn(
        `Could not fetch username for ${walletAddress}:`,
        profileError,
      );
      return null;
    }

    return profileData?.username || null;
  } catch (err) {
    return null;
  }
}

export function getTeamCrestPath(teamName: string | null): string {
  if (!teamName) {
    return "/images/teams/wfl_crest.png";
  }

  // Convert team name to crest filename format (lowercase with underscores)
  const crestName = teamName.toLowerCase().replace(/\s+/g, "_");
  return `/images/teams/${crestName}_crest.webp`;
}
