import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";

import EditionHoverPreview from "@/components/EditionHoverPreview";
import { FitText } from "@/components/ui/fit-text";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import {
  fetchMintedEditionIds,
  fetchMintedEditionIdsPaginated,
  fetchMintedByEditionId,
} from "@/lib/supabaseMinted";
import { fetchRollingMedianSaleByEditionId } from "@/lib/supabaseRelicSerialsJoined";
import {
  fetchPriorDropNFTs,
  buildPriorDropAttributeMap,
  getTokenIdString,
  resolveMediaUrl,
  type PriorDropNFT,
} from "@/lib/priorDrops";
import { formatOfferPrice } from "@/lib/activeOffers";
import {
  fetchRecentListingsByEdition,
  parseSupabaseTimestamp,
  fetchEditionsWithPriorSales,
} from "@/lib/marketplaceEvents";
import { getTeamCrest } from "@/lib/teams";
import { getFavoriteTeam } from "@/lib/favoriteTeamService";
import { Gavel } from "lucide-react";

const ACTION_BUTTON_CLASS = `relative overflow-hidden flex flex-col items-center justify-center gap-1 p-[2px] sm:p-2 w-16 h-[60px] sm:h-20 leading-[18px] sm:leading-normal rounded border border-slate-300 bg-white text-slate-800 dark:bg-slate-700 dark:text-white dark:border-white/10 before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`;

