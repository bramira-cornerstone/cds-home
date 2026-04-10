/**
 * Server-side drop queue management using Supabase
 * Replaces sessionStorage with persistent, global queue state
 * 
 * Table structure expected:
 * - id: uuid (primary key)
 * - queue_id: uuid (unique identifier for this queue entry)
 * - token_id: text (the box token ID)
 * - wallet_address: text (user's wallet address, lowercase)
 * - joined_at: timestamp (when user joined the queue)
 * - turn_started_at: timestamp (when user's turn began at position 0)
 * - status: text ('waiting' | 'active' | 'completed' | 'removed')
 * - created_at: timestamp
 * - updated_at: timestamp
 */

export interface QueueEntry {
  id: string;
  queue_id: string;
  token_id: string;
  wallet_address: string;
  joined_at: string;
  turn_started_at: string | null;
  status: 'waiting' | 'active' | 'completed' | 'removed';
  created_at: string;
  updated_at: string;
}

const TURN_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Get Supabase configuration from environment
 */
function getSupabaseConfig() {
  const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error('[dropQueueServerUtils] Supabase configuration missing', {
      hasUrl: !!baseUrl,
      hasKey: !!anonKey,
      url: baseUrl,
    });
    throw new Error('Supabase configuration missing - SUPABASE_URL or SUPABASE_ANON_KEY not set');
  }

  return { baseUrl, anonKey };
}

/**
 * Join the queue for a specific box drop
 * Returns the user's queue entry with a unique queue_id
 * If user is already in queue (and still active), returns existing entry
 * If user was previously removed/completed, creates a new entry
 */
export async function joinQueueEntry(
  tokenId: string,
  walletAddress: string,
): Promise<QueueEntry | null> {
  const { baseUrl, anonKey } = getSupabaseConfig();
  const normalizedWallet = walletAddress.toLowerCase();

  try {
    console.log('[joinQueueEntry] Attempting to join queue:', { tokenId, wallet: normalizedWallet });

    // First, check if user already has an ACTIVE entry (waiting or active status)
    const existingEntry = await getQueueEntry(tokenId, normalizedWallet);
    if (existingEntry && (existingEntry.status === 'waiting' || existingEntry.status === 'active')) {
      console.log('[joinQueueEntry] User already in active queue, returning existing entry:', existingEntry);
      return existingEntry;
    }

    if (existingEntry) {
      console.log('[joinQueueEntry] User has previous entry but status is', existingEntry.status, '- creating new entry');
    }

    // User not in queue, create new entry
    const url = `${baseUrl}/rest/v1/drop_queue`;
    console.log('[joinQueueEntry] Creating new queue entry:', { tokenId, wallet: normalizedWallet, url });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        token_id: tokenId,
        wallet_address: normalizedWallet,
        joined_at: new Date().toISOString(),
        status: 'waiting',
      }),
    });

    console.log('[joinQueueEntry] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.warn('[joinQueueEntry] HTTP Error:', response.status, error);

      // If we get a 409 (conflict), user might have just joined, try fetching again
      if (response.status === 409) {
        console.log('[joinQueueEntry] Got 409 conflict, checking if entry exists...');
        const retryEntry = await getQueueEntry(tokenId, normalizedWallet);
        if (retryEntry) {
          console.log('[joinQueueEntry] Found entry after 409 conflict:', retryEntry);
          return retryEntry;
        }
      }

      return null;
    }

    const responseText = await response.text();
    console.log('[joinQueueEntry] Response text:', responseText);

    if (!responseText) {
      console.warn('[joinQueueEntry] Empty response body');
      return null;
    }

    const data = JSON.parse(responseText);
    console.log('[joinQueueEntry] Joined queue:', { tokenId, wallet: normalizedWallet, data });

    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data;
    }

    console.warn('[joinQueueEntry] Unexpected response format:', data);
    return null;
  } catch (err) {
    console.warn('[joinQueueEntry] Exception:', err);
    return null;
  }
}

/**
 * Get user's current position in queue
 * Position is determined by counting how many entries with earlier joined_at timestamps exist
 */
export async function getQueuePosition(
  tokenId: string,
  walletAddress: string,
): Promise<number | null> {
  const { baseUrl, anonKey } = getSupabaseConfig();
  const normalizedWallet = walletAddress.toLowerCase();

  try {
    const url = `${baseUrl}/rest/v1/drop_queue?token_id=eq.${encodeURIComponent(tokenId)}&status=in.(waiting,active)&order=joined_at.asc&select=wallet_address`;
    console.log('[getQueuePosition] Fetching queue position:', { tokenId, wallet: normalizedWallet });

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    console.log('[getQueuePosition] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.warn('[getQueuePosition] HTTP Error:', response.status, error);
      return null;
    }

    const responseText = await response.text();
    if (!responseText) {
      console.warn('[getQueuePosition] Empty response body');
      return null;
    }

    const entries = JSON.parse(responseText) as QueueEntry[];
    const position = entries.findIndex(
      (e) => e.wallet_address.toLowerCase() === normalizedWallet,
    );

    console.log('[getQueuePosition] Position:', { tokenId, position, totalInQueue: entries.length });
    return position >= 0 ? position : null;
  } catch (err) {
    console.warn('[getQueuePosition] Exception:', err);
    return null;
  }
}

