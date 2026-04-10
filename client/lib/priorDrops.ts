export type PriorDropNFT = {
  tokenId: string;
  title: string;
};

export const PRIOR_DROPS_QUERY_PARAMS = {};

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
