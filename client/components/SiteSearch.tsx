import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

export type SiteSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "header" | "bottom";
  hideTrigger?: boolean;
  triggerRef?: React.RefObject<HTMLElement> | null;
};

type Category =
  | "Votes"
  | "Redemptions"
  | "Boxes"
  | "Relics"
  | "Users"
  | "Airdrops"
  | "Collectors";

function toStringValue(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean")
    return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

export type IndexedItem = {
  table: string;
  id: string;
  fields: Record<string, string>;
  raw: Record<string, unknown>;
};

async function fetchSupabaseTable(
  baseUrl: string,
  anonKey: string,
  table: string,
  select = "*",
  limit = 500,
): Promise<any[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}`;
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
  try {
    return (await res.json()) as any[];
  } catch {
    return [];
  }
}

function buildIndex(
  rows: any[],
  table: string,
  idKeyCandidates: string[],
): IndexedItem[] {
  const excludedFields = new Set(["video_location", "FinalScore"]);
  const items: IndexedItem[] = [];
  for (const row of rows) {
    const raw = row as Record<string, unknown>;
    const idKey = idKeyCandidates.find((k) => raw[k] != null);
    const idVal = raw[idKey ?? "id"] ?? "";
    const id =
      typeof idVal === "string" ||
      typeof idVal === "number" ||
      typeof idVal === "bigint"
        ? String(idVal)
        : "";
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (excludedFields.has(k)) continue;
      const s = toStringValue(v);
      if (s && s !== "{}" && s !== "[]") {
        fields[k] = s;
      }
    }
    // Generate synthetic "name" field for RelicSerialsJoined as edition_id_serial
    if (table === "RelicSerialsJoined") {
      const edition_id = raw.edition_id;
      const serial = raw.serial;
      if (edition_id != null && serial != null) {
        fields["name"] = `${edition_id}_${serial}`;
      }
    }
    items.push({ table, id, fields, raw });
  }
  return items;
}

function getCategoryFromTable(table: string): Category | null {
  const t = table.toLowerCase();
  if (t.includes("box")) return "Boxes";
  if (t.includes("relicclaim") || t.includes("claim")) return "Relics";
  if (t.includes("minted") || t.includes("relic")) return "Relics";
  if (t === "profiles") return "Collectors";
  if (t.includes("user") || t.includes("profile") || t.includes("wallet"))
    return "Users";
  if (t.includes("airdrop")) return "Airdrops";
  if (t.includes("vote") || t.includes("proposal")) return "Votes";
  return null;
}

function pickFirstField(
  obj: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v && v !== "null" && v !== "undefined") return v;
  }
  return undefined;
}

function pickFirstRaw(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" || typeof v === "number" || typeof v === "bigint")
      return String(v);
  }
  return undefined;
}

function computeItemKey(it: IndexedItem, category: Category): string {
  const raw = it.raw;
  const byCategory: Partial<Record<Category, string[]>> = {
    Boxes: ["token_id", "id"],
    Relics: ["edition_id", "token_id", "id"],
    Redemptions: ["edition_id", "token_id", "claim_id", "id"],
    Users: ["user_id", "uid", "id", "address", "wallet", "username"],
    Collectors: ["username", "id", "wallet_address"],
    Airdrops: ["campaign_id", "id"],
    Votes: ["vote_rank", "proposal_id", "id", "slug"],
  };
  const fromRaw = pickFirstRaw(raw, byCategory[category] ?? []);
  return fromRaw ?? it.id ?? JSON.stringify(raw);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSlugValue(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function highlight(text: string, q: string): string {
  if (!q) return escapeHtml(text);
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  return escapeHtml(text).replace(re, "<strong>$1</strong>");
}

function buildSnippetAroundMatch(
  text: string,
  q: string,
  maxLen = 120,
): string {
  const lc = text.toLowerCase();
  const m = q.toLowerCase();
  const idx = lc.indexOf(m);
  if (idx < 0)
    return highlight(text.slice(0, Math.min(maxLen, text.length)), q);
  const matchLen = Math.max(1, m.length);
  let start = Math.max(0, idx - Math.floor((maxLen - matchLen) / 2));
  let end = start + maxLen;
  const minEnd = idx + matchLen;
  if (end < minEnd) {
    end = minEnd;
    start = Math.max(0, end - maxLen);
  }
  if (end > text.length) {
    end = text.length;
    start = Math.max(0, end - maxLen);
  }
  const slice = text.slice(start, end);
  const hasLeading = start > 0;
  const hasTrailing = end < text.length;
  const withDots = `${hasLeading ? "..." : ""}${slice}${hasTrailing ? "..." : ""}`;
  return highlight(withDots, q);
}

function keyEq(a: string, b: string): boolean {
  return (
    a.toLowerCase().replace(/\s|_/g, "") ===
    b.toLowerCase().replace(/\s|_/g, "")
  );
}

function computeVotePreviewHtml(
  it: IndexedItem,
  q: string,
  matchedKey: string,
  matchedText: string,
): string {
  const fields = it.fields;
  const desc =
    pickFirstField(fields, [
      "Play Description",
      "play_description",
      "PlayDescription",
      "description",
    ]) ?? "";
  const isPlayer = keyEq(matchedKey, "PlayerName");
  const isTeam = keyEq(matchedKey, "team");
  const willAppend = isPlayer || isTeam;
  const maxLen = willAppend ? 80 : 140;
  const descHtml = desc
    ? buildSnippetAroundMatch(desc, q, maxLen)
    : highlight(matchedText, q);
  if (willAppend) {
    const label = isPlayer ? "PlayerName" : "team";
    return `${descHtml} — ${label}: ${highlight(matchedText, q)}`;
  }
  return descHtml;
}

function computeHref(
  it: IndexedItem,
  category: Category,
  itemKey: string,
  match?: { key: string; value: string; q: string },
): string | undefined {
  if (category === "Boxes") {
    const tokenId = pickFirstRaw(it.raw, ["token_id", "id"]);
    if (tokenId) return `/box/${tokenId}`;
  }
  if (category === "Relics") {
    const editionCandidates = [
      "edition_id",
      "editionId",
      "edition",
      "token_id",
      "tokenId",
      "id",
    ];
    if (match && match.key.toLowerCase() === "serial") {
      const edition = pickFirstRaw(it.raw, editionCandidates);
      const serial = match.value;
      if (edition && serial)
        return `/edition/${edition}/serial/${encodeURIComponent(String(serial))}`;
    }
    const edition = pickFirstRaw(it.raw, editionCandidates);
    if (edition) return `/edition/${edition}`;
  }
  if (category === "Redemptions") {
    return undefined;
  }
  if (category === "Users") {
    return undefined;
  }
  if (category === "Collectors") {
    const username = pickFirstRaw(it.raw, ["username"]);
    if (username) return `/collection/${encodeURIComponent(String(username))}`;
    return undefined;
  }
  if (category === "Airdrops") {
    return undefined;
  }
  if (category === "Votes") {
    const rank = pickFirstRaw(it.raw, ["vote_rank", "rank", "id"]);
    if (rank != null) {
      const n = Number(rank);
      const padded =
        Number.isFinite(n) && n >= 0 && n < 100
          ? String(n).padStart(2, "0")
          : String(rank);
      return `/vote/Vote${padded}`;
    }
    return undefined;
  }
  return undefined;
}

export default function SiteSearch({
  open,
  onOpenChange,
  variant = "header",
  hideTrigger = false,
  triggerRef = null,
}: SiteSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState<IndexedItem[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const ignoreNextClickRef = useRef(false);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (index.length > 0) {
      inputRef.current?.focus();
      return;
    }
    const baseUrl = (import.meta as any).env?.SUPABASE_URL as
      | string
      | undefined;
    const anonKey = (import.meta as any).env?.SUPABASE_ANON_KEY as
      | string
      | undefined;
    if (!baseUrl || !anonKey) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const tables = [
          { name: "boxes", idKeys: ["token_id", "id"] },
          {
            name: "RelicSerialsJoined",
            idKeys: ["token_id", "id", "edition_id", "claim_id"],
          },
          { name: "Minted", idKeys: ["edition_id", "id", "token_id"] },
          { name: "minted", idKeys: ["edition_id", "id", "token_id"] },
          { name: "ActiveVotes", idKeys: ["vote_rank", "id", "slug"] },
          { name: "profiles", idKeys: ["username", "id", "wallet_address"] },
        ];
        const all: IndexedItem[] = [];
        for (const t of tables) {
          const rows = await fetchSupabaseTable(
            baseUrl,
            anonKey,
            t.name,
            "*",
            500,
          );
          if (cancelled) return;
          if (rows && rows.length) {
            all.push(...buildIndex(rows, t.name, t.idKeys));
          }
        }
        if (cancelled) return;
        setIndex(all);
      } finally {
        if (!cancelled) setLoading(false);
        inputRef.current?.focus();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  type Result = {
    category: Category;
    itemKey: string;
    html: string;
    href?: string;
    table: string;
    priority: number;
  };

  const groupedByCategory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const categoriesOrder: Category[] = [
      "Collectors",
      "Votes",
      "Redemptions",
      "Boxes",
      "Relics",
      "Users",
      "Airdrops",
    ];
    const map: Record<Category, Map<string, Result>> = {
      Collectors: new Map(),
      Votes: new Map(),
      Redemptions: new Map(),
      Boxes: new Map(),
      Relics: new Map(),
      Users: new Map(),
      Airdrops: new Map(),
    };
    if (!q) return { map, order: categoriesOrder };
    for (const item of index) {
      let matchedText: string | null = null;
      let matchedKey: string | null = null;
      const category = getCategoryFromTable(item.table);

      // For Collectors, only search in username field
      if (category === "Collectors") {
        const username = item.fields.username;
        if (username && username.toLowerCase().includes(q)) {
          matchedText = username;
          matchedKey = "username";
        }
      } else {
        // For other categories, search all fields
        for (const [key, v] of Object.entries(item.fields)) {
          if (v.toLowerCase().includes(q)) {
            matchedText = v;
            matchedKey = key;
            break;
          }
        }
      }
      if (!matchedText || !matchedKey) continue;
      if (!category) continue;
      const itemKey = computeItemKey(item, category);
      const bucket = map[category];
      const isRelics = category === "Relics";
      const isPlayerField =
        keyEq(matchedKey, "PlayerName") || keyEq(matchedKey, "player_name");
      if (isRelics && isPlayerField) {
        const playerKey = `${itemKey}#player`;
        if (!bucket.has(playerKey)) {
          const slug = normalizeSlugValue(matchedText) ?? "";
          const href = slug
            ? `/market?player=${encodeURIComponent(slug)}`
            : undefined;
          bucket.set(playerKey, {
            category,
            itemKey: playerKey,
            html: `${highlight(matchedText, q)} (Player)`,
            href,
            table: item.table,
            priority: 0,
          });
        }
      }
      let html =
        category === "Votes"
          ? computeVotePreviewHtml(item, q, matchedKey, matchedText)
          : highlight(matchedText, q);
      if (keyEq(matchedKey, "team")) {
        const gameDate = item.fields.GameDate || item.fields.game_date || item.raw.GameDate || item.raw.game_date;
        if (gameDate) {
          html = `${html} - ${gameDate}`;
        }
      }
      const href = computeHref(item, category, itemKey, {
        key: matchedKey,
        value: matchedText,
        q,
      });
      if (!bucket.has(itemKey)) {
        bucket.set(itemKey, {
          category,
          itemKey,
          html,
          href,
          table: item.table,
          priority: isRelics && isPlayerField ? 1 : 10,
        });
      }
    }
    return { map, order: categoriesOrder };
  }, [index, query]);

  const groupEntries = useMemo(() => {
    const entries: Array<[Category, Result[]]> = [];
    for (const cat of groupedByCategory.order) {
      const arr = Array.from(groupedByCategory.map[cat].values());
      if (arr.length) {
        arr.sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
        entries.push([cat, arr.slice(0, 8)]);
      }
    }
    return entries;
  }, [groupedByCategory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const t = setTimeout(() => setEntered(true), 0);
    return () => clearTimeout(t);
  }, [open]);

  const isDesktop = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    } catch {
      return false;
    }
  }, []);

  const barRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: Event) => {
      const t = e.target as Node | null;
      const insideBar = !!(barRef.current && t && barRef.current.contains(t));
      const insideResults = !!(
        resultsRef.current &&
        t &&
        resultsRef.current.contains(t)
      );
      const onTrigger = !!(
        (btnRef.current || triggerRef?.current) &&
        t &&
        (btnRef.current || triggerRef?.current)!.contains(t as Node)
      );
      if (!insideBar && !insideResults && !onTrigger) onOpenChange(false);
    };
    const onScroll = () => onOpenChange(false);

    // Track whether a touch started inside the search UI
    let touchStartedInside = false;
    const onTouchStart = (e: TouchEvent) => {
      const t = (e.target as Node) || null;
      const insideBar = !!(barRef.current && t && barRef.current.contains(t));
      const insideResults = !!(
        resultsRef.current &&
        t &&
        resultsRef.current.contains(t)
      );
      const onTrigger = !!(
        (btnRef.current || triggerRef?.current) &&
        t &&
        (btnRef.current || triggerRef?.current)!.contains(t as Node)
      );
      touchStartedInside = insideBar || insideResults || onTrigger;
      // Also support outside tap-to-close immediately
      onPointer(e as any);
    };
    const onTouchMove = () => {
      if (!touchStartedInside && variant === "bottom") onOpenChange(false);
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener(
      "touchstart",
      onTouchStart as any,
      { passive: true } as any,
    );

    const addScrollClose = variant !== "bottom";
    if (addScrollClose) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener(
        "wheel",
        onScroll as any,
        { passive: true } as any,
      );
      window.addEventListener(
        "touchmove",
        onScroll as any,
        { passive: true } as any,
      );
    } else {
      // For bottom variant, close on mobile swipe that starts outside
      window.addEventListener(
        "touchmove",
        onTouchMove as any,
        { passive: true } as any,
      );
    }

    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("touchstart", onTouchStart as any);
      if (addScrollClose) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("wheel", onScroll as any);
        window.removeEventListener("touchmove", onScroll as any);
      } else {
        window.removeEventListener("touchmove", onTouchMove as any);
      }
    };
  }, [open, onOpenChange, triggerRef, variant]);

  return (
    <div className="w-full">
      {!hideTrigger && (
        <button
          ref={btnRef}
          type="button"
          aria-label="Open search"
          onClick={(e) => {
            if (ignoreNextClickRef.current) {
              ignoreNextClickRef.current = false;
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            onOpenChange(!open);
          }}
          onMouseEnter={isDesktop ? () => onOpenChange(true) as any : undefined}
          onTouchStart={() => {
            ignoreNextClickRef.current = true;
            onOpenChange(!open);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black border border-black/20 shadow hover:bg-white/90 dark:bg-black dark:text-white dark:border-white/20"
          title="Search"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      )}
      {open && variant === "header" && (
        <div
          className={`fixed left-0 right-0 top-14 md:top-16 z-40 transform transition-all duration-200 ${entered ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
        >
          <div className="mx-auto w-full px-3" ref={barRef}>
            <div className="flex w-full items-center gap-2 rounded-md border-t border-b border-black/10 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/80">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={loading ? "Building index…" : "Search players, fellow collectors, highlight descriptions, etc..."}
                className="w-full h-12 rounded-md border border-black/20 bg-white px-3 text-sm text-slate-800 shadow focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:italic placeholder:font-extralight text-left dark:bg-black dark:text-white dark:border-white/20 dark:focus:ring-white/20"
              />
            </div>
          </div>
        </div>
      )}
      {open && variant === "header" && query.trim() && (
        <div
          ref={resultsRef}
          className="fixed left-0 right-0 top-28 md:top-32 z-30 border-t border-black/10 bg-white/95 backdrop-blur dark:bg-black/80 dark:border-white/10"
        >
          <div className="container mx-auto px-4 py-3">
            {groupEntries.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                No results
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupEntries.map(([label, items]) => (
                  <div
                    key={label}
                    className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:bg-black dark:border-white/10"
                  >
                    <div className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                      {label === "Relics" ? "Relic" : label}
                    </div>
                    <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                      {items.map((it, idx) => (
                        <li key={it.itemKey ?? idx} className="truncate">
                          {it.href ? (
                            <Link to={it.href} className="hover:underline">
                              <span
                                dangerouslySetInnerHTML={{ __html: it.html }}
                              />
                            </Link>
                          ) : (
                            <span
                              dangerouslySetInnerHTML={{ __html: it.html }}
                            />
                          )}
                          <span className="ml-1 text-[10px] text-slate-500">
                            ({it.table})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {open && variant === "bottom" && (
        <>
          <div
            className={`fixed left-0 right-0 bottom-16 z-40 transform transition-all duration-200 ${entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
            ref={(el) => {
              if (el) {
                setTimeout(() => {
                  try {
                    const h = el.getBoundingClientRect().height;
                    setBarHeight(h);
                  } catch {}
                }, 0);
              }
            }}
          >
            <div className="mx-auto w-full px-3" ref={barRef}>
              <div className="flex w-full items-center gap-2 rounded-md border-t border-b border-black/10 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/80">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={loading ? "Building index…" : "Search players, fellow collectors, highlight descriptions, etc..."}
                  className="w-full h-12 rounded-md border border-black/20 bg-white px-3 text-sm text-slate-800 shadow focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:italic placeholder:font-extralight text-left dark:bg-black dark:text-white dark:border-white/20 dark:focus:ring-white/20"
                />
              </div>
            </div>
          </div>
          {query.trim() && (
            <div
              ref={resultsRef}
              className="fixed left-0 right-0 z-30 border-t border-black/10 bg-white/95 backdrop-blur dark:bg-black/80 dark:border-white/10"
              style={{ bottom: `${64 + Math.max(0, barHeight)}px` }}
            >
              <div className="container mx-auto px-4 py-3">
                {groupEntries.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    No results
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupEntries.map(([label, items]) => (
                      <div
                        key={label}
                        className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:bg-black dark:border-white/10"
                      >
                        <div className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                          {label === "Relics" ? "Relic" : label}
                        </div>
                        <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                          {items.map((it, idx) => (
                            <li key={it.itemKey ?? idx} className="truncate">
                              {it.href ? (
                                <Link to={it.href} className="hover:underline">
                                  <span
                                    dangerouslySetInnerHTML={{
                                      __html: it.html,
                                    }}
                                  />
                                </Link>
                              ) : (
                                <span
                                  dangerouslySetInnerHTML={{ __html: it.html }}
                                />
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