/**
 * Mark user's turn as active (they reached position 0)
 * Idempotent: safe to call multiple times, won't fail if already active
 */
export async function setUserTurnActive(
  tokenId: string,
  walletAddress: string,
): Promise<boolean> {
  const { baseUrl, anonKey } = getSupabaseConfig();
  const normalizedWallet = walletAddress.toLowerCase();

  try {
    // First, check if user is already active
    const entry = await getQueueEntry(tokenId, normalizedWallet);
    if (entry && entry.status === 'active' && entry.turn_started_at) {
      console.log('[setUserTurnActive] User already active, skipping activation:', {
        tokenId,
        wallet: normalizedWallet,
        turn_started_at: entry.turn_started_at,
      });
      return true; // Already active, return success
    }

    const url = `${baseUrl}/rest/v1/drop_queue?token_id=eq.${encodeURIComponent(tokenId)}&wallet_address=eq.${encodeURIComponent(normalizedWallet)}&status=eq.waiting`;
    console.log('[setUserTurnActive] Activating turn:', { tokenId, wallet: normalizedWallet });

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'active',
        turn_started_at: new Date().toISOString(),
      }),
    });

    console.log('[setUserTurnActive] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.warn('[setUserTurnActive] HTTP Error:', response.status, error);

      // If we get 409, it might be due to the unique constraint - check if already active
      if (response.status === 409) {
        const checkEntry = await getQueueEntry(tokenId, normalizedWallet);
        if (checkEntry && checkEntry.status === 'active') {
          console.log('[setUserTurnActive] Got 409 but user is already active, treating as success');
          return true;
        }
      }

      return false;
    }

    console.log('[setUserTurnActive] Turn activated successfully:', { tokenId, wallet: normalizedWallet });
    return true;
  } catch (err) {
    console.warn('[setUserTurnActive] Exception:', err);
    return false;
  }
}

/**
 * Remove user from queue (due to timeout, completion, or manual exit)
 */
export async function removeFromQueue(
  tokenId: string,
  walletAddress: string,
): Promise<boolean> {
  const { baseUrl, anonKey } = getSupabaseConfig();
  const normalizedWallet = walletAddress.toLowerCase();

  try {
    const url = `${baseUrl}/rest/v1/drop_queue?token_id=eq.${encodeURIComponent(tokenId)}&wallet_address=eq.${encodeURIComponent(normalizedWallet)}`;
    console.log('[removeFromQueue] Removing user from queue:', { tokenId, wallet: normalizedWallet });

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'removed',
      }),
    });

    console.log('[removeFromQueue] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.warn('[removeFromQueue] HTTP Error:', response.status, error);
      return false;
    }

    console.log('[removeFromQueue] Successfully removed from queue:', { tokenId, wallet: normalizedWallet });
    return true;
  } catch (err) {
    console.warn('[removeFromQueue] Exception:', err);
    return false;
  }
}

/**
 * Mark user as completed (successful purchase)
 */
export async function markQueueCompleted(
  tokenId: string,
  walletAddress: string,
): Promise<boolean> {
  const { baseUrl, anonKey } = getSupabaseConfig();
  const normalizedWallet = walletAddress.toLowerCase();

  try {
    const url = `${baseUrl}/rest/v1/drop_queue?token_id=eq.${encodeURIComponent(tokenId)}&wallet_address=eq.${encodeURIComponent(normalizedWallet)}`;
    console.log('[markQueueCompleted] Marking as completed:', { tokenId, wallet: normalizedWallet });

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'completed',
      }),
    });

    console.log('[markQueueCompleted] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.warn('[markQueueCompleted] HTTP Error:', response.status, error);
      return false;
    }

    console.log('[markQueueCompleted] Successfully marked completed:', { tokenId, wallet: normalizedWallet });
    return true;
  } catch (err) {
    console.warn('[markQueueCompleted] Exception:', err);
    return false;
  }
}

/**
 * Get user's entry to check if they're still in queue
 */
