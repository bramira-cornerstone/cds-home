export type ActiveAuction = {
  auctionId: string;
  tokenId: string;
  highestBidder: string;
};

export async function fetchAllActiveAuctions(): Promise<ActiveAuction[]> {
  return [];
}
