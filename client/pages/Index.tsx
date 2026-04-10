import MiniCarousel from "@/components/MiniCarousel";
import { Link, useNavigate } from "react-router-dom";

import { getPlaceholder } from "@/lib/placeholders";
import EditionCardMini from "@/components/EditionCardMini";
import SerialCardMini from "@/components/SerialCardMini";
import TrophyDisplayCard from "@/components/TrophyDisplayCard";
import HomepageBoxPlaceholder, {
  useHomepageBoxHasContent,
} from "@/components/HomepageBoxPlaceholder";
import MyClubCard from "@/components/MyClubCard";
import FitText from "@/components/FitText";
import {
  voteMediaForIndex,
  redeemMediaForIndex,
  dropsMediaForIndex,
  earnMediaForIndex,
} from "@/lib/sectionMedia";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVoteLocations } from "@/lib/supabaseRest";
import { useBetaAllowlist, useWalletProfile } from "@/hooks/useWalletProfile";
import { useTrophyCase } from "@/hooks/useTrophyCase";
import { useSharedCountdownBreakdown, useSharedCountdown } from "@/hooks/useSharedCountdown";
import { fetchHomepageMarketplaceCards } from "@/lib/homepageMarketplaceCards";
import { fetchSerialCardsFromTokenIds } from "@/lib/activeAuctionsFromEvents";
import {
  fetchPriorDropNFTs,
  PRIOR_DROPS_QUERY_PARAMS,
  buildPriorDropAttributeMap,
  getTokenIdString,
  resolveMediaUrl,
  type PriorDropNFT,
} from "@/lib/priorDrops";
import {
  fetchRelicsForWallet,
  fetchBoxesBalanceForWallet,
} from "@/lib/nftReads";
import {
  fetchMintedByEditionId,
  fetchHighestFanFavoriteEdition,
} from "@/lib/supabaseMinted";
import { getAirdropCloseRaw } from "@/lib/supabaseRedemptionDeadline";
import useRedeemCards from "@/components/redeem-cards";
import { fetchRelicSerialsByTokenIds } from "@/lib/alchemyRelicSerialsJoined";
import { getTeamCrest } from "@/lib/teams";
import {
  fetchSeriesTeamSales,
  getTopTeamsByPrice,
  type SeriesTeamSalesRecord,
} from "@/lib/seriesTeamSales";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ComingSoonModal } from "@/components/ComingSoonModal";

