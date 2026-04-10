function headers(anonKey: string, includePrefer = false) {
  const baseHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  } as Record<string, string>;

  if (includePrefer) {
    baseHeaders["Prefer"] = "return=representation";
  }

  return baseHeaders;
}

export interface EmojiReaction {
  id: string;
  event_id: string;
  emoji: string;
  wallet_address: string;
  reactee_wallet_address?: string;
  created_at: string;
}

/**
 * Normalize an event ID for emoji reactions
 * Returns the ID as-is since the database should support staking and redemption event IDs
 */
function normalizeEventId(eventId: string): string {
  return eventId;
}

export async function saveEmojiReaction(
  eventId: string,
  emoji: string,
  walletAddress: string,
  reacteeWalletAddress?: string,
): Promise<EmojiReaction | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("Supabase credentials missing");
    return null;
  }

  // Validate eventId
  if (!eventId || typeof eventId !== "string") {
    return null;
  }

  // Normalize eventId (convert UUIDs to numeric if needed)
  const normalizedEventId = normalizeEventId(eventId);

  try {

    // First, check if a reaction already exists for this user on this event
    const checkUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/emoji_reactions?event_id=eq.${encodeURIComponent(
      normalizedEventId,
    )}&wallet_address=eq.${encodeURIComponent(walletAddress)}&select=id`;

    const checkRes = await fetch(checkUrl, {
      headers: headers(anonKey),
    });

    if (checkRes.ok) {
      const existingReactions = (await checkRes.json()) as Array<{
        id: string;
      }>;

      if (existingReactions.length > 0) {
        // Update existing reaction
        const updateUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/emoji_reactions?id=eq.${existingReactions[0].id}`;

        const updateRes = await fetch(updateUrl, {
          method: "PATCH",
          headers: headers(anonKey, true),
          body: JSON.stringify({ emoji }),
        });

        if (updateRes.ok) {
          const text = await updateRes.text();
          if (text) {
            const updated = JSON.parse(text) as EmojiReaction[];
            return updated.length > 0 ? updated[0] : null;
          }
          return {
            id: existingReactions[0].id,
            event_id: normalizedEventId,
            emoji,
            wallet_address: walletAddress,
            created_at: new Date().toISOString(),
          };
        }
      }
    }

    // Create new reaction
    const createUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/emoji_reactions`;
    const requestBody = {
      event_id: normalizedEventId,
      emoji,
      wallet_address: walletAddress,
      ...(reacteeWalletAddress && {
        reactee_wallet_address: reacteeWalletAddress,
      }),
    };

    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: headers(anonKey, true),
      body: JSON.stringify(requestBody),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      const headers = Object.fromEntries(createRes.headers.entries());
      console.error("[saveEmojiReaction] ❌ FAILED - Response not OK");
      console.error(
        "[saveEmojiReaction] Status:",
        createRes.status,
        createRes.statusText,
      );
      console.error("[saveEmojiReaction] Response headers:", headers);
      console.error("[saveEmojiReaction] Response body:", errorText);
      console.error(
        "[saveEmojiReaction] Request body was:",
        JSON.stringify(requestBody),
      );

      try {
        const errorJson = JSON.parse(errorText);
        console.error(
          "[saveEmojiReaction] Parsed error:",
          JSON.stringify(errorJson, null, 2),
        );

        // Log specific Supabase error details if available
        if (errorJson?.message) {
          console.error(
            "[saveEmojiReaction] Error message:",
            errorJson.message,
          );
        }
        if (errorJson?.details) {
          console.error(
            "[saveEmojiReaction] Error details:",
            errorJson.details,
          );
        }
        if (errorJson?.hint) {
          console.error("[saveEmojiReaction] Error hint:", errorJson.hint);
        }
      } catch (parseErr) {
        console.error("[saveEmojiReaction] Could not parse error as JSON");
      }
      return null;
    }

    const text = await createRes.text();

    if (text) {
      const created = JSON.parse(text) as EmojiReaction[];
      return created.length > 0 ? created[0] : null;
    }
    // Return a mock object if no response body
    return {
      id: "temp",
      event_id: eventId,
      emoji,
      wallet_address: walletAddress,
      created_at: new Date().toISOString(),
    };
  } catch (err) {
    return null;
  }
}

export async function fetchEmojiReactionsForEvent(
  eventId: string,
  signal?: AbortSignal,
): Promise<EmojiReaction[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    return [];
  }

  // Normalize eventId (convert UUIDs to numeric if needed)
  const normalizedEventId = normalizeEventId(eventId);

  let timeoutId: NodeJS.Timeout | undefined;

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/emoji_reactions?event_id=eq.${encodeURIComponent(
      normalizedEventId,
    )}&select=*`;

    let finalSignal = signal;

    if (!signal) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000);
      finalSignal = controller.signal;
    }

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal: finalSignal,
    }).catch(() => null);

    if (timeoutId) clearTimeout(timeoutId);

    if (!res) return [];
    if (!res.ok) return [];

    const text = await res.text().catch(() => "");
    if (!text) return [];

    try {
      return JSON.parse(text) as EmojiReaction[];
    } catch {
      return [];
    }
  } catch {
    // Silently handle all errors
    if (timeoutId) clearTimeout(timeoutId);
    return [];
  }
}

export async function fetchUserReactionForEvent(
  eventId: string,
  walletAddress: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    return null;
  }

  // Normalize eventId (convert UUIDs to numeric if needed)
  const normalizedEventId = normalizeEventId(eventId);

  let timeoutId: NodeJS.Timeout | undefined;

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/emoji_reactions?event_id=eq.${encodeURIComponent(
      normalizedEventId,
    )}&wallet_address=eq.${encodeURIComponent(walletAddress)}&select=emoji&limit=1`;

    let finalSignal = signal;

    if (!signal) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000);
      finalSignal = controller.signal;
    }

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal: finalSignal,
    }).catch(() => null);

    if (timeoutId) clearTimeout(timeoutId);

    if (!res) return null;
    if (!res.ok) return null;

    const text = await res.text().catch(() => "");
    if (!text) return null;

    try {
      const reactions = JSON.parse(text) as Array<{ emoji: string }>;
      return reactions.length > 0 ? reactions[0].emoji : null;
    } catch {
      return null;
    }
  } catch {
    // Silently handle all errors
    if (timeoutId) clearTimeout(timeoutId);
    return null;
  }
}

export async function fetchEmojiReactionsForWallet(
  walletAddress: string,
): Promise<EmojiReaction[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/emoji_reactions?reactee_wallet_address=eq.${encodeURIComponent(
      walletAddress,
    )}&select=*`;

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (!res) return [];
    if (!res.ok) return [];

    const text = await res.text().catch(() => "");
    if (!text) return [];

    try {
      return JSON.parse(text) as EmojiReaction[];
    } catch {
      return [];
    }
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

export async function deleteEmojiReaction(
  eventId: string,
  walletAddress: string,
): Promise<boolean> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    return false;
  }

  // Normalize eventId (convert UUIDs to numeric if needed)
  const normalizedEventId = normalizeEventId(eventId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/emoji_reactions?event_id=eq.${encodeURIComponent(
      normalizedEventId,
    )}&wallet_address=eq.${encodeURIComponent(walletAddress)}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: headers(anonKey),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);
    return res?.ok || false;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}
