const AUCTION_HOUSE_ADDRESS = "0X859227C123BF4E4002A0AA1DCAF756FA78FAFDE7";

export function getOwnerDisplayName(
  addressOrName: string | null | undefined,
): string {
  if (!addressOrName) return "";

  // Check if it's the Auction House address
  if (addressOrName.toUpperCase() === AUCTION_HOUSE_ADDRESS.toUpperCase()) {
    return "Auction House";
  }

  // If it doesn't look like an address (has spaces or special chars that don't appear in hex), assume it's already a name
  if (!addressOrName.startsWith("0x") && !addressOrName.startsWith("0X")) {
    return addressOrName;
  }

  return addressOrName;
}

export function isAuctionHouseAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  return address.toUpperCase() === AUCTION_HOUSE_ADDRESS.toUpperCase();
}
