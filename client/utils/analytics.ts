/**
 * Analytics utility that respects user opt-out preferences
 * Google Analytics and Mixpanel are enabled by default unless the user has opted out
 */

interface AnalyticsConfig {
  gaId: string;
  mixpanelToken: string;
}

interface WindowWithAnalytics extends Window {
  dataLayer?: any[];
  gtag?: (...args: any[]) => void;
  mixpanel?: any;
}

let isAnalyticsEnabled = false; // Changed default to false (safer)
let isMixpanelReady = false;
let initInProgress = false;

/**
 * Create a Mixpanel stub that buffers calls until real Mixpanel is loaded
 * This prevents "mixpanel object not initialized" errors
 */
function createMixpanelStub(): any {
  const callBuffer: Array<{ method: string; args: any[] }> = [];

  return {
    init: function (...args: any[]) {
      // This will be replaced by the real Mixpanel
      callBuffer.push({ method: "init", args });
    },
    track: function (...args: any[]) {
      if (isMixpanelReady) {
        // Only call if actually ready
        return;
      }
      callBuffer.push({ method: "track", args });
    },
    identify: function (...args: any[]) {
      if (isMixpanelReady) {
        return;
      }
      callBuffer.push({ method: "identify", args });
    },
    opt_in_tracking: function () {
      if (isMixpanelReady) {
        return;
      }
      callBuffer.push({ method: "opt_in_tracking", args: [] });
    },
    opt_out_tracking: function () {
      if (isMixpanelReady) {
        return;
      }
      callBuffer.push({ method: "opt_out_tracking", args: [] });
    },
  };
}

// Initialize with stub to prevent errors if Mixpanel is called before loading
if (typeof window !== "undefined") {
  (window as WindowWithAnalytics).mixpanel = createMixpanelStub();
}

/**
 * Initialize analytics services based on user's opt-out preference
 * Only enables analytics if:
 * 1. Wallet address is provided
 * 2. Wallet address matches public.profiles.wallet_address
 * 3. public.profiles.analytics_optout = false
 */
export async function initializeAnalytics(
  walletAddress: string | undefined,
  config: AnalyticsConfig,
): Promise<void> {
  try {
    // Prevent multiple concurrent initializations
    if (initInProgress) {
      console.log("[Analytics] Initialization already in progress");
      return;
    }

    initInProgress = true;

    // If no wallet is provided, DO NOT load analytics (default: disabled)
    if (!walletAddress) {
      isAnalyticsEnabled = false;
      isMixpanelReady = false;
      console.log("[Analytics] No wallet address - analytics disabled");
      initInProgress = false;
      return;
    }

    // If config is missing tokens, don't try to load
    if (!config.gaId && !config.mixpanelToken) {
      isAnalyticsEnabled = false;
      isMixpanelReady = false;
      console.log("[Analytics] No GA ID or Mixpanel token configured");
      initInProgress = false;
      return;
    }

    // Check user's analytics_optout preference
    const shouldCollect = await checkAnalyticsShouldCollect(walletAddress);
    isAnalyticsEnabled = shouldCollect;

    if (isAnalyticsEnabled) {
      console.log("[Analytics] User opted in - loading analytics scripts");
      await loadAnalyticsScripts(config);
    } else {
      console.log("[Analytics] User has not opted in - analytics disabled");
    }

    initInProgress = false;
  } catch (err) {
    console.error("[Analytics] Error initializing analytics:", err);
    isAnalyticsEnabled = false;
    isMixpanelReady = false;
    initInProgress = false;
  }
}

/**
 * Check if analytics should be collected for a user
 * Returns true only if:
 * 1. Wallet address is provided
 * 2. Data exists in public.profiles for this wallet
 * 3. analytics_optout = false (explicitly opted in)
 *
 * Returns false (disabled) if:
 * - No wallet provided
 * - No matching profile found
 * - analytics_optout is missing or null
 * - analytics_optout = true
 */