export default function EditionsPage() {
  const account = useActiveAccount();
  const betaAllowlist = useBetaAllowlist();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ids, setIds] = useState<number[] | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    "none" | "player" | "team" | "tier" | "set" | "sort"
  >("none");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>(null);
  type MediaRecord = {
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
    lowAsk: string | null;
    highOffer: string | null;
    highOfferPrice: number | null;
    rollingMedianSale: string | null;
  };

  const [media, setMedia] = useState<Record<number, MediaRecord>>({});
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [pageOffset, setPageOffset] = useState<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [marketplaceType, setMarketplaceType] = useState<"relics" | "boxes">(
    "relics",
  );
  const [priorDrops, setPriorDrops] = useState<PriorDropNFT[] | null>(null);
  const { listings: activeListings, loading: listingsLoading } =
    useActiveListings();
  const { auctions: activeAuctions, loading: auctionsLoading } =
    useActiveAuctions();
  const { offers: allOffers, isLoading: offersLoading } = useActiveOffers();
  const [editionLowAsks, setEditionLowAsks] = useState<Record<number, string>>(
    {},
  );
  const [recentListingsByEdition, setRecentListingsByEdition] = useState<
    Record<number, string>
  >({});
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [defaultSortedIds, setDefaultSortedIds] = useState<number[] | null>(null);
  const [isComputingDefaultSort, setIsComputingDefaultSort] = useState(false);
  const hasInitialSortRef = useRef(false);

  useEffect(() => {
    if (!activeListings || activeListings.length === 0) {
      setEditionLowAsks({});
      return;
    }

    const lowAsksMap: Record<number, string> = {};
    for (const listing of activeListings) {
      if (listing.editionId != null && listing.low_ask) {
        const priceInWei = BigInt(listing.low_ask);
        const priceInTokens = Number(priceInWei) / 1e18;
        const formattedPrice = `$${priceInTokens.toFixed(2)}`;

        if (!(listing.editionId in lowAsksMap)) {
          lowAsksMap[listing.editionId] = formattedPrice;
        }
      }
    }
    setEditionLowAsks(lowAsksMap);
  }, [activeListings]);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    fetchRecentListingsByEdition(ctrl.signal)
      .then((data) => {
        if (!cancelled) {
          setRecentListingsByEdition(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecentListingsByEdition({});
        }
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  // Fetch favorite team for current user
  useEffect(() => {
    if (!account?.address) {
      setFavoriteTeam(null);
      return;
    }

    const fetchTeam = async () => {
      try {
        const team = await getFavoriteTeam(account.address);
        setFavoriteTeam(team);
        if (team) {
          console.log("[market] User favorite team:", team);
        }
      } catch (err) {
        console.debug("[market] Error fetching favorite team:", err);
        setFavoriteTeam(null);
      }
    };

    fetchTeam();
  }, [account?.address]);

  // Load first page of IDs
  useEffect(() => {
    const ctrl = new AbortController();
    const loadFirstPage = async () => {
      try {
        const pageIds = await fetchMintedEditionIdsPaginated(0, 48, ctrl.signal);
        setIds(pageIds);
        setHasMore(pageIds.length === 48);
        setPageOffset(48);
      } catch {
        setIds([]);
      }
    };
    loadFirstPage();
    return () => ctrl.abort();
  }, []);

  // Load more IDs when sentinel is intersected
  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          setIsLoadingMore(true);
          try {
            const pageIds = await fetchMintedEditionIdsPaginated(
              pageOffset,
              48
            );
            if (pageIds.length === 0) {
              setHasMore(false);
            } else {
              setIds((prevIds) => {
                const combined = [...(prevIds ?? []), ...pageIds];
                return Array.from(new Set(combined)); // Remove duplicates
              });
              setPageOffset((prev) => prev + 48);
              setHasMore(pageIds.length === 48);
            }
          } catch (err) {
            console.error("Error loading more IDs:", err);
            setHasMore(false);
          } finally {
            setIsLoadingMore(false);
          }
        }
      },
      { rootMargin: "200px" }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [isLoadingMore, hasMore, pageOffset]);

  useEffect(() => {
    if (!ids || !ids.length) return;
    let cancelled = false;
    const ctrl = new AbortController();
    Promise.allSettled(
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
            (row as any)?.SetName != null ? String((row as any).SetName) : null;
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
          return [
            id,
            {
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
            },
          ] as const;
        } catch (e: any) {
          if (e?.name === "AbortError") return null;
          throw e;
        }
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const rec: Record<
          number,
          {
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
        > = {};
        for (const r of results) {
          if (r.status === "fulfilled" && r.value && Array.isArray(r.value)) {
            const [id, obj] = r.value as readonly [number, any];
            rec[id] = {
              ...obj,
              lowAsk: null,
              rollingMedianSale: null,
              highOffer: null,
            } as any;
          }
        }
        setMedia(rec);
      })
      .catch(() => {
        if (cancelled) return;
        setMedia({});
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [ids]);

  useEffect(() => {
    if (!ids || ids.length === 0) return;
    let cancelled = false;

    // Fetch rolling median sale for all editions using direct RMV query
    const fetchMetrics = async () => {
      const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
      const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;
      if (!baseUrl || !anonKey) {
        console.debug("[market] Missing Supabase configuration for RMS fetch");
        return;
      }

      if (!ids || ids.length === 0) {
        return;
      }

      const root = baseUrl.replace(/\/$/, "");

      // Batch fetch: try to get all metrics at once instead of individual queries
      try {
        const idList = ids.slice(0, 100).map(String).join(","); // Limit to first 100
        const url = `${root}/rest/v1/RMV?edition_id=in.(${encodeURIComponent(idList)})&select=edition_id,rolling_median_sale`;
        console.debug("[market] Fetching RMS for editions");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(url, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Accept: "application/json",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!cancelled && response.ok) {
            const rows = await response.json();
            if (Array.isArray(rows)) {
              const mediaUpdates: Record<number, any> = {};
              for (const row of rows) {
                const id = row.edition_id;
                if (id && row.rolling_median_sale) {
                  try {
                    const bigValue = BigInt(String(row.rolling_median_sale).trim());
                    const wholePart = bigValue / BigInt(1e18);
                    const remainder = bigValue % BigInt(1e18);
                    const decimal = Number(wholePart) + Number(remainder) / 1e18;
                    const formatted = `$${decimal.toFixed(2)}`;
                    mediaUpdates[id] = { rollingMedianSale: formatted };
                  } catch (e) {
                    console.debug("[market] RMS conversion error for edition", id);
                  }
                }
              }

              if (!cancelled && Object.keys(mediaUpdates).length > 0) {
                setMedia((prevMedia) => {
                  const newMedia = { ...prevMedia };
                  for (const [id, updates] of Object.entries(mediaUpdates)) {
                    const numId = Number(id);
                    newMedia[numId] = {
                      ...(newMedia[numId] as any),
                      ...updates,
                    };
                  }
                  return newMedia;
                });
              }
            }
          } else if (!response.ok) {
            console.debug("[market] RMS fetch returned status:", response.status);
          }
        } catch (e: any) {
          if (e?.name === "AbortError") {
            console.debug("[market] RMS fetch timeout");
          } else {
            console.debug("[market] RMS fetch error:", e?.message || e);
          }
          // Silently fail - the value will just be null
        }
      } catch (e) {
        console.debug("[market] RMS batch fetch setup error:", e);
      }
    };

    fetchMetrics();

    return () => {
      cancelled = true;
    };
  }, [ids]);

  useEffect(() => {
    if (!ids || ids.length === 0 || !allOffers || allOffers.length === 0)
      return;

    // Build a map of highest offers by edition (tracking as BigInt for comparison)
    const highOfferMap: Record<number, { price: bigint; numericPrice: number; formatted: string }> =
      {};

    for (const offer of allOffers) {
      const editionId = offer.editionId;
      if (editionId == null) continue;

      const currentPrice = BigInt(offer.totalPrice);
      const currentHighest = highOfferMap[editionId];

      if (!currentHighest || currentPrice > currentHighest.price) {
        // Convert wei to ether for numeric comparison
        const numericPrice = Number(currentPrice) / 1e18;
        highOfferMap[editionId] = {
          price: currentPrice,
          numericPrice,
          formatted: formatOfferPrice(offer.totalPrice, offer.currency),
        };
      }
    }

    // Update media with high offers
    setMedia((prevMedia) => {
      const newMedia = { ...prevMedia };
      for (const id of ids) {
        if (newMedia[id] && highOfferMap[id]) {
          newMedia[id] = {
            ...newMedia[id],
            highOffer: highOfferMap[id].formatted,
            highOfferPrice: highOfferMap[id].numericPrice,
          };
        }
      }
      return newMedia;
    });
  }, [ids, allOffers]);

  useEffect(() => {
    if (marketplaceType !== "boxes") return;
    let active = true;
    const ctrl = new AbortController();
    setPriorDrops(null);
    fetchPriorDropNFTs({ signal: ctrl.signal })
      .then((data) => {
        if (!active) return;
        setPriorDrops(data);
      })
      .catch(() => {
        if (!active) return;
        setPriorDrops([]);
      });
    return () => {
      active = false;
      ctrl.abort();
    };
  }, [marketplaceType]);

  const availablePlayers = useMemo(() => {
    if (!ids || !ids.length) return [] as string[];
    let list = ids;
    if (selectedTeam)
      list = list.filter((id) => (media[id]?.team ?? null) === selectedTeam);
    if (selectedTier)
      list = list.filter((id) => (media[id]?.tier ?? null) === selectedTier);
    if (selectedSet)
      list = list.filter((id) => (media[id]?.setName ?? null) === selectedSet);
    const names: string[] = [];
    for (const id of list) {
      const n = media[id]?.name;
      if (n && typeof n === "string") names.push(n);
    }
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [ids, media, selectedTeam, selectedTier, selectedSet]);

  useEffect(() => {
    const playerParam = searchParams.get("player");
    if (!playerParam) return;

    const normalized = playerParam.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchedPlayer = availablePlayers.find(
      (p) => p.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized,
    );

    if (matchedPlayer && matchedPlayer !== selectedPlayer) {
      setSelectedPlayer(matchedPlayer);
    }
  }, [searchParams, availablePlayers, selectedPlayer]);

  const availableTeams = useMemo(() => {
    if (!ids || !ids.length) return [] as string[];
    let list = ids;
    if (selectedPlayer)
      list = list.filter((id) => (media[id]?.name ?? null) === selectedPlayer);
    if (selectedTier)
      list = list.filter((id) => (media[id]?.tier ?? null) === selectedTier);
    if (selectedSet)
      list = list.filter((id) => (media[id]?.setName ?? null) === selectedSet);
    const names: string[] = [];
    for (const id of list) {
      const t = media[id]?.team;
      if (t && typeof t === "string") names.push(t);
    }
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [ids, media, selectedPlayer, selectedTier, selectedSet]);

  useEffect(() => {
    const teamParam = searchParams.get("team");
    if (!teamParam) return;

    const normalized = teamParam.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchedTeam = availableTeams.find(
      (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized,
    );

    if (matchedTeam && matchedTeam !== selectedTeam) {
      setSelectedTeam(matchedTeam);
    }
  }, [searchParams, availableTeams, selectedTeam]);

  const availableTiers = useMemo(() => {
    if (!ids || !ids.length) return [] as string[];
    let list = ids;
    if (selectedPlayer)
      list = list.filter((id) => (media[id]?.name ?? null) === selectedPlayer);
    if (selectedTeam)
      list = list.filter((id) => (media[id]?.team ?? null) === selectedTeam);
    if (selectedSet)
      list = list.filter((id) => (media[id]?.setName ?? null) === selectedSet);
    const vals: string[] = [];
    for (const id of list) {
      const t = media[id]?.tier;
      if (t && typeof t === "string") vals.push(t);
    }
    return Array.from(new Set(vals)).sort((a, b) => a.localeCompare(b));
  }, [ids, media, selectedPlayer, selectedTeam, selectedSet]);

  const availableSets = useMemo(() => {
    if (!ids || !ids.length) return [] as string[];
    let list = ids;
    if (selectedPlayer)
      list = list.filter((id) => (media[id]?.name ?? null) === selectedPlayer);
    if (selectedTeam)
      list = list.filter((id) => (media[id]?.team ?? null) === selectedTeam);
    if (selectedTier)
      list = list.filter((id) => (media[id]?.tier ?? null) === selectedTier);
    const vals: string[] = [];
    for (const id of list) {
      const s = media[id]?.setName;
      if (s && typeof s === "string") vals.push(s);
    }
    return Array.from(new Set(vals)).sort((a, b) => a.localeCompare(b));
  }, [ids, media, selectedPlayer, selectedTeam, selectedTier]);

  const filteredIds = useMemo(() => {
    let list = ids ?? [];
    if (selectedPlayer)
      list = list.filter((id) => (media[id]?.name ?? null) === selectedPlayer);
    if (selectedTeam)
      list = list.filter((id) => (media[id]?.team ?? null) === selectedTeam);
    if (selectedTier)
      list = list.filter((id) => (media[id]?.tier ?? null) === selectedTier);
    if (selectedSet)
      list = list.filter((id) => (media[id]?.setName ?? null) === selectedSet);
    return list;
  }, [ids, media, selectedPlayer, selectedTeam, selectedTier, selectedSet]);

  const sortedIds = useMemo(() => {
    // If using default sort, return pre-computed result
    if (selectedSort === null) {
      return defaultSortedIds ?? filteredIds;
    }

    // Use the standard sorting logic for explicit sorts
    const list = [...filteredIds];
    const opt = selectedSort!;
    const getNum = (v: any) => {
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const getEditionLowAskPrice = (id: number): number | null => {
      const priceStr = editionLowAsks[id];
      if (!priceStr) return null;
      const num = parseFloat(priceStr.replace("$", ""));
      return Number.isFinite(num) ? num : null;
    };
    const getDateMs = (s: any) => {
      if (!s) return null;
      const ms = Date.parse(String(s));
      return Number.isFinite(ms) ? ms : null;
    };
    const cmpNulls = (
      a: number | null,
      b: number | null,
      dir: "asc" | "desc",
    ) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return dir === "asc" ? a - b : b - a;
    };
    const getRecentListingTime = (id: number): number | null => {
      const timestamp = recentListingsByEdition[id];
      if (!timestamp) return null;
      const date = parseSupabaseTimestamp(timestamp);
      return date ? date.getTime() : null;
    };
    switch (opt) {
      case "Recent Listings":
        list.sort((a, b) => {
          const aTime = getRecentListingTime(a);
          const bTime = getRecentListingTime(b);
          if (aTime == null && bTime == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aTime == null) return 1;
          if (bTime == null) return -1;
          if (aTime !== bTime) return bTime - aTime;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "CreateDate (Recent to Oldest)":
        list.sort((a, b) => {
          const aCreate = getDateMs(media[a]?.createDate);
          const bCreate = getDateMs(media[b]?.createDate);
          if (aCreate == null && bCreate == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aCreate == null) return 1;
          if (bCreate == null) return -1;
          if (aCreate !== bCreate) return bCreate - aCreate;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "CreateDate (Oldest to Recent)":
        list.sort((a, b) => {
          const aCreate = getDateMs(media[a]?.createDate);
          const bCreate = getDateMs(media[b]?.createDate);
          if (aCreate == null && bCreate == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aCreate == null) return 1;
          if (bCreate == null) return -1;
          if (aCreate !== bCreate) return aCreate - bCreate;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "GameDate (Recent to Oldest)":
        list.sort((a, b) => {
          const aGame = getDateMs(media[a]?.gameDate);
          const bGame = getDateMs(media[b]?.gameDate);
          if (aGame == null && bGame == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aGame == null) return 1;
          if (bGame == null) return -1;
          if (aGame !== bGame) return bGame - aGame;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "GameDate (Oldest to Recent)":
        list.sort((a, b) => {
          const aGame = getDateMs(media[a]?.gameDate);
          const bGame = getDateMs(media[b]?.gameDate);
          if (aGame == null && bGame == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aGame == null) return 1;
          if (bGame == null) return -1;
          if (aGame !== bGame) return aGame - bGame;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "Low Ask (High to Low)":
        list.sort((a, b) => {
          const aPrice = getEditionLowAskPrice(a);
          const bPrice = getEditionLowAskPrice(b);
          if (aPrice == null && bPrice == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aPrice == null) return 1;
          if (bPrice == null) return -1;
          if (aPrice !== bPrice) return bPrice - aPrice;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "Low Ask (Low to High)":
        list.sort((a, b) => {
          const aPrice = getEditionLowAskPrice(a);
          const bPrice = getEditionLowAskPrice(b);
          if (aPrice == null && bPrice == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aPrice == null) return 1;
          if (bPrice == null) return -1;
          if (aPrice !== bPrice) return aPrice - bPrice;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "High Offer (High to Low)":
        list.sort((a, b) => {
          const aOffer = (media[a] as any)?.highOfferPrice;
          const bOffer = (media[b] as any)?.highOfferPrice;

          // Primary sort: by offer amount (high to low)
          if (aOffer == null && bOffer == null) {
            // Both have no offer: tie-break by createDate (recent first)
            return cmpNulls(
              getDateMs(media[a]?.createDate),
              getDateMs(media[b]?.createDate),
              "desc",
            );
          }
          if (aOffer == null) return 1; // a has no offer, goes last
          if (bOffer == null) return -1; // b has no offer, goes last

          // Both have offers: compare them (high to low)
          if (aOffer !== bOffer) {
            return bOffer - aOffer;
          }

          // Offers are equal: tie-break by createDate (recent first)
          return cmpNulls(
            getDateMs(media[a]?.createDate),
            getDateMs(media[b]?.createDate),
            "desc",
          );
        });
        break;
      case "High Offer (Low to High)":
        list.sort((a, b) => {
          const aOffer = (media[a] as any)?.highOfferPrice;
          const bOffer = (media[b] as any)?.highOfferPrice;

          // Primary sort: by offer amount (low to high)
          if (aOffer == null && bOffer == null) {
            // Both have no offer: tie-break by createDate (recent first)
            return cmpNulls(
              getDateMs(media[a]?.createDate),
              getDateMs(media[b]?.createDate),
              "desc",
            );
          }
          if (aOffer == null) return 1; // a has no offer, goes last
          if (bOffer == null) return -1; // b has no offer, goes last

          // Both have offers: compare them (low to high)
          if (aOffer !== bOffer) {
            return aOffer - bOffer;
          }

          // Offers are equal: tie-break by createDate (recent first)
          return cmpNulls(
            getDateMs(media[a]?.createDate),
            getDateMs(media[b]?.createDate),
            "desc",
          );
        });
        break;
      case "Least Remaining (Minted - Redeemed)":
        list.sort((a, b) => {
          const aRemaining = getNum((media[a] as any)?.minted) != null && getNum((media[a] as any)?.redeemed) != null
            ? getNum((media[a] as any)?.minted)! - getNum((media[a] as any)?.redeemed)!
            : null;
          const bRemaining = getNum((media[b] as any)?.minted) != null && getNum((media[b] as any)?.redeemed) != null
            ? getNum((media[b] as any)?.minted)! - getNum((media[b] as any)?.redeemed)!
            : null;
          if (aRemaining == null && bRemaining == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aRemaining == null) return 1;
          if (bRemaining == null) return -1;
          if (aRemaining !== bRemaining) return aRemaining - bRemaining;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "Most Remaining (Minted - Redeemed)":
        list.sort((a, b) => {
          const aRemaining = getNum((media[a] as any)?.minted) != null && getNum((media[a] as any)?.redeemed) != null
            ? getNum((media[a] as any)?.minted)! - getNum((media[a] as any)?.redeemed)!
            : null;
          const bRemaining = getNum((media[b] as any)?.minted) != null && getNum((media[b] as any)?.redeemed) != null
            ? getNum((media[b] as any)?.minted)! - getNum((media[b] as any)?.redeemed)!
            : null;
          if (aRemaining == null && bRemaining == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aRemaining == null) return 1;
          if (bRemaining == null) return -1;
          if (aRemaining !== bRemaining) return bRemaining - aRemaining;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "Most Redeemed %":
        list.sort((a, b) => {
          const aPct = getNum((media[a] as any)?.redeemedPct);
          const bPct = getNum((media[b] as any)?.redeemedPct);
          if (aPct == null && bPct == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aPct == null) return 1;
          if (bPct == null) return -1;
          if (aPct !== bPct) return bPct - aPct;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "Least Redeemed %":
        list.sort((a, b) => {
          const aPct = getNum((media[a] as any)?.redeemedPct);
          const bPct = getNum((media[b] as any)?.redeemedPct);
          if (aPct == null && bPct == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aPct == null) return 1;
          if (bPct == null) return -1;
          if (aPct !== bPct) return aPct - bPct;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "Most Locked %":
        list.sort((a, b) => {
          const aPct = getNum((media[a] as any)?.lockedPct);
          const bPct = getNum((media[b] as any)?.lockedPct);
          if (aPct == null && bPct == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aPct == null) return 1;
          if (bPct == null) return -1;
          if (aPct !== bPct) return bPct - aPct;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      case "Least Locked %":
        list.sort((a, b) => {
          const aPct = getNum((media[a] as any)?.lockedPct);
          const bPct = getNum((media[b] as any)?.lockedPct);
          if (aPct == null && bPct == null) {
            return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
          }
          if (aPct == null) return 1;
          if (bPct == null) return -1;
          if (aPct !== bPct) return aPct - bPct;
          return cmpNulls(getDateMs(media[a]?.createDate), getDateMs(media[b]?.createDate), "desc");
        });
        break;
      default:
        break;
    }

    return list;
  }, [
    filteredIds,
    selectedSort,
    media,
    editionLowAsks,
    recentListingsByEdition,
    defaultSortedIds,
  ]);

  // Compute default sort using three-tier grouping: active listings, prior sales, new items
  useEffect(() => {
    if (selectedSort !== null) {
      setDefaultSortedIds(null);
      setIsComputingDefaultSort(false);
      return;
    }

    if (!filteredIds || filteredIds.length === 0) {
      setDefaultSortedIds(filteredIds);
      setIsComputingDefaultSort(false);
      return;
    }

    // Only show spinner on the initial sort computation, not on subsequent updates
    if (!hasInitialSortRef.current) {
      setIsComputingDefaultSort(true);
    }

    const computeDefaultSort = async () => {
      try {
        // Only sort the first page of editions (first 48) to avoid long computation
        const firstPageIds = filteredIds.slice(0, 48);

        // Fetch editions with prior sales
        let editionsWithPriorSales = new Set<number>();
        try {
          editionsWithPriorSales = await fetchEditionsWithPriorSales();
        } catch (err) {
          console.debug("[market] Error fetching prior sales data:", err);
          // Continue without prior sales data
        }

        // Helper function to check if edition has active listing/auction
        const hasActiveMarketplace = (id: number) => {
          const hasActiveListing = activeListings?.some(
            (listing) => listing.editionId === id && listing.status === "active",
          ) ?? false;
          const hasActiveAuction = activeAuctions?.some(
            (auction) => auction.editionId === id && auction.status === "active",
          ) ?? false;
          return hasActiveListing || hasActiveAuction;
        };

        // Separate items into three tiers (first page only)
        const activeItems: number[] = [];
        const priorSalesItems: number[] = [];
        const newItems: number[] = [];

        for (const id of firstPageIds) {
          if (hasActiveMarketplace(id)) {
            activeItems.push(id);
          } else if (editionsWithPriorSales.has(id)) {
            priorSalesItems.push(id);
          } else {
            newItems.push(id);
          }
        }

        // Sort function: favorite team first, then by most recent listings
        const tierSort = (aId: number, bId: number): number => {
          // Favorite team match comes first
          const aTeam = media[aId]?.team;
          const bTeam = media[bId]?.team;
          const aTeamMatch = aTeam && favoriteTeam && aTeam.toLowerCase() === favoriteTeam.toLowerCase();
          const bTeamMatch = bTeam && favoriteTeam && bTeam.toLowerCase() === favoriteTeam.toLowerCase();

          if (aTeamMatch !== bTeamMatch) {
            return aTeamMatch ? -1 : 1;
          }

          // Then by most recent listings
          const aTime = recentListingsByEdition[aId]
            ? parseSupabaseTimestamp(recentListingsByEdition[aId])?.getTime() ?? 0
            : 0;
          const bTime = recentListingsByEdition[bId]
            ? parseSupabaseTimestamp(recentListingsByEdition[bId])?.getTime() ?? 0
            : 0;

          if (aTime !== bTime) {
            return bTime - aTime; // Most recent first
          }

          return 0;
        };

        // Sort each tier
        activeItems.sort(tierSort);
        priorSalesItems.sort(tierSort);
        newItems.sort(tierSort);

        // Combine tiers: active first, then prior sales, then new
        // Append remaining unprocessed IDs to the end
        const allRemainingIds = filteredIds.slice(48);
        const sortedIds = [...activeItems, ...priorSalesItems, ...newItems, ...allRemainingIds];

        setDefaultSortedIds(sortedIds);
        console.log(
          "[market] Default sort computed for first page:",
          `${activeItems.length} active, ${priorSalesItems.length} prior sales, ${newItems.length} new`,
        );
      } catch (err) {
        console.debug("[market] Error computing default sort:", err);
        // Fallback to unsorted
        setDefaultSortedIds(filteredIds);
      } finally {
        hasInitialSortRef.current = true;
        setIsComputingDefaultSort(false);
      }
    };

    computeDefaultSort();
  }, [
    selectedSort,
    filteredIds,
    activeListings,
    activeAuctions,
    media,
    recentListingsByEdition,
    favoriteTeam,
  ]);

  const clearAllFilters = () => {
    setSelectedPlayer(null);
    setSelectedTeam(null);
    setSelectedTier(null);
    setSelectedSet(null);
    setSelectedSort(null);
  };

  useEffect(() => {
    if (selectedPlayer && !availablePlayers.includes(selectedPlayer)) {
      setSelectedPlayer(null);
    }
  }, [selectedPlayer, availablePlayers]);

  useEffect(() => {
    if (selectedTeam && !availableTeams.includes(selectedTeam)) {
      setSelectedTeam(null);
    }
  }, [selectedTeam, availableTeams]);

  useEffect(() => {
    if (selectedTier && !availableTiers.includes(selectedTier)) {
      setSelectedTier(null);
    }
  }, [selectedTier, availableTiers]);

  useEffect(() => {
    if (selectedSet && !availableSets.includes(selectedSet)) {
      setSelectedSet(null);
    }
  }, [selectedSet, availableSets]);

  function toCleanString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      const t = value.trim();
      return t.length ? t : null;
    }
    if (typeof value === "number" || typeof value === "bigint") {
      if (!Number.isFinite(Number(value))) return null;
      return String(value);
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return null;
  }
  function parseNumeric(value: unknown): number | null {
    const raw = toCleanString(value);
    if (!raw) return null;
    const cleaned = raw.replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  function formatPlain(value: unknown): string {
    return toCleanString(value) ?? "—";
  }
  function formatPrice(value: unknown): string {
    const raw = toCleanString(value);
    if (!raw) return "—";
    const withoutSymbol = raw.replace(/^[\$\s]+/, "");
    return `$${withoutSymbol}`;
  }

  return (
    <section
      className="container mx-auto px-4 pt-2 pb-0 flex flex-col nightmode_cards"
      data-marketplace_type={marketplaceType}
    >
      {false ? ( // Temporarily deactivated betaAllowlist check
        <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
          Platform is invitation only. Log in and enter your invite code to
          join.
        </div>
      ) : (
        <>
          <div className="w-full mb-4">
            <img
              src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F63ac72551044449083248a0a00b40ce1"
              alt="Marketplace banner"
              className="w-full h-auto object-cover rounded-md"
            />
          </div>
          <div className="w-full flex items-center justify-between">
            <div className="text-slate-800 text-[28px] font-semibold tracking-wide leading-7 text-left">
              <p>Marketplace</p>
            </div>
            <button
              onClick={() => navigate("/active-auctions")}
              className={ACTION_BUTTON_CLASS}
            >
              <Gavel size={24} style={{ position: "relative", zIndex: 1 }} />
              <span
                className="text-xs font-medium text-center"
                style={{ position: "relative", zIndex: 1 }}
              >
                Auctions
              </span>
            </button>
          </div>
          <div className="text-xs text-slate-600 text-left m-0 p-0">
            Filter and sort options
          </div>
          <div className="mb-0 relative flex flex-nowrap items-stretch gap-0.5 w-full">
            <button
              type="button"
              className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeFilter === "player" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100  active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
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
              className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeFilter === "team" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100  active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
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
              className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeFilter === "tier" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100  active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
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
              className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeFilter === "set" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100  active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
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
              className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeFilter === "sort" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100  active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
              onClick={() =>
                setActiveFilter((p) => (p === "sort" ? "none" : "sort"))
              }
            >
              <span className="relative z-[1]">
                Sort
                {selectedSort ? (
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
              className="relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)] before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100  active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]"
              onClick={() => {
                clearAllFilters();
                setActiveFilter("none");
              }}
            >
              <span className="relative z-[1]">Clear</span>
            </button>
          </div>

          {/* Sliding panels */}
          <div
            className={`relative z-10 overflow-hidden transition-all duration-300 ${activeFilter === "player" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
              <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availablePlayers.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${selectedPlayer === name ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      setSelectedPlayer(name);
                      setActiveFilter("none");
                    }}
                  >
                    {name}
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
                {availableTeams.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${selectedTeam === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      setSelectedTeam(t);
                      setActiveFilter("none");
                    }}
                  >
                    {t}
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
                {availableTiers.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${selectedTier === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      setSelectedTier(t);
                      setActiveFilter("none");
                    }}
                  >
                    {t}
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
                {availableSets.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${selectedSet === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      setSelectedSet(s);
                      setActiveFilter("none");
                    }}
                  >
                    {s}
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
                  "Recent Listings",
                  "Low Ask (High to Low)",
                  "Low Ask (Low to High)",
                  "High Offer (High to Low)",
                  "High Offer (Low to High)",
                  "Least Remaining (Minted - Redeemed)",
                  "Most Remaining (Minted - Redeemed)",
                  "CreateDate (Recent to Oldest)",
                  "CreateDate (Oldest to Recent)",
                  "GameDate (Recent to Oldest)",
                  "GameDate (Oldest to Recent)",
                  "Most Redeemed %",
                  "Least Redeemed %",
                  "Most Locked %",
                  "Least Locked %",
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

          <div className="mt-[10px]" />
          {marketplaceType === "boxes" ? (
            priorDrops == null ? (
              <div className="text-sm text-slate-600">Loading…</div>
            ) : priorDrops.length === 0 ? (
              <div className="text-sm text-slate-600">No boxes found.</div>
            ) : (
              <>
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {priorDrops.slice(0, visibleCount).map((nft, idx) => {
                    const tokenId = getTokenIdString(nft.id);
                    const metadata = nft.metadata ?? undefined;
                    const imageUrl = resolveMediaUrl(metadata?.image ?? null);
                    const attrMap = buildPriorDropAttributeMap(
                      metadata?.attributes,
                    );
                    const tierVal =
                      (attrMap as any).tier ??
                      (attrMap as any).tier_value ??
                      (attrMap as any).tiervalue;
                    const mintedVal =
                      (attrMap as any).minted ?? (attrMap as any).max_supply;
                    const seriesVal = (attrMap as any).series;
                    const dropWeekVal = (attrMap as any).drop_week;
                    const rawLowAsk =
                      (attrMap as any).low_ask ??
                      (attrMap as any).lowask ??
                      (attrMap as any).lowAsk ??
                      (nft as any).lowAsk ??
                      null;
                    const rawRms =
                      (attrMap as any).rolling_median_sale ??
                      (attrMap as any).median_sale ??
                      (attrMap as any).rollingMedianSale ??
                      (nft as any).rollingMedianSale ??
                      null;
                    const rawHighOffer =
                      (attrMap as any).high_offer ??
                      (attrMap as any).highoffer ??
                      (attrMap as any).highOffer ??
                      (nft as any).highOffer ??
                      null;
                    const preferred = rawLowAsk ?? rawRms ?? rawHighOffer;
                    const topText =
                      preferred != null
                        ? formatPrice(preferred)
                        : name != null
                          ? "New"
                          : "";
                    const name = metadata?.name ?? null;
                    return (
                      <li key={tokenId ?? idx} className="mb-[5px]">
                        <Link
                          to={tokenId ? `/box/${tokenId}` : "#"}
                          className="relative block rounded-md border border-slate-300 bg-white p-3 hover:shadow-sm focus:outline-none shadow-[0_5px_0_0_rgba(226,232,240,1)] holo-card"
                        >
                          {name ? (
                            <h3 className="text-center text-base md:text-lg font-semibold text-slate-800 mb-1">
                              {name}
                            </h3>
                          ) : null}
                          {imageUrl ? (
                            <div className="mb-2 overflow-hidden rounded-md bg-slate-100 aspect-video">
                              <EditionHoverPreview
                                thumb={imageUrl}
                                streamId={null}
                              />
                            </div>
                          ) : null}
                          <div className="relative">
                            <div className="flex items-center justify-between">
                              <div className="text-xs md:text-sm text-slate-700 w-1/2">
                                {tierVal && mintedVal != null
                                  ? `${String(tierVal)} - ${String(mintedVal)} to ever exist`
                                  : tokenId
                                    ? `token_id: ${tokenId}`
                                    : "Prior Drop"}
                              </div>
                              <div className="flex items-center gap-1">
                                <span
                                  className="inline-block h-[25px] w-[25px]"
                                  aria-hidden="true"
                                ></span>
                                <span
                                  className="inline-block h-[25px] w-[25px]"
                                  aria-hidden="true"
                                ></span>
                                <span
                                  className="inline-block h-[25px] w-[25px]"
                                  aria-hidden="true"
                                ></span>
                              </div>
                            </div>
                            {seriesVal && dropWeekVal ? (
                              <div className="text-[11px] md:text-xs text-slate-600 w-1/2">
                                {String(seriesVal)} - {String(dropWeekVal)}
                              </div>
                            ) : null}
                            <div className="pointer-events-none absolute inset-y-0 right-0 left-1/2 rounded-sm flex items-center justify-end pr-2">
                              <FitText
                                text={topText}
                                align="right"
                                className="text-slate-900 dark:text-white"
                                min={10}
                              />
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {priorDrops.length > visibleCount ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="relative overflow-hidden flex items-center justify-center text-center w-full px-3 py-1.5 text-sm rounded border bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)] before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100  active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]"
                      onClick={() =>
                        setVisibleCount((c) =>
                          Math.min(c + 12, priorDrops.length),
                        )
                      }
                    >
                      FIND MORE
                    </button>
                  </div>
                ) : null}
              </>
            )
          ) : ids == null ? (
            // Show spinner while loading IDs
            <div className="flex justify-center py-20">
              <div className="inline-block">
                <div
                  className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-slate-300 border-t-[#FF6300]"
                  role="status"
                  aria-label="Loading editions"
                />
              </div>
            </div>
          ) : ids.length === 0 ? (
            <div className="text-sm text-slate-600">No editions found.</div>
          ) : selectedSort === null && (isComputingDefaultSort || listingsLoading || auctionsLoading || offersLoading) ? (
            // Show spinner while computing default sort or loading sort criteria data
            <div className="flex justify-center py-20">
              <div className="inline-block">
                <div
                  className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-slate-300 border-t-[#FF6300]"
                  role="status"
                  aria-label="Loading marketplace data"
                />
              </div>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {sortedIds.map((id) => (
                  <li key={id} className="mb-[5px]">
                    <Link
                      to={`/edition/${id}`}
                      className="relative block rounded-md border border-slate-300 bg-white p-3 hover:shadow-sm focus:outline-none shadow-[0_5px_0_0_rgba(226,232,240,1)] holo-card"
                    >
                      {media[id]?.name ? (
                        <h3 className="text-center text-base md:text-lg font-semibold text-slate-800 mb-1">
                          {media[id]?.name}
                        </h3>
                      ) : null}
                      {media[id]?.thumb ? (
                        <div className="mb-2 overflow-hidden rounded-md bg-slate-100 aspect-video">
                          <EditionHoverPreview
                            thumb={media[id]?.thumb as string}
                            streamId={media[id]?.videoId ?? null}
                          />
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <div className="text-xs md:text-sm text-slate-700">
                          {media[id]?.tier && media[id]?.minted != null
                            ? `${media[id]?.tier} - ${String(media[id]?.minted)} to ever exist`
                            : `edition_id: ${id}`}
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="inline-block h-[25px] w-[25px]"
                            aria-hidden="true"
                          >
                            {media[id]?.badge3 ? (
                              <img
                                src={media[id]?.badge3 as string}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            ) : null}
                          </span>
                          <span
                            className="inline-block h-[25px] w-[25px]"
                            aria-hidden="true"
                          >
                            {media[id]?.badge2 ? (
                              <img
                                src={media[id]?.badge2 as string}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            ) : null}
                          </span>
                          <span
                            className="inline-block h-[25px] w-[25px]"
                            aria-hidden="true"
                          >
                            {media[id]?.badge ? (
                              <img
                                src={media[id]?.badge as string}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            ) : null}
                          </span>
                          <span
                            className="inline-block h-[25px] w-[25px]"
                            aria-hidden="true"
                          >
                            {media[id]?.team ? (
                              <img
                                src={
                                  getTeamCrest(media[id]?.team as string) || ""
                                }
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            ) : null}
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 right-0 left-1/2 rounded-sm flex items-center justify-end pr-2">
                          {(() => {
                            const editionData = media[id] as any;
                            const editionLowAsk = editionLowAsks[id];
                            const highOffer = editionData?.highOffer;
                            const rms = editionData?.rollingMedianSale;

                            // Check for active auction for this edition
                            const editionAuction = activeAuctions?.find(
                              (a) =>
                                a.editionId === id && a.status === "active",
                            );
                            let auctionPrice: number | null = null;
                            if (editionAuction) {
                              auctionPrice = editionAuction.currentBidAmount
                                ? Number(
                                    BigInt(editionAuction.currentBidAmount),
                                  ) / 1e18
                                : Number(
                                    BigInt(editionAuction.minimumBidAmount),
                                  ) / 1e18;
                            }

                            // Compare auction price with direct listing price and use the lower
                            let lowestActivePrice: string | null = null;
                            let activeSource: "auction" | "listing" | null =
                              null;

                            if (auctionPrice != null && editionLowAsk != null) {
                              const directPrice = parseFloat(
                                editionLowAsk.replace("$", ""),
                              );
                              if (auctionPrice < directPrice) {
                                lowestActivePrice = `$${auctionPrice.toFixed(2)}`;
                                activeSource = "auction";
                              } else {
                                lowestActivePrice = editionLowAsk;
                                activeSource = "listing";
                              }
                            } else if (auctionPrice != null) {
                              lowestActivePrice = `$${auctionPrice.toFixed(2)}`;
                              activeSource = "auction";
                            } else if (editionLowAsk != null) {
                              lowestActivePrice = editionLowAsk;
                              activeSource = "listing";
                            }

                            let topText: string = "";
                            if (lowestActivePrice != null) {
                              topText = lowestActivePrice;
                            } else if (highOffer != null) {
                              topText = highOffer;
                            } else if (rms != null) {
                              topText = rms;
                            } else if (
                              !listingsLoading &&
                              !auctionsLoading &&
                              !offersLoading &&
                              editionData?.name != null
                            ) {
                              // Only show "New" after confirming all data sources have finished loading and are empty
                              topText = "New";
                            }

                            return (
                              <FitText
                                text={topText}
                                align="right"
                                className="text-slate-900 dark:text-white"
                                min={10}
                              />
                            );
                          })()}
                        </div>
                        {media[id]?.gameDate ? (
                          <div className="text-[11px] md:text-xs text-slate-600 w-1/2">
                            Game Date: {media[id]?.gameDate}
                          </div>
                        ) : null}
                        <div className="text-[11px] md:text-xs text-slate-600 w-1/2">
                          Creation Date:{" "}
                          {media[id]?.createDate
                            ? String(media[id]?.createDate).slice(0, 10)
                            : "—"}
                        </div>
                      </div>
                      {media[id]?.setName ? (
                        <div className="grid grid-cols-2 items-center">
                          <div className="text-[12px] md:text-sm text-slate-700 text-left">
                            {media[id]?.setName}
                          </div>
                          <div className="relative h-6 md:h-7">
                            <div
                              aria-hidden="true"
                              className="absolute inset-0 rounded-sm"
                            ></div>
                            <div className="absolute inset-0 flex items-start justify-end pr-2">
                              {(() => {
                                const editionLowAsk = editionLowAsks[id];
                                const lowAsk = (media[id] as any)?.lowAsk;
                                const rms = (media[id] as any)
                                  ?.rollingMedianSale;
                                const highOffer = (media[id] as any)?.highOffer;

                                // Check for active auction for this edition
                                const editionAuction = activeAuctions?.find(
                                  (a) =>
                                    a.editionId === id && a.status === "active",
                                );

                                // Determine the label based on lowest active price source
                                let auctionPrice: number | null = null;
                                if (editionAuction) {
                                  auctionPrice = editionAuction.currentBidAmount
                                    ? Number(
                                        BigInt(editionAuction.currentBidAmount),
                                      ) / 1e18
                                    : Number(
                                        BigInt(editionAuction.minimumBidAmount),
                                      ) / 1e18;
                                }

                                let label: string | null = null;
                                if (
                                  auctionPrice != null &&
                                  editionLowAsk != null
                                ) {
                                  const directPrice = parseFloat(
                                    editionLowAsk.replace("$", ""),
                                  );
                                  label =
                                    auctionPrice < directPrice
                                      ? "Active Auction"
                                      : "Low Ask";
                                } else if (auctionPrice != null) {
                                  label = "Active Auction";
                                } else if (editionLowAsk != null) {
                                  label = "Low Ask";
                                } else if (lowAsk != null) {
                                  label = "Low Ask";
                                } else if (rms != null) {
                                  label = "Median Sale";
                                } else if (highOffer != null) {
                                  label = "High Offer";
                                }
                                return label ? (
                                  <span className="text-[10px] md:text-xs text-slate-900 dark:text-white">
                                    {label}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
              {/* Sentinel element for infinite scroll */}
              <div ref={sentinelRef} className="h-8" />

              {/* Loading spinner while fetching more items */}
              {isLoadingMore && (
                <div className="flex justify-center py-6">
                  <div className="inline-block">
                    <div
                      className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-slate-300 border-t-[#FF6300]"
                      role="status"
                      aria-label="Loading more items"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