export async function getQueueEntry(
  tokenId: string,
  walletAddress: string,
): Promise<QueueEntry | null> {
  const { baseUrl, anonKey } = getSupabaseConfig();
  const normalizedWallet = walletAddress.toLowerCase();

  try {
    const url = `${baseUrl}/rest/v1/drop_queue?token_id=eq.${encodeURIComponent(tokenId)}&wallet_address=eq.${encodeURIComponent(normalizedWallet)}`;
    console.log('[getQueueEntry] Fetching queue entry:', { tokenId, wallet: normalizedWallet });

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    console.log('[getQueueEntry] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.warn('[getQueueEntry] HTTP Error:', response.status, error);
      return null;
    }

    const responseText = await response.text();
    if (!responseText) {
      console.warn('[getQueueEntry] Empty response body');
      return null;
    }

    const data = JSON.parse(responseText) as QueueEntry[];
    return data[0] || null;
  } catch (err) {
    console.warn('[getQueueEntry] Exception:', err);
    return null;
  }
}

/**
 * Check if user's turn has timed out
 * Returns true if user is at position 0 and has exceeded 3-minute timeout
 */
export async function hasUserTimedOut(
  tokenId: string,
  walletAddress: string,
): Promise<boolean> {
  const entry = await getQueueEntry(tokenId, walletAddress);
  if (!entry || entry.status !== 'active' || !entry.turn_started_at) {
    return false;
  }

  const turnStartTime = new Date(entry.turn_started_at).getTime();
  const now = Date.now();
  const elapsed = now - turnStartTime;

  return elapsed > TURN_TIMEOUT_MS;
}

/**
 * Process all timeouts for a queue
 * Removes anyone who timed out from their turn
 * This is called periodically to clean up stalled users
 */
export async function processQueueTimeouts(tokenId: string): Promise<number> {
  const { baseUrl, anonKey } = getSupabaseConfig();

  try {
    // Get all active entries that have timed out
    const url = `${baseUrl}/rest/v1/drop_queue?token_id=eq.${encodeURIComponent(tokenId)}&status=eq.active`;
    console.log('[processQueueTimeouts] Fetching active entries:', { tokenId });

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    console.log('[processQueueTimeouts] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.warn('[processQueueTimeouts] HTTP Error:', response.status, error);
      return 0;
    }

    const responseText = await response.text();
    if (!responseText) {
      console.warn('[processQueueTimeouts] Empty response body');
      return 0;
    }

    const entries = JSON.parse(responseText) as QueueEntry[];
    console.log('[processQueueTimeouts] Found active entries:', { tokenId, count: entries.length });

    let removedCount = 0;

    for (const entry of entries) {
      if (!entry.turn_started_at) continue;

      const turnStartTime = new Date(entry.turn_started_at).getTime();
      const now = Date.now();
      const elapsed = now - turnStartTime;

      if (elapsed > TURN_TIMEOUT_MS + 5000) { // Add 5 second buffer to prevent race conditions
        console.log('[processQueueTimeouts] Removing timed out user:', {
          tokenId,
          wallet: entry.wallet_address,
          elapsed,
          timeout: TURN_TIMEOUT_MS,
        });

        // Mark as removed
        try {
          await fetch(
            `${baseUrl}/rest/v1/drop_queue?id=eq.${encodeURIComponent(entry.id)}`,
            {
              method: 'PATCH',
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: 'removed',
              }),
            },
          );
          removedCount++;
        } catch (updateErr) {
          console.warn('[processQueueTimeouts] Failed to remove user:', { id: entry.id, error: updateErr });
        }
      } else if (elapsed > TURN_TIMEOUT_MS) {
        console.log('[processQueueTimeouts] User is close to timeout but not yet removed (within safety buffer):', {
          tokenId,
          wallet: entry.wallet_address,
          elapsed,
          timeout: TURN_TIMEOUT_MS,
          bufferRemaining: (TURN_TIMEOUT_MS + 5000) - elapsed,
        });
      }
    }

    console.log('[processQueueTimeouts] Processed timeouts:', { tokenId, removed: removedCount });
    return removedCount;
  } catch (err) {
    console.error('[processQueueTimeouts] Exception:', err);
    return 0;
  }
}

/**
 * Get the entire queue for a drop (for debugging/monitoring)
 */
export async function getFullQueue(tokenId: string): Promise<QueueEntry[]> {
  const { baseUrl, anonKey } = getSupabaseConfig();

  try {
    const url = `${baseUrl}/rest/v1/drop_queue?token_id=eq.${encodeURIComponent(tokenId)}&status=in.(waiting,active)&order=joined_at.asc`;
    console.log('[getFullQueue] Fetching full queue:', { tokenId });

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    console.log('[getFullQueue] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.warn('[getFullQueue] HTTP Error:', response.status, error);
      return [];
    }

    const responseText = await response.text();
    if (!responseText) {
      console.warn('[getFullQueue] Empty response body');
      return [];
    }

    const data = JSON.parse(responseText) as QueueEntry[];
    console.log('[getFullQueue] Queue data:', { tokenId, count: data.length });
    return data;
  } catch (err) {
    console.warn('[getFullQueue] Exception:', err);
    return [];
  }
}
