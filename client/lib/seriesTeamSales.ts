import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface SeriesTeamSalesRecord {
  series_name: string;
  team_name: string;
  total_price: number;
}

export interface TopTeamData {
  team_name: string;
  total_price: number;
  crest_image?: string;
}

export async function fetchSeriesTeamSales(): Promise<SeriesTeamSalesRecord[]> {
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

  const fallbackData: SeriesTeamSalesRecord[] = [];

  return withSupabaseFallback(
    "series-team-sales",
    async () => {
      const url = `${baseUrl}/seriesteamsales?select=*`;

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
          `Failed to fetch series team sales data: ${statusMessage}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      if (!Array.isArray(data)) return [];

      return data.map(
        (record: {
          team?: string;
          series_name: string;
          total_price: number;
        }) => ({
          series_name: record.series_name,
          team_name: record.team || "",
          total_price: record.total_price,
        }),
      );
    },
    fallbackData,
    "fetchSeriesTeamSales",
  );
}

export function getMaxSeriesName(
  records: SeriesTeamSalesRecord[],
): string | null {
  if (records.length === 0) return null;

  return records.reduce((max, record) => {
    if (!max) return record.series_name;
    return record.series_name > max ? record.series_name : max;
  }, "" as string);
}

export function getTopTeamsByPrice(
  records: SeriesTeamSalesRecord[],
  limit: number = 5,
): SeriesTeamSalesRecord[] {
  const maxSeries = getMaxSeriesName(records);

  if (!maxSeries) return [];

  const filteredByMaxSeries = records.filter(
    (record) => record.series_name === maxSeries,
  );

  const grouped = new Map<string, number>();

  for (const record of filteredByMaxSeries) {
    const current = grouped.get(record.team_name) || 0;
    grouped.set(record.team_name, current + record.total_price);
  }

  const sorted = Array.from(grouped.entries())
    .map(([team_name, total_price]) => ({
      series_name: maxSeries,
      team_name,
      total_price,
    }))
    .sort((a, b) => b.total_price - a.total_price);

  return sorted.slice(0, limit);
}
