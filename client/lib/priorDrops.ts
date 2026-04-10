export type PriorDropNFT = {
  tokenId: string;
  title: string;
};

export type PriorDropAttributeMap = Record<string, unknown>;

export const PRIOR_DROPS_QUERY_PARAMS = {};
export const priorDropsContract = null;
export const priorDropsClient = null;

export async function fetchPriorDropNFTs(): Promise<PriorDropNFT[]> {
  return [];
}

export function getTokenIdString(nft: PriorDropNFT): string {
  return nft.tokenId;
}

export function resolveMediaUrl(url: string): string {
  return url;
}

export function buildPriorDropAttributeMap(): Record<string, unknown> {
  return {};
}

export function normalizeAttributes(attributes: unknown[]): unknown[] {
  return attributes ?? [];
}

export function parseBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  if (typeof value === "number") {
    return BigInt(Math.floor(value));
  }
  return null;
}
