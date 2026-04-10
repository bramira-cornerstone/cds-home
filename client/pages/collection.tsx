import { Link } from "react-router-dom";
import { useMemo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { VscAccount } from "react-icons/vsc";
import CollectionCards from "@/components/CollectionCards";
import TrophyPlaceholders, {
  type TrophySlotName,
} from "@/components/TrophyPlaceholders";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import { useBetaAllowlist, useWalletProfile } from "@/hooks/useWalletProfile";
import { useTrophyCase, type TrophySlot } from "@/hooks/useTrophyCase";
import { useToast } from "@/components/ui/use-toast";
import { updateFollowStatus, getFollowStatus } from "@/lib/followService";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";
import EditionSplineScene from "@/components/EditionSplineScene";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { UserMarketplaceStats } from "@/components/UserMarketplaceStats";
import { UserRecentEventsPills } from "@/components/UserRecentEventsPills";
import { UserFolloweeEventsPills } from "@/components/UserFolloweeEventsPills";
import { TeamSelectionModal } from "@/components/TeamSelectionModal";
import { TrophyModal } from "@/components/TrophyModal";
import { getTeamCrest } from "@/lib/teams";
import {
  fetchRelicsForWallet,
  fetchBoxesForOwnerAlchemy,
} from "@/lib/nftReads";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateRankLevel,
} from "@/lib/rmvPerOwner";
import {
  fetchTeamRMVPerOwner,
  fetchTeamRMVPerOwnerByWallet,
  findTeamRMVByWallet,
} from "@/lib/teamRmvPerOwner";
import { getEligibleDisplays } from "@/lib/trophyEligibility";
import UserTeamLeaderboardCarousel from "@/components/UserTeamLeaderboardCarousel";

