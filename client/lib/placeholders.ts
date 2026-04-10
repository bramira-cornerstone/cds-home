export type MediaType = "image" | "video";
export type SourceType = "url" | "data";

export interface PlaceholderItem {
  key: string;
  src: string; // URL or data URI
  mediaType: MediaType; // image or video
  sourceType: SourceType; // url or data
}

export type PlaceholderMap = Record<string, PlaceholderItem>;

const STORAGE_KEY = "placeholderConfigV1";

export function loadPlaceholders(): PlaceholderMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PlaceholderMap) : {};
  } catch {
    return {};
  }
}

export function savePlaceholders(map: PlaceholderMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getPlaceholder(key: string): PlaceholderItem | undefined {
  const map = loadPlaceholders();
  return map[key];
}

export function setPlaceholder(item: PlaceholderItem) {
  const map = loadPlaceholders();
  map[item.key] = item;
  savePlaceholders(map);
}

export function removePlaceholder(key: string) {
  const map = loadPlaceholders();
  delete map[key];
  savePlaceholders(map);
}

export function keysForUI(): string[] {
  return [
    "dropsEpic",
    "dropsRare",
    "dropsBasic",
    "redeemDefault",
    "voteDefault",
    "earnDefault",
    "dataPlayerDefault",
    "marketTopSales",
    "marketRecentSales",
  ];
}