export default function Home() {
  const account = useActiveAccount();
  const isLoggedIn = !!account;

  const defaultLabels = [
    "YOUR COLLECTION",
    "MARKETPLACE",
    "DROPS",
    "VOTE",
    "REDEEM",
    "REWARD",
    "DATA",
    "CLUBHOUSE",
    "INFO",
  ] as const;

  const newCollectorLabels = [
    "INFO",
    "VOTE",
    "MARKETPLACE",
    "DROPS",
    "REWARD",
    "REDEEM",
    "DATA",
    "CLUBHOUSE",
  ] as const;

  const [hasZeroTokens, setHasZeroTokens] = useState(false);
  const labels = (hasZeroTokens ? newCollectorLabels : defaultLabels) as const;
  type Label = (typeof defaultLabels)[number];

  const footerTextOverrides: Partial<Record<Label, string>> = {
    VOTE: "Vote to decide what becomes new relics",
    REDEEM: "Earn a team's new Relic by turning in their prior ones",
    DROPS: "Score a Box of Relics users want",
    MARKETPLACE: "Buy Relics from users. Level up your collection.",
    COLLECTION:
      "Show off, organize, and transact with your prized collectibles",
    REWARD: "Compete to earn your team's new free Relic",
    CLUBHOUSE: "Connect with collectors of your favorite team.",
    DATA: "Track the market. Make informed buying decisions.",
    INFO: "Learn more about how the platform works",
  };

  const footerlessLabels = new Set<Label>(["INFO", "YOUR COLLECTION"]);

  const { profile } = useWalletProfile();
  const navigate = useNavigate();

  const [clubQuery, setClubQuery] = useState("");
  const [clubOpen, setClubOpen] = useState(false);
  const [clubResults, setClubResults] = useState<string[]>([]);
  const [clubSelected, setClubSelected] = useState<string | null>(null);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

  // Detect scroll position to hide scroll indicator when at bottom
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const isAtBottom = scrollTop + windowHeight >= documentHeight - 100;
      setShowScrollIndicator(!isAtBottom);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Call hook at component level (not inside conditional/switch)
  const hasBoxContent = useHomepageBoxHasContent();
  const { cards: redeemCards } = useRedeemCards();

  // Fetch distinct usernames matching query
  useEffect(() => {
    let mounted = true;
    const q = clubQuery.trim();
    const ctrl = new AbortController();
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;
    if (!baseUrl || !anonKey) return;
    if (q.length < 1) {
      setClubResults([]);
      return;
    }
    const fetchUsers = async () => {
      try {
        const params = new URLSearchParams({
          select: "username",
          limit: "10",
          order: "username.asc",
        });
        // ilike pattern for contains
        params.append("username", `ilike.*${q}*`);
        const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?${params.toString()}`;
        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
          signal: ctrl.signal,
        });
        if (!mounted) return;
        const rows = (await res.json()) as Array<{ username?: string | null }>;
        const vals = Array.from(
          new Set(
            (rows || []).map((r) => (r.username || "").trim()).filter(Boolean),
          ),
        );
        if (mounted) {
          setClubResults(vals);
          setClubOpen(vals.length > 0);
        }
      } catch (err: any) {
        if (!mounted || err?.name === "AbortError") return;
        setClubResults([]);
        setClubOpen(false);
      }
    };
    fetchUsers();
    return () => {
      mounted = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, [clubQuery]);
  const myCollectionPath =
    (profile as any)?.username &&
    String((profile as any).username).trim().length > 0
      ? `/collection/${encodeURIComponent(String((profile as any).username))}`
      : "/collection";

  const [voteLocations, setVoteLocations] = useState<string[]>([]);
  const betaAllowlist = useBetaAllowlist();

  const [refetchTrophy, setRefetchTrophy] = useState(0);
  const connectedProfile = profile as any;
  const { trophyCase } = useTrophyCase(
    connectedProfile?.wallet_address,
    refetchTrophy,
  );

  // Check if user has zero tokens (used to rearrange homepage cards)
  useEffect(() => {
    let mounted = true;
    const walletAddress = (connectedProfile?.wallet_address as string) || "";

    if (!walletAddress) {
      setHasZeroTokens(false);
      return;
    }

    const checkTokenBalances = async () => {
      try {
        const relics = await fetchRelicsForWallet(walletAddress);
        const boxes = await fetchBoxesBalanceForWallet(walletAddress);

        if (!mounted) return;

        const hasRelics = relics && relics.length > 0;
        const hasBoxes = boxes && Object.keys(boxes).length > 0;

        setHasZeroTokens(!hasRelics && !hasBoxes);
      } catch (e) {
        if (mounted) {
          setHasZeroTokens(false);
        }
      }
    };

    checkTokenBalances();
    return () => {
      mounted = false;
    };
  }, [connectedProfile?.wallet_address]);

  const selectedRelicForTrophy1 = trophyCase?.trophy1_tokenId
    ? {
        editionId: trophyCase.trophy1_editionId ?? 0,
        serial: trophyCase.trophy1_serial ?? 0,
        tokenId: trophyCase.trophy1_tokenId,
      }
    : null;
  type MarketplaceItem = {
    type: "listing" | "sale" | "auction";
    id: number;
    serial: number | null;
    name: string | null;
    thumb: string | null;
    minted: number | null;
    gameDate: string | null;
    createDate: string | null;
    setName: string | null;
    badge: string | null;
    badge2: string | null;
    badge3: string | null;
    team?: string | null;
    price: string | null;
    username?: string | null;
    increaseFromAsking?: string | null;
    auctionEndTs?: number;
    auctionCreatorUsername?: string | null;
  };

  const [newRelics, setNewRelics] = useState<
    Array<{
      id: number;
      serial: number;
      name: string | null;
      thumb: string | null;
      minted: number | string | null;
      gameDate: string | null;
      createDate: string | null;
      setName: string | null;
      badge: string | null;
      badge2: string | null;
      badge3: string | null;
      team?: string | null;
      price: string | null;
      listing_creator_username?: string | null;
    }>
  >([]);
  const [recentSales, setRecentSales] = useState<
    Array<{
      id: number;
      name: string | null;
      thumb: string | null;
      tier: string | null;
      serial: number | null;
      minted: number | null;
      gameDate: string | null;
      createDate: string | null;
      setName: string | null;
      badge: string | null;
      badge2: string | null;
      badge3: string | null;
      team?: string | null;
      price: string | null;
      saleUsername?: string | null;
    }>
  >([]);
  const [activeAuctionCards, setActiveAuctionCards] = useState<
    Array<{
      editionId: number;
      serial: number;
      name: string | null;
      thumb: string | null;
      gameDate: string | null;
      createDate: string | null;
      setName: string | null;
      badge: string | null;
      badge2: string | null;
      badge3: string | null;
      team?: string | null;
      minted: number | null;
      endTimestamp: number;
      increaseFromAsking: string | null;
      bidPrice: string | null;
      overlayText: string | null;
      auctionEndTs: number;
      auctionCreatorUsername?: string | null;
    }>
  >([]);

  const marketplaceItems = useMemo(() => {
    const items: MarketplaceItem[] = [];
    const maxLength = Math.max(
      newRelics.length,
      recentSales.length,
      activeAuctionCards.length,
    );

    for (let i = 0; i < maxLength; i++) {
      if (i < newRelics.length) {
        const relic = newRelics[i];
        items.push({
          type: "listing",
          id: relic.id,
          serial: relic.serial,
          name: relic.name,
          thumb: relic.thumb,
          minted: relic.minted as number | null,
          gameDate: relic.gameDate,
          createDate: relic.createDate,
          setName: relic.setName,
          badge: relic.badge,
          badge2: relic.badge2,
          badge3: relic.badge3,
          team: relic.team,
          price: relic.price,
          username: relic.listing_creator_username,
        });
      }
      if (i < recentSales.length) {
        const sale = recentSales[i];
        items.push({
          type: "sale",
          id: sale.id,
          serial: sale.serial,
          name: sale.name,
          thumb: sale.thumb,
          minted: sale.minted,
          gameDate: sale.gameDate,
          createDate: sale.createDate,
          setName: sale.setName,
          badge: sale.badge,
          badge2: sale.badge2,
          badge3: sale.badge3,
          team: sale.team,
          price: sale.price,
          username: sale.saleUsername,
        });
      }
      if (i < activeAuctionCards.length) {
        const auction = activeAuctionCards[i];
        items.push({
          type: "auction",
          id: auction.editionId,
          serial: auction.serial,
          name: auction.name,
          thumb: auction.thumb,
          minted: auction.minted,
          gameDate: auction.gameDate,
          createDate: auction.createDate,
          setName: auction.setName,
          badge: auction.badge,
          badge2: auction.badge2,
          badge3: auction.badge3,
          team: auction.team,
          price: auction.bidPrice,
          increaseFromAsking: auction.increaseFromAsking,
          auctionEndTs: auction.auctionEndTs,
          username: undefined,
          auctionCreatorUsername: auction.auctionCreatorUsername,
        });
      }
    }
    return items;
  }, [newRelics, recentSales, activeAuctionCards]);

  const [marketplaceIndex, setMarketplaceIndex] = useState(0);
  const [marketplaceFlash, setMarketplaceFlash] = useState(false);
  const [auctionCountdowns, setAuctionCountdowns] = useState<
    Record<number, string>
  >({});
  const [redeemIndex, setRedeemIndex] = useState(0);
  const [ownedRelics, setOwnedRelics] = useState<
    Array<{
      tokenId: string;
      editionId: number | null;
      serial: number | null;
      thumb: string | null;
    }>
  >([]);
  const [relicsLoading, setRelicsLoading] = useState(false);

  const [fanFavoriteMinted, setFanFavoriteMinted] = useState<{
    edition_id: number;
    name?: string;
    thumb?: string;
    tier?: string;
    minted?: number;
    gameDate?: string;
    createDate?: string;
    setName?: string;
    badge?: string;
    badge2?: string;
    badge3?: string;
    team?: string;
    drop_week?: string;
  } | null>(null);
  const [fanFavoriteLoading, setFanFavoriteLoading] = useState(false);
  const [airdropCloseDate, setAirdropCloseDate] = useState<Date | null>(null);
  const countdownTimeRaw = useSharedCountdownBreakdown(
    airdropCloseDate ? airdropCloseDate.getTime() : 0,
  );
  const countdownTime = airdropCloseDate && countdownTimeRaw.seconds !== -1
    ? countdownTimeRaw
    : null;

  const [ownedRelicForReward, setOwnedRelicForReward] = useState<{
    editionId: number;
    thumb?: string;
    name?: string;
    serial?: number;
    minted?: number;
    gameDate?: string;
    createDate?: string;
    setName?: string;
    badge?: string;
    badge2?: string;
    badge3?: string;
    team?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetchVoteLocations()
      .then((vals) => {
        if (!active) return;
        setVoteLocations(vals);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    const walletAddress = (connectedProfile?.wallet_address as string) || "";

    if (!walletAddress) {
      setOwnedRelicForReward(null);
      return;
    }

    const fetchOwnedRelic = async () => {
      try {
        const relicsNfts = await fetchRelicsForWallet(
          walletAddress,
          ctrl.signal,
        );
        if (!mounted) return;
        if (!relicsNfts || relicsNfts.length === 0) {
          setOwnedRelicForReward(null);
          return;
        }

        const tokenIds = relicsNfts.map((nft: any) =>
          String(nft?.tokenId ?? nft?.id ?? ""),
        );
        const validTokenIds = tokenIds.filter(Boolean);
        const relicsMetadata = await fetchRelicSerialsByTokenIds(
          validTokenIds,
          ctrl.signal,
        );
        if (!mounted) return;

        if (relicsMetadata.size === 0) {
          setOwnedRelicForReward(null);
          return;
        }

        const mostRecentRelic = Array.from(relicsMetadata.values())[0];
        if (!mostRecentRelic) {
          setOwnedRelicForReward(null);
          return;
        }

        const {
          edition_id,
          serial,
          video_location,
          PlayerName,
          GameDate,
          CreateDate,
          SetName,
          Badge1,
          Badge2,
          Badge3,
          Minted,
          team,
        } = mostRecentRelic as any;

        const video = video_location && String(video_location).trim();
        const thumb = video
          ? `https://image.mux.com/${video}/thumbnail.png?time=5`
          : null;

        const getBadge = (
          badgeCode: string | null | undefined,
        ): string | undefined => {
          if (!badgeCode) return undefined;
          const code = String(badgeCode).toUpperCase();
          if (code === "CP") return "/images/cp-badge.webp";
          if (code === "RY") return "/images/ry-badge.webp";
          if (code === "CY") return "/images/cy-badge.webp";
          return undefined;
        };

        if (mounted) {
          setOwnedRelicForReward({
            editionId: edition_id || 0,
            thumb: thumb ?? undefined,
            name: PlayerName ? String(PlayerName) : undefined,
            serial: serial,
            minted: Minted || undefined,
            gameDate: GameDate ? String(GameDate) : undefined,
            createDate: CreateDate ? String(CreateDate) : undefined,
            setName: SetName ? String(SetName) : undefined,
            badge: getBadge(Badge1),
            badge2: getBadge(Badge2),
            badge3: getBadge(Badge3),
            team: team ? String(team) : undefined,
          });
        }
      } catch (err: any) {
        if (mounted && err?.name !== "AbortError") {
          setOwnedRelicForReward(null);
        }
      }
    };

    fetchOwnedRelic();

    return () => {
      mounted = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, [connectedProfile?.wallet_address]);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    const fetchFanFavorite = async () => {
      setFanFavoriteLoading(true);
      try {
        const mintedRow = await fetchHighestFanFavoriteEdition(ctrl.signal);
        if (!mounted) return;
        if (mintedRow) {
          const video =
            mintedRow.video_location && String(mintedRow.video_location).trim();
          const thumb = video
            ? `https://image.mux.com/${video}/thumbnail.png?time=5`
            : null;

          const getBadge = (badgeCode: string | null | undefined) => {
            if (!badgeCode) return undefined;
            try {
              const trimmed = String(badgeCode).trim();
              return trimmed
                ? `https://cdn.builder.io/api/v1/image/assets%2F5a0f5c8b0b3a4b0a8b3a4b0a%2F${trimmed}.png`
                : undefined;
            } catch {
              return undefined;
            }
          };

          setFanFavoriteMinted({
            edition_id: mintedRow.edition_id,
            name: mintedRow.PlayerName,
            thumb,
            tier: mintedRow.TierValue,
            minted: mintedRow.Minted,
            gameDate: mintedRow.GameDate,
            createDate: mintedRow.CreateDate,
            setName: mintedRow.SetName,
            badge: getBadge(mintedRow.Badge1),
            badge2: getBadge(mintedRow.Badge2),
            badge3: getBadge(mintedRow.Badge3),
            team: mintedRow.team,
            drop_week: mintedRow.drop_week,
          });
        } else {
          setFanFavoriteMinted(null);
        }
      } catch (e) {
        if (mounted) {
          setFanFavoriteMinted(null);
        }
      } finally {
        if (mounted) {
          setFanFavoriteLoading(false);
        }
      }
    };

    fetchFanFavorite();
    return () => {
      mounted = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    if (!fanFavoriteMinted?.drop_week) {
      setAirdropCloseDate(null);
      return;
    }

    const fetchAirdropClose = async () => {
      try {
        const result = await getAirdropCloseRaw(
          fanFavoriteMinted.drop_week!,
          ctrl.signal,
        );
        if (!mounted) return;

        if (result.found && result.value) {
          // Parse the date and set 5pm EST as the deadline
          const closeDate = new Date(result.value);
          // Set time to 5pm EST (17:00 EST)
          closeDate.setHours(17, 0, 0, 0);
          setAirdropCloseDate(closeDate);
        } else {
          setAirdropCloseDate(null);
        }
      } catch (e) {
        if (mounted) {
          setAirdropCloseDate(null);
        }
      }
    };

    fetchAirdropClose();
    return () => {
      mounted = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, [fanFavoriteMinted?.drop_week]);


  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;
    if (baseUrl && anonKey) {
      // Select only required columns to reduce view computation overhead
      const params = new URLSearchParams({
        select:
          "edition_id,PlayerName,TierValue,Minted,GameDate,CreateDate,video_location,SetName,Badge1,Badge2,Badge3",
        order: "GameDate.desc",
        limit: "5",
      });
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?${params.toString()}`;
      fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        signal: ctrl.signal,
        mode: "cors",
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((rows) => {
          if (!mounted) return;
          const list = Array.isArray(rows) ? rows : [];
          const items = list
            .map((row) => {
              const video =
                row?.video_location && String(row.video_location).trim();
              const thumb = video
                ? `https://image.mux.com/${video}/thumbnail.png?time=5`
                : null;
              const id = Number(row?.edition_id);
              const name = row?.PlayerName ? String(row.PlayerName) : null;
              const tier = row?.TierValue ? String(row.TierValue) : null;
              const minted = (row as any)?.Minted ?? null;
              const gameDate = row?.GameDate ? String(row.GameDate) : null;
              const rawCreate = (row as any)?.CreateDate ?? null;
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
                thumb,
                tier,
                minted,
                gameDate,
                createDate,
                setName,
                badge,
                badge2,
                badge3,
              };
            })
            .filter((it) => Number.isFinite(it.id as any));
          setNewRelics(items);
          setNewRelicIndex(0);
        })
        .catch((err: any) => {
          if (!mounted || err?.name === "AbortError") return;
        });
    }
    return () => {
      mounted = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    const fetchMarketplaceCardsData = async () => {
      try {
        const data = await fetchHomepageMarketplaceCards(ctrl.signal);
        if (!mounted) return;

        // Update New Relics
        const newRelicsCards = data.newRelics.map((card) => ({
          id: card.editionId,
          serial: card.serial,
          name: card.name,
          thumb: card.thumb,
          minted: card.minted,
          gameDate: card.gameDate,
          createDate: card.createDate,
          setName: card.setName,
          badge: card.badge,
          badge2: card.badge2,
          badge3: card.badge3,
          team: card.team,
          price: card.price,
          listing_creator_username: card.listing_creator_username,
        }));

        // Update Recent Sales
        const recentSalesCards = data.recentSales.map((card) => ({
          id: card.editionId,
          name: card.name,
          thumb: card.thumb,
          tier: null,
          serial: card.serial,
          minted: card.minted,
          gameDate: card.gameDate,
          createDate: card.createDate,
          setName: card.setName,
          badge: card.badge,
          badge2: card.badge2,
          badge3: card.badge3,
          team: card.team,
          price: card.price,
          saleUsername: card.saleUsername,
        }));

        // Update Previous Auctions
        // Exclude ended auctions with zero bids (increaseFromAsking = "+0.00%")
        const auctionCards = data.previousAuctions
          .filter((card) => card.increaseFromAsking !== "+0.00%")
          .map((card) => ({
            editionId: card.editionId,
            serial: card.serial,
            name: card.name,
            thumb: card.thumb,
            gameDate: card.gameDate,
            createDate: card.createDate,
            setName: card.setName,
            badge: card.badge,
            badge2: card.badge2,
            badge3: card.badge3,
            team: card.team,
            minted: card.minted,
            endTimestamp: 0,
            increaseFromAsking: card.increaseFromAsking,
            bidPrice: card.bidPrice,
            overlayText: card.overlayText,
            auctionEndTs: card.auctionEndTs || 0,
            auctionCreatorUsername: card.auctionCreatorUsername,
          }));

        if (mounted) {
          setNewRelics(newRelicsCards);
          setRecentSales(recentSalesCards);
          setActiveAuctionCards(auctionCards);
          setMarketplaceIndex(0);
        }
      } catch (err: any) {
        if (!mounted || err?.name === "AbortError") return;
        console.error("Failed to fetch marketplace cards:", err);
      }
    };

    fetchMarketplaceCardsData();
    return () => {
      mounted = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (marketplaceItems.length <= 1) return;
    let timeoutId: number | undefined;
    let intervalId: number | undefined;

    const startInterval = () => {
      intervalId = window.setInterval(() => {
        setMarketplaceFlash(true);
        timeoutId = window.setTimeout(() => {
          setMarketplaceIndex((i) => (i + 1) % marketplaceItems.length);
          setMarketplaceFlash(false);
        }, 120) as any;
      }, 6000) as any;
    };

    startInterval();

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [marketplaceItems.length]);

  useEffect(() => {
    if (redeemCards.length <= 1) return;
    let intervalId: number | undefined;

    intervalId = window.setInterval(() => {
      setRedeemIndex((i) => (i + 1) % redeemCards.length);
    }, 3000) as any;

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [redeemCards.length]);

  // Calculate auction end time for current item
  const currentMarketplaceItem =
    marketplaceIndex >= 0 && marketplaceIndex < marketplaceItems.length
      ? marketplaceItems[marketplaceIndex]
      : null;
  const currentAuctionEndMs =
    currentMarketplaceItem &&
    currentMarketplaceItem.type === "auction" &&
    currentMarketplaceItem.auctionEndTs &&
    currentMarketplaceItem.auctionEndTs !== 0
      ? currentMarketplaceItem.auctionEndTs * 1000 // Convert seconds to milliseconds
      : 0;

  const auctionCountdownBreakdown = useSharedCountdownBreakdown(
    currentAuctionEndMs,
  );

  // Update auctionCountdowns state for the current item if we have a breakdown
  useEffect(() => {
    if (
      auctionCountdownBreakdown &&
      currentAuctionEndMs > 0 &&
      (auctionCountdownBreakdown.days > 0 ||
        auctionCountdownBreakdown.hours > 0 ||
        auctionCountdownBreakdown.minutes > 0 ||
        auctionCountdownBreakdown.seconds > 0)
    ) {
      const countdownText = `${auctionCountdownBreakdown.days}d ${String(auctionCountdownBreakdown.hours).padStart(2, "0")}h ${String(auctionCountdownBreakdown.minutes).padStart(2, "0")}m ${String(auctionCountdownBreakdown.seconds).padStart(2, "0")}s`;
      setAuctionCountdowns((prev) => ({
        ...prev,
        [marketplaceIndex]: countdownText,
      }));
    }
  }, [auctionCountdownBreakdown, currentAuctionEndMs, marketplaceIndex]);

  useEffect(() => {
    const run = (el: HTMLElement) => {
      el.classList.add("holo-run");
      window.setTimeout(() => el.classList.remove("holo-run"), 1100);
    };
    const handler = (e: Event) => run(e.currentTarget as HTMLElement);
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".holo-card"),
    );
    cards.forEach((c) => {
      c.addEventListener("pointerdown", handler, { passive: true } as any);
      c.addEventListener(
        "touchstart",
        handler as any,
        { passive: true } as any,
      );
    });
    return () => {
      cards.forEach((c) => {
        c.removeEventListener("pointerdown", handler as any);
        c.removeEventListener("touchstart", handler as any);
      });
    };
  }, []);

  useEffect(() => {
    let active = true;
    const walletAddress = connectedProfile?.wallet_address;
    if (!walletAddress) {
      setOwnedRelics([]);
      setRelicsLoading(false);
      return;
    }

    const fetchRelics = async () => {
      setRelicsLoading(true);
      try {
        const relics = await fetchRelicsForWallet(walletAddress);
        if (!active) return;

        if (relics.length === 0) {
          setOwnedRelics([]);
          setRelicsLoading(false);
          return;
        }

        const tokenIds = relics.map((r) => r.tokenId);
        const serialCardMap = await fetchSerialCardsFromTokenIds(tokenIds);
        if (!active) return;

        const editionIds = Array.from(
          new Set(
            Array.from(serialCardMap.values())
              .map((s) => s.editionId)
              .filter((id) => Number.isFinite(id)),
          ),
        );

        const mintedDataMap = new Map<
          number,
          { video_location?: string | null }
        >();
        if (editionIds.length > 0) {
          for (const editionId of editionIds.slice(0, 10)) {
            const mintedRow = await fetchMintedByEditionId(editionId);
            if (mintedRow) {
              mintedDataMap.set(editionId, mintedRow);
            }
          }
        }

        const relicsWithData = relics.map((relic) => {
          const serialCard = serialCardMap.get(relic.tokenId);
          if (!serialCard) {
            return {
              tokenId: relic.tokenId,
              editionId: null,
              serial: null,
              thumb: null,
            };
          }

          const editionId = serialCard.editionId;
          const mintedRow = mintedDataMap.get(editionId);
          const videoLocation =
            mintedRow?.video_location &&
            String(mintedRow.video_location).trim();
          const thumb = videoLocation
            ? `https://image.mux.com/${videoLocation}/thumbnail.png?time=5`
            : null;

          return {
            tokenId: relic.tokenId,
            editionId,
            serial: serialCard.serial,
            thumb,
          };
        });

        if (active) {
          setOwnedRelics(relicsWithData);
        }
      } catch (e) {
        if (active) {
          setOwnedRelics([]);
        }
      } finally {
        if (active) {
          setRelicsLoading(false);
        }
      }
    };

    fetchRelics();
    return () => {
      active = false;
    };
  }, [connectedProfile?.wallet_address]);

  const renderCardContent = (label: Label) => {
    switch (label) {
      case "VOTE":
        return (
          <div className="mt-0 mb-[5px] flex h-full w-full min-h-0 flex-1">
            <MiniCarousel
              count={20}
              caption={(i) => (voteLocations[i] ? undefined : "Coming Soon")}
              overlayCaption
              mediaForIndex={(i) => {
                const id = voteLocations[i];
                if (id) {
                  const src = `https://image.mux.com/${encodeURIComponent(id)}/thumbnail.png?height=214&width=121&time=3&fit_mode=smartcrop`;
                  return { src, mediaType: "image" };
                }
                return undefined;
              }}
              itemHrefForIndex={(i) =>
                `/vote/Vote${String(i + 1).padStart(2, "0")}`
              }
              onItemClick={() => {
                try {
                  sessionStorage.setItem(
                    "vote_player_autoplay_unlocked",
                    "true",
                  );
                } catch {}
              }}
              containerPaddingClass="px-[2px] w-full"
              gapClass="gap-1"
              itemWidthClass="w-[calc((100%-12px)/4)] md:w-[103px]"
              imageClass="h-full"
              overlayTextStyle={{
                fontFamily: "Roboto, sans-serif",
                fontSize: "12px",
                fontWeight: 300,
                lineHeight: "20px",
                color: "rgb(51, 65, 85)",
              }}
            />
          </div>
        );
      case "REDEEM": {
        const uniqueTeams = Array.from(
          new Set(redeemCards.map((c) => c.team).filter(Boolean)),
        ).slice(0, 10);

        return (
          <div
            className="mt-0 mb-[5px] flex h-full w-full min-h-0 flex-1 px-3"
            style={{ gap: "2px" }}
          >
            <div
              className="flex h-full min-h-0 min-w-0 items-center justify-center"
              style={{ flex: "1 1 33.33%" }}
            >
              {redeemCards.length > 0 &&
                redeemIndex < redeemCards.length &&
                (() => {
                  const card = redeemCards[redeemIndex];
                  return (
                    <div
                      className="flex h-full flex-col items-center justify-center p-0 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => navigate(`/redeem/Redeem${card.id}`)}
                      data-redeem-id={`redeem${card.id}`}
                    >
                      <div className="h-[150px] w-[105px] max-sm:h-[140px] max-sm:w-[110px] overflow-hidden">
                        <EditionCardMini
                          id={card.id}
                          name={card.name}
                          thumb={card.thumb}
                          tier={card.tier}
                          minted={card.minted}
                          gameDate={card.gameDate}
                          createDate={card.createDate}
                          setName={card.setName}
                          badge={card.badge}
                          badge2={card.badge2}
                          badge3={card.badge3}
                          team={card.team}
                          disableBadgeTooltips={true}
                        />
                      </div>
                    </div>
                  );
                })()}
            </div>
            <div
              className="flex w-full min-h-0 min-w-0 rounded-none bg-white overflow-hidden md:h-[154px] h-full"
              style={{ flex: "1 1 66.66%" }}
            >
              <div
                className="relative flex-1 flex flex-col items-start justify-start px-3"
                style={{ width: "100%", margin: "auto" }}
              >
                <div
                  className="text-base font-normal text-slate-700 dark:text-slate-200 text-center"
                  style={{
                    fontSize: "12px",
                    lineHeight: "18px",
                    margin: "5px auto 8px",
                  }}
                >
                  Redeem Relics from these teams to earn their newest ones
                </div>
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gridTemplateRows: "repeat(2, 1fr)",
                    width: "100%",
                    maxWidth: "100%",
                    gap: "8px",
                    height: "auto",
                    alignContent: "start",
                  }}
                >
                  {uniqueTeams.map((team) => {
                    const crest = team ? getTeamCrest(team) : null;
                    return (
                      <div
                        key={team}
                        className="flex items-center justify-center bg-white rounded-md border border-slate-200 p-1 md:w-10 md:h-10"
                        style={{
                          aspectRatio: "1",
                        }}
                      >
                        {crest ? (
                          <img
                            src={crest}
                            alt={team}
                            className="h-full w-full object-contain"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      }
      case "DROPS": {
        return <PriorDropsHomepageGrid />;
      }
      case "MARKETPLACE":
        return (
          <div
            className="mt-0 mb-[5px] flex h-full w-full min-h-0 flex-1 px-3"
            style={{ gap: "2px" }}
          >
            {marketplaceItems.length > 0 ? (
              <div
                className="flex h-full w-full min-h-0 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => navigate("/market")}
              >
                <div
                  className="relative flex-1 rounded-none bg-slate-100 overflow-hidden flex items-center"
                  style={{ border: "0.727273px none rgb(226, 232, 240)" }}
                >
                  {(() => {
                    const p = getPlaceholder("marketTopSales");
                    if (!p?.src) return null;
                    return p.mediaType === "video" ? (
                      <video
                        className="absolute inset-0 h-full w-full object-cover"
                        src={p.src}
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        className="absolute inset-0 h-full w-full object-cover"
                        src={p.src}
                        alt="marketplace"
                      />
                    );
                  })()}
                  <div
                    className="absolute inset-0 flex h-full w-full"
                    style={{
                      backgroundColor: "rgb(255, 255, 255)",
                      borderStyle: "none",
                      borderWidth: "1px",
                      borderColor: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    <div
                      className="flex flex-col items-start justify-center p-3 pointer-events-none"
                      style={{ width: "60%", margin: "0 auto" }}
                    >
                      <div
                        className="font-normal text-slate-700 dark:text-slate-200"
                        style={{
                          fontSize: "16px",
                          lineHeight: "20px",
                          margin: "0 auto 8px",
                        }}
                      >
                        {marketplaceItems[marketplaceIndex].type === "listing"
                          ? "New Listing"
                          : marketplaceItems[marketplaceIndex].type === "sale"
                            ? "Recent Sale"
                            : "Auction"}
                      </div>
                      {marketplaceItems[marketplaceIndex].type === "auction" ? (
                        <>
                          <p
                            className="font-bold break-words"
                            style={{
                              color: "#FF6300",
                              fontSize: "21px",
                              lineHeight: "32px",
                              margin: "0 auto",
                              overflowWrap: "break-word",
                              wordWrap: "break-word",
                            }}
                          >
                            {(() => {
                              const currentItem =
                                marketplaceItems[marketplaceIndex];
                              const auctionEndTs =
                                currentItem.auctionEndTs || 0;
                              const now = Math.floor(Date.now() / 1000);
                              const isActive =
                                auctionEndTs > 0 && auctionEndTs > now;

                              if (isActive) {
                                return (
                                  auctionCountdowns[marketplaceIndex] || ""
                                );
                              } else {
                                return currentItem.increaseFromAsking || "";
                              }
                            })()}
                          </p>
                          {(() => {
                            const currentItem =
                              marketplaceItems[marketplaceIndex];
                            const auctionEndTs = currentItem.auctionEndTs || 0;
                            const now = Math.floor(Date.now() / 1000);
                            const isActive =
                              auctionEndTs > 0 && auctionEndTs > now;

                            if (!isActive) {
                              return (
                                <p
                                  className="break-words text-center"
                                  style={{
                                    color: "#FF6300",
                                    fontSize: "12px",
                                    fontWeight: "400",
                                    lineHeight: "14.4px",
                                    overflowWrap: "break-word",
                                    wordWrap: "break-word",
                                    margin: "0 auto",
                                  }}
                                >
                                  from asking
                                </p>
                              );
                            }
                          })()}
                          {marketplaceItems[marketplaceIndex]
                            .auctionCreatorUsername && (
                            <p
                              className="break-words"
                              style={{
                                color: "#004000",
                                fontSize: "12px",
                                fontWeight: "400",
                                lineHeight: "14.4px",
                                overflowWrap: "break-word",
                                wordWrap: "break-word",
                                margin: "0 auto",
                              }}
                            >
                              {
                                marketplaceItems[marketplaceIndex]
                                  .auctionCreatorUsername
                              }
                            </p>
                          )}
                        </>
                      ) : (
                        <p
                          className="font-bold break-words"
                          style={{
                            color: "#FF6300",
                            fontSize: "30px",
                            fontWeight: "700",
                            lineHeight: "32px",
                            margin: "0 auto",
                            overflowWrap: "break-word",
                            wordWrap: "break-word",
                          }}
                        >
                          {marketplaceItems[marketplaceIndex].price || ""}
                        </p>
                      )}
                      {marketplaceItems[marketplaceIndex].username && (
                        <FitText
                          minFontSize={12}
                          maxFontSize={12}
                          style={{
                            color: "#000000",
                            fontWeight: "400",
                            lineHeight: "19.2px",
                            maxWidth: "100%",
                            margin: "0 auto",
                          }}
                        >
                          {marketplaceItems[marketplaceIndex].username}
                        </FitText>
                      )}
                      <div
                        style={{
                          fontWeight: "400",
                          marginBottom: "8px",
                          pointerEvents: "none",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      />
                    </div>
                    <div
                      className="flex items-center justify-center p-0 pointer-events-none"
                      style={{ width: "40%" }}
                    >
                      <div
                        className="h-full aspect-[3/4] max-w-full relative"
                        style={{ marginRight: "auto" }}
                      >
                        <div className="block h-full w-full">
                          <SerialCardMini
                            id={marketplaceItems[marketplaceIndex].id}
                            name={marketplaceItems[marketplaceIndex].name}
                            thumb={marketplaceItems[marketplaceIndex].thumb}
                            serial={
                              marketplaceItems[marketplaceIndex].serial ?? 0
                            }
                            minted={marketplaceItems[marketplaceIndex].minted}
                            gameDate={
                              marketplaceItems[marketplaceIndex].gameDate
                            }
                            createDate={
                              marketplaceItems[marketplaceIndex].createDate
                            }
                            setName={marketplaceItems[marketplaceIndex].setName}
                            badge={marketplaceItems[marketplaceIndex].badge}
                            badge2={marketplaceItems[marketplaceIndex].badge2}
                            badge3={marketplaceItems[marketplaceIndex].badge3}
                            team={marketplaceItems[marketplaceIndex].team}
                            disableBadgeTooltips={true}
                          />
                        </div>
                        <div
                          className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${marketplaceFlash ? "opacity-100" : "opacity-0"}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      case "YOUR COLLECTION": {
        const hasTrophy = selectedRelicForTrophy1 !== null;
        const hasReward = ownedRelicForReward !== null;
        const visibleCount =
          (hasTrophy ? 1 : 0) + (hasBoxContent ? 1 : 0) + (hasReward ? 1 : 0);
        const widthClass =
          visibleCount === 3
            ? "w-1/3"
            : visibleCount === 2
              ? "w-1/2"
              : visibleCount === 1
                ? "w-full"
                : null;

        if (visibleCount === 0) {
          // Check if user is logged in
          const isLoggedIn = (profile as any)?.wallet_address;

          if (!isLoggedIn) {
            // Show relic gif as content
            return (
              <div className="flex items-center justify-center w-full h-full" style={{ marginTop: "10px" }}>
                <img
                  src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F3181bbccdaef4c2aa24b59a66cca4363"
                  alt="Relic preview"
                  className="max-w-sm h-auto"
                />
              </div>
            );
          }

          return null;
        }

        return (
          <div
            className="mt-0 mb-[5px] flex h-full w-full min-h-0 flex-1 justify-center gap-0.5 tablet:gap-4 desktop:gap-0.5"
            style={{ padding: "0 6px" }}
          >
            {hasTrophy && (
              <div
                className={`flex flex-col h-full ${widthClass} overflow-hidden rounded-none`}
              >
                <div className="mx-auto mb-0 text-[10px] md:text-xs font-medium text-slate-600 dark:text-slate-300">
                  Trophy Case
                </div>
                <div
                  className="relative flex-1 mt-auto flex flex-col"
                  style={{ backgroundColor: "transparent" }}
                >
                  <img
                    src="/images/home-trophy-display.jpg"
                    alt="Home Page Trophy Display"
                    className="absolute inset-0 h-full w-full object-cover mt-auto"
                  />
                  <div
                    className="self-center border border-gray-400 overflow-hidden flex-shrink-0"
                    style={{
                      backgroundColor: "transparent",
                      width: "100px",
                      height: "130px",
                    }}
                  >
                    <TrophyDisplayCard
                      selectedRelic={selectedRelicForTrophy1}
                    />
                  </div>
                </div>
              </div>
            )}
            {hasBoxContent && (
              <div
                className={`flex flex-col h-full ${widthClass} overflow-hidden rounded-none cursor-pointer`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/collection?toggle=boxes");
                  setTimeout(() => {
                    window.scrollTo({
                      top: document.body.scrollHeight,
                      behavior: "smooth",
                    });
                  }, 100);
                }}
              >
                <div className="mx-auto mb-0 text-[10px] md:text-xs font-medium text-slate-600 dark:text-slate-300">
                  My Boxes
                </div>
                <div className="flex-1 min-h-0">
                  <HomepageBoxPlaceholder />
                </div>
              </div>
            )}
            {hasReward && (
              <div className={`flex flex-col h-full ${widthClass}`}>
                <div className="mx-auto mb-0 text-[10px] md:text-xs font-medium text-slate-600 dark:text-slate-300">
                  My Recent Relics
                </div>
                <div className="relative w-full flex-1 rounded-none border border-slate-200 bg-slate-100 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center p-0 pointer-events-none w-auto self-stretch mx-auto sm:w-auto sm:self-auto sm:mx-0">
                    <div className="h-full aspect-[3/4] max-w-full relative">
                      <div className="block h-full w-full">
                        <SerialCardMini
                          id={ownedRelicForReward.editionId}
                          name={ownedRelicForReward.name}
                          thumb={ownedRelicForReward.thumb}
                          serial={ownedRelicForReward.serial}
                          minted={ownedRelicForReward.minted}
                          gameDate={ownedRelicForReward.gameDate}
                          createDate={ownedRelicForReward.createDate}
                          setName={ownedRelicForReward.setName}
                          badge={ownedRelicForReward.badge}
                          badge2={ownedRelicForReward.badge2}
                          badge3={ownedRelicForReward.badge3}
                          team={ownedRelicForReward.team}
                          disableBadgeTooltips={true}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
      case "REWARD":
        const middleContentImage =
          "https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2Fa889eefa7eac4fe6b1a92080b21acdbb?format=webp&width=800";
        return (
          <div className="h-full w-full min-h-0 flex-1 flex px-3 py-2 gap-2">
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="text-xs md:text-sm leading-tight text-slate-800 dark:text-slate-100">
                <p>Team's fans earning the next Fan Favorite Relic...</p>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <svg
                  className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {countdownTime && airdropCloseDate ? (
                  <div
                    className="text-xs font-semibold"
                    style={{ color: "#FF6300" }}
                  >
                    {countdownTime.days}d {countdownTime.hours}h{" "}
                    {countdownTime.minutes}m {countdownTime.seconds}s
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Announcing soon
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 flex-shrink-0 bg-white dark:bg-slate-600 rounded-md flex items-center justify-center overflow-hidden">
              {fanFavoriteMinted?.team && (
                <img
                  src={
                    getTeamCrest(fanFavoriteMinted.team) || middleContentImage
                  }
                  alt={`${fanFavoriteMinted.team} crest`}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            <div className="flex-1 flex-shrink-0 overflow-hidden">
              {fanFavoriteMinted && (
                <div className="h-full aspect-[3/4] max-w-full relative">
                  <div className="block h-full w-full">
                    <EditionCardMini
                      id={fanFavoriteMinted.edition_id}
                      name={fanFavoriteMinted.name}
                      thumb={fanFavoriteMinted.thumb}
                      tier={fanFavoriteMinted.tier}
                      minted={fanFavoriteMinted.minted}
                      gameDate={fanFavoriteMinted.gameDate}
                      createDate={fanFavoriteMinted.createDate}
                      setName={fanFavoriteMinted.setName}
                      badge={fanFavoriteMinted.badge}
                      badge2={fanFavoriteMinted.badge2}
                      badge3={fanFavoriteMinted.badge3}
                      team={fanFavoriteMinted.team}
                      disableBadgeTooltips={true}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case "DATA":
        return (
          <div className="flex h-full w-full min-h-0 flex-1">
            <div className="flex w-full px-3 min-h-0 gap-[2px]">
              <div className="flex-1 min-h-0">
                <TotalSeriesSalesCard />
              </div>
              <div className="flex-1 min-h-0">
                <SeriesTeamSalesChart />
              </div>
            </div>
          </div>
        );
      case "INFO":
        return (
          <div className="mt-0 mb-[5px] grid h-full w-full min-h-0 flex-1 grid-cols-5 items-center justify-items-center gap-3 px-3">
            <Link
              to="/info"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity"
            >
              <svg
                className="h-10 w-16 text-slate-500 md:h-12 md:w-20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9 10a3 3 0 1 1 4 2c-1 .6-1.5 1-1.5 2" />
                <path d="M12 17h.01" />
              </svg>
              <div className="mt-1 text-[10px] md:text-xs text-slate-600">
                FAQ
              </div>
            </Link>
            <Link
              to="/info/blog"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity"
            >
              <svg
                className="h-10 w-16 text-slate-500 md:h-12 md:w-20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 8h10" />
                <path d="M7 12h10" />
                <path d="M7 16h6" />
              </svg>
              <div className="mt-1 text-[10px] md:text-xs text-slate-600">
                Blog
              </div>
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsComingSoonOpen(true);
              }}
              className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity border-0 bg-transparent p-0"
            >
              <svg
                className="h-10 w-16 text-slate-500 md:h-12 md:w-20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 8c3-2 11-2 14 0l1 8c-3 2-6 3-8 3s-5-1-8-3L5 8z" />
                <circle
                  cx="9"
                  cy="12"
                  r="1"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="15"
                  cy="12"
                  r="1"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
              <div className="mt-1 text-[10px] md:text-xs text-slate-600">
                Discord
              </div>
            </button>
            <div className="flex flex-col items-center opacity-50 cursor-not-allowed">
              <svg
                className="h-10 w-16 text-slate-500 md:h-12 md:w-20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4L20 20" />
                <path d="M20 4L4 20" />
              </svg>
              <div className="mt-1 text-[10px] md:text-xs text-slate-600">
                X/Twitter
              </div>
            </div>
            <Link
              to="/info"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity"
            >
              <svg
                className="h-10 w-16 text-slate-500 md:h-12 md:w-20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
              <div className="mt-1 text-[10px] md:text-xs text-slate-600">
                Contact
              </div>
            </Link>
          </div>
        );
      case "CLUBHOUSE":
        return <MyClubCard followerAddress={profile?.wallet_address} />;
      default:
        return <div className="flex h-full w-full flex-1" />;
    }
  };

  // Temporarily deactivated betaAllowlist check
  // if (betaAllowlist !== true) {
  //   return (
  //     <section className="container mx-auto px-4 py-16">
  //       <div className="w-full rounded-none bg-white p-6 text-center text-base text-black">
  //         Platform is invitation only. Log in and enter your invite code to
  //         join.
  //       </div>
  //     </section>
  //   );
  // }

  const routeMap: Record<Label, string> = {
    VOTE: "/vote",
    REDEEM: "/redeem",
    DROPS: "/prior-drops",
    MARKETPLACE: "/market",
    "YOUR COLLECTION": myCollectionPath,
    REWARD: "/reward",
    CLUBHOUSE: "/my_club",
    DATA: "/data",
    INFO: "/info",
  };

  const titleOnly = new Set<Label>([
    "VOTE",
    "REDEEM",
    "DROPS",
    "REWARD",
    "INFO",
    "CLUBHOUSE",
    "DATA",
  ]);

  return (
    <>
    <section className="container mx-auto px-2 py-0 pb-0 nightmode_cards">
      <div className="mb-1">
        <div className="relative left-1/2 right-1/2 flex w-screen max-w-[100vw] -ml-[50vw] -mr-[50vw] justify-start overflow-hidden xl:justify-center">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F77e247b78fb849549842406ebd2ef629"
            alt="Season kick off banner"
            className="block h-[150px] w-full max-w-none object-cover object-left shadow-sm md:h-[150px] xl:h-40 xl:w-[1155.2px] xl:object-center"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
      {!isLoggedIn && (
        <div className="homepage-section grid grid-cols-1 lg:grid-cols-4 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
          <div className="flex items-center justify-center">
            <div>
              <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                Get Started
              </p>
              <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                Open a box of digital sports cards
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col justify-center items-start" style={{ height: "200px" }}>
              <img
                src="/images/basicBox.webp"
                alt="Basic Box"
                className="object-cover"
                style={{ width: "300px", height: "220px", marginLeft: "auto", marginRight: "auto", objectPosition: "center" }}
              />
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div>
              <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                SELL
              </p>
              <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                Sell on the market for cash
              </p>
            </div>
          </div>
          {marketplaceItems.length > 0 && (
            <div className="flex items-center justify-center">
              <div
                className="flex h-full w-full min-h-0 min-w-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
                style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.08) 0%, rgba(0, 79, 255, 0.08) 100%)", paddingLeft: "16px", paddingRight: "16px", height: "280px" }}
              >
                <div
                  className="flex h-full w-full flex-col items-start justify-center p-3 pointer-events-none"
                  style={{ flex: 1 }}
                >
                  <div
                    className="font-normal text-slate-700 dark:text-slate-200 text-center"
                    style={{
                      fontSize: "20px",
                      lineHeight: "20px",
                      margin: "0 auto 8px",
                    }}
                  >
                    {marketplaceItems[marketplaceIndex].type === "listing"
                      ? "New Listing"
                      : marketplaceItems[marketplaceIndex].type === "sale"
                        ? "Recent Sale"
                        : "Auction"}
                  </div>
                  {marketplaceItems[marketplaceIndex].type === "auction" ? (
                    <>
                      <p
                        className="font-bold break-words text-center"
                        style={{
                          color: "#FF6300",
                          fontSize: "18px",
                          lineHeight: "24px",
                          margin: "0 auto 4px",
                          overflowWrap: "break-word",
                          wordWrap: "break-word",
                        }}
                      >
                        {(() => {
                          const currentItem = marketplaceItems[marketplaceIndex];
                          const auctionEndTs = currentItem.auctionEndTs || 0;
                          const now = Math.floor(Date.now() / 1000);
                          const isActive = auctionEndTs > 0 && auctionEndTs > now;
                          if (isActive) {
                            return auctionCountdowns[marketplaceIndex] || "";
                          } else {
                            return currentItem.increaseFromAsking || "";
                          }
                        })()}
                      </p>
                      {(() => {
                        const currentItem = marketplaceItems[marketplaceIndex];
                        const auctionEndTs = currentItem.auctionEndTs || 0;
                        const now = Math.floor(Date.now() / 1000);
                        const isActive = auctionEndTs > 0 && auctionEndTs > now;
                        if (!isActive) {
                          return (
                            <p
                              className="break-words text-center"
                              style={{
                                color: "#FF6300",
                                fontSize: "12px",
                                fontWeight: "400",
                                lineHeight: "14.4px",
                                overflowWrap: "break-word",
                                wordWrap: "break-word",
                                margin: "0 auto",
                              }}
                            >
                              from asking
                            </p>
                          );
                        }
                      })()}
                    </>
                  ) : (
                    <p
                      className="font-bold break-words text-center"
                      style={{
                        color: "#FF6300",
                        fontSize: "40px",
                        fontWeight: "700",
                        lineHeight: "40px",
                        margin: "0 auto 4px",
                        overflowWrap: "break-word",
                        wordWrap: "break-word",
                      }}
                    >
                      {marketplaceItems[marketplaceIndex].price || ""}
                    </p>
                  )}
                  {marketplaceItems[marketplaceIndex].username && (
                    <p
                      className="break-words text-center"
                      style={{
                        color: "#000000",
                        fontSize: "20px",
                        fontWeight: "300",
                        lineHeight: "20px",
                        marginLeft: "auto",
                        marginRight: "auto",
                      }}
                    >
                      {marketplaceItems[marketplaceIndex].username}
                    </p>
                  )}
                  {marketplaceItems[marketplaceIndex].auctionCreatorUsername && (
                    <p
                      className="text-xs break-words text-center"
                      style={{
                        color: "#004000",
                        fontSize: "12px",
                        fontWeight: "400",
                        lineHeight: "14.4px",
                        marginLeft: "auto",
                        marginRight: "auto",
                      }}
                    >
                      {marketplaceItems[marketplaceIndex].auctionCreatorUsername}
                    </p>
                  )}
                </div>
                <div
                  className="flex items-center justify-center p-0 pointer-events-none"
                  style={{ flex: 1 }}
                >
                  <div
                    className="aspect-[3/4] relative"
                    style={{ marginRight: "auto", width: "150px", height: "180px" }}
                  >
                    <div className="block h-full w-full">
                      <SerialCardMini
                        id={marketplaceItems[marketplaceIndex].id}
                        name={marketplaceItems[marketplaceIndex].name}
                        thumb={marketplaceItems[marketplaceIndex].thumb}
                        serial={marketplaceItems[marketplaceIndex].serial ?? 0}
                        minted={marketplaceItems[marketplaceIndex].minted}
                        gameDate={marketplaceItems[marketplaceIndex].gameDate}
                        createDate={marketplaceItems[marketplaceIndex].createDate}
                        setName={marketplaceItems[marketplaceIndex].setName}
                        badge={marketplaceItems[marketplaceIndex].badge}
                        badge2={marketplaceItems[marketplaceIndex].badge2}
                        badge3={marketplaceItems[marketplaceIndex].badge3}
                        team={marketplaceItems[marketplaceIndex].team}
                        disableBadgeTooltips={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {isLoggedIn && (
      <div className="grid grid-cols-1 gap-[5px] lg-desktop:grid-cols-3 lg-desktop:gap-[5px]">
        {labels.map((label, i) => {
          const to = routeMap[label];
          const cardIsLink = !!to;
          const CardTag: any = "div";
          const footerText =
            footerTextOverrides[label] ??
            (footerlessLabels.has(label)
              ? undefined
              : "Display your Relics, Show off, Open your Boxes");

          const displayLabel = label === "CLUBHOUSE" ? "MY CLUB" : label;
          const titleClass =
            "uppercase tracking-[0.18em] text-black dark:text-white section-title";
          const extraClasses = label === "REDEEM" ? "text-left" : "";
          const titleStyle: React.CSSProperties = {
            fontFamily: "Roboto, sans-serif",
            fontSize: "20px",
            lineHeight: "20px",
            fontWeight: 600,
            display: "block",
            color: "rgb(0, 0, 0)",
            letterSpacing: "2.52px",
            textTransform: "uppercase",
          };

          // Check if user has profile wallet address for YOUR COLLECTION card footer
          const hasProfileWalletAddress = (profile as any)?.wallet_address;
          let collectionFooterText: string | undefined;
          if (label === "YOUR COLLECTION" && !hasProfileWalletAddress) {
            collectionFooterText = "Log In on the top left to join";
          }

          let titleNode: ReactNode;
          if (cardIsLink) {
            titleNode = (
              <span
                className={`${titleClass} ${extraClasses}`}
                style={titleStyle}
              >
                {displayLabel}
              </span>
            );
          } else if (to) {
            titleNode = (
              <span
                className={`${titleClass} ${extraClasses}`}
                style={titleStyle}
              >
                {displayLabel}
              </span>
            );
          } else {
            titleNode = (
              <span
                className={`${titleClass} ${extraClasses}`}
                style={titleStyle}
              >
                {displayLabel}
              </span>
            );
          }

          const contentNode = renderCardContent(label);

          // Hide YOUR COLLECTION card entirely if there's no content and user is logged in
          if (label === "YOUR COLLECTION" && contentNode === null && hasProfileWalletAddress) {
            return null;
          }

          // Use collection footer text if set
          const effectiveFooterText = collectionFooterText || footerText;

          // Hide REDEEM card if no redeeming items are available
          if (label === "REDEEM" && redeemCards.length === 0) {
            return null;
          }

          const shouldAddNavigation = [
            "YOUR COLLECTION",
            "REWARD",
            "CLUBHOUSE",
            "DATA",
            "INFO",
            "REDEEM",
          ].includes(label);
          const cardProps =
            shouldAddNavigation && to ? { onClick: () => navigate(to) } : {};

          // Handle navigation for INFO, REDEEM and REWARD cards
          let finalCardProps = cardProps;
          if (label === "YOUR COLLECTION") {
            // Only navigate if user is logged in
            finalCardProps = isLoggedIn && to ? { onClick: () => navigate(to) } : {};
          } else if (label === "INFO" && !cardIsLink) {
            finalCardProps = { ...cardProps, onClick: () => navigate("/info") };
          } else if (label === "REDEEM" || label === "REWARD") {
            finalCardProps = {
              ...cardProps,
              onClick: () => setIsComingSoonOpen(true),
            };
          }

          return (
            <CardTag
              key={i}
              {...finalCardProps}
              className={`group relative holo-card bg-white shadow-lg ring-1 ring-black/5 transition-transform duration-300 hover:-translate-y-1 slab-depth dark:bg-slate-700 dark:ring-white/10 ${
                shouldAddNavigation ? "cursor-pointer hover:opacity-90" : ""
              }`}
              style={{ height: "220px" }}
            >
              <div className="flex h-[220px] flex-col items-stretch md:h-[220px]">
                <div className="flex items-center justify-start sm:justify-center px-2 py-1 section-header relative z-20" style={{ margin: "6px 0" }}>
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-t-lg" />
                  <div className="relative z-10">
                    {titleNode}
                  </div>
                </div>
                <div className="flex min-h-0 w-full flex-1 relative">
                  {contentNode}
                  {label === "REDEEM" && (
                    <div
                      className="absolute inset-0 z-50 cursor-pointer"
                      onClick={() => setIsComingSoonOpen(true)}
                    />
                  )}
                </div>
                {effectiveFooterText ? (
                  <div className="flex items-end justify-center px-2 py-1 relative">
                    {collectionFooterText && (
                      <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-b-lg" />
                    )}
                    <p
                      className={`overflow-hidden text-ellipsis whitespace-nowrap text-center italic dark:text-white font-light leading-4 ${collectionFooterText ? 'relative z-10' : ''} text-sm`}
                      style={{ color: "rgba(74, 74, 74, 1)" }}
                    >
                      {effectiveFooterText}
                    </p>
                  </div>
                ) : null}
              </div>
            </CardTag>
          );
        })}
      </div>
      )}
      <ComingSoonModal
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
        title="Coming Soon"
      />
    </section>
    <div className="h-px my-8" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(0, 79, 255, 0.3) 20%, rgba(255, 99, 0, 0.3) 80%, transparent 100%)" }}></div>
    {!isLoggedIn && (
      <>
        <section className="container mx-auto px-2 py-0 pb-0">
        <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
          <div className="flex items-center justify-center">
            <div>
              <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                Explore
              </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Buy cards on the market
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900" style={{ height: "280px" }}>
                <img
                  src="/images/relicGif.gif"
                  alt="Relic Card"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  Rewards
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Build your collection for weekly rewards
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  DEMAND
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  You decide the supply
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900">
                <img
                  src="/images/voteGif.gif"
                  alt="Vote Card"
                  className="w-full object-cover"
                  loading="lazy"
                  style={{ marginLeft: "auto", marginRight: "auto", height: "250px" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  CONTROL
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Vote for what releases next
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-4 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  REDEEM
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Turn in old cards to earn a team's new one
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex flex-col justify-center items-center flex-shrink-0" style={{ height: "250px" }}>
                <img
                  src="/images/teamGrid.webp"
                  alt="Team Grid"
                  className="object-scale-down"
                  loading="lazy"
                  style={{ marginLeft: "auto", marginRight: "auto", height: "300px" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  Value
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Hold to see more scarcity over time
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex items-center justify-center" style={{ height: "250px" }}>
                <img
                  src="/images/collectionValue.webp"
                  alt="Collection Value"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>
        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  Showcase
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Customize your collection page
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex items-center justify-center" style={{ height: "250px" }}>
                <img
                  src="/images/trophyCaseSplash.webp"
                  alt="Trophy Case"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  Community
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Show off, connect, and chat with fellow fans
                </p>
              </div>
            </div>
          </div>
        </section>
      </>
    )}
    {!isLoggedIn && showScrollIndicator && (
      <div
        className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none"
        style={{ padding: "0.5rem 0" }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{
            animation: "fadeInOut 3s ease-in-out infinite",
            backgroundColor: "rgba(255, 255, 255, 0.75)",
          }}
        >
          <div style={{ fontSize: "20px", fontWeight: "bold", lineHeight: "1", color: "rgba(120, 120, 120, 1)" }}>⬇</div>
          <div style={{ fontSize: "18px", fontWeight: "500", lineHeight: "1", color: "rgba(120, 120, 120, 1)" }}>Scroll for More</div>
          <div style={{ fontSize: "20px", fontWeight: "bold", lineHeight: "1", color: "rgba(120, 120, 120, 1)" }}>⬇</div>
        </div>
      </div>
    )}
    </>
  );
}

function TotalSeriesSalesCard() {
  const [totalSales, setTotalSales] = useState<number>(0);
  const [seriesName, setSeriesName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState<number>(96);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const allData = await fetchSeriesTeamSales();

        if (allData.length === 0) {
          setTotalSales(0);
          setSeriesName("");
          return;
        }

        const maxSeries = allData.reduce((max, record) => {
          return record.series_name > max ? record.series_name : max;
        }, "");

        const totalForSeries = allData
          .filter((record) => record.series_name === maxSeries)
          .reduce((sum, record) => sum + record.total_price, 0);

        setSeriesName(maxSeries);
        setTotalSales(totalForSeries);
      } catch (err) {
        console.error("[TotalSeriesSalesCard] Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;

    if (!container || !textElement) return;

    let frameId: number;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frameId);

      frameId = requestAnimationFrame(() => {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        let calculatedFontSize = 96;
        let low = 12;
        let high = 200;

        while (high - low > 1) {
          const mid = Math.floor((low + high) / 2);
          textElement.style.fontSize = `${mid}px`;

          const textWidth = textElement.scrollWidth;
          const textHeight = textElement.scrollHeight;

          const padding = 16;
          if (
            textWidth + padding < containerWidth &&
            textHeight + padding < containerHeight
          ) {
            calculatedFontSize = mid;
            low = mid;
          } else {
            high = mid;
          }
        }

        setFontSize(calculatedFontSize);
        textElement.style.fontSize = `${calculatedFontSize}px`;
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [totalSales]);

  if (loading) {
    return (
      <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center">
        <div className="text-xs text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 min-w-0 flex flex-col h-full justify-center items-center"
    >
      <div
        ref={textRef}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: "40px",
          textShadow: "1px 1px 3px rgba(155, 155, 155, 1)",
          fontWeight: "500",
          color: "rgba(74, 74, 74, 1)",
        }}
        className="whitespace-nowrap"
      >
        ${totalSales.toFixed(2)}
      </div>
      <div
        style={{ marginTop: "2px" }}
        className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        Total {seriesName} Sales
      </div>
    </div>
  );
}

function SeriesTeamSalesChart() {
  const [chartData, setChartData] = useState<
    Array<{
      team_name: string;
      total_price: number;
      crest_image?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const allData = await fetchSeriesTeamSales();
        console.log(
          "[SeriesTeamSalesChart] Fetched raw data:",
          allData,
          "count:",
          allData.length,
        );

        const topTeams = getTopTeamsByPrice(allData, 5);
        console.log("[SeriesTeamSalesChart] Top teams:", topTeams);

        const withCrests = topTeams.map((team) => ({
          team_name: team.team_name,
          total_price: team.total_price,
          crest_image: getTeamCrest(team.team_name),
        }));

        console.log(
          "[SeriesTeamSalesChart] Chart data with crests:",
          withCrests,
        );
        setChartData(withCrests);
      } catch (err) {
        console.error("[SeriesTeamSalesChart] Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center">
        <div className="text-xs text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center">
        <div className="text-xs text-slate-500">
          No team sales data available
        </div>
      </div>
    );
  }

  const maxPrice = Math.max(...chartData.map((d) => d.total_price));
  const minPrice = Math.min(...chartData.map((d) => d.total_price));
  const yAxisMax = Math.ceil(maxPrice * 1.1);

  const getBarColor = (value: number): string => {
    if (maxPrice === minPrice) return "#a1a5a8";

    const normalized = (value - minPrice) / (maxPrice - minPrice);
    const lightGrey = [209, 213, 219];
    const mediumGrey = [107, 114, 128];

    const r = Math.round(
      lightGrey[0] + (mediumGrey[0] - lightGrey[0]) * normalized,
    );
    const g = Math.round(
      lightGrey[1] + (mediumGrey[1] - lightGrey[1]) * normalized,
    );
    const b = Math.round(
      lightGrey[2] + (mediumGrey[2] - lightGrey[2]) * normalized,
    );

    return `rgb(${r}, ${g}, ${b})`;
  };

  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value, index } = props;
    const entry = chartData[index];

    if (!entry?.crest_image) return null;

    const crestSize = 24;
    const crestX = x + width / 2 - crestSize / 2;
    const crestY = y - crestSize - 4;

    return (
      <image
        x={crestX}
        y={crestY}
        width={crestSize}
        height={crestSize}
        href={entry.crest_image}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col h-full">
      <div className="w-full flex-1 min-h-0 relative p-px">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 32, right: 1, left: 1, bottom: 1 }}
          >
            <Bar
              dataKey="total_price"
              radius={[0, 0, 0, 0]}
              label={renderCustomLabel}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.total_price)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mb-1 text-[10px] md:text-xs font-medium text-slate-600 dark:text-slate-300 text-center">
        <p>Top 5 Teams</p>
      </div>
    </div>
  );
}

function renderDropsMedia(idx: number) {
  const p = dropsMediaForIndex(idx);
  if (!p?.src) return null;
  if (p.mediaType === "video") {
    return (
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={p.src}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }
  return (
    <img
      className="absolute inset-0 h-full w-full object-cover"
      src={p.src}
      alt={`drops-${idx}`}
    />
  );
}

function DropsGridPlaceholders() {
  return (
    <div className="mt-[5px] mb-[5px] flex h-full w-full min-h-0 flex-1 px-2">
      <div className="grid h-full w-full min-h-0 grid-cols-3 gap-0.5">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="flex h-full w-full flex-col items-center px-[2px]"
          >
            <div className="relative w-full flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-inner">
              {renderDropsMedia(idx)}
              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                style={{
                  fontFamily: "Roboto, sans-serif",
                  fontSize: "12px",
                  fontWeight: 300,
                  lineHeight: "20px",
                  color: "rgb(51, 65, 85)",
                }}
              >
                <div>{idx === 0 ? "Epic" : idx === 1 ? "Rare" : "Basic"}</div>
                <div>Box</div>
              </div>
              <Link
                to="/prior-drops"
                className="absolute inset-0"
                aria-label="Open Prior Drops"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ProcessedEntry = {
  nft: PriorDropNFT;
  tokenId: string;
  tier: string;
  dropWeekValue: string | null;
  dropWeekSortValue: number;
};

function DropStartOverlay({
  startTimeString,
  tier,
}: {
  startTimeString: string | null | undefined;
  tier?: string | null;
}) {
  // Parse startTime once
  const startTimeMs = (() => {
    if (!startTimeString) return 0;
    const raw = String(startTimeString ?? "").trim();
    if (!raw) return 0;

    let isoDate = raw;
    if (
      isoDate &&
      /^\d{4}-\d{2}-\d{2}/.test(isoDate) &&
      !isoDate.includes("+") &&
      !isoDate.includes("Z")
    ) {
      isoDate += "-05:00";
    }

    return new Date(isoDate).getTime();
  })();

  const countdownBreakdown = useSharedCountdownBreakdown(startTimeMs);

  // Format timeLeft based on countdown breakdown
  const timeLeft = (() => {
    if (!countdownBreakdown || startTimeMs === 0) return null;
    if (
      countdownBreakdown.days === 0 &&
      countdownBreakdown.hours === 0 &&
      countdownBreakdown.minutes === 0 &&
      countdownBreakdown.seconds === 0
    ) {
      return null;
    }

    if (countdownBreakdown.hours > 0) {
      return `${countdownBreakdown.hours}h ${countdownBreakdown.minutes}m`;
    } else if (countdownBreakdown.minutes > 0) {
      return `${countdownBreakdown.minutes}m ${countdownBreakdown.seconds}s`;
    } else {
      return `${countdownBreakdown.seconds}s`;
    }
  })();

  if (!startTimeString || startTimeMs === 0) return null;

  const isLive = startTimeMs <= Date.now();
  const tierName = tier ?? "Drop";

  if (isLive) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="text-center px-2" style={{ fontSize: "24px" }}>
          <p
            className="italic font-bold break-words leading-tight"
            style={{ color: "#FF6300" }}
          >
            {tierName} drop LIVE!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="text-center px-2">
        <p className="text-white italic font-medium break-words leading-tight text-xs md:text-sm">
          {tierName} drop in {timeLeft}
        </p>
      </div>
    </div>
  );
}

function PriorDropsHomepageGrid() {
  const { data, isLoading, isError } = useQuery<PriorDropNFT[]>({
    queryKey: [
      "prior-drops",
      PRIOR_DROPS_QUERY_PARAMS.start,
      PRIOR_DROPS_QUERY_PARAMS.count,
    ],
    queryFn: ({ signal }) =>
      fetchPriorDropNFTs({
        ...PRIOR_DROPS_QUERY_PARAMS,
        signal,
      }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const processed = useMemo(() => {
    const groups = new Map<string, ProcessedEntry[]>();
    let totalEntries = 0;

    const nfts = data ?? [];
    for (const nft of nfts) {
      const tokenId = getTokenIdString(nft.id);
      if (!tokenId) continue;

      const attrMap = buildPriorDropAttributeMap(nft.metadata?.attributes);
      const tier = attrMap.tier ?? "Uncategorized";
      const dropWeekValue = attrMap.drop_week ?? null;
      const dropWeekSortValue = computeDropWeekSortValue(dropWeekValue);

      const entry: ProcessedEntry = {
        nft,
        tokenId,
        tier,
        dropWeekValue,
        dropWeekSortValue,
      };

      const arr = groups.get(tier);
      if (arr) {
        arr.push(entry);
      } else {
        groups.set(tier, [entry]);
      }

      totalEntries += 1;
    }

    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        if (b.dropWeekSortValue !== a.dropWeekSortValue) {
          return b.dropWeekSortValue - a.dropWeekSortValue;
        }
        if (a.dropWeekValue && b.dropWeekValue) {
          const lexical = b.dropWeekValue.localeCompare(a.dropWeekValue);
          if (lexical !== 0) return lexical;
        }
        return b.tokenId.localeCompare(a.tokenId);
      });
    }

    const bestBasic = groups.get("Basic Tier")?.[0] ?? null;

    return { groups, bestBasic, totalEntries };
  }, [data]);

  if (isLoading || isError || processed.totalEntries === 0) {
    return <DropsGridPlaceholders />;
  }

  const { bestBasic, groups } = processed;
  const basicImage = bestBasic?.nft.metadata?.image ?? null;
  const resolvedBasicImage = resolveMediaUrl(basicImage) ?? basicImage;

  const nonBasicTiers = Array.from(groups.entries())
    .filter(([tierName]) => tierName !== "Basic Tier")
    .sort((a, b) => {
      // Try to sort by tier value in descending order (higher tier first)
      const aVal = a[0].toLowerCase().includes("epic") ? 1 : 0;
      const bVal = b[0].toLowerCase().includes("epic") ? 1 : 0;
      return bVal - aVal;
    });

  const getBoxAtIndex = (index: number) => {
    if (index < nonBasicTiers.length) {
      return nonBasicTiers[index]?.[1]?.[0] ?? null;
    }
    return null;
  };

  const getStartTime = (entry: ProcessedEntry | null) => {
    if (!entry?.nft.metadata?.attributes) return undefined;
    const attrMap = buildPriorDropAttributeMap(entry.nft.metadata.attributes);
    return attrMap.start_time ?? attrMap.startTime ?? attrMap.StartTime;
  };

  // Build list of valid boxes that have actual /box/{tokenId} links
  const validBoxes: Array<{
    idx: number;
    entry: ProcessedEntry | null;
    isBasic: boolean;
  }> = [];

  for (let idx = 0; idx < 3; idx++) {
    const isBasicSlot = idx === 2;
    const boxEntry = isBasicSlot ? bestBasic : getBoxAtIndex(idx);

    // Only include if it has a tokenId (actual /box/{tokenId} link, not placeholder)
    if (boxEntry?.tokenId) {
      validBoxes.push({ idx, entry: boxEntry, isBasic: isBasicSlot });
    }
  }

  // If no valid boxes, don't render the DROPS card at all
  if (validBoxes.length === 0) {
    return null;
  }

  // Determine grid columns based on count of valid boxes
  const gridColsClass =
    validBoxes.length === 1
      ? "grid-cols-1"
      : validBoxes.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className="mt-[5px] mb-[5px] flex h-full w-full min-h-0 flex-1 px-2">
      <div className={`grid h-full w-full min-h-0 ${gridColsClass} gap-0.5`}>
        {validBoxes.map(({ idx, entry: boxEntry, isBasic }) => {
          const detailLink = `/box/${boxEntry!.tokenId}`;
          const startTime = boxEntry
            ? getStartTime(boxEntry as any)
            : undefined;

          const mediaNode =
            isBasic && resolvedBasicImage ? (
              <img
                className="absolute inset-0 h-full w-full object-cover"
                src={resolvedBasicImage}
                alt={
                  bestBasic?.nft.metadata?.name
                    ? `${bestBasic.nft.metadata.name} artwork`
                    : "Prior drop"
                }
                loading="lazy"
              />
            ) : (
              renderDropsMedia(idx)
            );

          return (
            <div
              key={idx}
              className="flex h-full w-full flex-col items-center px-[2px]"
            >
              <div className="relative w-full flex-1 overflow-hidden rounded-sm border border-slate-200 bg-slate-100 shadow-inner">
                {mediaNode}
                {!isBasic && (
                  <div
                    className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                    style={{
                      fontFamily: "Roboto, sans-serif",
                      fontSize: "12px",
                      fontWeight: 300,
                      lineHeight: "20px",
                      color: "rgb(51, 65, 85)",
                    }}
                  >
                    <div>{idx === 0 ? "Epic" : "Rare"}</div>
                    <div>Box</div>
                  </div>
                )}
                <DropStartOverlay
                  startTimeString={startTime as any}
                  tier={boxEntry?.tier}
                />
                <Link
                  to={detailLink}
                  className="absolute inset-0"
                  aria-label={`Open Prior Drop ${boxEntry!.tokenId}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function computeDropWeekSortValue(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  const numeric = Number.parseFloat(value);
  if (!Number.isNaN(numeric)) return numeric;
  const digits = value.replace(/[^0-9]/g, "");
  if (digits) {
    const asInt = Number.parseInt(digits, 10);
    if (!Number.isNaN(asInt)) return asInt;
  }
  return Number.NEGATIVE_INFINITY;
}
