import React from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import EditionSplineScene from "@/components/EditionSplineScene";
import type { TrophySlot } from "@/hooks/useTrophyCase";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import {
  fetchUsernameByWalletAddress,
  fetchRelicOwnerByTokenId,
} from "@/lib/supabaseRelicSerialsJoined";
import { getOwnerDisplayName } from "@/lib/auctionHouse";

export type TrophyDisplayKey =
  | "trophy_display1"
  | "trophy_display2"
  | "trophy_display3"
  | "trophy_display4"
  | "trophy_display5";

export type TrophySlotName =
  | "trophy1"
  | "trophy2"
  | "trophy3"
  | "trophy4"
  | "trophy5"
  | "trophy6"
  | "trophy7"
  | "trophy8"
  | "trophy9";

export type SlotConfig = {
  name: TrophySlotName;
  widthPct: number;
  centerXPct: number;
  centerYPct: number;
};

const DISPLAY_CONFIGS: Record<TrophyDisplayKey, SlotConfig[]> = {
  trophy_display1: [
    {
      name: "trophy1",
      widthPct: 33.3333,
      centerXPct: 50,
      centerYPct: 58,
    },
  ],
  trophy_display2: [],
  trophy_display3: [],
  trophy_display4: [],
  trophy_display5: [],
};

export interface TrophyPlaceholdersProps {
  display: TrophyDisplayKey;
  isEditMode?: boolean;
  selectedSlot?: TrophySlotName | null;
  onSlotClick?: (slot: TrophySlotName) => void;
  selectedRelicsBySlot?: Record<
    TrophySlot,
    { editionId: number; serial: number; tokenId: number } | null
  >;
}

