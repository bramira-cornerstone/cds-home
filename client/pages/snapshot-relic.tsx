import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import EditionSplineScene from "@/components/EditionSplineScene";
import { createClient } from "@supabase/supabase-js";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { countInPackTokensByEditionId } from "@/lib/supabaseRelicSerialsJoined";
import { countStakedTokensByEditionId } from "@/lib/public_staking";
import { countRedeemedTokensByEditionId } from "@/lib/supabaseRedemptionEvents";

interface RelicData {
  edition_id: number;
  serial: number;
  PlayerName: string | null;
  ProductName: string | null;
  Minted: number | null;
  SeriesName: string | null;
  TierValue: string | null;
  Description: string | null;
  SetName: string | null;
  FinalScore: string | null;
  GameDate: string | null;
  StatValue1: string | null;
  StatValue2: string | null;
  StatValue3: string | null;
  StatValue4: string | null;
  StatValue5: string | null;
  StatName1: string | null;
  StatName2: string | null;
  StatName3: string | null;
  StatName4: string | null;
  StatName5: string | null;
  Badge1: string | null;
  Badge2: string | null;
  Badge3: string | null;
  video_location: string | null;
  spline_scene_url: string | null;
  CreateDate: string | null;
  RollingMedianSale: string | null;
  LowAsk: string | null;
  HighOffer: string | null;
}

export default function SnapshotRelicPage() {
  const { token_id } = useParams<{ token_id: string }>();
  const [relicData, setRelicData] = useState<RelicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { listings: activeListings } = useActiveListings();
  const { auctions: activeAuctions } = useActiveAuctions();
  const [stakedCount, setStakedCount] = useState<number>(0);
  const [inPacksCount, setInPacksCount] = useState<number>(0);
  const [redeemedCount, setRedeemedCount] = useState<number>(0);

  useEffect(() => {
    const fetchRelicData = async () => {
      if (!token_id) {
        setError("No token_id provided");
        setLoading(false);
        return;
      }

      try {
        const supabaseUrl = import.meta.env.SUPABASE_URL as string;
        const supabaseKey = import.meta.env.SUPABASE_ANON_KEY as string;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error: dbError } = await supabase
          .from("RelicSerialsJoined")
          .select("*")
          .eq("token_id", BigInt(token_id))
          .single();

        if (dbError) {
          setError(`Database error: ${dbError.message}`);
          setLoading(false);
          return;
        }

        if (!data) {
          setError("Relic not found");
          setLoading(false);
          return;
        }

        setRelicData(data as RelicData);
        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error fetching relic data",
        );
        setLoading(false);
      }
    };

    fetchRelicData();
  }, [token_id]);

  // Calculate active listings count for the relic's edition
  const activeListingsCount = useMemo(() => {
    if (!relicData?.edition_id) return 0;

    const serialsSet = new Set<number>();

    // Add serials from active listings
    if (activeListings) {
      for (const listing of activeListings) {
        if (
          listing.editionId === relicData.edition_id &&
          listing.serial !== null &&
          listing.status === "active"
        ) {
          serialsSet.add(listing.serial);
        }
      }
    }

    // Add serials from active auctions
    if (activeAuctions) {
      for (const auction of activeAuctions) {
        if (
          auction.editionId === relicData.edition_id &&
          auction.serial !== null &&
          auction.status === "active"
        ) {
          serialsSet.add(auction.serial);
        }
      }
    }

    return serialsSet.size;
  }, [relicData?.edition_id, activeListings, activeAuctions]);

  // Fetch staked count for the relic's edition
  useEffect(() => {
    if (!relicData?.edition_id) {
      setStakedCount(0);
      return;
    }
    let cancelled = false;
    countStakedTokensByEditionId(relicData.edition_id, undefined)
      .then((count) => {
        if (!cancelled) setStakedCount(count);
      })
      .catch(() => {
        if (!cancelled) setStakedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [relicData?.edition_id]);

  // Fetch in-packs count for the relic's edition
  useEffect(() => {
    if (!relicData?.edition_id) {
      setInPacksCount(0);
      return;
    }
    let cancelled = false;
    countInPackTokensByEditionId(relicData.edition_id, undefined)
      .then((count) => {
        if (!cancelled) setInPacksCount(count);
      })
      .catch(() => {
        if (!cancelled) setInPacksCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [relicData?.edition_id]);

  // Fetch redeemed count for the relic's edition
  useEffect(() => {
    if (!relicData?.edition_id) {
      setRedeemedCount(0);
      return;
    }
    let cancelled = false;
    countRedeemedTokensByEditionId(relicData.edition_id, undefined, undefined)
      .then((count) => {
        if (!cancelled) setRedeemedCount(count);
      })
      .catch(() => {
        if (!cancelled) setRedeemedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [relicData?.edition_id]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading snapshot...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!relicData) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="text-white">No relic data</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      <div className="w-full h-full flex items-center justify-center">
        <EditionSplineScene
          playerName={relicData.PlayerName}
          productName={relicData.ProductName}
          minted={relicData.Minted}
          seriesName={relicData.SeriesName}
          tierValue={relicData.TierValue}
          playDescription={relicData.Description}
          setName={relicData.SetName}
          finalScore={relicData.FinalScore}
          gameDate={relicData.GameDate}
          statValue1={relicData.StatValue1}
          statValue2={relicData.StatValue2}
          statValue3={relicData.StatValue3}
          statValue4={relicData.StatValue4}
          statValue5={relicData.StatValue5}
          statName1={relicData.StatName1}
          statName2={relicData.StatName2}
          statName3={relicData.StatName3}
          statName4={relicData.StatName4}
          statName5={relicData.StatName5}
          badge1={relicData.Badge1}
          badge2={relicData.Badge2}
          badge3={relicData.Badge3}
          overlayUrl={relicData.video_location}
          sceneUrl={relicData.spline_scene_url}
          serialNumber={relicData.serial}
          edition_id={relicData.edition_id}
          showControls={false}
          isSnapshot={true}
          lowAsk={relicData.LowAsk}
          highOffer={relicData.HighOffer}
          rollingMedianSale={relicData.RollingMedianSale}
          activeListingsCount={activeListingsCount}
          stakedCount={stakedCount}
          inPacksCount={inPacksCount}
          redeemedCount={redeemedCount}
        />
      </div>
    </div>
  );
}
