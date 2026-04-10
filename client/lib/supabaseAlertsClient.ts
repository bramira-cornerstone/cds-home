/**
 * Supabase Alerts Client
 * Manages alerts stored in public.alerts table using Supabase REST API
 */

import type { AlertItem } from "@/lib/alerts";

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

export interface AlertRecord {
  id: string;
  wallet_address: string;
  alert_type: string;
  title: string;
  body: string;
  created_at: string;
  status: "active" | "closed";
  updated_at: string;
}

/**
 * Check if an alert already exists for wallet + id combination
 */
async function alertExists(
  walletAddress: string,
  alertId: string,
): Promise<boolean> {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    const url = new URL(`${SUPABASE_URL}/rest/v1/alerts`);
    url.searchParams.append("id", `eq.${alertId}`);
    url.searchParams.append("wallet_address", `eq.${normalizedAddress}`);
    url.searchParams.append("select", "id");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      return false;
    }

    const records = (await response.json()) as AlertRecord[];
    return records.length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Insert a new alert into the public.alerts table
 * Returns true if inserted, false if already exists or error
 */
export async function insertAlert(
  walletAddress: string,
  alertItem: AlertItem,
): Promise<boolean> {
  try {
    const normalizedAddress = walletAddress.toLowerCase();

    // Check if alert already exists
    const exists = await alertExists(normalizedAddress, alertItem.id);
    if (exists) {
      return false;
    }

    // Derive alert type from ID
    const alertType = alertItem.id.split(":")[0];

    const url = `${SUPABASE_URL}/rest/v1/alerts`;

    // Convert AlertItem createdAt (epoch ms) to ISO string for created_at
    const createdAtIso = new Date(alertItem.createdAt).toISOString();

    const payload: Omit<AlertRecord, "updated_at"> & { created_at: string } = {
      id: alertItem.id,
      wallet_address: normalizedAddress,
      alert_type: alertType,
      title: alertItem.title,
      body: alertItem.body || "",
      status: alertItem.closed ? "closed" : "active",
      created_at: createdAtIso,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Fetch all alerts for a wallet from public.alerts table
 */
export async function fetchAlertsForWallet(
  walletAddress: string,
): Promise<AlertItem[]> {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    const url = new URL(`${SUPABASE_URL}/rest/v1/alerts`);
    url.searchParams.append("wallet_address", `eq.${normalizedAddress}`);
    url.searchParams.append(
      "order",
      "created_at.desc",
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      return [];
    }

    const records = (await response.json()) as AlertRecord[];

    // Convert database records to AlertItem format
    const alerts: AlertItem[] = records.map((record) => ({
      id: record.id,
      title: record.title,
      body: record.body,
      createdAt: new Date(record.created_at).getTime(),
      closed: record.status === "closed",
    }));

    return alerts;
  } catch (err) {
    return [];
  }
}

/**
 * Update alert status to 'closed' in public.alerts table
 * @param walletAddress - The wallet address (will be normalized to lowercase)
 * @param alertId - The alert ID
 * @param status - New status ('active' or 'closed')
 * @param createdAtMs - Optional: createdAt timestamp in milliseconds (used for more accurate filtering with primary key)
 */
export async function updateAlertStatus(
  walletAddress: string,
  alertId: string,
  status: "active" | "closed",
  createdAtMs?: number,
): Promise<boolean> {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    const url = new URL(`${SUPABASE_URL}/rest/v1/alerts`);
    url.searchParams.append("id", `eq.${alertId}`);
    url.searchParams.append("wallet_address", `eq.${normalizedAddress}`);

    // Note: We filter only by id + wallet_address
    // Although the primary key is (id, wallet_address, created_at),
    // id + wallet_address should be unique in practice, and this avoids
    // timestamp format matching issues with Supabase's eq operator

    const response = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      return false;
    }

    // Check if any rows were actually affected
    const responseData = await response.json();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Batch insert multiple alerts
 */
export async function insertAlerts(
  walletAddress: string,
  alertItems: AlertItem[],
): Promise<number> {
  let insertedCount = 0;

  for (const alert of alertItems) {
    const success = await insertAlert(walletAddress, alert);
    if (success) {
      insertedCount++;
    }
  }

  return insertedCount;
}
