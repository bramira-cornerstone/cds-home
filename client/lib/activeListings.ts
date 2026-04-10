export type ActiveListing = {
  listingId?: string;
  tokenId?: string;
  lister?: string;
  [key: string]: unknown;
};

export async function fetchAllActiveListings(): Promise<ActiveListing[]> {
  return [];
}

export function getHighestListingForToken(
  listings: ActiveListing[],
  tokenId: string,
): ActiveListing | null {
  return null;
}

export function formatListingPrice(listing: ActiveListing): string {
  return "$0";
}

export function findListingByTokenId(
  listings: ActiveListing[],
  tokenId: string,
): ActiveListing | undefined {
  return undefined;
}
