import { useEffect, useState } from "react";

export interface TokenMetadata {
  edition_id: number | null;
  serial: number | null;
}

export function useTokenMetadata(tokenId: string | null) {
  const [metadata, setMetadata] = useState<TokenMetadata>({
    edition_id: null,
    serial: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tokenId) {
      setMetadata({ edition_id: null, serial: null });
      return;
    }

    async function fetchMetadata() {
      try {
        setLoading(true);
        const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
        const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

        if (!baseUrl || !anonKey) {
          setMetadata({ edition_id: null, serial: null });
          return;
        }

        const root = baseUrl.replace(/\/$/, "");
        const url = `${root}/rest/v1/RelicSerialsJoined?token_id=eq.${encodeURIComponent(tokenId)}&select=edition_id,serial`;

        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const data = (await response.json()) as Array<{ edition_id: number; serial: number }>;
          if (Array.isArray(data) && data[0]) {
            setMetadata({
              edition_id: data[0].edition_id,
              serial: data[0].serial,
            });
          } else {
            setMetadata({ edition_id: null, serial: null });
          }
        } else {
          setMetadata({ edition_id: null, serial: null });
        }
      } catch (err) {
        setMetadata({ edition_id: null, serial: null });
      } finally {
        setLoading(false);
      }
    }

    fetchMetadata();
  }, [tokenId]);

  return { metadata, loading };
}
