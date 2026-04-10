import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface WalletDailyValueRecord {
  wallet_address: string;
  snapshot_date: string;
  snapshot_ts: string;
  tokens_count: number;
  total_median_sale_price: number | string | null;
  median_missing_count: number;
  Percentile?: number | string | null;
}

export async function fetchWalletDailyValue(): Promise<
  WalletDailyValueRecord[]
> {
  const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (!supabaseUrl || !anonKey) {
    return [];
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

  const fallbackData: WalletDailyValueRecord[] = [];

  return withSupabaseFallback(
    "wallet-daily-value",
    async () => {
      const url = `${baseUrl}/wallet_daily_value?select=*`;

      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const statusMessage = response.statusText || `HTTP ${response.status}`;
        const error = new Error(
          `Failed to fetch wallet daily value data: ${statusMessage}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    fallbackData,
    "fetchWalletDailyValue",
  );
}

export function findWalletDailyValueByAddress(
  records: WalletDailyValueRecord[],
  walletAddress: string,
): WalletDailyValueRecord[] {
  const lowerAddress = walletAddress.toLowerCase();
  return records.filter(
    (record) =>
      record.wallet_address &&
      record.wallet_address.toLowerCase() === lowerAddress,
  );
}

export function getLatestWalletSnapshot(
  records: WalletDailyValueRecord[],
  walletAddress: string,
): WalletDailyValueRecord | undefined {
  const walletRecords = findWalletDailyValueByAddress(records, walletAddress);

  if (walletRecords.length === 0) {
    return undefined;
  }

  return walletRecords.reduce((latest, current) => {
    const latestDate = new Date(latest.snapshot_ts).getTime();
    const currentDate = new Date(current.snapshot_ts).getTime();
    return currentDate > latestDate ? current : latest;
  });
}

export function getWalletValueHistory(
  records: WalletDailyValueRecord[],
  walletAddress: string,
  limit?: number,
): WalletDailyValueRecord[] {
  const walletRecords = findWalletDailyValueByAddress(records, walletAddress);

  const sorted = walletRecords.sort((a, b) => {
    const dateA = new Date(b.snapshot_ts).getTime();
    const dateB = new Date(a.snapshot_ts).getTime();
    return dateA - dateB;
  });

  return limit ? sorted.slice(0, limit) : sorted;
}

export function calculateWalletValueStats(
  records: WalletDailyValueRecord[],
  walletAddress: string,
): {
  totalTokens: number;
  currentValue: number;
  averageValue: number;
  maxValue: number;
  minValue: number;
} {
  const history = getWalletValueHistory(records, walletAddress);

  if (history.length === 0) {
    return {
      totalTokens: 0,
      currentValue: 0,
      averageValue: 0,
      maxValue: 0,
      minValue: 0,
    };
  }

  const latest = history[0];
  const values = history
    .map((r) => Number(r.total_median_sale_price) || 0)
    .filter((v) => v > 0);

  const currentValue = Number(latest.total_median_sale_price) || 0;
  const averageValue =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const minValue = values.length > 0 ? Math.min(...values) : 0;

  return {
    totalTokens: latest.tokens_count,
    currentValue: Math.round(currentValue * 100) / 100,
    averageValue: Math.round(averageValue * 100) / 100,
    maxValue: Math.round(maxValue * 100) / 100,
    minValue: Math.round(minValue * 100) / 100,
  };
}
