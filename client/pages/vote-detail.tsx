import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import { useActiveAccount } from "thirdweb/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import { fetchVoteByRank } from "@/lib/supabaseRest";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";

function loadMuxPlayerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector("script[data-mux-player]")) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@mux/mux-player@1/dist/mux-player.js";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-mux-player", "");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load mux-player script"));
    document.head.appendChild(s);
  });
}

interface VoteDetailPageProps {
  section: "VOTE" | "REDEEM" | "DROPS" | "EARN" | "DATA";
}

export default function VoteDetailPage({ section }: VoteDetailPageProps) {
  const navigate = useNavigate();
  const betaAllowlist = useBetaAllowlist();
  const params = useParams<{ component?: string }>();
  const voteRank = useMemo(() => {
    if (section !== "VOTE") return null;
    const comp = params.component || "";
    const m = comp.match(/(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1], 10);
  }, [params.component, section]);

  const handlePrevious = () => {
    if (voteRank === null) return;
    try {
      sessionStorage.setItem("vote_player_autoplay_unlocked", "true");
    } catch {}
    const nextRank = voteRank === 1 ? 20 : voteRank - 1;
    navigate(`/vote/Vote${String(nextRank).padStart(2, "0")}`);
  };

  const handleNext = () => {
    if (voteRank === null) return;
    try {
      sessionStorage.setItem("vote_player_autoplay_unlocked", "true");
    } catch {}
    const nextRank = voteRank === 20 ? 1 : voteRank + 1;
    navigate(`/vote/Vote${String(nextRank).padStart(2, "0")}`);
  };

  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playDescription, setPlayDescription] = useState<string>("");
  const [editionId, setEditionId] = useState<number | null>(null);
  const [loops, setLoops] = useState(0);
  const [showUnmute, setShowUnmute] = useState(true);
  const [voteStage, setVoteStage] = useState<"initial" | "confirm" | "locked">(
    "initial",
  );
  const [isVoteCheckLoading, setIsVoteCheckLoading] = useState(false);
  const [isVoteSubmitLoading, setIsVoteSubmitLoading] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [collectorPopupOpen, setCollectorPopupOpen] = useState(false);
  const [alreadyVotedThisWeek, setAlreadyVotedThisWeek] = useState(false);
  const [lastHolderCurl, setLastHolderCurl] = useState<string>("");
  const [league, setLeague] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [voteRow, setVoteRow] = useState<Record<string, any> | null>(null);
  const [hasAutoplayInteraction, setHasAutoplayInteraction] =
    useState<boolean>(false);
  const playerRef = useRef<any>(null);

  // Check for prior interaction that unlocks autoplay with sound
  useEffect(() => {
    if (section !== "VOTE") return;
    try {
      const unlocked = sessionStorage.getItem("vote_player_autoplay_unlocked");
      if (unlocked === "true") {
        setHasAutoplayInteraction(true);
        sessionStorage.removeItem("vote_player_autoplay_unlocked");
      }
    } catch {}
  }, [section, voteRank]);

  // Wallet + NFT ownership check (Polygon contracts)
  const polygonNFTContracts = useMemo(() => {
    const erc721 = (import.meta as any).env.VITE_ERC721_ADDRESS as
      | string
      | undefined;
    const erc1155 = (import.meta as any).env.VITE_ERC1155_ADDRESS as
      | string
      | undefined;
    return [
      erc721 || "0x19b20b393c10911963d82B2f032Db6f527bb4fC0",
      erc1155 || "0xdF4c403D4A9c1b4Ead5ac60A91A1E652d749e31d",
    ];
  }, []);
  const account = useActiveAccount();

  async function ethCall(to: string, data: string): Promise<string | null> {
    try {
      const res = await fetch("https://polygon-rpc.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to, data }, "latest"],
        }),
      });
      const json = await res.json();
      if (json?.error) return null;
      return typeof json?.result === "string" ? json.result : null;
    } catch {
      return null;
    }
  }

  function pad32(hexNo0x: string) {
    return hexNo0x.replace(/^0x/, "").padStart(64, "0");
  }

  async function supportsInterface(addr: string, iid: string) {
    // supportsInterface(bytes4) => 0x01ffc9a7
    const selector = "01ffc9a7";
    const data = `0x${selector}${pad32(iid.padStart(8, "0"))}`;
    const out = await ethCall(addr, data);
    if (!out) return false;
    try {
      return BigInt(out) !== 0n;
    } catch {
      return false;
    }
  }

  async function erc721Balance(addr: string, owner: string) {
    // balanceOf(address) => 0x70a08231
    const selector = "70a08231";
    const ownerNo0x = owner.replace(/^0x/, "").toLowerCase();
    const data = `0x${selector}${pad32(ownerNo0x)}`;
    const out = await ethCall(addr, data);
    if (!out) return 0n;
    try {
      return BigInt(out);
    } catch {
      return 0n;
    }
  }

  async function fetchBoxTokenIds(): Promise<bigint[]> {
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;
    if (!baseUrl || !anonKey) return [];
    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/boxes?select=token_id&order=token_id.asc&limit=5000`;
    try {
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        mode: "cors",
        cache: "no-store",
      });
      if (!res.ok) return [];
      const rows = (await res.json()) as Array<{
        token_id?: number | string | null;
      }>;
      const set = new Set<bigint>();
      for (const r of rows) {
        const v = r?.token_id;
        if (typeof v === "number" && Number.isFinite(v)) set.add(BigInt(v));
        else if (typeof v === "string" && v.trim()) {
          const n = Number(v);
          if (Number.isFinite(n)) set.add(BigInt(n));
        }
      }
      return Array.from(set);
    } catch {
      return [];
    }
  }

  async function erc1155HasAny(addr: string, owner: string, idList?: bigint[]) {
    // balanceOf(address,uint256) => 0x00fdd58e
    const selector = "00fdd58e";
    const ownerNo0x = owner.replace(/^0x/, "").toLowerCase();
    const ids =
      Array.isArray(idList) && idList.length > 0
        ? idList
        : Array.from({ length: 16 }, (_, i) => BigInt(i));
    for (const id of ids) {
      const idHex = id.toString(16);
      const data = `0x${selector}${pad32(ownerNo0x)}${pad32(idHex)}`;
      const out = await ethCall(addr, data);
      if (!out) continue;
      try {
        if (BigInt(out) > 0n) return true;
      } catch {}
    }
    return false;
  }

  async function checkHasRequiredNFTs(owner: string | undefined | null) {
    const o = owner ?? "";
    if (!o) return false;
    // Preload known ERC1155 token ids from Supabase for accurate checks
    const ids = await fetchBoxTokenIds().catch(() => []);
    for (const c of polygonNFTContracts) {
      const is721 = await supportsInterface(c, "80ac58cd");
      if (is721) {
        const bal = await erc721Balance(c, o);
        if (bal > 0n) return true;
        continue;
      }
      const is1155 = await supportsInterface(c, "d9b67a26");
      if (is1155) {
        const has = await erc1155HasAny(c, o, ids);
        if (has) return true;
      }
    }
    return false;
  }

  async function submitUserVoteByEdition(params: {
    userWalletAddress: string;
    editionId: number;
  }) {
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;
    if (!baseUrl || !anonKey)
      return { ok: false, conflict: false, row: null as any } as const;
    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/user_vote_insert_by_edition`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_edition_id: params.editionId,
          p_wallet_address: params.userWalletAddress,
        }),
        mode: "cors",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        const lower = (txt || "").toLowerCase();
        const isConflict =
          res.status === 409 ||
          lower.includes("duplicate key") ||
          lower.includes("violates unique constraint");
        return { ok: false, conflict: isConflict, row: null as any } as const;
      }
      const row = await res.json().catch(() => null);
      return { ok: true, conflict: false, row } as const;
    } catch {
      return { ok: false, conflict: false, row: null as any } as const;
    }
  }

  function maskKey(key: string): string {
    const k = key || "";
    if (k.length <= 10) return "***";
    return `${k.slice(0, 6)}…${k.slice(-4)}`;
  }

  async function alchemyIsHolderOfBox(
    wallet: string | undefined | null,
    contracts?: readonly string[],
  ): Promise<{ ok: boolean; curl: string }> {
    const addr = (wallet || "").trim();
    const contractList = contracts || polygonNFTContracts;
    const apiKey =
      (import.meta.env as any).RPC_KEY ||
      (import.meta.env as any).VITE_ALCHEMY_API_KEY ||
      "";

    if (!addr || !apiKey) {
      return { ok: false, curl: "" };
    }

    for (const contract of contractList) {
      const curl =
        apiKey && addr
          ? `curl --request GET \\ --url 'https://polygon-mainnet.g.alchemy.com/nft/v3/${maskKey(apiKey)}/isHolderOfContract?wallet=${addr}&contractAddress=${contract}' \\ --header 'accept: application/json'`
          : "";
      const url = `https://polygon-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(apiKey)}/isHolderOfContract?wallet=${encodeURIComponent(addr)}&contractAddress=${encodeURIComponent(contract)}`;
      try {
        const res = await fetch(url, {
          headers: { accept: "application/json" },
          mode: "cors",
          cache: "no-store",
        });
        if (!res.ok) continue;
        const json: any = await res.json().catch(() => null);
        const raw = json?.isHolderOfContract;
        const ok = raw === true || raw === "true" || raw === 1 || raw === "1";
        if (ok) {
          return { ok: true, curl };
        }
      } catch {
        continue;
      }
    }
    return { ok: false, curl: "" };
  }

  function toWeekOf(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    // Compute Monday (ISO week start) in UTC
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // Mon=0, Sun=6
    const monday = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    monday.setUTCDate(monday.getUTCDate() - diffToMonday);
    const y = monday.getUTCFullYear();
    const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(monday.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  async function hasVotedThisWeek(
    addr: string,
    lg: string | null,
    cd: string | null,
  ): Promise<boolean> {
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;
    if (!baseUrl || !anonKey || !addr || !lg || !cd) return false;
    const week = toWeekOf(cd);
    if (!week) return false;
    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Votes2?wallet_address=eq.${encodeURIComponent(addr)}&league=eq.${encodeURIComponent(lg)}&week_of_gamedate=eq.${encodeURIComponent(week)}&select=internal_id&limit=1`;
    try {
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        mode: "cors",
      });
      if (!res.ok) return false;
      const rows = (await res.json()) as any[];
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  const handleVoteClick = async () => {
    if (voteStage === "locked") return;
    if (voteStage === "confirm") {
      setIsVoteSubmitLoading(true);
      const addr = account?.address ?? null;
      const eid =
        editionId ??
        (typeof voteRow?.edition_id === "number" ? voteRow.edition_id : null);
      const lg =
        league ?? (typeof voteRow?.league === "string" ? voteRow.league : null);
      const cd =
        createDate ??
        (typeof voteRow?.CreateDate === "string" ? voteRow.CreateDate : null);
      if (!addr || !eid) {
        setIsVoteSubmitLoading(false);
        return;
      }
      // Pre-validate against wallet+league+week constraint
      const voted = await hasVotedThisWeek(addr, lg, cd);
      if (voted) {
        setAlreadyVotedThisWeek(true);
        setVoteStage("locked");
        setIsVoteSubmitLoading(false);
        return;
      }
      const result = await submitUserVoteByEdition({
        userWalletAddress: addr,
        editionId: eid,
      });
      if (result.ok) {
        setAlreadyVotedThisWeek(false);
        setVoteStage("locked");
      } else if (result.conflict) {
        setAlreadyVotedThisWeek(true);
        setVoteStage("locked");
      }
      setIsVoteSubmitLoading(false);
      return;
    }
    setIsVoteCheckLoading(true);
    // Try Alchemy approach first
    const alchemyResult = await alchemyIsHolderOfBox(account?.address);

    let hasNFT = alchemyResult.ok;
    let curl = alchemyResult.curl;

    // Fallback to ethCall if Alchemy didn't return a result
    if (!curl && !alchemyResult.ok) {
      hasNFT = await checkHasRequiredNFTs(account?.address);
      curl = ""; // ethCall doesn't provide curl output
    }

    setIsVoteCheckLoading(false);
    if (hasNFT) {
      setVoteStage("confirm");
      setLastHolderCurl("");
    } else {
      setLastHolderCurl(curl);
      setCollectorPopupOpen(true);
    }
  };

  async function fetchForVotesMetaByRank(rank: number, signal?: AbortSignal) {
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;
    if (!baseUrl || !anonKey || !Number.isFinite(rank)) return null as any;
    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/For_Votes?vote_rank=eq.${encodeURIComponent(String(rank))}&select=edition_id,league,PlayerName,CreateDate&limit=1`;
    try {
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
          "Accept-Profile": "cornerstone_private_schemas",
        },
        mode: "cors",
        signal,
      });
      if (!res.ok) return null as any;
      const rows = (await res.json()) as any[];
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    } catch {
      return null as any;
    }
  }

  useEffect(() => {
    if (section !== "VOTE" || !voteRank) return;
    const ctrl = new AbortController();
    setVideoError(null);
    fetchVoteByRank(voteRank, ctrl.signal)
      .then((row: any) => {
        if (!row) return;
        setVoteRow(row);
        if (row.video_location) {
          const id = String(row.video_location).trim();
          if (id.length > 0) {
            setPlaybackId(id);
            setVideoError(null);
          } else {
            setPlaybackId(null);
            setVideoError("No video available for this highlight");
          }
        }
        const pd =
          typeof row.PlayDescription === "string" && row.PlayDescription.trim()
            ? row.PlayDescription
            : typeof row.play_description === "string" &&
                row.play_description.trim()
              ? row.play_description
              : typeof row.playDescription === "string" &&
                  row.playDescription.trim()
                ? row.playDescription
                : null;
        if (pd) setPlayDescription(pd);
        const eid = Number(row.edition_id);
        if (Number.isFinite(eid)) setEditionId(eid);
        const lg = typeof row.league === "string" ? row.league : null;
        if (lg && lg.trim()) setLeague(lg);
        const pn = typeof row.PlayerName === "string" ? row.PlayerName : null;
        if (pn && pn.trim()) setPlayerName(pn);
        const cd = typeof row.CreateDate === "string" ? row.CreateDate : null;
        if (cd && cd.trim()) setCreateDate(cd);
      })
      .catch(() => {})
      .finally(() => {});
    fetchForVotesMetaByRank(voteRank, ctrl.signal)
      .then((meta) => {
        if (!meta) return;
        const eid = Number(meta?.edition_id);
        if (Number.isFinite(eid)) setEditionId(eid);
        const lg = meta?.league;
        if (typeof lg === "string" && lg.trim()) setLeague(lg);
        const pn = meta?.PlayerName;
        if (typeof pn === "string" && pn.trim()) setPlayerName(pn);
        const cd = meta?.CreateDate;
        if (typeof cd === "string" && cd.trim()) setCreateDate(cd);
      })
      .catch(() => {})
      .finally(() => {});
    return () => ctrl.abort();
  }, [section, voteRank]);

  useEffect(() => {
    if (!playbackId) return;
    loadMuxPlayerScript().catch(() => {});
  }, [playbackId]);

  useEffect(() => {
    const player = playerRef.current as any;
    if (!player) return;
    try {
      if (hasAutoplayInteraction) {
        player.volume = 0.5;
      } else {
        player.volume = 0;
      }
    } catch {}
  }, [hasAutoplayInteraction, playbackId]);

  useEffect(() => {
    setLoops(0);
    setShowUnmute(!hasAutoplayInteraction);
  }, [playbackId, hasAutoplayInteraction]);

  const splitIntoTwoLines = (text: string): [string, string] => {
    const t = (text || "").trim();
    if (!t) return ["", ""];
    const words = t.split(/\s+/);
    if (words.length === 1) {
      const mid = Math.ceil(t.length / 2);
      return [t.slice(0, mid), t.slice(mid)];
    }
    let bestA = words[0];
    let bestB = words.slice(1).join(" ");
    let bestDiff = Math.abs(bestA.length - bestB.length);
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const diff = Math.abs(a.length - b.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestA = a;
        bestB = b;
      }
    }
    return [bestA, bestB];
  };

  useEffect(() => {
    const el = playerRef.current as any | null;
    if (!el) return;
    const onEnded = () => {
      setLoops((n) => {
        const next = n + 1;
        if (next < 3) {
          try {
            el.currentTime = 0;
            el.play?.();
          } catch {}
        } else {
          try {
            el.pause?.();
          } catch {}
        }
        return next;
      });
    };
    el.addEventListener?.("ended", onEnded);
    return () => {
      el.removeEventListener?.("ended", onEnded);
    };
  }, [playbackId]);

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
  return (
    <>
      {section === "VOTE" && (
        <img
          src="/images/voteBanner.gif"
          alt="Vote banner"
          className="mx-auto rounded-md max-w-full h-auto"
        />
      )}
      <section className="container mx-auto px-4 py-6 nightmode_nocards">
        <h1 className="mb-2 md:mb-3 text-center uppercase font-sans text-[40px] leading-none text-slate-800 dark:text-white">
          {section}
        </h1>
        {section === "VOTE" && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-[9px]">
              <FilterStyleButton
                type="button"
                onClick={handleVoteClick}
                disabled={isVoteCheckLoading || isVoteSubmitLoading}
                style={{ boxShadow: "1px 1px 3px 0 rgba(74, 74, 74, 1)", borderStyle: "none" }}
                className={`w-full py-2 md:py-2.5 font-sans font-medium ${voteStage === "confirm" ? "bg-[#ff8200] text-white dark:bg-[#ff8200]" : ""} ${voteStage === "locked" ? "bg-black dark:bg-black text-white pointer-events-none cursor-default" : ""} ${voteStage !== "confirm" && voteStage !== "locked" ? "bg-[#004FFF] text-white dark:bg-[#004FFF]" : ""}`}
              >
                {isVoteSubmitLoading
                  ? "Transmitting your vote..."
                  : voteStage === "locked"
                    ? alreadyVotedThisWeek
                      ? "Vote again next week"
                      : "Vote locked"
                    : voteStage === "confirm"
                      ? "Are You Sure?"
                      : isVoteCheckLoading
                        ? "Are You Sure?"
                        : "Vote to Create"}
              </FilterStyleButton>
              <FilterStyleButton
                type="button"
                onClick={() => setIsComingSoonOpen(true)}
                style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
                className="w-full py-2 md:py-2.5 font-sans font-medium"
              >
                Share
              </FilterStyleButton>
            </div>

            <AlertDialog
              open={collectorPopupOpen}
              onOpenChange={setCollectorPopupOpen}
            >
              <AlertDialogContent>
                <AlertDialogTitle>
                  Voting is for collectors only.
                </AlertDialogTitle>
                <div className="space-y-2 text-sm">
                  <AlertDialogDescription>
                    Shop for boxes:{" "}
                    <Link to="/prior-drops" className="underline">
                      HERE
                    </Link>
                  </AlertDialogDescription>
                  <AlertDialogDescription>
                    Shop for relics from fellow fans:{" "}
                    <Link to="/market" className="underline">
                      HERE
                    </Link>
                  </AlertDialogDescription>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel asChild>
                    <button type="button">Close</button>
                  </AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {playbackId && (
              <>
                <div className="relative w-full">
                  {videoError ? (
                    <div
                      style={{ width: "100%", aspectRatio: "16 / 9" }}
                      className="flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-md"
                    >
                      <p className="text-slate-600 dark:text-slate-400">
                        {videoError}
                      </p>
                    </div>
                  ) : playbackId ? (
                    <mux-player
                      ref={playerRef as any}
                      style={{ width: "100%", aspectRatio: "16 / 9" }}
                      stream-type="on-demand"
                      playback-id={playbackId}
                      primary-color="#ff8000"
                      autoplay="any"
                      volume={hasAutoplayInteraction ? 0.5 : 0}
                      playsinline
                      onError={(e: any) => {
                        setVideoError(
                          "Video failed to load. Please try refreshing the page.",
                        );
                      }}
                    ></mux-player>
                  ) : (
                    <div
                      style={{ width: "100%", aspectRatio: "16 / 9" }}
                      className="flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-md"
                    >
                      <p className="text-slate-600 dark:text-slate-400">
                        Loading video...
                      </p>
                    </div>
                  )}
                  {!videoError &&
                    playbackId &&
                    showUnmute &&
                    !hasAutoplayInteraction && (
                      <button
                        type="button"
                        aria-label="Unmute"
                        onClick={() => {
                          const el = playerRef.current as any | null;
                          try {
                            if (el) {
                              el.muted = false;
                              el.volume = 0.5;
                              el.play?.();
                            }
                            setShowUnmute(false);
                          } catch {}
                        }}
                        className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 text-white px-2.5 py-1.5 text-[12px] shadow-md border border-white/20"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M3 10v4h4l5 5V5L7 10H3z"
                            fill="currentColor"
                          />
                          <path
                            d="M14 10.5c1.5 1.5 1.5 3.5 0 5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M16.5 8c3 3 3 7 0 10"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span>Tap for sound</span>
                      </button>
                    )}
                </div>
                {playDescription && (
                  <div className="mt-2 text-center px-2">
                    <p className="text-[12px] md:text-[13px] leading-tight text-black dark:text-white">
                      {playDescription}
                    </p>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-[8px]">
                  <FilterStyleButton
                    type="button"
                    onClick={handlePrevious}
                    style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
                    className="w-full py-2 md:py-2.5 font-sans font-medium"
                  >
                    Previous
                  </FilterStyleButton>
                  <FilterStyleButton
                    type="button"
                    onClick={handleNext}
                    style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
                    className="w-full py-2 md:py-2.5 font-sans font-medium"
                  >
                    Next
                  </FilterStyleButton>
                </div>
              </>
            )}
          </>
        )}
        <ComingSoonModal
          isOpen={isComingSoonOpen}
          onClose={() => setIsComingSoonOpen(false)}
          title="Coming Soon"
        />
        <div />
      </section>
    </>
  );
}
