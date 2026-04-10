import { createThirdwebClient, getContract } from "thirdweb";
import { polygon } from "thirdweb/chains";

export const priorDropsClientId = (import.meta as any).env
  ?.THIRDWEB_CLIENT_ID as string | undefined;

export const priorDropsClient = priorDropsClientId
  ? createThirdwebClient({ clientId: priorDropsClientId })
  : null;

export const priorDropsContract = priorDropsClient
  ? getContract({
      client: priorDropsClient,
      address: "0xdF4c403D4A9c1b4Ead5ac60A91A1E652d749e31d",
      chain: polygon,
    })
  : null;

export const corContract = priorDropsClient
  ? getContract({
      client: priorDropsClient,
      address: "0x1505F1122C8D08008DBac7B9D9dadDE4a1c64e71",
      chain: polygon,
    })
  : null;

export const PRIOR_DROPS_FETCH_COUNT = 100;

export const PRIOR_DROPS_QUERY_PARAMS = {
  start: 0,
  count: PRIOR_DROPS_FETCH_COUNT,
} as const;

export function parseBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(value);
  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && "toString" in value) {
    const str = (value as { toString(): string }).toString();
    if (str) {
      try {
        return BigInt(str);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export type AttributeRecord = {
  trait_type?: string;
  display_type?: string;
  name?: string;
  value?: unknown;
  max_value?: unknown;
  min_value?: unknown;
  [key: string]: unknown;
};

export type PriorDropNFT = {
  id: unknown;
  // League is sourced from public.boxes.league, kept out of normalized attributes by design
  league?: string | null;
  metadata?: {
    name?: string | null;
    description?: string | null;
    image?: string | null;
    attributes?: AttributeRecord[] | null;
  } | null;
};

export type NormalizedAttribute = {
  key: string;
  label: string;
  value: string;
  order: number;
};

const ATTRIBUTE_PRIORITY: Record<string, number> = {
  series: 0,
  drop_week: 1,
  tier: 2,
  minted: 3,
};

export function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatAttributeValue(item))
      .filter((item) => item !== "—");
    return parts.length ? parts.join(", ") : "—";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return "—";
    return entries
      .map(([key, val]) => `${key}: ${formatAttributeValue(val)}`)
      .join(", ");
  }
  return String(value);
}

export function normalizeAttributes(
  attributes: AttributeRecord[] | null | undefined,
): NormalizedAttribute[] {
  if (!Array.isArray(attributes)) return [];

  return attributes
    .map((attr, index) => {
      if (!attr || typeof attr !== "object") return null;

      const baseLabel =
        (typeof attr.trait_type === "string" && attr.trait_type.trim()) ||
        (typeof attr.display_type === "string" && attr.display_type.trim()) ||
        (typeof attr.name === "string" && attr.name.trim()) ||
        `Attribute ${index + 1}`;

      const normalizedKey = baseLabel.toLowerCase().replace(/\s+/g, "_");

      let key = normalizedKey;
      let label = baseLabel;
      switch (normalizedKey) {
        case "seriesname":
          key = "series";
          label = "Series";
          break;
        case "drop_week":
          key = "drop_week";
          label = "Drop Week";
          break;
        case "tiervalue":
          key = "tier";
          label = "Tier";
          break;
        case "minted":
          key = "minted";
          label = "Minted";
          break;
        case "league":
          return null;
        default:
          label = baseLabel.replace(/_/g, " ");
      }

      const primaryValue =
        attr.value !== undefined && attr.value !== null
          ? attr.value
          : (attr.max_value ?? attr.min_value ?? null);

      const extraValues = Object.entries(attr)
        .filter(
          ([attrKey]) =>
            ![
              "trait_type",
              "display_type",
              "name",
              "value",
              "max_value",
              "min_value",
            ].includes(attrKey),
        )
        .map(([, val]) => formatAttributeValue(val))
        .filter((val) => val !== "—");

      const value =
        primaryValue !== null
          ? formatAttributeValue(primaryValue)
          : extraValues.length > 0
            ? extraValues.join(", ")
            : "—";

      return {
        key,
        label,
        value,
        order: ATTRIBUTE_PRIORITY[key] ?? 100 + index,
      } satisfies NormalizedAttribute;
    })
    .filter((attr): attr is NormalizedAttribute => attr !== null)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export type PriorDropAttributeMap = {
  series?: string;
  drop_week?: string;
  tier?: string;
  minted?: string;
  [key: string]: string | undefined;
};

export function buildPriorDropAttributeMap(
  attributes: AttributeRecord[] | null | undefined,
): PriorDropAttributeMap {
  const normalized = normalizeAttributes(attributes);
  return normalized.reduce<PriorDropAttributeMap>((acc, attr) => {
    acc[attr.key] = attr.value;
    return acc;
  }, {});
}

export function getTokenIdString(tokenId: unknown): string | null {
  if (typeof tokenId === "bigint") return tokenId.toString();
  if (typeof tokenId === "number") {
    if (!Number.isFinite(tokenId)) return null;
    return String(tokenId);
  }
  if (typeof tokenId === "string") {
    const trimmed = tokenId.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

const PRIOR_DROP_METADATA_BASE_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "token_id",
  "contract_address",
  "event_name",
  "name",
  "description",
  "image",
  "metadata",
]);

const PRIOR_DROP_ATTRIBUTE_LABELS: Record<string, string> = {
  series: "Series",
  drop_week: "Drop Week",
  tier: "Tier",
  minted: "Minted",
  price: "Price",
  boxes_remaining: "Boxes Remaining",
  max_supply: "Total Boxes",
  limit_per_wallet: "Limit Per Wallet",
};

const PRIOR_DROP_PRIORITY_ATTRIBUTE_KEYS = [
  "series",
  "drop_week",
  "tier",
  "minted",
  "max_supply",
  "boxes_remaining",
  "price",
  "limit_per_wallet",
] as const;

const PRIOR_DROP_PRIORITY_ATTRIBUTE_KEY_SET = new Set<string>(
  PRIOR_DROP_PRIORITY_ATTRIBUTE_KEYS,
);

type SupabaseBoxRow = {
  token_id?: string | number | null;
  league?: unknown;
  name?: unknown;
  description?: unknown;
  image?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
};

export type PriorDropsFetchOptions = {
  start?: number;
  count?: number;
  signal?: AbortSignal;
  tokenIds?: number[];
};

function toAttributeLabel(key: string): string {
  if (PRIOR_DROP_ATTRIBUTE_LABELS[key]) {
    return PRIOR_DROP_ATTRIBUTE_LABELS[key];
  }

  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

function attributeFromKeyValue(
  key: string,
  value: unknown,
): AttributeRecord | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  return {
    trait_type: toAttributeLabel(key),
    value,
  } satisfies AttributeRecord;
}

function asOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return null;
}

