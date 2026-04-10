export type ActiveOffer = {
  offerId: string;
  tokenId: string;
  offeror: string;
  expiresAt: string;
};

export async function fetchAllActiveOffers(): Promise<ActiveOffer[]> {
  return [];
}

export function getHighestOfferForToken(offers: ActiveOffer[], tokenId: string): ActiveOffer | null {
  return null;
}

export function formatOfferPrice(offer: ActiveOffer): string {
  return "$0";
}
