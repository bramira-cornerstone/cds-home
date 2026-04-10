import React, { memo } from "react";
import { DarkModeHover } from "@/components/ui/dark_mode_hover";
import { getBadgeLabel } from "@/lib/badgeLabels";
import { getTeamCrest } from "@/lib/teams";

export type CollectionSerialCardProps = {
  id: number;
  name?: string | null;
  thumb?: string | null;
  tier?: string | null;
  serial?: number | string | null;
  minted?: number | null;
  gameDate?: string | null;
  createDate?: string | null;
  setName?: string | null;
  badge?: string | null;
  badge2?: string | null;
  badge3?: string | null;
  team?: string | null;
  disableBadgeTooltips?: boolean;
  isUserMarketplaceStatsCarousel?: boolean;
  isSettlementNeeded?: boolean;
  maxBid?: string | null;
  disableShadow?: boolean;
};

function CollectionSerialCard(props: CollectionSerialCardProps) {
  const {
    id,
    name,
    thumb,
    tier,
    serial,
    minted,
    gameDate,
    createDate,
    setName,
    badge,
    badge2,
    badge3,
    team,
    disableBadgeTooltips = false,
    isUserMarketplaceStatsCarousel = false,
    isSettlementNeeded = false,
    maxBid,
    disableShadow = false,
  } = props;
  return (
    <div
      className={`w-full ${!disableShadow ? "card-shadow-responsive card-shadow" : ""} flex flex-col ${
        isUserMarketplaceStatsCarousel ? "max-sm:h-[160px] h-auto" : "h-full"
      }`}
    >
      <div className="relative flex-1 w-full rounded-[1px] border border-slate-200 bg-white nightmode-exempt overflow-hidden flex flex-col m-auto">
        {name ? (
          <h3
            className="text-center font-normal text-slate-800 mb-1 truncate flex-shrink-0"
            title={name}
            style={
              isUserMarketplaceStatsCarousel
                ? { fontSize: "12px", lineHeight: "18px" }
                : { fontSize: "16px" }
            }
          >
            {name}
          </h3>
        ) : null}
        {thumb ? (
          <div className="flex flex-col justify-center items-center mb-1 overflow-hidden rounded-[1px] bg-slate-100 flex-1 min-h-0">
            <img
              src={thumb}
              alt={`Edition ${id} thumbnail`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : null}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center justify-start">
            {team ? (
              <img
                src={getTeamCrest(team) || "/images/teams/wfl_crest.png"}
                alt={team}
                className="h-[20px] w-[20px] object-contain"
              />
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-1 ml-auto">
            <span className="inline-block h-[16px] w-[16px]" aria-hidden="true">
              {badge3 ? (
                <DarkModeHover
                  tooltip={
                    disableBadgeTooltips ? undefined : getBadgeLabel(badge3)
                  }
                >
                  <img
                    src={badge3}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </DarkModeHover>
              ) : null}
            </span>
            <span className="inline-block h-[16px] w-[16px]" aria-hidden="true">
              {badge2 ? (
                <DarkModeHover
                  tooltip={
                    disableBadgeTooltips ? undefined : getBadgeLabel(badge2)
                  }
                >
                  <img
                    src={badge2}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </DarkModeHover>
              ) : null}
            </span>
            <span className="inline-block h-[16px] w-[16px]" aria-hidden="true">
              {badge ? (
                <DarkModeHover
                  tooltip={
                    disableBadgeTooltips ? undefined : getBadgeLabel(badge)
                  }
                >
                  <img
                    src={badge}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </DarkModeHover>
              ) : null}
            </span>
          </div>
        </div>
        <div
          className="text-slate-700 truncate flex-shrink-0"
          style={{
            paddingTop: "4px",
            fontSize: isUserMarketplaceStatsCarousel ? "12px" : "16px",
            lineHeight: isUserMarketplaceStatsCarousel ? "12px" : "16px",
          }}
        >
          {serial != null ? (
            <>
              #{<strong>{serial}</strong>}
              {minted ? ` of ${minted}` : ""}
            </>
          ) : (
            `edition_id: ${id}`
          )}
        </div>
        {gameDate ? (
          <div
            className="mt-0.5 text-slate-600 truncate flex-shrink-0"
            style={{
              fontSize: isUserMarketplaceStatsCarousel ? "10px" : "12px",
              lineHeight: isUserMarketplaceStatsCarousel ? "12px" : "16px",
            }}
          >
            Game Date: {gameDate}
          </div>
        ) : null}
        {setName ? (
          <div
            className="mt-[2px] mb-[6px] font-normal text-slate-700 text-center truncate flex-shrink-0"
            title={setName}
            style={{
              fontSize: isUserMarketplaceStatsCarousel ? "10px" : "12px",
              lineHeight: isUserMarketplaceStatsCarousel ? "12px" : "18px",
            }}
          >
            {setName}
          </div>
        ) : null}
        {isSettlementNeeded && (
          <div
            className="absolute inset-0 bg-black/45 text-[#FF6300] flex flex-col items-center justify-center font-medium"
            style={{ overflow: "hidden", padding: "4px" }}
          >
            <div className="text-[12px] leading-[16px] font-medium flex-shrink-0">
              Settle Auction
            </div>
            {maxBid ? (
              <div
                className="font-medium text-center"
                style={{
                  fontSize: "14px",
                  lineHeight: "18px",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: "0",
                }}
              >
                ${(Number(BigInt(maxBid)) / 1e18).toFixed(2)}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CollectionSerialCard);