export function resolveMediaUrl(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("ipfs://")) {
    const path = trimmed.slice("ipfs://".length).replace(/^ipfs\//, "");
    return path ? `https://ipfs.io/ipfs/${path}` : null;
  }
  if (trimmed.startsWith("ar://")) {
    const path = trimmed.slice("ar://".length);
    return path ? `https://arweave.net/${path}` : null;
  }
  return trimmed;
}

function mapSupabaseRowToPriorDrop(row: SupabaseBoxRow): PriorDropNFT | null {
  const tokenId = getTokenIdString(row.token_id ?? row.id ?? null);
  if (!tokenId) return null;

  const attributes: AttributeRecord[] = [];

  for (const key of PRIOR_DROP_PRIORITY_ATTRIBUTE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
    const attr = attributeFromKeyValue(key, row[key]);
    if (attr) {
      attributes.push(attr);
    }
  }

  const extraAttributes: AttributeRecord[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (PRIOR_DROP_METADATA_BASE_KEYS.has(key)) continue;
    if (PRIOR_DROP_PRIORITY_ATTRIBUTE_KEY_SET.has(key)) continue;
    const attr = attributeFromKeyValue(key, value);
    if (attr) {
      extraAttributes.push(attr);
    }
  }

  extraAttributes.sort((a, b) => {
    const aLabel = a.trait_type ?? a.name ?? "";
    const bLabel = b.trait_type ?? b.name ?? "";
    return aLabel.localeCompare(bLabel);
  });

  attributes.push(...extraAttributes);

  const image = resolveMediaUrl(asOptionalString(row.image));

  return {
    id: tokenId,
    league: asOptionalString(row.league),
    metadata: {
      name: asOptionalString(row.name),
      description: asOptionalString(row.description),
      image,
      attributes,
    },
  } satisfies PriorDropNFT;
}

export async function fetchPriorDropNFTs(
  options: PriorDropsFetchOptions = {},
): Promise<PriorDropNFT[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return [];

  const {
    start = PRIOR_DROPS_QUERY_PARAMS.start,
    count = PRIOR_DROPS_QUERY_PARAMS.count,
    signal,
    tokenIds,
  } = options;

  const params = new URLSearchParams({
    select: "*",
    order: "token_id.asc",
  });

  if (typeof count === "number" && Number.isFinite(count) && count > 0) {
    params.set("limit", String(Math.trunc(count)));
  }

  if (typeof start === "number" && Number.isFinite(start) && start > 0) {
    params.set("offset", String(Math.trunc(start)));
  }

  let url = `${baseUrl.replace(/\/$/, "")}/rest/v1/boxes?${params.toString()}`;
  if (Array.isArray(tokenIds) && tokenIds.length > 0) {
    const uniq = Array.from(
      new Set(tokenIds.filter((n) => Number.isFinite(n))),
    );
    if (uniq.length > 0) {
      const list = `(${uniq.join(",")})`;
      url = `${baseUrl.replace(/\/$/, "")}/rest/v1/boxes?token_id=in.${encodeURIComponent(list)}&${params.toString()}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
      signal,
      mode: "cors",
      cache: "no-store",
    });
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  let rows: SupabaseBoxRow[];
  try {
    rows = (await response.json()) as SupabaseBoxRow[];
  } catch {
    return [];
  }

  return rows
    .map((row) => mapSupabaseRowToPriorDrop(row))
    .filter((item): item is PriorDropNFT => item !== null);
}