const TrophySlot = ({
  slotName,
  isEditMode,
  isSelected,
  onSlotClick,
  selectedRelic,
}: {
  slotName: TrophySlotName;
  isEditMode: boolean;
  isSelected: boolean;
  onSlotClick?: (slot: TrophySlotName) => void;
  selectedRelic?: { editionId: number; serial: number; tokenId: number } | null;
}) => {
  const navigate = useNavigate();
  const [mintedRow, setMintedRow] = useState<MintedRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);

  const handleSlotClick = () => {
    if (isEditMode) {
      onSlotClick?.(slotName);
    } else if (selectedRelic) {
      navigate(`/edition/${selectedRelic.editionId}/serial/${selectedRelic.serial}`);
    }
  };

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
        // Query RelicSerialsJoined by tokenId to get current_owner
        const ownerData = await fetchRelicOwnerByTokenId(selectedRelic.tokenId);
        const currentOwner = ownerData?.current_owner;

        if (!currentOwner) {
          return;
        }

        // Use the same method as the serial page to fetch username
        const username = await fetchUsernameByWalletAddress(currentOwner);
        const displayName = getOwnerDisplayName(username || currentOwner);
        setOwnerName(displayName);
      } catch (err) {
        console.error("Failed to fetch owner for trophy:", err);
      }
    };

    fetchOwner();
  }, [selectedRelic?.tokenId]);

  return (
    <div
      className={`flex-1 relative ${!isEditMode && selectedRelic ? "cursor-pointer" : ""}`}
      data-slot={slotName}
      onClick={handleSlotClick}
      role={!isEditMode && selectedRelic ? "button" : undefined}
      tabIndex={!isEditMode && selectedRelic ? 0 : undefined}
    >
      <AspectRatio ratio={3 / 4}>
        {selectedRelic ? (
          <div className="h-full w-full overflow-hidden bg-slate-100/10 relative">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs text-gray-600">Loading...</span>
              </div>
            ) : mintedRow ? (
              <>
                <EditionSplineScene
                  key={`${selectedRelic.editionId}-${selectedRelic.serial}`}
                  className="h-full w-full"
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
                  badge1={mintedRow.Badge1 ?? null}
                  badge2={mintedRow.Badge2 ?? null}
                  badge3={mintedRow.Badge3 ?? null}
                  team={mintedRow?.team ?? null}
                  serialNumber={selectedRelic.serial}
                  owner_name={ownerName}
                  showControls={false}
                  forceSerialMode={true}
                  cameraZ={535}
                  autoPlay={false}
                  isInTrophyCase={true}
                />
                {!isEditMode && (
                  <div
                    className="absolute inset-0 cursor-pointer"
                    onClick={handleSlotClick}
                  />
                )}
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs text-gray-600">Failed to load</span>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`h-full w-full rounded-sm border border-gray-400 bg-gray-300/50 ${
              isEditMode
                ? "cursor-pointer hover:bg-gray-300/70 transition-colors"
                : ""
            } ${isSelected ? "ring-2" : ""}`}
            style={isSelected ? { boxShadow: "0 0 0 2px #004FFF" } : {}}
          />
        )}
      </AspectRatio>
      {isEditMode && !selectedRelic && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-gray-600 bg-white/80 px-2 py-1 rounded">
            Select Relic
          </span>
        </div>
      )}
    </div>
  );
};

export function TrophyPlaceholders({
  display,
  isEditMode = false,
  selectedSlot = null,
  onSlotClick,
  selectedRelicsBySlot = {},
}: TrophyPlaceholdersProps) {
  if (display === "trophy_display2") {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "66.6667%",
            top: "58%",
            pointerEvents: "auto",
          }}
        >
          <div className="flex items-center justify-center gap-[2px]">
            <TrophySlot
              slotName="trophy1"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy1"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy1 ?? null}
            />
            <TrophySlot
              slotName="trophy2"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy2"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy2 ?? null}
            />
          </div>
        </div>
      </div>
    );
  }

  if (display === "trophy_display3") {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "90%",
            top: "58%",
            pointerEvents: "auto",
          }}
        >
          <div className="flex items-center justify-center gap-[2px]">
            <TrophySlot
              slotName="trophy1"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy1"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy1 ?? null}
            />
            <TrophySlot
              slotName="trophy2"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy2"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy2 ?? null}
            />
            <TrophySlot
              slotName="trophy3"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy3"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy3 ?? null}
            />
          </div>
        </div>
      </div>
    );
  }

  if (display === "trophy_display4") {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "95%",
            top: "58%",
            pointerEvents: "auto",
          }}
        >
          <div className="flex items-center justify-center gap-[2px]">
            <TrophySlot
              slotName="trophy1"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy1"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy1 ?? null}
            />
            <TrophySlot
              slotName="trophy2"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy2"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy2 ?? null}
            />
            <TrophySlot
              slotName="trophy3"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy3"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy3 ?? null}
            />
            <TrophySlot
              slotName="trophy4"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy4"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy4 ?? null}
            />
          </div>
        </div>
      </div>
    );
  }

  if (display === "trophy_display5") {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "46%",
            pointerEvents: "auto",
          }}
        >
          <div className="flex items-center justify-center gap-[2px]">
            <TrophySlot
              slotName="trophy1"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy1"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy1 ?? null}
            />
            <TrophySlot
              slotName="trophy2"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy2"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy2 ?? null}
            />
          </div>
        </div>
        <div
          className="absolute left-1/2 top-[76%] -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "70%",
            pointerEvents: "auto",
          }}
        >
          <div className="flex items-center justify-center gap-[2px]">
            <TrophySlot
              slotName="trophy3"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy3"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy3 ?? null}
            />
            <TrophySlot
              slotName="trophy4"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy4"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy4 ?? null}
            />
            <TrophySlot
              slotName="trophy5"
              isEditMode={isEditMode}
              isSelected={selectedSlot === "trophy5"}
              onSlotClick={onSlotClick}
              selectedRelic={selectedRelicsBySlot?.trophy5 ?? null}
            />
          </div>
        </div>
      </div>
    );
  }

  const slots = DISPLAY_CONFIGS[display] || [];
  if (!slots.length) return null;

  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      {slots.map((slot) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${slot.centerXPct}%`,
          top: `${slot.centerYPct}%`,
          width: `${slot.widthPct}%`,
          transform: "translate(-50%, -50%)",
          pointerEvents: isEditMode ? "auto" : "none",
        };
        return (
          <div
            key={slot.name}
            style={{ ...style, pointerEvents: "auto" }}
            className="drop-placeholder"
          >
            <TrophySlot
              slotName={slot.name}
              isEditMode={isEditMode}
              isSelected={selectedSlot === slot.name}
              onSlotClick={onSlotClick}
              selectedRelic={
                selectedRelicsBySlot?.[slot.name as TrophySlot] ?? null
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export default TrophyPlaceholders;
