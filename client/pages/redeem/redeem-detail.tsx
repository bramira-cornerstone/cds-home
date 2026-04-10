import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  FontLoader,
  type Font,
} from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { fetchMintedByEditionId, MintedRow } from "@/lib/supabaseMinted";
import EditionSplineScene, {
  EDITION_FONT_URL,
} from "@/components/EditionSplineScene";
import { RedemptionsCard } from "@/components/RedemptionsCard";
import { getTeamCrest } from "@/lib/teams";
import { DarkModeHover } from "@/components/ui/dark_mode_hover";
import { getBadgeLabel } from "@/lib/badgeLabels";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { countInPackTokensByEditionId } from "@/lib/supabaseRelicSerialsJoined";
import { countStakedTokensByEditionId } from "@/lib/public_staking";
import { countRedeemedTokensByEditionId } from "@/lib/supabaseRedemptionEvents";

export default function RedeemDetailPage() {
  const params = useParams<{ redeemId?: string }>();

  const editionId = useMemo(() => {
    const raw = params.redeemId || "";
    // Extract the edition ID from "Redeem{id}" format
    const match = raw.match(/^Redeem(\d+)$/);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
  }, [params.redeemId]);

  const [row, setRow] = useState<MintedRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [font, setFont] = useState<Font | null>(null);
  const { listings: activeListings } = useActiveListings();
  const { auctions: activeAuctions } = useActiveAuctions();
  const [stakedCount, setStakedCount] = useState<number>(0);
  const [inPacksCount, setInPacksCount] = useState<number>(0);
  const [redeemedCount, setRedeemedCount] = useState<number>(0);

  useEffect(() => {
    if (!editionId) {
      setLoaded(true);
      setRow(null);
      return;
    }
    let cancelled = false;
    fetchMintedByEditionId(editionId, undefined)
      .then((r) => {
        if (!cancelled) setRow(r);
      })
      .catch(() => {
        if (!cancelled) setRow(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  useEffect(() => {
    let cancelled = false;
    const loader = new FontLoader();
    loader
      .loadAsync(EDITION_FONT_URL)
      .then((loadedFont) => {
        if (!cancelled) {
          setFont(loadedFont);
        }
      })
      .catch(() => {
        // Silently ignore font load issues
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate active listings count for this edition
  const activeListingsCount = useMemo(() => {
    if (!editionId) return 0;

    const serialsSet = new Set<number>();

    // Add serials from active listings
    if (activeListings) {
      for (const listing of activeListings) {
        if (
          listing.editionId === editionId &&
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
          auction.editionId === editionId &&
          auction.serial !== null &&
          auction.status === "active"
        ) {
          serialsSet.add(auction.serial);
        }
      }
    }

    return serialsSet.size;
  }, [editionId, activeListings, activeAuctions]);

  // Fetch staked count for the edition (asynchronous)
  useEffect(() => {
    if (!editionId) {
      setStakedCount(0);
      return;
    }
    let cancelled = false;
    countStakedTokensByEditionId(editionId, undefined)
      .then((count) => {
        if (!cancelled) setStakedCount(count);
      })
      .catch(() => {
        if (!cancelled) setStakedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  // Fetch in-packs count for the edition (asynchronous)
  useEffect(() => {
    if (!editionId) {
      setInPacksCount(0);
      return;
    }
    let cancelled = false;
    countInPackTokensByEditionId(editionId, undefined)
      .then((count) => {
        if (!cancelled) setInPacksCount(count);
      })
      .catch(() => {
        if (!cancelled) setInPacksCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  // Fetch redeemed count for the edition (asynchronous)
  useEffect(() => {
    if (!editionId) {
      setRedeemedCount(0);
      return;
    }
    let cancelled = false;
    countRedeemedTokensByEditionId(editionId, undefined, undefined)
      .then((count) => {
        if (!cancelled) setRedeemedCount(count);
      })
      .catch(() => {
        if (!cancelled) setRedeemedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  return (
    <section
      className="container mx-auto px-0 md:px-4 pb-4 pt-0 nightmode_nocards"
      style={{ paddingTop: "0px" }}
    >
      <div className="w-full">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column: RedemptionsCard (order-1 on mobile, order-1 on desktop) */}
          <div className="w-full lg:w-1/2 order-1">
            {loaded && row && (
              <div className="md:px-0">
                <RedemptionsCard
                  team={row?.team ?? null}
                  editionId={editionId}
                  minted={row?.Minted ?? null}
                />
              </div>
            )}
          </div>

          {/* Right column: EditionSplineScene on top, details below (order-2 on mobile, order-2 on desktop) */}
          <div className="w-full lg:w-1/2 order-2 flex flex-col gap-6">
            {/* EditionSplineScene */}
            <div className="w-full flex flex-col">
              {loaded ? (
                row ? (
                  <EditionSplineScene
                    key={`${row.edition_id ?? editionId ?? undefined}-edition`}
                    overlayUrl={
                      row?.video_location
                        ? `https://stream.mux.com/${row.video_location}.m3u8`
                        : undefined
                    }
                    className="w-full h-[calc(80dvh+20px)] flex items-center justify-center"
                    font={font}
                    fontUrl={EDITION_FONT_URL}
                    textGeometryClass={TextGeometry}
                    playerName={row?.PlayerName ?? null}
                    productName={row?.ProductName ?? null}
                    minted={row?.Minted ?? null}
                    seriesName={row?.SeriesName ?? null}
                    tierValue={row?.TierValue ?? null}
                    playDescription={row?.PlayDescription ?? null}
                    setName={row?.SetName ?? null}
                    finalScore={row?.FinalScore ?? null}
                    gameDate={row?.GameDate ?? null}
                    statValue1={row?.PlayerStatValue1 ?? null}
                    statValue2={row?.PlayerStatValue2 ?? null}
                    statValue3={row?.PlayerStatValue3 ?? null}
                    statValue4={row?.PlayerStatValue4 ?? null}
                    statValue5={row?.PlayerStatValue5 ?? null}
                    statName1={row?.PlayerStat1 ?? null}
                    statName2={row?.PlayerStat2 ?? null}
                    statName3={row?.PlayerStat3 ?? null}
                    statName4={row?.PlayerStat4 ?? null}
                    statName5={row?.PlayerStat5 ?? null}
                    badge1={row?.Badge1 ?? null}
                    badge2={row?.Badge2 ?? null}
                    badge3={row?.Badge3 ?? null}
                    team={row?.team ?? null}
                    serialNumber={null}
                    owner_name={null}
                    onRefetchMissingData={() => {}}
                    activeListingsCount={activeListingsCount}
                    stakedCount={stakedCount}
                    inPacksCount={inPacksCount}
                    redeemedCount={redeemedCount}
                  />
                ) : (
                  <div className="w-full h-[calc(80dvh+20px)] flex items-center justify-center text-slate-600">
                    No data.
                  </div>
                )
              ) : (
                <div className="w-full h-[calc(80dvh+20px)] flex items-center justify-center text-slate-600">
                  Loading...
                </div>
              )}
            </div>

            {/* Details section */}
            <div className="w-full">
              {loaded ? (
                row ? (
                  <div className="text-sm text-slate-800 space-y-1 dark:text-white">
                    {(() => {
                      const FIELDS_BEFORE = ["PlayerName", "team"] as const;
                      const FIELDS_AFTER = [
                        "GameDate",
                        "PlayDescription",
                        "FinalScore",
                        "SeriesName",
                        "Minted",
                        "TierValue",
                        "SetName",
                        "CreateDate",
                      ] as const;

                      const elements: JSX.Element[] = [];

                      for (const k of FIELDS_BEFORE) {
                        const v = (row as any)?.[k as any];
                        const label =
                          k === "PlayerName"
                            ? "Player"
                            : k === "team"
                              ? "Team"
                              : String(k);
                        elements.push(
                          <p key={String(k)} className="leading-relaxed">
                            <span className="font-medium">{label}</span>:{" "}
                            {v === null || v === undefined
                              ? "—"
                              : typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v)}
                          </p>,
                        );
                      }

                      for (const k of FIELDS_AFTER) {
                        const v = (row as any)?.[k as any];
                        if (k === "PlayDescription") {
                          elements.push(
                            <p key={String(k)} className="leading-relaxed">
                              {v === null || v === undefined
                                ? "—"
                                : typeof v === "object"
                                  ? JSON.stringify(v)
                                  : String(v)}
                            </p>,
                          );
                          continue;
                        }
                        if (k === "SeriesName") {
                          const seriesVal = v;
                          const tierVal = (row as any)?.["TierValue"];
                          const combined =
                            (seriesVal == null ? "" : String(seriesVal)) +
                            (tierVal == null
                              ? ""
                              : (seriesVal ? " - " : "") + String(tierVal));
                          elements.push(
                            <p key={String(k)} className="leading-relaxed">
                              {combined || "—"}
                            </p>,
                          );
                          continue;
                        }
                        if (k === "CreateDate") {
                          const raw = v;
                          let formatted = "—";
                          try {
                            if (raw != null) {
                              const s = String(raw).replace(" ", "T");
                              const m = s.match(
                                /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/,
                              );
                              if (m) {
                                const msUTCGuess = Date.parse(
                                  `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`,
                                );
                                const getTzOffset = (
                                  date: Date,
                                  timeZone: string,
                                ) => {
                                  const dtf = new Intl.DateTimeFormat("en-US", {
                                    timeZone,
                                    hour12: false,
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  });
                                  const parts = dtf.formatToParts(date);
                                  const map: any = {};
                                  for (const { type, value } of parts)
                                    (map as any)[type] = value as string;
                                  const tzAsUTC = Date.parse(
                                    `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`,
                                  );
                                  return tzAsUTC - date.getTime();
                                };
                                const offset = getTzOffset(
                                  new Date(msUTCGuess),
                                  "America/New_York",
                                );
                                const utcMs = msUTCGuess - offset;
                                const dLocal = new Date(utcMs);
                                const pad = (n: number) =>
                                  String(n).padStart(2, "0");
                                formatted = `${dLocal.getFullYear()}-${pad(dLocal.getMonth() + 1)}-${pad(dLocal.getDate())} ${pad(dLocal.getHours())}:${pad(dLocal.getMinutes())}:${pad(dLocal.getSeconds())}`;
                              } else {
                                const d = new Date(raw);
                                const pad = (n: number) =>
                                  String(n).padStart(2, "0");
                                formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                              }
                            }
                          } catch {}
                          elements.push(
                            <p key={String(k)} className="leading-relaxed">
                              <span className="font-medium">
                                {"Relic created on"}
                              </span>
                              : {formatted}
                            </p>,
                          );
                          continue;
                        }
                        const label =
                          k === "GameDate"
                            ? "Game Date"
                            : k === "FinalScore"
                              ? "Final Score"
                              : k === "SetName"
                                ? "Set Name"
                                : String(k);
                        elements.push(
                          <p key={String(k)} className="leading-relaxed">
                            <span className="font-medium">{label}</span>:{" "}
                            {v === null || v === undefined
                              ? "—"
                              : typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v)}
                          </p>,
                        );
                      }

                      return elements;
                    })()}

                    {(() => {
                      const names = [
                        row?.PlayerStat1 ?? null,
                        row?.PlayerStat2 ?? null,
                        row?.PlayerStat3 ?? null,
                        row?.PlayerStat4 ?? null,
                        row?.PlayerStat5 ?? null,
                      ];
                      const values = [
                        row?.PlayerStatValue1 ?? null,
                        row?.PlayerStatValue2 ?? null,
                        row?.PlayerStatValue3 ?? null,
                        row?.PlayerStatValue4 ?? null,
                        row?.PlayerStatValue5 ?? null,
                      ];
                      const hasAny =
                        names.some((n) => n != null) ||
                        values.some((v) => v != null);
                      if (!hasAny) return null;
                      return (
                        <div className="mt-3 rounded-md border border-slate-200 overflow-hidden dark:bg-slate-700 dark:border-white/10 dark:text-white">
                          <div className="grid grid-cols-5 bg-slate-50 dark:bg-slate-700">
                            {names.map((n, i) => (
                              <div
                                key={`h-${i}`}
                                className="px-2 py-1 text-center text-[12px] font-medium text-slate-700 truncate dark:text-white"
                              >
                                {n ?? "—"}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-5">
                            {values.map((v, i) => (
                              <div
                                key={`v-${i}`}
                                className="px-2 py-2 text-center text-[13px] text-slate-800 dark:text-white"
                              >
                                {v === null || v === undefined
                                  ? "—"
                                  : String(v)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const b1 = String(
                        (row as any)?.Badge1 ?? "",
                      ).toUpperCase();
                      const badgeSrc =
                        b1 === "CP"
                          ? "/images/cp-badge.webp"
                          : b1 === "RY"
                            ? "/images/ry-badge.webp"
                            : b1 === "CY"
                              ? "/images/cy-badge.webp"
                              : null;
                      const b2 = String(
                        (row as any)?.Badge2 ?? "",
                      ).toUpperCase();
                      const badgeSrc2 =
                        b2 === "CP"
                          ? "/images/cp-badge.webp"
                          : b2 === "RY"
                            ? "/images/ry-badge.webp"
                            : b2 === "CY"
                              ? "/images/cy-badge.webp"
                              : null;
                      const b3 = String(
                        (row as any)?.Badge3 ?? "",
                      ).toUpperCase();
                      const badgeSrc3 =
                        b3 === "CP"
                          ? "/images/cp-badge.webp"
                          : b3 === "RY"
                            ? "/images/ry-badge.webp"
                            : b3 === "CY"
                              ? "/images/cy-badge.webp"
                              : null;
                      const teamName = (row as any)?.team;
                      const teamCrestSrc = teamName
                        ? getTeamCrest(teamName)
                        : null;

                      return (
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          <div
                            className="h-[80px] md:h-[80px] rounded-[4px] flex items-center justify-center relative group"
                            title={teamName || undefined}
                          >
                            {teamCrestSrc ? (
                              <>
                                <img
                                  src={teamCrestSrc}
                                  alt={teamName || "Team crest"}
                                  className="max-h-[80%] object-contain"
                                />
                                {teamName && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity z-10 dark:bg-slate-700">
                                    {teamName}
                                  </div>
                                )}
                              </>
                            ) : null}
                          </div>
                          <DarkModeHover
                            tooltip={getBadgeLabel(badgeSrc)}
                            className={`h-[80px] md:h-[80px] rounded-[4px] flex items-center justify-center ${badgeSrc ? "dark:bg-slate-700" : ""}`}
                          >
                            {badgeSrc ? (
                              <img
                                src={badgeSrc}
                                alt=""
                                className="max-h-[80%] object-contain"
                              />
                            ) : null}
                          </DarkModeHover>
                          <DarkModeHover
                            tooltip={getBadgeLabel(badgeSrc2)}
                            className={`h-[80px] md:h-[80px] rounded-[4px] flex items-center justify-center ${badgeSrc2 ? "dark:bg-slate-700" : ""}`}
                          >
                            {badgeSrc2 ? (
                              <img
                                src={badgeSrc2}
                                alt=""
                                className="max-h-[80%] object-contain"
                              />
                            ) : null}
                          </DarkModeHover>
                          <DarkModeHover
                            tooltip={getBadgeLabel(badgeSrc3)}
                            className={`h-[80px] md:h-[80px] rounded-[4px] flex items-center justify-center ${badgeSrc3 ? "dark:bg-slate-700" : ""}`}
                          >
                            {badgeSrc3 ? (
                              <img
                                src={badgeSrc3}
                                alt=""
                                className="max-h-[80%] object-contain"
                              />
                            ) : null}
                          </DarkModeHover>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-slate-600">No data.</div>
                )
              ) : (
                <div className="text-slate-600">Loading…</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
