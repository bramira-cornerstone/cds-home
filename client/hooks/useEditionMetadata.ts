import { useEffect, useState } from "react";
import { fetchRelicSerialsByEditionId } from "@/lib/supabaseRelicSerialsJoined";

export interface EditionMetadata {
  edition_id: number;
  name?: string;
  thumb?: string;
  tier?: string;
  minted?: number | string;
  gameDate?: string;
  createDate?: string;
  setName?: string;
  badge?: string;
  badge2?: string;
  badge3?: string;
  team?: string;
}

export function useEditionMetadata(editionId: number | null) {
  const [metadata, setMetadata] = useState<EditionMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editionId) {
      setMetadata(null);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const row = await fetchRelicSerialsByEditionId(editionId);
        if (row) {
          const video =
            row?.video_location && String(row.video_location).trim();
          const thumb = video
            ? `https://image.mux.com/${video}/thumbnail.png?time=5`
            : null;

          // Generate badges
          const getBadge = (badgeCode: string | null): string | undefined => {
            if (!badgeCode) return undefined;
            const code = String(badgeCode).toUpperCase();
            if (code === "CP") return "/images/cp-badge.webp";
            if (code === "RY") return "/images/ry-badge.webp";
            if (code === "CY") return "/images/cy-badge.webp";
            return undefined;
          };

          setMetadata({
            edition_id: editionId,
            name: row?.PlayerName ? String(row.PlayerName) : undefined,
            thumb: thumb ?? undefined,
            tier: row?.TierValue ? String(row.TierValue) : undefined,
            minted: (row as any)?.Minted ?? undefined,
            gameDate: row?.GameDate ? String(row.GameDate) : undefined,
            createDate:
              (row as any)?.CreateDate ??
              (row as any)?.CreatedDate ??
              (row as any)?.created_at ??
              (row as any)?.createdAt ??
              (row as any)?.inserted_at ??
              (row as any)?.InsertedAt ??
              undefined,
            setName: (row as any)?.SetName ? String((row as any).SetName) : undefined,
            badge: getBadge(row?.Badge1),
            badge2: getBadge(row?.Badge2),
            badge3: getBadge(row?.Badge3),
            team: (row as any)?.team ? String((row as any).team) : undefined,
          });
        }
      } catch (err) {
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [editionId]);

  return { metadata, loading };
}
