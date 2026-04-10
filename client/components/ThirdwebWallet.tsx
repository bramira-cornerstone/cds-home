import { useCallback, useEffect, useMemo, useState } from "react";
import { createThirdwebClient } from "thirdweb";
import { ConnectButton, lightTheme, useActiveAccount } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { getUserEmail } from "thirdweb/wallets/in-app";
import { polygon } from "thirdweb/chains";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { useWalletProfile } from "@/hooks/useWalletProfile";

const clientId = (import.meta as any).env.THIRDWEB_CLIENT_ID as
  | string
  | undefined;

// Create client once - Thirdweb handles session persistence automatically
const client = createThirdwebClient({
  clientId: clientId ?? "",
});

export default function ConnectGlobal() {
  const account = useActiveAccount();
  const inRouter = useInRouterContext();
  const navigate = useNavigate();
  const { profile } = useWalletProfile();

  // Memoize wallets array to prevent recreating on every render
  const wallets = useMemo(
    () => [
      inAppWallet({
        auth: {
          options: ["google", "apple", "facebook", "email", "passkey"],
        },
        chain: polygon,
      }),
      createWallet("io.metamask"),
      createWallet("com.coinbase.wallet"),
      createWallet("com.binance.wallet"),
      createWallet("com.ledger"),
      createWallet("global.safe"),
    ],
    []
  );

  const detailsLabel = useMemo(() => {
    const name = (profile?.username || "").toString().trim();
    if (name) return name;
    const addr = account?.address;
    if (!addr) return undefined;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, [profile?.username, account?.address]);

  // COR token (Polygon ERC-20)
  const CUSTOM_TOKEN_ADDRESS = "0x1505F1122C8D08008DBac7B9D9dadDE4a1c64e71";
  const CUSTOM_TOKEN_ICON =
    "https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F91ffefe3455443f69489701bb91042c6";

  const [corBalance, setCorBalance] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function formatWholeWithCommas(value: bigint): string {
    const neg = value < 0n ? "-" : "";
    const s = (value < 0n ? -value : value).toString();
    const withCommas = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return neg + withCommas;
  }

  // Listen for balance refresh events
  useEffect(() => {
    const handleRefresh = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    document.addEventListener("wallet:balance:refresh", handleRefresh);
    return () => {
      document.removeEventListener("wallet:balance:refresh", handleRefresh);
    };
  }, []);

  useEffect(() => {
    const addr = account?.address;
    let aborted = false;
    async function load() {
      try {
        if (!addr) {
          setCorBalance(null);
          sessionStorage.removeItem(`__corBalance_${addr}`);
          return;
        }

        // Check session cache first - avoid refetch on page navigation
        const cachedBalance = sessionStorage.getItem(`__corBalance_${addr}`);
        if (cachedBalance && refreshTrigger === 0) {
          setCorBalance(cachedBalance);
          return;
        }

        let raw = 0n;
        let decimals = 18;
        let success = false;

        try {
          // Try Alchemy API first (primary method)
          const rpcKey = (import.meta as any).env.RPC_KEY as string | undefined;
          const alchemyRpc = `https://polygon-mainnet.g.alchemy.com/v2/${rpcKey || "demo"}`;
          const alchemyRes = await fetch(alchemyRpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: 1,
              jsonrpc: "2.0",
              method: "alchemy_getTokenBalances",
              params: [
                addr,
                [CUSTOM_TOKEN_ADDRESS],
                { maxCount: 100 }
              ],
            }),
          });
          const alchemyJson = await alchemyRes.json();
          const tokenBalance = alchemyJson?.result?.tokenBalances?.[0]?.tokenBalance;
          if (tokenBalance) {
            raw = BigInt(tokenBalance);
            success = true;
          }
        } catch {
          // Fallback to standard RPC method
          const RPC = "https://polygon-rpc.com";
          try {
            // decimals()
            const decRes = await fetch(RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_call",
                params: [
                  { to: CUSTOM_TOKEN_ADDRESS, data: "0x313ce567" },
                  "latest",
                ],
              }),
            });
            const decJson = await decRes.json();
            decimals = decJson?.result ? Number(BigInt(decJson.result)) : 18;
            // balanceOf(address)
            const addrNo0x = addr.replace(/^0x/, "").toLowerCase();
            const data = `0x70a08231${addrNo0x.padStart(64, "0")}`;
            const balRes = await fetch(RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "eth_call",
                params: [{ to: CUSTOM_TOKEN_ADDRESS, data }, "latest"],
              }),
            });
            const balJson = await balRes.json();
            raw = balJson?.result ? BigInt(balJson.result) : 0n;
            success = true;
          } catch {
            success = false;
          }
        }

        const divisor =
          10n ** BigInt(Number.isFinite(decimals) ? decimals : 18);
        const whole = raw / divisor;
        const formatted = `$${formatWholeWithCommas(whole)} COR`;
        if (!aborted) {
          setCorBalance(formatted);
          // Cache balance in session storage
          sessionStorage.setItem(`__corBalance_${addr}`, formatted);
        }
      } catch {
        if (!aborted) {
          setCorBalance("$0 COR");
          sessionStorage.setItem(`__corBalance_${addr}`, "$0 COR");
        }
      }
    }
    load();
    return () => {
      aborted = true;
    };
  }, [account?.address, refreshTrigger]);

  function goJoin() {
    if (inRouter) navigate("/join");
    else window.location.href = "/join";
  }

  async function updateProfileEmail(
    addr: string,
    baseUrl: string,
    anonKey: string,
  ) {
    try {
      // Try to get email from thirdweb in-app wallet
      let email: string | null = null;
      try {
        email = await getUserEmail({ client });
      } catch {
        // Email fetch failed or user not authenticated via in-app wallet
      }

      if (!email) return;

      // Check if profile already has an email
      const checkUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(
        addr,
      )}&select=email&limit=1`;
      const checkRes = await fetch(checkUrl, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });

      if (!checkRes.ok) return;

      const rows = (await checkRes.json()) as Array<{
        email?: string | null;
      }>;
      const existingProfile = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      // Only update if email is null/empty
      if (existingProfile?.email) return;

      // Update profile with email
      const updateUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(
        addr,
      )}`;
      await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          email: email,
          email_source: "thirdweb_inapp",
        }),
      });
    } catch (err) {
      console.debug("[ThirdwebWallet] Error updating profile email:", err);
    }
  }

  async function updateProfileIPAddress(
    addr: string,
    baseUrl: string,
    anonKey: string,
  ) {
    try {
      // Try to get IP address from public IP service
      let ipAddress: string | null = null;
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        if (ipRes.ok) {
          const ipData = (await ipRes.json()) as { ip?: string };
          ipAddress = ipData?.ip || null;
        }
      } catch {
        // IP fetch failed, silently ignore
      }

      if (!ipAddress) return;

      // Check if profile already has an IP address
      const checkUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(
        addr,
      )}&select=last_ip_address&limit=1`;
      const checkRes = await fetch(checkUrl, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });

      if (!checkRes.ok) return;

      const rows = (await checkRes.json()) as Array<{
        last_ip_address?: string | null;
      }>;
      const existingProfile = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      const existingIP = existingProfile?.last_ip_address;

      // Only update if:
      // 1. Last IP is null/empty, OR
      // 2. New IP is different from existing IP
      if (existingIP && existingIP === ipAddress) return;

      // Never overwrite non-null IP with null, so if we couldn't get IP, don't update
      if (!ipAddress) return;

      // Lookup geolocation data for the IP address
      let ipStateProvince: string = "";
      let ipCountry: string = "";
      try {
        const geoRes = await fetch(
          `https://ipwho.is/${ipAddress}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (geoRes.ok) {
          const geoData = (await geoRes.json()) as {
            success?: boolean;
            country?: string;
            region?: string;
          };
          if (geoData.success) {
            ipCountry = geoData.country || "";
            ipStateProvince = geoData.region || "";
          }
        }
      } catch {
        // Geolocation lookup failed, continue with empty values
      }

      // Update profile with IP address and geolocation data
      const updateUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(
        addr,
      )}`;
      const updateBody: Record<string, string> = {
        last_ip_address: ipAddress,
        ip_country: ipCountry,
        ip_state_province: ipStateProvince,
      };

      await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(updateBody),
      });
    } catch (err) {
      console.debug("[ThirdwebWallet] Error updating profile IP address:", err);
    }
  }

  async function loadAndVerifyProfile(addr: string | null) {
    try {
      const baseUrl = (import.meta as any).env.SUPABASE_URL as
        | string
        | undefined;
      const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
        | string
        | undefined;
      if (!addr) {
        (window as any).__walletProfile = null;
        sessionStorage.removeItem("__walletProfileCache");
        document.dispatchEvent(
          new CustomEvent("wallet:profile", { detail: null }),
        );
        return;
      }
      if (!baseUrl || !anonKey) return;

      // Check session cache first - avoid refetch on page navigation
      const cachedProfile = sessionStorage.getItem("__walletProfileCache");
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          if (parsed?.wallet_address?.toLowerCase() === addr.toLowerCase()) {
            (window as any).__walletProfile = parsed;
            document.dispatchEvent(
              new CustomEvent("wallet:profile", { detail: parsed }),
            );
            // Still attempt email and IP updates in background (non-blocking)
            updateProfileEmail(addr, baseUrl, anonKey).catch(() => {});
            updateProfileIPAddress(addr, baseUrl, anonKey).catch(() => {});
            return;
          }
        } catch (e) {
          // Cache invalid, proceed with fetch
        }
      }

      // Run these in background - don't block profile loading
      updateProfileEmail(addr, baseUrl, anonKey).catch(() => { });
      updateProfileIPAddress(addr, baseUrl, anonKey).catch(() => { });

      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(
        addr,
      )}&select=wallet_address,username,beta_allowlist,tos_accepted_at,created_at&limit=1`;
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        (window as any).__walletProfile = null;
        sessionStorage.removeItem("__walletProfileCache");
        document.dispatchEvent(
          new CustomEvent("wallet:profile", { detail: null }),
        );
        return;
      }
      const rows = (await res.json()) as Array<{
        wallet_address?: string | null;
        username?: string | null;
        beta_allowlist?: boolean | string | number | null;
        tos_accepted_at?: string | null;
        created_at?: string | null;
      }>;
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      (window as any).__walletProfile = row;

      // Cache profile in session storage
      if (row) {
        sessionStorage.setItem("__walletProfileCache", JSON.stringify(row));
      } else {
        sessionStorage.removeItem("__walletProfileCache");
      }

      document.dispatchEvent(
        new CustomEvent("wallet:profile", { detail: row }),
      );
      const missing = !row || !row.username || !row.tos_accepted_at;
      if (missing && window.location.pathname !== "/join") {
        goJoin();
      }
    } catch (err) {
      // Silently handle fetch errors (network issues, etc.)
      console.debug("[ThirdwebWallet] Error loading profile:", err);
      (window as any).__walletProfile = null;
      sessionStorage.removeItem("__walletProfileCache");
      try {
        document.dispatchEvent(
          new CustomEvent("wallet:profile", { detail: null }),
        );
      } catch {}
    }
  }

  // Keep global window state and event in sync with active account
  // Use session storage to avoid refetching on page navigation
  useEffect(() => {
    const addr = account?.address ?? null;
    const sessionKey = "__walletSessionAddress";
    const lastSessionAddr = sessionStorage.getItem(sessionKey);

    // If we have a session address and it matches the current account, skip refetch
    if (lastSessionAddr === addr) {
      // Address matches session - just restore from window state if needed
      if (!(window as any).__walletAddress) {
        try {
          (window as any).__walletAddress = addr;
          document.dispatchEvent(
            new CustomEvent("wallet:change", { detail: { address: addr } }),
          );
        } catch {}
      }
      return;
    }

    // New connection or disconnection - update session and profile
    if (addr) {
      sessionStorage.setItem(sessionKey, addr);
    } else {
      sessionStorage.removeItem(sessionKey);
    }

    try {
      (window as any).__walletAddress = addr;
      document.dispatchEvent(
        new CustomEvent("wallet:change", { detail: { address: addr } }),
      );
    } catch {}
    loadAndVerifyProfile(addr);
  }, [account?.address]);

  const handleConnect = useCallback(async (connectionInfo: any) => {
    try {
      const addr =
        connectionInfo?.account?.address || connectionInfo?.address || null;
      (window as any).__walletAddress = addr;
      document.dispatchEvent(
        new CustomEvent("wallet:change", { detail: { address: addr } }),
      );
      await loadAndVerifyProfile(addr);
    } catch {}
  }, []);

  return (
    <div className="relative inline-block">
      <ConnectButton
        accountAbstraction={{ chain: polygon, sponsorGas: true }}
        autoConnect={true}
        client={client}
        connectButton={{ label: "Log In" }}
        connectModal={{ size: "compact", title: "Log In" }}
        theme={lightTheme({
          colors: {
            selectedTextBg: "hsl(257, 10%, 14%)",
            primaryButtonBg: "hsl(245, 100%, 53%)",
          },
        })}
        wallets={wallets}
        onConnect={handleConnect}
        chain={polygon}
      />
      {profile?.username ? (
        <span
          className="pointer-events-none absolute z-10 top-1 left-12 right-2 h-[20px] md:h-[22px] bg-white rounded px-1 truncate text-[12px] md:text-sm font-medium text-slate-800 text-left leading-[20px] md:leading-[22px]"
          title={profile.username ?? undefined}
        >
          {profile.username}
        </span>
      ) : null}
      {account?.address ? (
        <span className="pointer-events-none absolute z-10 top-[26px] left-12 right-2 bg-white rounded px-1 text-[10px] md:text-xs text-slate-600 text-left leading-[16px]">
          {corBalance ?? "$0 COR"}
        </span>
      ) : null}
    </div>
  );
}
