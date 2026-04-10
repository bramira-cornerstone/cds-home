import { useEffect, useState } from "react";
import {
  fetchLatestMintedEditionIds,
  fetchMintedByEditionId,
} from "@/lib/supabaseMinted";

export interface RedeemCardData {
  id: number;
  name: string | null;
  team: string | null;
  thumb: string | null;
  videoId: string | null;
  tier: string | null;
  minted: number | string | null;
  gameDate: string | null;
  createDate: string | null;
  setName: string | null;
  badge: string | null;
  badge2: string | null;
  badge3: string | null;
}

export default function useRedeemCards() {
  const [cards, setCards] = useState<RedeemCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    async function loadCards() {
      try {
        setLoading(true);
        // Fetch the 10 latest edition IDs from public.Minted ordered by edition_id DESC
        const ids = await fetchLatestMintedEditionIds(10, ctrl.signal);
        if (!ids || ids.length === 0) {
          setCards([]);
          setLoading(false);
          return;
        }

        // Fetch metadata for all IDs
        const results = await Promise.allSettled(
          ids.map(async (id) => {
            try {
              const row = await fetchMintedByEditionId(id, ctrl.signal);
              const video =
                row?.video_location && String(row.video_location).trim();
              const url = video
                ? `https://image.mux.com/${video}/thumbnail.png?time=5`
                : null;
              const name = row?.PlayerName ? String(row.PlayerName) : null;
              const team =
                (row as any)?.team != null ? String((row as any).team) : null;
              const tier = row?.TierValue ? String(row.TierValue) : null;
              const minted = row?.Minted ?? null;
              const gameDate = row?.GameDate ? String(row.GameDate) : null;
              const rawCreate =
                (row as any)?.CreateDate ??
                (row as any)?.CreatedDate ??
                (row as any)?.created_at ??
                (row as any)?.createdAt ??
                (row as any)?.inserted_at ??
                (row as any)?.InsertedAt ??
                null;
              const createDate = rawCreate != null ? String(rawCreate) : null;
              const setName =
                (row as any)?.SetName != null
                  ? String((row as any).SetName)
                  : null;

              const b1 = (row?.Badge1 ? String(row.Badge1) : "").toUpperCase();
              const badge =
                b1 === "CP"
                  ? "/images/cp-badge.webp"
                  : b1 === "RY"
                    ? "/images/ry-badge.webp"
                    : b1 === "CY"
                      ? "/images/cy-badge.webp"
                      : null;

              const b2 = (row?.Badge2 ? String(row.Badge2) : "").toUpperCase();
              const badge2 =
                b2 === "CP"
                  ? "/images/cp-badge.webp"
                  : b2 === "RY"
                    ? "/images/ry-badge.webp"
                    : b2 === "CY"
                      ? "/images/cy-badge.webp"
                      : null;

              const b3 = (row?.Badge3 ? String(row.Badge3) : "").toUpperCase();
              const badge3 =
                b3 === "CP"
                  ? "/images/cp-badge.webp"
                  : b3 === "RY"
                    ? "/images/ry-badge.webp"
                    : b3 === "CY"
                      ? "/images/cy-badge.webp"
                      : null;

              return {
                id,
                name,
                team,
                thumb: url,
                videoId: video ?? null,
                tier,
                minted,
                gameDate,
                createDate,
                setName,
                badge,
                badge2,
                badge3,
              };
            } catch (e: any) {
              if (e?.name === "AbortError") return null;
              throw e;
            }
          }),
        );

        if (cancelled) return;

        // Process results and sort by createDate (most recent first)
        const processedCards: RedeemCardData[] = [];
        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            processedCards.push(result.value as RedeemCardData);
          }
        }

        // Sort by createDate, most recent first
        processedCards.sort((a, b) => {
          const dateA = a.createDate ? new Date(a.createDate).getTime() : 0;
          const dateB = b.createDate ? new Date(b.createDate).getTime() : 0;
          return dateB - dateA;
        });

        setCards(processedCards);
      } catch (error) {
        if (!cancelled) {
          setCards([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCards();

    return () => {
      cancelled = true;
      try {
        ctrl.abort();
      } catch {}
    };
  }, []);

  return { cards, loading };
}