export default function CollectionPage() {
  const navigate = useNavigate();
  const { profile } = useWalletProfile();
  const connectedProfile = profile as any;
  const { username } = useParams<{ username?: string }>();
  const [routeProfile, setRouteProfile] = useState<any | null>(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [refetchProfile, setRefetchProfile] = useState(0);
  const [connectedProfileOverride, setConnectedProfileOverride] = useState<
    any | null
  >(null);
  const { offers, isLoading: offersLoading } = useActiveOffers();
  const { listings, loading: listingsLoading } = useActiveListings();
  const { auctions, loading: auctionsLoading } = useActiveAuctions();
  const [rankLevel, setRankLevel] = useState<string | null>(null);
  const [rmvData, setRmvData] = useState<any | null>(null);
  const [teamRmvData, setTeamRmvData] = useState<any | null>(null);
  const [openBadgeStats, setOpenBadgeStats] = useState<"rank" | "team" | null>(
    null,
  );
  const [walletOwnsTokens, setWalletOwnsTokens] = useState<boolean | null>(
    null,
  );
  const rankBadgeRef = useRef<HTMLDivElement>(null);
  const teamBadgeRef = useRef<HTMLDivElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const usernameRef = useRef<HTMLHeadingElement>(null);
  const followButtonRef = useRef<HTMLButtonElement>(null);
  const [calculatedFontSize, setCalculatedFontSize] = useState<number>(40);

  // Close badge stats when clicking outside
  useEffect(() => {
    if (openBadgeStats === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const rankElement = rankBadgeRef.current;
      const teamElement = teamBadgeRef.current;

      let clickedOutside = true;
      if (openBadgeStats === "rank" && rankElement) {
        clickedOutside = !rankElement.contains(target);
      } else if (openBadgeStats === "team" && teamElement) {
        clickedOutside = !teamElement.contains(target);
      }

      if (clickedOutside) {
        setOpenBadgeStats(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openBadgeStats]);

  // Fetch connected user's profile data for account modal
  const baseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;
  const address = connectedProfile?.wallet_address ?? null;

  const profileQueryEnabled = useMemo(
    () => Boolean(address && baseUrl && anonKey),
    [address, baseUrl, anonKey],
  );

  const {
    data: profileQueryData,
    isLoading: profileIsLoading,
    isError: profileIsError,
    error: profileError,
  } = useQuery<{
    found: boolean;
    row: any | null;
  }>({
    queryKey: ["profile-by-wallet", address],
    enabled: profileQueryEnabled,
    queryFn: async () => {
      if (!address || !baseUrl || !anonKey) return { found: false, row: null };

      const select =
        "wallet_address,username,tos_accepted_at,email,contact_frequency,invite_code";
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=ilike.${encodeURIComponent(address)}&select=${encodeURIComponent(select)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Supabase error ${res.status}`);
      }
      const rows = (await res.json()) as any[];
      const normalizedAddress = address.toLowerCase();
      const row = Array.isArray(rows)
        ? (rows.find(
            (r) => r.wallet_address?.toLowerCase() === normalizedAddress,
          ) as any | undefined) || null
        : null;
      return { found: !!row, row };
    },
  });

  useEffect(() => {
    let aborted = false;
    async function loadByUsername(u?: string) {
      try {
        if (!u) {
          setRouteProfile(null);
          return;
        }
        const baseUrl = (import.meta as any).env.SUPABASE_URL as
          | string
          | undefined;
        const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
          | string
          | undefined;
        if (!baseUrl || !anonKey) return;

        // First, try to load by username
        let url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?username=eq.${encodeURIComponent(u)}&select=wallet_address,username,beta_allowlist,tos_accepted_at,created_at,favorite_team&limit=1`;
        let res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          if (!aborted) setRouteProfile(null);
          return;
        }
        let rows = (await res.json()) as any[];
        let row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

        // If no username match found and input looks like a wallet address, try querying by wallet_address
        if (!row && u.startsWith("0x") && u.length === 42) {
          url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=ilike.${encodeURIComponent(u)}&select=wallet_address,username,beta_allowlist,tos_accepted_at,created_at,favorite_team&limit=1`;
          res = await fetch(url, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Accept: "application/json",
            },
          });
          if (res.ok) {
            rows = (await res.json()) as any[];
            row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          }
        }

        if (!aborted) setRouteProfile(row);
      } catch {
        if (!aborted) setRouteProfile(null);
      }
    }
    loadByUsername(username);
    return () => {
      aborted = true;
    };
  }, [username, refetchProfile]);

  // Load connected user's profile on initial load and when favorite team changes
  useEffect(() => {
    if (!connectedProfile?.username) return;
    // Skip if we already have the profile with favorite_team from route load
    if (routeProfile && routeProfile.favorite_team !== undefined) return;

    let aborted = false;
    async function loadConnectedProfile() {
      try {
        const baseUrl = (import.meta as any).env.SUPABASE_URL as
          | string
          | undefined;
        const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
          | string
          | undefined;
        if (!baseUrl || !anonKey) return;

        const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?username=eq.${encodeURIComponent(connectedProfile.username)}&select=*&limit=1`;
        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });

        if (!res.ok) return;

        const rows = (await res.json()) as any[];
        const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (!aborted && row) {
          setConnectedProfileOverride(row);
        }
      } catch {
        // Silently fail
      }
    }

    loadConnectedProfile();
    return () => {
      aborted = true;
    };
  }, [refetchProfile, connectedProfile?.username, routeProfile]);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTrophyModalOpen, setIsTrophyModalOpen] = useState(false);

  const { toast } = useToast();
  const [refetchTrophy, setRefetchTrophy] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingFollowStatus, setIsLoadingFollowStatus] = useState(false);
  const [isUpdatingFollowStatus, setIsUpdatingFollowStatus] = useState(false);
  const displayProfile = (routeProfile ??
    connectedProfileOverride ??
    profile) as any;

  // Load initial follow status
  useEffect(() => {
    if (
      !connectedProfile?.wallet_address ||
      !displayProfile?.wallet_address ||
      connectedProfile.wallet_address === displayProfile.wallet_address
    ) {
      return;
    }

    const loadFollowStatus = async () => {
      setIsLoadingFollowStatus(true);
      try {
        // Wrap in timeout to prevent hanging on network issues
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            resolve(null);
          }, 5000);
        });

        const statusPromise = getFollowStatus(
          connectedProfile.wallet_address,
          displayProfile.wallet_address,
        );

        const status = await Promise.race([statusPromise, timeoutPromise]);
        setIsFollowing(status === "Follow");
      } catch (error) {
        // Default to "Follow" state if there's an error
        setIsFollowing(false);
      } finally {
        setIsLoadingFollowStatus(false);
      }
    };

    loadFollowStatus();
  }, [connectedProfile?.wallet_address, displayProfile?.wallet_address]);

  // Load rank level data
  useEffect(() => {
    if (!displayProfile?.wallet_address) {
      setRankLevel(null);
      setRmvData(null);
      return;
    }

    const loadRankLevel = async () => {
      try {
        const rmvDataResults = await fetchRMVPerOwner();
        const matchedRecord = findRMVByOwner(
          rmvDataResults,
          displayProfile.wallet_address,
        );
        const level = calculateRankLevel(matchedRecord?.Percentile);
        setRankLevel(level);
        setRmvData(matchedRecord || null);
      } catch (error) {
        setRankLevel(null);
        setRmvData(null);
      }
    };

    loadRankLevel();
  }, [displayProfile?.wallet_address]);

  // Load team RMV data
  useEffect(() => {
    // Don't clear data if favorite_team is not loaded yet (it might be loading from profile)
    if (!displayProfile?.wallet_address) {
      setTeamRmvData(null);
      return;
    }

    // Only fetch if we have a favorite team
    if (!displayProfile?.favorite_team) {
      return;
    }

    const loadTeamRmvData = async () => {
      try {
        console.debug("[collection] Loading team RMV for wallet:", displayProfile.wallet_address, "favorite_team:", displayProfile.favorite_team);
        // Use wallet-filtered fetch (much more efficient than fetching all records)
        const teamRmvResults = await fetchTeamRMVPerOwnerByWallet(displayProfile.wallet_address);
        console.debug("[collection] fetchTeamRMVPerOwnerByWallet results:", teamRmvResults);

        // Normalize team names for comparison
        const normalizeTeamName = (name: string | null | undefined) =>
          name?.toLowerCase().trim().replace(/\s+/g, " ") || "";

        const normalizedFavoriteTeam = normalizeTeamName(displayProfile.favorite_team);
        console.debug("[collection] normalizedFavoriteTeam:", normalizedFavoriteTeam);

        // Find the record that matches the favorite team (wallet is already filtered)
        const matchedRecord = teamRmvResults.find(
          (record) => {
            const teamMatch = normalizeTeamName(record.team) === normalizedFavoriteTeam;
            console.debug(`[collection] Checking record:`, {
              team: record.team,
              teamMatch,
              rmv: record.rmv,
            });
            return teamMatch;
          }
        );

        console.debug("[collection] matchedRecord:", matchedRecord);
        if (matchedRecord) {
          setTeamRmvData(matchedRecord);
        } else {
          console.warn("[collection] No matching team record found for:", displayProfile.favorite_team);
          setTeamRmvData(null);
        }
      } catch (error) {
        console.error("[collection] Error loading team RMV data:", error);
        setTeamRmvData(null);
      }
    };

    loadTeamRmvData();
  }, [displayProfile?.wallet_address, displayProfile?.favorite_team]);

  // Check if wallet owns any tokens on the ERC721 contract
  useEffect(() => {
    if (!displayProfile?.wallet_address) {
      setWalletOwnsTokens(null);
      return;
    }

    const checkTokenOwnership = async () => {
      try {
        const relics = await fetchRelicsForWallet(
          displayProfile.wallet_address,
        );
        setWalletOwnsTokens((relics?.length ?? 0) > 0);
      } catch (error) {
        setWalletOwnsTokens(false);
      }
    };

    checkTokenOwnership();
  }, [displayProfile?.wallet_address]);

  // Dynamic font sizing based on available container space
  // Placed in hooks area to maintain hook call order consistency
  useEffect(() => {
    const calculateOptimalFontSize = () => {
      if (!headerContainerRef.current || !usernameRef.current) return;

      const container = headerContainerRef.current;
      const containerWidth = container.offsetWidth;

      // Get the username text
      const username =
        displayProfile?.username &&
        String(displayProfile.username).trim().length > 0
          ? String(displayProfile.username)
          : "My Collection";

      // Measure widths of rendered right-aligned elements
      let reservedWidth = 0;

      // Account settings button or Follow button (if rendered)
      if (followButtonRef.current) {
        reservedWidth += followButtonRef.current.offsetWidth;
      }

      // Rank badge (50px if rendered)
      if (
        rankBadgeRef.current &&
        rankLevel &&
        rankLevel !== "Spectator" &&
        rankLevel !== "Beginner"
      ) {
        reservedWidth += rankBadgeRef.current.offsetWidth || 50;
      }

      // Team badge (50px if rendered for own collection)
      // Note: isOwnCollection is accessed through closure, defined later in component
      if (isOwnCollection && teamBadgeRef.current) {
        reservedWidth += teamBadgeRef.current.offsetWidth || 50;
      }

      // Add gap spacing between right-aligned elements (rank badge and team badge)
      let rightElementCount = 0;
      if (
        rankBadgeRef.current &&
        rankLevel &&
        rankLevel !== "Spectator" &&
        rankLevel !== "Beginner"
      ) {
        rightElementCount += 1;
      }
      if (isOwnCollection && teamBadgeRef.current) {
        rightElementCount += 1;
      }
      const gapCount = Math.max(0, rightElementCount - 1);
      const gapSize = containerWidth < 640 ? 1 : containerWidth < 1024 ? 4 : 8;
      reservedWidth += gapCount * gapSize;

      const availableWidth = Math.max(100, containerWidth - reservedWidth - 16);

      // Binary search for optimal font size
      let minFontSize = 12;
      let maxFontSize = 40;
      let optimalFontSize = 40;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setCalculatedFontSize(optimalFontSize);
        return;
      }

      const fontWeight = "600";
      const fontFamily = "system-ui, -apple-system, sans-serif";
      const letterSpacing = 0.03;

      const measureTextWidth = (text: string, fontSize: number): number => {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const textWidth = ctx.measureText(text).width;
        const spacingWidth =
          text.length > 0 ? (text.length - 1) * fontSize * letterSpacing : 0;
        return textWidth + spacingWidth;
      };

      while (minFontSize <= maxFontSize) {
        const midFontSize = Math.floor((minFontSize + maxFontSize) / 2);
        const textWidth = measureTextWidth(username, midFontSize);

        if (textWidth <= availableWidth) {
          optimalFontSize = midFontSize;
          minFontSize = midFontSize + 1;
        } else {
          maxFontSize = midFontSize - 1;
        }
      }

      setCalculatedFontSize(Math.max(12, optimalFontSize));
    };

    calculateOptimalFontSize();

    const resizeObserver = new ResizeObserver(() => {
      calculateOptimalFontSize();
    });

    if (headerContainerRef.current) {
      resizeObserver.observe(headerContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [displayProfile?.username, rankLevel]);

  const {
    trophyCase,
    updateTrophySlot,
    updateTrophyStyle,
    ensureEligibleTrophyStyle,
  } = useTrophyCase(displayProfile?.wallet_address, refetchTrophy);

  // Convert Supabase trophy_style (e.g., "Display 1") to internal format (e.g., "trophy_display1")
  const convertEnumToDisplay = (
    enumValue: string | null | undefined,
  ):
    | "trophy_display1"
    | "trophy_display2"
    | "trophy_display3"
    | "trophy_display4"
    | "trophy_display5" => {
    if (!enumValue) return "trophy_display1";
    const match = enumValue.match(/Display\s*(\d+)/i);
    if (match) {
      const num = match[1];
      return `trophy_display${num}` as any;
    }
    return "trophy_display1";
  };

  // Use trophy_style from Supabase, fallback to default
  const trophyDisplay = convertEnumToDisplay(
    (trophyCase as any)?.trophy_style || "Display 1",
  );

  const getMaxSlotsForDisplay = (display: typeof trophyDisplay): number => {
    switch (display) {
      case "trophy_display1":
        return 1;
      case "trophy_display2":
        return 2;
      case "trophy_display3":
        return 3;
      case "trophy_display4":
        return 4;
      case "trophy_display5":
        return 5;
      default:
        return 1;
    }
  };

  // Validate trophy ownership - CRITICAL: Only run on your own collection to prevent clearing other users' trophies
  // Also wait until owned relics have been fetched to avoid race condition clearing trophies prematurely
  useEffect(() => {
    const validateTrophyOwnership = async () => {
      if (!trophyCase?.wallet_address || !displayProfile?.wallet_address)
        return;

      // Only validate trophies if viewing your own collection
      if (displayProfile?.wallet_address !== connectedProfile?.wallet_address) {
        return;
      }

      // Skip validation until owned relics have been fetched
      // walletOwnsTokens is null while loading, true/false after loading
      if (walletOwnsTokens === null) {
        return;
      }

      const { fetchRelicOwnerByTokenId } = await import(
        "@/lib/supabaseRelicSerialsJoined"
      );

      const slots: TrophySlot[] = [
        "trophy1",
        "trophy2",
        "trophy3",
        "trophy4",
        "trophy5",
      ];

      for (const slot of slots) {
        const tokenIdKey = `${slot}_tokenId` as keyof typeof trophyCase;
        const tokenId = trophyCase[tokenIdKey];

        if (!tokenId) continue;

        try {
          const relic = await fetchRelicOwnerByTokenId(tokenId);
          const normalizedCurrentOwner =
            relic?.current_owner?.toUpperCase() ?? "";
          const normalizedWallet = displayProfile.wallet_address.toUpperCase();

          if (
            !relic?.current_owner ||
            normalizedCurrentOwner !== normalizedWallet
          ) {
            await updateTrophySlot(slot, null);
          }
        } catch (err) {
          // Error validating trophy
        }
      }
    };

    validateTrophyOwnership();
  }, [
    walletOwnsTokens,
    trophyCase?.wallet_address,
    displayProfile?.wallet_address,
    connectedProfile?.wallet_address,
    trophyCase?.trophy1_tokenId,
    trophyCase?.trophy2_tokenId,
    trophyCase?.trophy3_tokenId,
    trophyCase?.trophy4_tokenId,
    trophyCase?.trophy5_tokenId,
    updateTrophySlot,
  ]);

  // Check and downgrade trophy eligibility when rank level changes
  useEffect(() => {
    if (!displayProfile?.wallet_address || !rankLevel) return;

    // Only check eligibility on own collection page to prevent unauthorized updates
    if (displayProfile?.wallet_address !== connectedProfile?.wallet_address) return;

    const checkEligibility = async () => {
      await ensureEligibleTrophyStyle(rankLevel);
    };

    checkEligibility();
  }, [rankLevel, displayProfile?.wallet_address, connectedProfile?.wallet_address, ensureEligibleTrophyStyle]);

  const [thirdwebDebug, setThirdwebDebug] = useState<{
    boxesNfts: any;
    relicsNfts: any;
    boxesBalance: any;
    relicsBalance: any;
    errors: string[];
  }>({
    boxesNfts: null,
    relicsNfts: null,
    boxesBalance: null,
    relicsBalance: null,
    errors: [],
  });
  const [insightTxs, setInsightTxs] = useState<any | null>(null);
  const [insightQuery, setInsightQuery] = useState<any | null>(null);
  const [txItems, setTxItems] = useState<any[]>([]);

  const formatLocalTimestamp = (value: any): string => {
    if (value == null) return "—";
    let d: Date | null = null;
    if (typeof value === "number") {
      const ms = value > 1e12 ? value : value * 1000;
      d = new Date(ms);
    } else {
      const n = Number(value);
      if (Number.isFinite(n)) {
        const ms = n > 1e12 ? n : n * 1000;
        d = new Date(ms);
      } else {
        const dt = new Date(String(value));
        if (!Number.isNaN(dt.getTime())) d = dt;
      }
    }
    if (!d) return String(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const HH = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
  };
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
    };
  }, []);
  const betaAllowlist = useBetaAllowlist();

  // Extract user-owned tokenIds from thirdweb data
  const userOwnedTokenIds = useMemo(() => {
    const tokenIds = new Set<string>();

    // Extract from relics (Alchemy NFT array format)
    if (
      Array.isArray(thirdwebDebug.relicsNfts) &&
      thirdwebDebug.relicsNfts.length > 0
    ) {
      thirdwebDebug.relicsNfts.forEach((nft: any) => {
        const tokenId = nft?.tokenId || nft?.token_id;
        if (tokenId) {
          tokenIds.add(String(tokenId));
        }
      });
    }

    // Extract from boxes (Alchemy balance map format: {tokenId: balance, ...})
    if (
      thirdwebDebug.boxesBalance &&
      typeof thirdwebDebug.boxesBalance === "object" &&
      !thirdwebDebug.boxesBalance.error
    ) {
      Object.keys(thirdwebDebug.boxesBalance).forEach((tokenId: string) => {
        if (tokenId && /^\d+$/.test(tokenId)) {
          tokenIds.add(tokenId);
        }
      });
    }

    return tokenIds;
  }, [thirdwebDebug.relicsNfts, thirdwebDebug.boxesNfts]);

  useEffect(() => {
    let active = true;
    const addr = ((routeProfile ?? profile) as any)?.wallet_address as
      | string
      | undefined;
    const rpcKey = (import.meta as any).env.RPC_KEY as string | undefined;

    (async () => {
      if (!addr) {
        if (active)
          setThirdwebDebug({
            boxesNfts: null,
            relicsNfts: null,
            boxesBalance: null,
            relicsBalance: null,
            errors: ["No wallet address"],
          });
        return;
      }

      const errors: string[] = [];

      // Fetch relics from Alchemy
      let relicsNfts: any = null;
      try {
        const relics = await fetchRelicsForWallet(addr);
        relicsNfts = relics;
      } catch (e: any) {
        relicsNfts = { error: String(e?.message || e) };
        errors.push(`Relics fetch error: ${e?.message || e}`);
      }

      // Fetch boxes from Alchemy
      let boxesBalance: any = null;
      try {
        boxesBalance = await fetchBoxesForOwnerAlchemy(addr);
      } catch (e: any) {
        boxesBalance = { error: String(e?.message || e) };
        errors.push(`Boxes fetch error: ${e?.message || e}`);
      }

      if (!active) return;
      setThirdwebDebug({
        boxesNfts: null,
        relicsNfts,
        boxesBalance,
        relicsBalance: null,
        errors,
      });
    })();
    return () => {
      active = false;
    };
  }, [routeProfile, profile]);

  useEffect(() => {
    let active = true;
    const addr = ((routeProfile ?? profile) as any)?.wallet_address as
      | string
      | undefined;
    const relicContract = "0x19b20b393c10911963d82B2f032Db6f527bb4fC0";
    const boxContract = "0xdF4c403D4A9c1b4Ead5ac60A91A1E652d749e31d";
    const clientId = (import.meta as any).env.THIRDWEB_CLIENT_ID as
      | string
      | undefined;
    const secret = (import.meta as any).env.VITE_THIRDWEB_SECRET_KEY as
      | string
      | undefined;

    const buildHeaders = (preferClientId: boolean): Record<string, string> => {
      const secretTrimmed = secret && String(secret).trim();
      if (preferClientId && clientId && String(clientId).trim())
        return { "x-client-id": clientId };
      if (
        secretTrimmed &&
        secretTrimmed !== "undefined" &&
        secretTrimmed.length > 0
      )
        return { "x-secret-key": secretTrimmed };
      if (clientId && String(clientId).trim())
        return { "x-client-id": clientId };
      return {};
    };

    const fetchInsight = async (qs: URLSearchParams): Promise<any> => {
      const url = `https://137.insight.thirdweb.com/v1/transactions?${qs.toString()}`;
      // Try with client-id first (Insight often expects this), then fallback to secret
      let res: Response | null = null;
      try {
        res = await fetch(url, {
          headers: buildHeaders(true),
          mode: "cors",
          cache: "no-store",
        });
        if (!res.ok) {
          res = await fetch(url, {
            headers: buildHeaders(false),
            mode: "cors",
            cache: "no-store",
          });
        }
      } catch {
        return null;
      }
      if (!res || !res.ok) return null;
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    };

    (async () => {
      try {
        if (!addr) {
          if (active) setTxItems([]);
          return;
        }
        const secretTrimmed = secret && String(secret).trim();
        const headers =
          secretTrimmed &&
          secretTrimmed !== "undefined" &&
          secretTrimmed.length > 0
            ? { "x-secret-key": secretTrimmed }
            : clientId && String(clientId).trim()
              ? { "x-client-id": clientId }
              : {};

        const walletUrls = [
          `https://api.thirdweb.com/v1/wallets/${addr}/nft-transfers?chainId=137&limit=100&order=desc`,
          `https://api.thirdweb.com/v1/wallets/${addr}/nft-transfers?chainId=137&limit=100&sortOrder=desc`,
          `https://api.thirdweb.com/v1/wallets/${addr}/nfts/activity?chainId=137&limit=100&order=desc`,
        ];
        const contractEventUrls = [
          `https://api.thirdweb.com/v1/contracts/137/${relicContract}/events?eventName=Transfer&limit=200&order=desc`,
          `https://api.thirdweb.com/v1/contracts/137/${boxContract}/events?eventName=TransferSingle&limit=200&order=desc`,
          `https://api.thirdweb.com/v1/contracts/137/${boxContract}/events?eventName=TransferBatch&limit=200&order=desc`,
        ];
        const reqUrls = [...walletUrls, ...contractEventUrls];

        const responses = await Promise.all(
          reqUrls.map(async (u) => {
            try {
              const r = await fetch(u, {
                headers,
                mode: "cors",
                cache: "no-store",
              });
              const t = await r.text();
              try {
                return JSON.parse(t);
              } catch {
                return null;
              }
            } catch {
              return null;
            }
          }),
        );

        const lowerAddr = addr.toLowerCase();
        const flat = responses.flatMap((r: any) => {
          if (!r) return [] as any[];
          if (Array.isArray(r?.transfers)) return r.transfers as any[]; // hypothetical wallet nft-transfers
          if (Array.isArray(r?.activities)) return r.activities as any[]; // hypothetical activity
          if (Array.isArray(r?.events)) return r.events as any[];
          if (Array.isArray(r?.result?.data)) return r.result.data as any[];
          if (Array.isArray(r?.data)) return r.data as any[];
          if (Array.isArray(r)) return r as any[];
          return [] as any[];
        });

        const pick = (obj: any, ...keys: string[]): any => {
          for (const k of keys) {
            if (obj && obj[k] != null) return obj[k];
          }
          return null;
        };

        const decodeEvent = (it: any) => {
          const decoded = it?.decoded ?? it?.event ?? null;
          if (!decoded) return { name: pick(it, "name", "eventName") };
          const name =
            pick(decoded, "name", "eventName") ?? pick(it, "name", "eventName");
          const params =
            decoded?.params ?? decoded?.args ?? decoded?.parameters ?? null;
          const getParam = (keys: string[]) => {
            if (Array.isArray(params)) {
              // array of { name, type, value }
              for (const p of params) {
                const key = String(p?.name ?? "").toLowerCase();
                if (keys.some((k) => k.toLowerCase() === key))
                  return p?.value ?? p?.val ?? null;
              }
            } else if (params && typeof params === "object") {
              for (const k of keys) {
                if (params[k] != null) return params[k];
              }
            }
            return null;
          };
          const from = getParam(["from", "from_address"]);
          const to = getParam(["to", "to_address"]);
          const tokenId = getParam(["tokenId", "token_id", "id"]);
          const amount = getParam(["value", "amount", "quantity"]);
          return { name, from, to, tokenId, amount };
        };

        const items = flat
          .map((tx: any) => {
            const timestamp = pick(
              tx,
              "block_timestamp",
              "timestamp",
              "time",
              "blockTimestamp",
            );
            // prefer direct transfer shape
            const from = pick(tx, "from_address", "from", "fromAddress");
            const to = pick(tx, "to_address", "to", "toAddress");
            const tokenId = pick(tx, "token_id", "tokenId");
            const quantity = pick(tx, "quantity", "value", "amount");
            let name = pick(tx, "name", "eventName", "type");
            let value = quantity ?? tokenId;
            if (!from || !to || name == null) {
              const d = decodeEvent(tx);
              name = name ?? d.name ?? "NFT Transfer";
              value = value ?? d.amount ?? d.tokenId ?? null;
              const f2 = d.from ?? from;
              const t2 = d.to ?? to;
              return {
                from: f2,
                to: t2,
                timestamp,
                name,
                value,
                tokenId: d.tokenId ?? tokenId,
              };
            }
            return { from, to, timestamp, name, value, tokenId };
          })
          // filter to wallet involvement
          .filter((it: any) => {
            const f = String(it.from ?? "").toLowerCase();
            const t = String(it.to ?? "").toLowerCase();
            return !!(f === lowerAddr || t === lowerAddr);
          });

        // dedupe by combo of timestamp+from+to+tokenId+name
        const seen = new Set<string>();
        const deduped = items.filter((it: any) => {
          const key = [
            it.timestamp,
            it.from,
            it.to,
            it.tokenId ?? "",
            it.name ?? "",
          ]
            .map((x) => String(x ?? ""))
            .join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // sort desc by timestamp
        const toMs = (v: any): number => {
          if (v == null) return 0;
          if (typeof v === "number") return v > 1e12 ? v : v * 1000;
          const num = Number(v);
          if (Number.isFinite(num)) return num > 1e12 ? num : num * 1000;
          const ms = Date.parse(String(v));
          return Number.isFinite(ms) ? ms : 0;
        };
        deduped.sort((a: any, b: any) => toMs(b.timestamp) - toMs(a.timestamp));

        if (active) setTxItems(deduped);
      } catch (e) {
        if (active) setTxItems([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [routeProfile, profile]);

  // Temporarily deactivated betaAllowlist check
  // if (betaAllowlist !== true) {
  //   return (
  //     <section className="container mx-auto px-4 py-16">
  //       <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
  //         Platform is invitation only. Log in and enter your invite code to
  //         join.
  //       </div>
  //     </section>
  //   );
  // }
  const display1Url =
    "https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F8678673397c64988b8a2ca8e6b61d85f?format=webp&width=800";
  const display2Url =
    "https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F946cd4b73eb142f6bb44ed37ed175c6a?format=webp&width=800";
  const display3Url =
    "https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2Fa01d9289ffc94dcb8710606880d35699?format=webp&width=800";
  const display4Url =
    "https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F57ed5efd06ba4ea389eeed6d37512c16?format=webp&width=800";
  const display5LocalUrl =
    "https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2Fb4b45c407e7d44558bde360951c7c69d?format=webp&width=800";
  const display5CdnUrl =
    "https://cdn.builder.io/api/v1/image/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2Fb4b45c407e7d44558bde360951c7c69d?format=webp&width=800";
  const trophyLevel = (displayProfile as any)?.trophy_level ?? null;

  const maxSlots = getMaxSlotsForDisplay(trophyDisplay);

  const selectedRelicsBySlot: Record<
    TrophySlot,
    { editionId: number; serial: number; tokenId: number } | null
  > = {
    trophy1: trophyCase?.trophy1_editionId && trophyCase?.trophy1_serial
      ? {
          editionId: trophyCase.trophy1_editionId,
          serial: trophyCase.trophy1_serial,
          tokenId: trophyCase.trophy1_tokenId ?? 0,
        }
      : null,
    trophy2: trophyCase?.trophy2_editionId && trophyCase?.trophy2_serial
      ? {
          editionId: trophyCase.trophy2_editionId,
          serial: trophyCase.trophy2_serial,
          tokenId: trophyCase.trophy2_tokenId ?? 0,
        }
      : null,
    trophy3: trophyCase?.trophy3_editionId && trophyCase?.trophy3_serial
      ? {
          editionId: trophyCase.trophy3_editionId,
          serial: trophyCase.trophy3_serial,
          tokenId: trophyCase.trophy3_tokenId ?? 0,
        }
      : null,
    trophy4: trophyCase?.trophy4_editionId && trophyCase?.trophy4_serial
      ? {
          editionId: trophyCase.trophy4_editionId,
          serial: trophyCase.trophy4_serial,
          tokenId: trophyCase.trophy4_tokenId ?? 0,
        }
      : null,
    trophy5: trophyCase?.trophy5_editionId && trophyCase?.trophy5_serial
      ? {
          editionId: trophyCase.trophy5_editionId,
          serial: trophyCase.trophy5_serial,
          tokenId: trophyCase.trophy5_tokenId ?? 0,
        }
      : null,
  };

  const connectedUsername = ((profile as any)?.username || "").trim();
  const pageUsername = ((displayProfile as any)?.username || "").trim();
  const isOwnCollection = Boolean(
    connectedUsername &&
      pageUsername &&
      connectedUsername.toLowerCase() === pageUsername.toLowerCase(),
  );
  const showFollow = Boolean(
    connectedUsername &&
      pageUsername &&
      connectedUsername.toLowerCase() !== pageUsername.toLowerCase(),
  );
  const defaultBasedOnLevel =
    typeof trophyLevel === "string" && trophyLevel.trim().length > 0
      ? "trophy_display1"
      : "trophy_display1";
  const selectedDisplay =
    trophyDisplay ||
    (defaultBasedOnLevel as
      | "trophy_display1"
      | "trophy_display2"
      | "trophy_display3"
      | "trophy_display4"
      | "trophy_display5");
  const trophyUrl =
    selectedDisplay === "trophy_display5"
      ? display5LocalUrl
      : selectedDisplay === "trophy_display4"
        ? display4Url
        : selectedDisplay === "trophy_display3"
          ? display3Url
          : selectedDisplay === "trophy_display2"
            ? display2Url
            : display1Url;

  return (
    <section className="container mx-auto px-4 space-y-6 nightmode_cards collection-header-section">
      {!username && (
        <div className="w-full mb-4">
          <img
            src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F2d07d3272a62489dbeb4dcbe797aebd1"
            alt="Collection banner"
            className="w-full h-auto object-cover rounded-md"
          />
        </div>
      )}
      <div className="w-full mt-0">
        <div
          ref={headerContainerRef}
          className="flex items-center collection-header-title-row min-w-0 gap-px sm:gap-1 lg:gap-2"
          style={{ height: "50px" }}
        >
          <h1
            ref={usernameRef}
            className="text-left font-semibold tracking-wide text-slate-800 dark:text-white"
            style={{
              fontSize: `${calculatedFontSize}px`,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}
          >
            {displayProfile?.username &&
            String(displayProfile.username).trim().length > 0
              ? String(displayProfile.username)
              : "My Collection"}
          </h1>
          {isOwnCollection ? (
            <button
              ref={followButtonRef}
              onClick={() => navigate("/account")}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Open account settings"
              title="Account settings"
            >
              <VscAccount className="w-5 h-5" />
            </button>
          ) : showFollow ? (
            <FilterStyleButton
              ref={followButtonRef}
              type="button"
              className="flex-shrink-0 px-2 py-1 text-[11px]"
              aria-label={
                isFollowing
                  ? "Unfollow this collector"
                  : "Follow this collector"
              }
              disabled={isUpdatingFollowStatus}
              onClick={async () => {
                if (
                  !connectedProfile?.wallet_address ||
                  !displayProfile?.wallet_address
                ) {
                  toast({
                    title: "Error",
                    description: "Unable to determine wallet addresses",
                    variant: "destructive",
                  });
                  return;
                }

                setIsUpdatingFollowStatus(true);
                const newStatus = isFollowing ? "Unfollow" : "Follow";

                try {
                  const result = await updateFollowStatus(
                    connectedProfile.wallet_address,
                    displayProfile.wallet_address,
                    newStatus as "Follow" | "Unfollow",
                  );

                  if (result.success) {
                    setIsFollowing(newStatus === "Follow");
                    toast({
                      title: "Success",
                      description: `${newStatus === "Follow" ? "Now following" : "Unfollowed"} ${displayProfile.display_name || displayProfile.username || "this collector"}`,
                    });
                  } else {
                    toast({
                      title: "Error",
                      description:
                        result.error || "Failed to update follow status",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description:
                      "Failed to update follow status. Please check your connection and try again.",
                    variant: "destructive",
                  });
                } finally {
                  setIsUpdatingFollowStatus(false);
                }
              }}
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </FilterStyleButton>
          ) : null}
          <div className="flex-1" />
          {rankLevel &&
          rankLevel !== "Spectator" &&
          rankLevel !== "Beginner" ? (
            <div
              ref={rankBadgeRef}
              className="flex-shrink-0 relative inline-flex items-start focus:outline-none"
              style={{
                backgroundColor: "rgba(255, 255, 255, 1)",
                borderRadius: "6px",
                overflow: "visible",
                boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
                marginBottom: "auto",
                height: "67px",
              }}
            >
              {rmvData && (
                <div
                  className="badge-stats-panel absolute flex items-center transition-all duration-200 ease-out"
                  style={{
                    maxWidth: openBadgeStats === "rank" ? "180px" : "0px",
                    opacity: openBadgeStats === "rank" ? 1 : 0,
                    padding: openBadgeStats === "rank" ? "0 8px" : "0",
                    pointerEvents: openBadgeStats === "rank" ? "auto" : "none",
                    backgroundColor: "rgba(255, 255, 255, 1)",
                    right: "100%",
                    top: "50%",
                    transform:
                      openBadgeStats === "rank"
                        ? "translateY(-50%)"
                        : "translateY(-50%) translateX(-8px)",
                    zIndex: 10,
                    overflow: "hidden",
                    borderRadius: "6px 0 0 6px",
                    height: "100%",
                    boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
                  }}
                >
                  <div
                    className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    style={{
                      lineHeight: "12px",
                      marginLeft: "auto",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ marginLeft: "auto" }}>
                      {String(rmvData.total_rolling_median_sale).substring(
                        0,
                        8,
                      )}{" "}
                      total RMV held
                    </div>
                    <div style={{ margin: "4px 0 0 auto" }}>
                      #{rmvData.league_rank} ranked, better than{" "}
                      {Number(rmvData.Percentile || 0) * 100 > 100
                        ? "100"
                        : Math.round(Number(rmvData.Percentile || 0) * 100)}
                      %
                    </div>
                    <div style={{ margin: "4px 0 0 auto" }}>
                      {rankLevel === "Diamond"
                        ? "All drop allowlist access"
                        : ["Epic", "Rare", "Basic"].includes(rankLevel)
                          ? `${rankLevel} drop allowlist access`
                          : "Public drop access"}
                    </div>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  setOpenBadgeStats(openBadgeStats === "rank" ? null : "rank")
                }
                className="relative flex flex-col items-center justify-start rounded-lg border border-slate-300 dark:border-slate-600 hover:opacity-80 transition-opacity"
                title="View collector stats"
                aria-label="View collector stats"
                style={{ width: "50px", minHeight: "50px", backgroundColor: "rgba(0, 0, 0, 0)" }}
              >
                <img
                  src={
                    rankLevel === "Diamond"
                      ? "/images/diamondbadge.png"
                      : rankLevel === "Epic"
                        ? "/images/epicbadge.png"
                        : rankLevel === "Rare"
                          ? "/images/rarebadge.png"
                          : rankLevel === "Basic"
                            ? "/images/basicbadge.png"
                            : ""
                  }
                  alt={`${rankLevel} rank badge`}
                  className="w-full object-contain p-0 badge-mobile-shadow"
                  style={{
                    width: "50px",
                    height: "50px",
                    padding: "4px",
                    backgroundColor: "rgba(255, 255, 255, 1)",
                    borderRadius: "6px",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderBottomLeftRadius: "6px",
                    borderBottomRightRadius: "6px",
                    borderColor: "rgb(203, 213, 225)",
                    borderTopWidth: "0.8px",
                    borderWidth: "0.8px 0px 0px",
                    boxShadow: "rgb(155, 155, 155) 1px 1px 3px 0px",
                    fontSize: "10px",
                    fontWeight: "400",
                    height: "16px",
                    justifyContent: "center",
                    lineHeight: "16px",
                    textAlign: "center",
                    width: "100%",
                  }}
                >
                  {rmvData?.total_rolling_median_sale ? Math.round(Number(rmvData.total_rolling_median_sale)) : 0}
                </div>
              </button>
            </div>
          ) : null}
          {isOwnCollection ? (
            <div
              className="flex-shrink-0 relative inline-flex items-start focus:outline-none"
              style={{
                backgroundColor: "rgba(255, 255, 255, 1)",
                borderRadius: "6px",
                overflow: "visible",
                boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
                marginBottom: "auto",
              }}
            >
              <button
                onClick={() => setIsTeamModalOpen(true)}
                className="relative flex flex-col items-center justify-start rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 hover:opacity-80 transition-opacity set-favorite-team-button group"
                title="Set your favorite team"
                style={{ width: "50px", minHeight: "50px" }}
              >
                {displayProfile?.favorite_team ? (
                  <>
                    <img
                      src={
                        getTeamCrest(displayProfile.favorite_team) ||
                        "/images/teams/wfl_crest.png"
                      }
                      alt={displayProfile.favorite_team || "Team"}
                      className="w-full object-contain p-0 badge-mobile-shadow"
                      style={{
                        width: "50px",
                        height: "50px",
                        padding: "4px",
                        backgroundColor: "rgba(255, 255, 255, 1)",
                        borderRadius: "6px",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    />
                    <div className="absolute opacity-0 group-hover:opacity-100 bg-slate-800 dark:bg-white text-white dark:text-slate-800 px-2 py-1 rounded text-[8px] whitespace-nowrap pointer-events-none transition-opacity">
                      Change
                    </div>
                    <div
                      className="w-full rounded-b-md bg-slate-100 dark:bg-slate-700 border-t border-slate-300 dark:border-slate-600 text-center badge-mobile-shadow"
                      style={{
                        fontSize: "10px",
                        fontWeight: "500",
                        color: "rgb(71, 85, 105)",
                        backgroundColor: "rgba(255, 255, 255, 1)",
                        padding: "0 2px",
                        minHeight: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {teamRmvData?.rmv
                        ? String(teamRmvData.rmv).substring(0, 8)
                        : "0"}
                    </div>
                  </>
                ) : (
                  <span className="px-2 py-1">Set Favorite Team</span>
                )}
              </button>
            </div>
          ) : displayProfile?.favorite_team ? (
            <div
              ref={teamBadgeRef}
              className="flex-shrink-0 relative inline-flex items-start focus:outline-none"
              style={{
                backgroundColor: "rgba(255, 255, 255, 1)",
                borderRadius: "6px",
                overflow: "visible",
                boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
                marginBottom: "auto",
              }}
            >
              {teamRmvData && (
                <div
                  className="badge-stats-panel absolute flex items-center transition-all duration-200 ease-out"
                  style={{
                    maxWidth: openBadgeStats === "team" ? "180px" : "0px",
                    opacity: openBadgeStats === "team" ? 1 : 0,
                    padding: openBadgeStats === "team" ? "0 8px" : "0",
                    pointerEvents: openBadgeStats === "team" ? "auto" : "none",
                    backgroundColor: "rgba(255, 255, 255, 1)",
                    right: "100%",
                    top: "34px",
                    transform:
                      openBadgeStats === "team"
                        ? "translateY(-50%)"
                        : "translateY(-50%) translateX(-8px)",
                    zIndex: 10,
                    overflow: "hidden",
                    borderRadius: "6px 0 0 6px",
                    height: "100%",
                    boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
                  }}
                >
                  <div
                    className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    style={{
                      lineHeight: "12px",
                      marginLeft: "auto",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ marginLeft: "auto" }}>
                      {String(teamRmvData.rmv).substring(0, 8)} held in {displayProfile.favorite_team}
                    </div>
                    <div style={{ margin: "4px 0 0 auto" }}>
                      #{teamRmvData.team_rank} ranked collection
                    </div>
                    <div style={{ margin: "4px 0 0 auto" }}>
                      Better than{" "}
                      {(() => {
                        const percentile = Number(teamRmvData.percentile || 0);
                        const percentage = percentile > 1 ? 100 : Math.round(percentile * 100);
                        return `${percentage}`;
                      })()}
                      % of collectors
                    </div>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  setOpenBadgeStats(openBadgeStats === "team" ? null : "team")
                }
                className="relative flex flex-col items-center justify-start rounded-lg border border-slate-300 bg-slate-100 dark:bg-slate-700 dark:border-slate-600 hover:opacity-80 transition-opacity"
                title="View collector stats"
                aria-label="View collector stats"
                style={{ width: "50px", minHeight: "50px" }}
              >
                <img
                  src={
                    getTeamCrest(displayProfile.favorite_team) ||
                    "/images/teams/wfl_crest.png"
                  }
                  alt={displayProfile.favorite_team || "Team"}
                  className="w-full object-contain p-0 badge-mobile-shadow"
                  style={{
                    width: "50px",
                    height: "50px",
                    padding: "4px",
                    backgroundColor: "rgba(255, 255, 255, 1)",
                    borderRadius: "6px",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                />
                <div
                  className="w-full rounded-b-md bg-slate-100 dark:bg-slate-700 border-t border-slate-300 dark:border-slate-600 text-center badge-mobile-shadow"
                  style={{
                    fontSize: "10px",
                    fontWeight: "500",
                    color: "rgb(71, 85, 105)",
                    backgroundColor: "rgba(255, 255, 255, 1)",
                    padding: "0 2px",
                    minHeight: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {teamRmvData?.rmv
                    ? String(teamRmvData.rmv).substring(0, 8)
                    : "0"}
                </div>
              </button>
            </div>
          ) : null}
        </div>
        {(displayProfile?.created_at ?? null) ? (
          <div className="text-left text-xs text-slate-600 dark:text-white/80 m-0 p-0 leading-5">
            Collector since: {String(displayProfile.created_at).slice(0, 10)}
          </div>
        ) : null}
      </div>
      <div className="w-full flex flex-col lg:flex-row gap-4 items-stretch collection-trophy-wrapper">
        <div
          className="trophy_style relative w-full lg:w-1/2"
          style={{ margin: "0 6px" }}
        >
          <img
            src={trophyUrl}
            alt="Trophy style"
            className="w-full h-auto object-contain select-none"
            loading="lazy"
            data-fallback={
              selectedDisplay === "trophy_display5" ? display5CdnUrl : undefined
            }
            onError={(e) => {
              const fb = (
                e.currentTarget.getAttribute("data-fallback") || ""
              ).trim();
              if (fb && e.currentTarget.src !== fb) {
                e.currentTarget.src = fb;
              }
            }}
          />
          <TrophyPlaceholders
            display={selectedDisplay}
            isEditMode={false}
            selectedSlot={null}
            onSlotClick={undefined}
            selectedRelicsBySlot={selectedRelicsBySlot}
          />
          {isOwnCollection && (
            <div
              ref={dropdownRef}
              className="absolute bottom-2 left-2 text-white z-20"
            >
              <div
                role="button"
                aria-expanded={isDropdownOpen}
                tabIndex={0}
                onClick={() => setIsDropdownOpen((o) => !o)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsDropdownOpen((o) => !o);
                  }
                }}
                className="flex items-center justify-between gap-2 rounded-md bg-black/25 px-3 py-2 text-xs backdrop-blur-sm cursor-pointer select-none"
              >
                <span className="text-[11px] opacity-90">Trophy style</span>
                <span className="inline-block transform rotate-90 opacity-90">
                  {">"}
                </span>
              </div>
              {isDropdownOpen && (
                <ul className="absolute bottom-full left-0 mb-2 w-44 rounded-md bg-black/25 p-1 text-xs backdrop-blur-sm z-30">
                  {getEligibleDisplays(rankLevel).includes("trophy_display1") && (
                    <li>
                      <button
                        className={`w-full text-left px-2 py-1 rounded hover:bg-white/10 ${selectedDisplay === "trophy_display1" ? "bg-white/10" : ""}`}
                        onClick={() => {
                          updateTrophyStyle("trophy_display1");
                          setIsDropdownOpen(false);
                        }}
                      >
                        Display 1
                      </button>
                    </li>
                  )}
                  {getEligibleDisplays(rankLevel).includes("trophy_display2") && (
                    <li>
                      <button
                        className={`w-full text-left px-2 py-1 rounded hover:bg-white/10 ${selectedDisplay === "trophy_display2" ? "bg-white/10" : ""}`}
                        onClick={() => {
                          updateTrophyStyle("trophy_display2");
                          setIsDropdownOpen(false);
                        }}
                      >
                        Display 2
                      </button>
                    </li>
                  )}
                  {getEligibleDisplays(rankLevel).includes("trophy_display3") && (
                    <li>
                      <button
                        className={`w-full text-left px-2 py-1 rounded hover:bg-white/10 ${selectedDisplay === "trophy_display3" ? "bg-white/10" : ""}`}
                        onClick={() => {
                          updateTrophyStyle("trophy_display3");
                          setIsDropdownOpen(false);
                        }}
                      >
                        Display 3
                      </button>
                    </li>
                  )}
                  {getEligibleDisplays(rankLevel).includes("trophy_display4") && (
                    <li>
                      <button
                        className={`w-full text-left px-2 py-1 rounded hover:bg-white/10 ${selectedDisplay === "trophy_display4" ? "bg-white/10" : ""}`}
                        onClick={() => {
                          updateTrophyStyle("trophy_display4");
                          setIsDropdownOpen(false);
                        }}
                      >
                        Display 4
                      </button>
                    </li>
                  )}
                  {getEligibleDisplays(rankLevel).includes("trophy_display5") && (
                    <li>
                      <button
                        className={`w-full text-left px-2 py-1 rounded hover:bg-white/10 ${selectedDisplay === "trophy_display5" ? "bg-white/10" : ""}`}
                        onClick={() => {
                          updateTrophyStyle("trophy_display5");
                          setIsDropdownOpen(false);
                        }}
                      >
                        Display 5
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
          {isOwnCollection && (
            <button
              type="button"
              onClick={() => setIsTrophyModalOpen(true)}
              className="absolute bottom-2 right-2 rounded-md bg-black/25 px-3 py-2 text-white backdrop-blur-sm select-none z-20 hover:bg-black/40 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="opacity-90">Choose Relics</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="opacity-90"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </div>
            </button>
          )}
        </div>
        <div className="w-full lg:w-1/2 flex flex-col gap-2 mt-3 lg:mt-0 collection-events-wrapper">
          <div
            className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow recent-events-card"
            style={{
              boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
              padding: "4px 12px 8px",
              margin: "0 6px",
            }}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Recent Events
            </p>
            <div className="flex-1 min-h-0">
              <UserRecentEventsPills
                walletAddress={displayProfile?.wallet_address}
              />
            </div>
          </div>
          {isOwnCollection && (
            <div
              className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow recent-events-card"
              style={{
                boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
                padding: "4px 12px 8px",
                margin: "8px 6px 0",
              }}
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Friend Events
              </p>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <UserFolloweeEventsPills
                  walletAddress={displayProfile?.wallet_address}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {!offersLoading && !listingsLoading && !auctionsLoading && (
        <UserMarketplaceStats
          offers={offers}
          listings={listings}
          auctions={auctions}
          userTokenIds={userOwnedTokenIds}
          walletAddress={displayProfile?.wallet_address}
        />
      )}
      {walletOwnsTokens && (
        <UserTeamLeaderboardCarousel
          walletAddress={displayProfile?.wallet_address}
        />
      )}
      <div className="collection-cards-wrapper" style={{ marginTop: "24px" }}>
        <CollectionCards
          ownerWallet={displayProfile?.wallet_address ?? null}
          isOwnCollection={isOwnCollection}
          thirdwebDebug={thirdwebDebug}
          isSelectionMode={false}
          isTrophyCaseFull={false}
          selectedRelicsOrder={[]}
        />
      </div>
      <TeamSelectionModal
        open={isTeamModalOpen}
        onOpenChange={setIsTeamModalOpen}
        walletAddress={connectedProfile?.wallet_address}
        onTeamSelected={(team) => {
          setRefetchProfile((prev) => prev + 1);
        }}
      />
      <TrophyModal
        open={isTrophyModalOpen}
        onOpenChange={setIsTrophyModalOpen}
        maxSlots={maxSlots}
        ownerWallet={displayProfile?.wallet_address ?? null}
        connectedProfile={connectedProfile}
        trophyCase={trophyCase}
        onSaveSuccess={() => {
          setRefetchTrophy((prev) => prev + 1);
        }}
      />
    </section>
  );
}
