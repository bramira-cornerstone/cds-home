import { useEffect, useState } from "react";
import EditionSplineScene from "@/components/EditionSplineScene";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import { getOwnerDisplayName } from "@/lib/auctionHouse";

interface TrophyDisplayCardProps {
  selectedRelic: { editionId: number; serial: number; tokenId: number } | null;
}

export default function TrophyDisplayCard({
  selectedRelic,
}: TrophyDisplayCardProps) {
  const [mintedRow, setMintedRow] = useState<MintedRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRelic) {
      setMintedRow(null);
      return;
    }

    setLoading(true);
    const controller = new AbortController();

    fetchMintedByEditionId(selectedRelic.editionId, controller.signal)
      .then((row) => {
        setMintedRow(row);
      })
      .catch(() => {
        // silently ignore errors
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedRelic?.editionId]);

  useEffect(() => {
    if (!selectedRelic?.tokenId) {
      setOwnerName(null);
      return;
    }

    const fetchOwner = async () => {
      try {
        const rpcKey = (import.meta as any).env.RPC_KEY;
        const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY;

        if (!rpcKey || !anonKey) {
          return;
        }

        const tokenIdNum = parseInt(String(selectedRelic.tokenId), 10);
        if (!Number.isFinite(tokenIdNum)) {
          return;
        }

        const erc721Address = (import.meta as any).env.VITE_ERC721_ADDRESS as string | undefined;
        if (!erc721Address) {
          return;
        }
        const data = `0x6352211e${tokenIdNum.toString(16).padStart(64, "0")}`;

        const rpcResponse = await fetch("https://polygon-rpc.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [{ to: erc721Address, data }, "latest"],
          }),
        });

        if (!rpcResponse.ok) {
          return;
        }

        const rpcData = await rpcResponse.json();
        if (!rpcData?.result || rpcData.result === "0x") {
          return;
        }

        const ownerAddress = ("0x" + rpcData.result.slice(-40)).toUpperCase();

        const baseUrl = (import.meta as any).env.SUPABASE_URL;
        const profileUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=ilike.${encodeURIComponent(ownerAddress)}&select=username&limit=1`;
        const profileRes = await fetch(profileUrl, {
          headers: {
            apikey: anonKey,
            Accept: "application/json",
          },
        });

        if (profileRes.ok) {
          const profiles = (await profileRes.json()) as any[];
          if (profiles.length > 0 && profiles[0].username) {
            const displayName = getOwnerDisplayName(profiles[0].username);
            setOwnerName(displayName);
          } else {
            const displayName = getOwnerDisplayName(ownerAddress);
            setOwnerName(displayName);
          }
        } else {
          const displayName = getOwnerDisplayName(ownerAddress);
          setOwnerName(displayName);
        }
      } catch (err) {
        console.error("Failed to fetch owner for trophy:", err);
      }
    };

    fetchOwner();
  }, [selectedRelic?.tokenId]);

  if (!selectedRelic) {
    return (
      <div
        className="w-full h-full rounded-none shadow-sm"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          border: "0.8px none rgb(203, 213, 225)",
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full rounded-none border border-gray-400 bg-gray-300/50 flex items-center justify-center">
        <span className="text-xs text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!mintedRow) {
    return (
      <div className="w-full h-full rounded-none border border-gray-400 bg-gray-300/50 flex items-center justify-center">
        <span className="text-xs text-gray-600">Failed to load</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-none" style={{ backgroundColor: "transparent" }}>
      <EditionSplineScene
        className="flex flex-col h-full w-full"
        edition_id={selectedRelic.editionId}
        overlayUrl={
          mintedRow.video_location
            ? `https://stream.mux.com/${mintedRow.video_location}.m3u8`
            : undefined
        }
        sceneUrl={mintedRow.scene_url ?? undefined}
        playerName={mintedRow.PlayerName ?? null}
        productName={mintedRow.ProductName ?? null}
        minted={mintedRow.Minted ?? null}
        seriesName={mintedRow.SeriesName ?? null}
        tierValue={mintedRow.TierValue ?? null}
        playDescription={mintedRow.PlayDescription ?? null}
        setName={mintedRow.SetName ?? null}
        finalScore={mintedRow.FinalScore ?? null}
        gameDate={mintedRow.GameDate ?? null}
        statValue1={mintedRow.PlayerStatValue1 ?? null}
        statValue2={mintedRow.PlayerStatValue2 ?? null}
        statValue3={mintedRow.PlayerStatValue3 ?? null}
        statValue4={mintedRow.PlayerStatValue4 ?? null}
        statValue5={mintedRow.PlayerStatValue5 ?? null}
        statName1={mintedRow.PlayerStat1 ?? null}
        statName2={mintedRow.PlayerStat2 ?? null}
        statName3={mintedRow.PlayerStat3 ?? null}
        statName4={mintedRow.PlayerStat4 ?? null}
        statName5={mintedRow.PlayerStat5 ?? null}
        badge1={mintedRow.Badge1 ?? null}
        badge2={mintedRow.Badge2 ?? null}
        badge3={mintedRow.Badge3 ?? null}
        serialNumber={selectedRelic.serial}
        owner_name={ownerName}
        showControls={false}
        forceSerialMode={true}
        cameraZ={585}
        isInTrophyCase={true}
      />
    </div>
  );
}
