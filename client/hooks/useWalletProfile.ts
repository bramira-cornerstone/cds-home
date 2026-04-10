import { useSyncExternalStore, useMemo } from "react";

export interface WalletProfile {
  wallet_address?: string | null;
  username?: string | null;
  tos_accepted_at?: string | null;
  beta_allowlist?: boolean | string | number | null;
  created_at?: string | null;
}

function subscribe(callback: () => void) {
  const handler = () => callback();
  document.addEventListener("wallet:change", handler as EventListener);
  document.addEventListener("wallet:profile", handler as EventListener);
  return () => {
    document.removeEventListener("wallet:change", handler as EventListener);
    document.removeEventListener("wallet:profile", handler as EventListener);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") return '{"a":null,"p":null}';
  const a = (window as any).__walletAddress ?? null;
  const p = (window as any).__walletProfile ?? null;
  return JSON.stringify({ a, p });
}

function getServerSnapshot() {
  return '{"a":null,"p":null}';
}

export function useWalletProfile() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { a: address, p: profile } = useMemo(() => {
    try {
      return JSON.parse(snap) as { a: string | null; p: WalletProfile | null };
    } catch {
      return { a: null, p: null } as {
        a: string | null;
        p: WalletProfile | null;
      };
    }
  }, [snap]);
  const tosAccepted = useMemo(() => {
    const tosAcceptedAt = (profile as any)?.tos_accepted_at as any;
    return tosAcceptedAt != null;
  }, [(profile as any)?.tos_accepted_at]);
  return { address, profile, tosAccepted } as const;
}

export function useBetaAllowlist() {
  return useWalletProfile().tosAccepted;
}
