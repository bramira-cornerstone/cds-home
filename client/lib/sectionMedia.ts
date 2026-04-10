import { getPlaceholder } from "@/lib/placeholders";

export type MediaItem = { src: string; mediaType: "image" | "video" } | undefined;

export function voteMediaForIndex(_i: number): MediaItem {
  const p = getPlaceholder("voteDefault");
  return p ? { src: p.src, mediaType: p.mediaType } : undefined;
}

export function redeemMediaForIndex(_i: number): MediaItem {
  const p = getPlaceholder("redeemDefault");
  return p ? { src: p.src, mediaType: p.mediaType } : undefined;
}

export function dropsMediaForIndex(i: number): MediaItem {
  const key = i === 0 ? "dropsEpic" : i === 1 ? "dropsRare" : "dropsBasic";
  const p = getPlaceholder(key);
  return p ? { src: p.src, mediaType: p.mediaType } : undefined;
}

export function earnMediaForIndex(_i: number): MediaItem {
  const p = getPlaceholder("earnDefault");
  return p ? { src: p.src, mediaType: p.mediaType } : undefined;
}
