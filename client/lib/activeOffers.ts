export type ActiveOffer = {
  offerId: string;
  tokenId: string;
  offeror: string;
  expiresAt: string;
  totalPrice?: string | number;
  currency?: string;
};

export async function fetchAllActiveOffers(): Promise<ActiveOffer[]> {
  return [];
}

export function getHighestOfferForToken(offers: ActiveOffer[], tokenId: string): ActiveOffer | null {
  return null;
}

export function formatOfferPrice(totalPrice?: string | number, currency?: string): string {
  return "$0";
}
