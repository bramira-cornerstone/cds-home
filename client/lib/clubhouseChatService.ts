export interface ChatMessage {
  id: number;
  team: string;
  wallet_address: string;
  username: string;
  created_at: string;
  message: string;
  thumbsUp?: number;
  thumbsDown?: number;
}

export async function fetchRecentTeamMessages(
  team: string,
  limit: number = 10,
): Promise<ChatMessage[]> {
  const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (!supabaseUrl || !anonKey) {
    return [];
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/clubhousechats?team=eq.${encodeURIComponent(team)}&order=created_at.desc&limit=${limit}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      if (response.status >= 500) {
        const statusMessage = response.statusText || `HTTP ${response.status}`;
        console.warn("Failed to fetch recent messages:", statusMessage);
      }
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    // Return in reverse order so newest is last
    return data.reverse();
  } catch (error) {
    return [];
  }
}

export async function fetchAllRecentMessages(
  limit: number = 10,
): Promise<ChatMessage[]> {
  const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (!supabaseUrl || !anonKey) {
    return [];
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/clubhousechats?order=created_at.desc&limit=${limit}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      if (response.status >= 500) {
        const statusMessage = response.statusText || `HTTP ${response.status}`;
        console.warn("Failed to fetch recent messages:", statusMessage);
      }
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    // Return in reverse order so newest is last
    return data.reverse();
  } catch (error) {
    return [];
  }
}
