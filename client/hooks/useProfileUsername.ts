import { useEffect, useState } from "react";

interface ProfileData {
  username: string | null;
}

export function useProfileUsername(walletAddress: string | null) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setUsername(null);
      return;
    }

    async function fetchUsername() {
      try {
        setLoading(true);
        const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
        const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

        if (!baseUrl || !anonKey) {
          setUsername(null);
          return;
        }

        const root = baseUrl.replace(/\/$/, "");
        const url = `${root}/rest/v1/profiles?wallet_address=eq.${walletAddress}&select=username`;

        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const data = (await response.json()) as ProfileData[];
          if (Array.isArray(data) && data[0]?.username) {
            setUsername(data[0].username);
          } else {
            setUsername(null);
          }
        } else {
          setUsername(null);
        }
      } catch (err) {
        setUsername(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUsername();
  }, [walletAddress]);

  return { username, loading };
}