async function checkAnalyticsShouldCollect(walletAddress: string): Promise<boolean> {
  try {
    const baseUrl = (import.meta as any).env.SUPABASE_URL as
      | string
      | undefined;
    const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
      | string
      | undefined;

    if (!baseUrl || !anonKey) {
      // If Supabase not configured, do NOT collect analytics (default: disabled)
      console.warn("[Analytics] Supabase not configured - analytics disabled");
      return false;
    }

    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=analytics_optout`;
    const res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      // If fetch fails, do NOT collect analytics (default: disabled)
      console.warn(`[Analytics] Failed to fetch profile (${res.status}) - analytics disabled`);
      return false;
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      // No profile found for wallet, do NOT collect analytics (default: disabled)
      console.warn("[Analytics] No profile found for wallet - analytics disabled");
      return false;
    }

    const profile = data[0];
    // Only collect if explicitly set to false (not null, not missing, not true)
    const shouldCollect = profile.analytics_optout === false;

    if (!shouldCollect) {
      console.warn("[Analytics] User has opted out or preference not set - analytics disabled");
    }

    return shouldCollect;
  } catch (err) {
    console.error("[Analytics] Error checking analytics preference:", err);
    // If error, do NOT collect analytics (default: disabled)
    return false;
  }
}

/**
 * Load Google Analytics and Mixpanel scripts
 * Only loads if isAnalyticsEnabled is true
 */
async function loadAnalyticsScripts(config: AnalyticsConfig): Promise<void> {
  // Double-check that analytics should be enabled before loading
  if (!isAnalyticsEnabled) {
    console.log("[Analytics] Analytics disabled - skipping script load");
    return;
  }

  const w = window as WindowWithAnalytics;

  try {
    // Load Google Analytics
    if (config.gaId) {
      await loadGoogleAnalyticsScript(config.gaId);
    }

    // Load Mixpanel - only if token is provided
    if (config.mixpanelToken) {
      console.log("[Analytics] Starting Mixpanel initialization");
      try {
        await loadMixpanelScript(config.mixpanelToken);

        // Verify Mixpanel is available and initialized
        if (w.mixpanel && typeof w.mixpanel.track === "function") {
          isMixpanelReady = true;
          console.log("[Analytics] Mixpanel verified as ready");
        } else {
          console.warn("[Analytics] Mixpanel not properly initialized");
          isMixpanelReady = false;
        }
      } catch (err) {
        console.error("[Analytics] Error loading Mixpanel script:", err);
        isMixpanelReady = false;
      }
    }
  } catch (err) {
    console.error("[Analytics] Error loading analytics scripts:", err);
  }
}

/**
 * Load Google Analytics script and wait for it to be ready
 */
function loadGoogleAnalyticsScript(gaId: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const w = window as WindowWithAnalytics;

      // Check if already loaded
      if (w.gtag && typeof w.gtag === "function") {
        console.log("[Analytics] Google Analytics already loaded");
        resolve();
        return;
      }

      // Initialize dataLayer and gtag function before script loads
      w.dataLayer = w.dataLayer || [];
      w.gtag = function (...args: any[]) {
        w.dataLayer?.push(arguments);
      };

      // Don't load GA twice
      if (document.querySelector(`script[src*="gtag/js?id=${gaId}"]`)) {
        console.log("[Analytics] Google Analytics script already queued");
        // Wait for it to initialize
        let retries = 0;
        const checkInterval = setInterval(() => {
          if (w.gtag && typeof w.gtag === "function") {
            clearInterval(checkInterval);
            w.gtag("js", new Date());
            w.gtag("config", gaId);
            resolve();
          }
          retries++;
          if (retries > 20) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        return;
      }

      // Load the script
      const gaScript = document.createElement("script");
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;

      gaScript.onload = () => {
        try {
          // Call gtag after script loads
          if (w.gtag && typeof w.gtag === "function") {
            w.gtag("js", new Date());
            w.gtag("config", gaId);
            console.log("[Analytics] Google Analytics initialized successfully");
          }
        } catch (err) {
          console.warn("[Analytics] Error calling gtag after script load:", err);
        }
        resolve();
      };

      gaScript.onerror = () => {
        console.warn("[Analytics] Google Analytics script failed to load");
        resolve(); // Don't fail the whole analytics init
      };

      document.head.appendChild(gaScript);
    } catch (err) {
      console.error("[Analytics] Error loading Google Analytics:", err);
      resolve();
    }
  });
}

/**
 * Dynamically load Mixpanel library script with initialization
 */
function loadMixpanelScript(token: string): Promise<void> {
  return new Promise((resolve) => {
    const w = window as WindowWithAnalytics;

    // Check if already loaded and initialized
    if (w.mixpanel && typeof w.mixpanel.track === "function") {
      console.log("[Analytics] Mixpanel already initialized");
      resolve();
      return;
    }

    // Don't load Mixpanel twice
    if (document.querySelector('script[src*="cdn.mxpnl.com"]')) {
      console.log("[Analytics] Mixpanel script already in DOM");
      // Wait for it to be ready
      let retries = 0;
      const checkInterval = setInterval(() => {
        if (w.mixpanel && typeof w.mixpanel.track === "function") {
          clearInterval(checkInterval);
          resolve();
        }
        retries++;
        if (retries > 30) {
          clearInterval(checkInterval);
          console.warn("[Analytics] Timeout waiting for Mixpanel to be ready");
          resolve();
        }
      }, 100);
      return;
    }

    // Create a script tag with Mixpanel initialization
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";

    script.onload = () => {
      console.log("[Analytics] Mixpanel script loaded");
      // Initialize Mixpanel
      try {
        if (w.mixpanel && typeof w.mixpanel.init === "function") {
          w.mixpanel.init(token, {
            autocapture: false,
            record_sessions_percent: 100,
            debug: false,
          });
          console.log("[Analytics] Mixpanel.init() called with token");
        }
      } catch (err) {
        console.error("[Analytics] Error calling mixpanel.init():", err);
      }
      setTimeout(() => resolve(), 200);
    };

    script.onerror = () => {
      console.warn("[Analytics] Mixpanel script failed to load");
      resolve();
    };

    document.head.appendChild(script);
  });
}

/**
 * Update analytics status when user changes their opt-out preference
 * Only updates if analytics were actually initialized
 */
export function updateAnalyticsStatus(enabled: boolean): void {
  isAnalyticsEnabled = enabled;
  console.log("[Analytics] Status updated:", enabled);

  if (!enabled) {
    // Disable analytics
    const w = window as WindowWithAnalytics;

    // Disable Mixpanel only if it's actually loaded and ready
    if (isMixpanelReady && w.mixpanel) {
      try {
        if (typeof w.mixpanel.opt_out_tracking === "function") {
          w.mixpanel.opt_out_tracking();
          console.log("[Analytics] Mixpanel tracking disabled");
        }
      } catch (err) {
        console.warn("[Analytics] Error disabling Mixpanel:", err);
      }
    }

    // Disable Google Analytics
    if (w.gtag && typeof w.gtag === "function") {
      try {
        w.gtag("consent", "update", {
          analytics_storage: "denied",
        });
        console.log("[Analytics] Google Analytics disabled");
      } catch (err) {
        console.warn("[Analytics] Error disabling Google Analytics:", err);
      }
    }
  } else {
    // Enable analytics (only updates if they were actually loaded)
    const w = window as WindowWithAnalytics;

    // Enable Mixpanel only if it's actually loaded and ready
    if (isMixpanelReady && w.mixpanel) {
      try {
        if (typeof w.mixpanel.opt_in_tracking === "function") {
          w.mixpanel.opt_in_tracking();
          console.log("[Analytics] Mixpanel tracking enabled");
        }
      } catch (err) {
        console.warn("[Analytics] Error enabling Mixpanel:", err);
      }
    }

    // Enable Google Analytics
    if (w.gtag && typeof w.gtag === "function") {
      try {
        w.gtag("consent", "update", {
          analytics_storage: "granted",
        });
        console.log("[Analytics] Google Analytics enabled");
      } catch (err) {
        console.warn("[Analytics] Error enabling Google Analytics:", err);
      }
    }
  }
}

/**
 * Check if analytics are currently enabled
 */
export function areAnalyticsEnabled(): boolean {
  return isAnalyticsEnabled;
}

/**
 * Safe wrapper to track events with Mixpanel
 * Only tracks if analytics are enabled and Mixpanel is initialized
 */
export function trackEvent(eventName: string, properties?: Record<string, any>): void {
  // Silently return if analytics not enabled
  if (!isAnalyticsEnabled) {
    return;
  }

  // Return if Mixpanel not ready
  if (!isMixpanelReady) {
    return;
  }

  try {
    const w = window as WindowWithAnalytics;
    if (w.mixpanel && typeof w.mixpanel.track === "function") {
      w.mixpanel.track(eventName, properties);
    }
  } catch (err) {
    // Silently fail - don't let analytics errors break the app
  }
}

/**
 * Safe wrapper to set user identity with Mixpanel
 * Only sets if analytics are enabled and Mixpanel is initialized
 */
export function identifyUser(userId: string): void {
  // Silently return if analytics not enabled
  if (!isAnalyticsEnabled) {
    return;
  }

  // Return if Mixpanel not ready
  if (!isMixpanelReady) {
    return;
  }

  try {
    const w = window as WindowWithAnalytics;
    if (w.mixpanel && typeof w.mixpanel.identify === "function") {
      w.mixpanel.identify(userId);
    }
  } catch (err) {
    // Silently fail - don't let analytics errors break the app
  }
}
