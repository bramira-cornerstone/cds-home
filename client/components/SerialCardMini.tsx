import React, { memo } from "react";
import { DarkModeHover } from "@/components/ui/dark_mode_hover";
import { getBadgeLabel } from "@/lib/badgeLabels";
import { getTeamCrest } from "@/lib/teams";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export type SerialCardMiniProps = {
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
};

function SerialCardMini(props: SerialCardMiniProps) {
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
  } = props;

  // Only render the card when all critical data is available
  const isDataReady = !!(name && thumb && setName);

  if (!isDataReady) {
    return (
      <div
        className="h-full w-full card-shadow-responsive flex flex-col"
        style={{
          paddingBottom: "2px",
          margin: "0 auto",
        }}
      >
        <div className="relative flex-1 w-full rounded-[1px] border border-slate-200 bg-white nightmode-exempt overflow-hidden flex flex-col m-auto card-shadow">
          <LoadingSpinner />
        </div>
      </div>
    );
  }
  return (
    <div
      className="h-full w-full card-shadow-responsive flex flex-col"
      style={{
        paddingBottom: "2px",
        margin: "0 auto",
      }}
    >
      <div className="relative flex-1 w-full rounded-[1px] border border-slate-200 bg-white nightmode-exempt overflow-hidden flex flex-col m-auto card-shadow">
        {name ? (
          <h3
            className="text-center text-[11px] font-normal text-slate-800 truncate flex-shrink-0"
            title={name}
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
        <div className="flex items-center justify-start gap-2 flex-shrink-0 w-full">
          <div className="flex items-center flex-shrink-0">
            {team ? (
              <img
                src={getTeamCrest(team) || "/images/teams/wfl_crest.png"}
                alt={team}
                className="h-[20px] w-[20px] object-contain flex-shrink-0"
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
        <div className="text-[10px] text-slate-700 truncate flex-shrink-0">
          {serial != null ? (
            <>
              #{serial}
              {minted ? ` of ${minted}` : ""}
            </>
          ) : (
            `edition_id: ${id}`
          )}
        </div>
        {gameDate ? (
          <div className="mt-0.5 text-[9px] text-slate-600 truncate flex-shrink-0 leading-[12px]">
            Game Date: {gameDate}
          </div>
        ) : null}
        {setName ? (
          <div
            className="mt-[2px] mb-[6px] text-[10px] font-normal text-slate-700 text-center truncate flex-shrink-0"
            title={setName}
          >
            {setName}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(SerialCardMini);
