/**
 * Diagnostic utility to check Supabase connectivity
 * Helps identify CORS, network, or configuration issues
 */

export interface ConnectivityCheckResult {
  supabaseUrl: string | null;
  hasAnonKey: boolean;
  canReachSupabase: boolean;
  corsIssue: boolean;
  error: string | null;
}

/**
 * Performs a simple connectivity check to verify Supabase is reachable
 */
export async function checkSupabaseConnectivity(): Promise<ConnectivityCheckResult> {
  const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  const result: ConnectivityCheckResult = {
    supabaseUrl: supabaseUrl || null,
    hasAnonKey: !!anonKey,
    canReachSupabase: false,
    corsIssue: false,
    error: null,
  };

  if (!supabaseUrl || !anonKey) {
    result.error = "Missing Supabase configuration (URL or ANON_KEY)";
    return result;
  }

  try {
    const healthCheckUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/health`;

    const response = await fetch(healthCheckUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      result.canReachSupabase = true;
    } else {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (err: any) {
    const errorMessage = err?.message || String(err);

    // CORS errors typically have "Failed to fetch" in the message
    if (errorMessage.includes("Failed to fetch")) {
      result.corsIssue = true;
      result.error = `Network error (possible CORS issue or unreachable service): ${errorMessage}`;
    } else {
      result.error = `Connectivity check failed: ${errorMessage}`;
    }
  }

  return result;
}

/**
 * Run diagnostic and log results
 */
export async function logSupabaseConnectivityStatus(): Promise<void> {
  const result = await checkSupabaseConnectivity();

  console.log("[Supabase Connectivity Check]", {
    url: result.supabaseUrl ? `${result.supabaseUrl.split("?")[0]}...` : null,
    hasAnonKey: result.hasAnonKey,
    reachable: result.canReachSupabase,
    corsIssue: result.corsIssue,
    error: result.error,
  });
}
