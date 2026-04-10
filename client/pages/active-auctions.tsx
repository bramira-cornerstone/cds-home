import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { AuctionCard } from "@/components/market/AuctionCard";
import { fetchMintedByEditionId } from "@/lib/supabaseMinted";
import { isAuctionExpired } from "@/lib/activeAuctionsFromEvents";

const FILTER_BUTTON_CLASS = `relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`;

const ACTION_BUTTON_CLASS = `relative overflow-hidden flex flex-col items-center justify-center gap-1 p-[2px] sm:p-2 w-16 h-[60px] sm:h-20 leading-[18px] sm:leading-normal rounded border border-slate-300 bg-white text-slate-800 dark:bg-slate-700 dark:text-white dark:border-white/10 before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`;

export default function ActiveAuctionsPage() {
  const navigate = useNavigate();
  const { auctions, loading, error } = useActiveAuctions();
  const [activeFilter, setActiveFilter] = useState<
    "none" | "player" | "team" | "tier" | "set" | "sort"
  >("none");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string>("Ending Soon");
  const [auctionMetadata, setAuctionMetadata] = useState<
    Record<
      string,
      {
        playerName?: string;
        team?: string;
        tierValue?: string;
        setName?: string;
      }
    >
  >({});

  // Show all auctions except cancelled ones
  const baseActiveAuctions = useMemo(() => {
    return auctions.filter((auction) => auction.status !== "cancelled");
  }, [auctions]);

  // Fetch metadata for all auctions
  useEffect(() => {
    const fetchMetadata = async () => {
      const metadata: typeof auctionMetadata = {};

      for (const auction of baseActiveAuctions) {
        if (auction.editionId && !metadata[auction.editionId]) {
          try {
            const editionData = await fetchMintedByEditionId(auction.editionId);
            if (editionData) {
              metadata[auction.editionId] = {
                playerName: editionData.PlayerName,
                team: (editionData as any).team,
                tierValue: editionData.TierValue,
                setName: (editionData as any).SetName,
              };
            }
          } catch (err) {
            console.error(
              `Failed to fetch metadata for edition ${auction.editionId}:`,
              err,
            );
          }
        }
      }

      setAuctionMetadata(metadata);
    };

    if (baseActiveAuctions.length > 0) {
      fetchMetadata();
    }
  }, [baseActiveAuctions]);

  // Extract available filter options from auctions data and metadata
  const filterOptions = useMemo(() => {
    const players = new Set<string>();
    const teams = new Set<string>();
    const tiers = new Set<string>();
    const sets = new Set<string>();

    for (const auction of baseActiveAuctions) {
      const meta = auctionMetadata[auction.editionId || ""];
      if (meta?.playerName) players.add(meta.playerName);
      if (meta?.team) teams.add(meta.team);
      if (meta?.tierValue) tiers.add(String(meta.tierValue));
      if (meta?.setName) sets.add(meta.setName);
    }

    return {
      players: Array.from(players).sort(),
      teams: Array.from(teams).sort(),
      tiers: Array.from(tiers).sort(),
      sets: Array.from(sets).sort(),
    };
  }, [baseActiveAuctions, auctionMetadata]);

  // Apply filters and sorting
  const activeAuctions = useMemo(() => {
    let filtered = baseActiveAuctions;

    if (selectedPlayer) {
      filtered = filtered.filter((a) => {
        const meta = auctionMetadata[a.editionId || ""];
        return meta?.playerName === selectedPlayer;
      });
    }
    if (selectedTeam) {
      filtered = filtered.filter((a) => {
        const meta = auctionMetadata[a.editionId || ""];
        return meta?.team === selectedTeam;
      });
    }
    if (selectedTier) {
      filtered = filtered.filter((a) => {
        const meta = auctionMetadata[a.editionId || ""];
        return String(meta?.tierValue) === selectedTier;
      });
    }
    if (selectedSet) {
      filtered = filtered.filter((a) => {
        const meta = auctionMetadata[a.editionId || ""];
        return meta?.setName === selectedSet;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      if (selectedSort === "Ending Soon") {
        // Active auctions first (sorted by nearest end time), then ended auctions (most recent first)
        const aExpired = isAuctionExpired(a);
        const bExpired = isAuctionExpired(b);

        if (aExpired && !bExpired) return 1; // b is active, comes first
        if (!aExpired && bExpired) return -1; // a is active, comes first

        // Both active or both ended
        if (aExpired && bExpired) {
          // Both ended: most recent first (higher timestamp first)
          return (b.endTimestamp || 0) - (a.endTimestamp || 0);
        } else {
          // Both active: nearest end time first (lower timestamp first)
          return (a.endTimestamp || 0) - (b.endTimestamp || 0);
        }
      } else if (selectedSort === "Ending Latest") {
        return (b.endTimestamp || 0) - (a.endTimestamp || 0);
      } else if (selectedSort === "Recent Listings") {
        return (b.startTimestamp || 0) - (a.startTimestamp || 0);
      } else if (selectedSort === "Oldest Listings") {
        return (a.startTimestamp || 0) - (b.startTimestamp || 0);
      }
      return 0;
    });

    return sorted;
  }, [
    baseActiveAuctions,
    selectedPlayer,
    selectedTeam,
    selectedTier,
    selectedSet,
    selectedSort,
    auctionMetadata,
  ]);

  const clearAllFilters = () => {
    setSelectedPlayer(null);
    setSelectedTeam(null);
    setSelectedTier(null);
    setSelectedSet(null);
    setSelectedSort("Ending Soon");
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 py-1 px-3">
      <div className="w-full flex flex-col">
        <div className="w-full mb-4">
          <img
            src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F63ac72551044449083248a0a00b40ce1"
            alt="Marketplace banner"
            className="w-full h-auto object-cover rounded-md"
          />
        </div>
        <div className="w-full flex items-center justify-between mb-4">
          <div className="text-slate-800 text-[28px] font-semibold tracking-wide leading-7 text-left dark:text-white">
            <p>Relic Auctions</p>
          </div>
          <button
            onClick={() => navigate("/market")}
            className={ACTION_BUTTON_CLASS}
          >
            <svg
              width="16"
              height="24"
              viewBox="0 0 16 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "relative", zIndex: 1 }}
            >
              <rect x="2" y="2" width="12" height="20" rx="1" />
              <rect x="4" y="4.8" width="8" height="7.2" fill="black" />
            </svg>
            <span
              className="text-xs font-medium text-center"
              style={{ position: "relative", zIndex: 1 }}
            >
              All Relics
            </span>
          </button>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {!loading && (
          <>
            <div className="text-xs text-slate-600 text-left m-0 p-0 mb-2">
              Filter and sort options
            </div>
            <div className="mb-1.5 relative flex flex-nowrap items-stretch gap-0.5 w-full">
              <button
                type="button"
                className={`${FILTER_BUTTON_CLASS} ${activeFilter === "player" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                onClick={() =>
                  setActiveFilter((p) => (p === "player" ? "none" : "player"))
                }
              >
                <span className="relative z-[1]">
                  Player
                  {selectedPlayer ? (
                    <span
                      aria-hidden="true"
                      className="ml-1 text-black text-xs align-middle"
                    >
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                className={`${FILTER_BUTTON_CLASS} ${activeFilter === "team" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                onClick={() =>
                  setActiveFilter((p) => (p === "team" ? "none" : "team"))
                }
              >
                <span className="relative z-[1]">
                  Team
                  {selectedTeam ? (
                    <span
                      aria-hidden="true"
                      className="ml-1 text-black text-xs align-middle"
                    >
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                className={`${FILTER_BUTTON_CLASS} ${activeFilter === "tier" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                onClick={() =>
                  setActiveFilter((p) => (p === "tier" ? "none" : "tier"))
                }
              >
                <span className="relative z-[1]">
                  Tier
                  {selectedTier ? (
                    <span
                      aria-hidden="true"
                      className="ml-1 text-black text-xs align-middle"
                    >
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                className={`${FILTER_BUTTON_CLASS} ${activeFilter === "set" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                onClick={() =>
                  setActiveFilter((p) => (p === "set" ? "none" : "set"))
                }
              >
                <span className="relative z-[1]">
                  Set
                  {selectedSet ? (
                    <span
                      aria-hidden="true"
                      className="ml-1 text-black text-xs align-middle"
                    >
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                className={`${FILTER_BUTTON_CLASS} ${activeFilter === "sort" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                onClick={() =>
                  setActiveFilter((p) => (p === "sort" ? "none" : "sort"))
                }
              >
                <span className="relative z-[1]">
                  Sort
                  {selectedSort && selectedSort !== "Ending Soon" ? (
                    <span
                      aria-hidden="true"
                      className="ml-1 text-black text-xs align-middle"
                    >
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                className="relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)] before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]"
                onClick={() => {
                  clearAllFilters();
                  setActiveFilter("none");
                }}
              >
                <span className="relative z-[1]">Clear</span>
              </button>
            </div>

            {/* Filter Panels */}
            <div
              className={`relative z-10 overflow-hidden transition-all duration-300 ${activeFilter === "player" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
                <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filterOptions.players.map((player) => (
                    <button
                      key={player}
                      type="button"
                      className={`px-2 py-1.5 text-sm rounded border text-left ${selectedPlayer === player ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                      onClick={() => {
                        setSelectedPlayer(player);
                        setActiveFilter("none");
                      }}
                    >
                      {player}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`relative z-10 overflow-hidden transition-all duration-300 ${activeFilter === "team" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
                <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filterOptions.teams.map((team) => (
                    <button
                      key={team}
                      type="button"
                      className={`px-2 py-1.5 text-sm rounded border text-left ${selectedTeam === team ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                      onClick={() => {
                        setSelectedTeam(team);
                        setActiveFilter("none");
                      }}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`relative z-10 overflow-hidden transition-all duration-300 ${activeFilter === "tier" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
                <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filterOptions.tiers.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`px-2 py-1.5 text-sm rounded border text-left ${selectedTier === tier ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                      onClick={() => {
                        setSelectedTier(tier);
                        setActiveFilter("none");
                      }}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`relative z-10 overflow-hidden transition-all duration-300 ${activeFilter === "set" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
                <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filterOptions.sets.map((set) => (
                    <button
                      key={set}
                      type="button"
                      className={`px-2 py-1.5 text-sm rounded border text-left ${selectedSet === set ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                      onClick={() => {
                        setSelectedSet(set);
                        setActiveFilter("none");
                      }}
                    >
                      {set}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`relative z-10 overflow-hidden transition-all duration-300 ${activeFilter === "sort" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
                <div className="max-h-40 overflow-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    "Ending Soon",
                    "Ending Latest",
                    "Recent Listings",
                    "Oldest Listings",
                  ].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`px-2 py-1.5 text-sm rounded border text-left ${selectedSort === opt ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                      onClick={() => {
                        setSelectedSort(opt);
                        setActiveFilter("none");
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400">
              Loading auctions...
            </p>
          </div>
        ) : activeAuctions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400">
              No active auctions at this time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mt-3">
            {activeAuctions.map((auction) => (
              <div key={auction.auctionId}>
                <AuctionCard
                  auction={auction}
                  editionIdProp={auction.editionId || undefined}
                  serialProp={auction.serial || undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
