# Thirdweb Marketplace Integration Guide

This document explains the marketplace integration setup for your Cornerstone NFT platform using thirdweb v5 SDK.

## Setup Complete

The following files have been created:

### 1. Marketplace Hook (`client/hooks/useMarketplace.ts`)

- Initializes the marketplace contract using your `VITE_MARKETPLACE_ADDRESS`
- Validates contract addresses against `VITE_ERC721_ADDRESS` and `VITE_ERC1155_ADDRESS`
- Exports `ALLOWED_CONTRACT_ADDRESSES` and validation functions

### 2. Create Listing Page (`client/pages/market/create-listing.tsx`)

- Form to create direct listings or auctions
- Contract address validation (only allows ERC721 and ERC1155 addresses)
- Token ID and price inputs
- Placeholder transaction logic (see "Next Steps" below)

### 3. Marketplace Listings Component (`client/components/MarketplaceListings.tsx`)

- Displays active marketplace listings
- Shows listing type (direct or auction)
- Links to individual listing details

### 4. Listing Detail Page (`client/pages/market/listing.tsx`)

- Shows individual listing details
- Allows users to place bids or make offers
- Supports buy-now functionality for direct listings
- Placeholder logic for transaction execution

## Next Steps - Completing the Integration

### 1. Understand Your Marketplace Contract

Your marketplace contract address is: `VITE_MARKETPLACE_ADDRESS`

You need to know:

- The contract's function names (e.g., `createListing`, `createAuction`, `getListing`, `getActiveListings`)
- The exact parameter structure for creating listings
- The contract ABI for reading listings

### 2. Update Contract Interaction Code

In `client/pages/market/create-listing.tsx`, replace the placeholder functions:

```typescript
// Current placeholder:
const transaction = await contract?.write("createListing", [...])

// Needs actual contract method names and parameters based on your marketplace contract
```

In `client/components/MarketplaceListings.tsx`, implement listing fetching:

```typescript
// Currently returns empty array - needs actual implementation
// Example (adjust based on your contract):
const listings = await contract?.read("getActiveListings", []);
```

### 3. Get Your Contract ABI

1. Go to your marketplace contract on PolygonScan
2. Copy the contract ABI
3. Use it to understand available functions and their signatures

### 4. Adapt Transaction Logic

The create listing functions need to be updated based on your marketplace contract. The guide used:

**For Direct Listings:**

```typescript
await marketplace.direct.createListing({
  assetContractAddress: string,
  buyoutPricePerToken: string,
  currencyContractAddress: string,
  listingDurationInSeconds: number,
  quantity: number,
  startTimestamp: Date,
  tokenId: string,
});
```

**For Auctions:**

```typescript
await marketplace.auction.createListing({
  assetContractAddress: string,
  buyoutPricePerToken: string,
  currencyContractAddress: string,
  listingDurationInSeconds: number,
  quantity: number,
  reservePricePerToken: number,
  startTimestamp: Date,
  tokenId: string,
});
```

### 5. Update Listing Display

Implement listing fetching in `MarketplaceListings.tsx`:

```typescript
// Get active listings
const listings = await contract?.read("getActiveListings", []);
```

Or if using thirdweb's marketplace SDK extension:

```typescript
const { data: listings } = await contract?.marketplace.getActiveListings();
```
```

## Routing Setup

The following routes are available:

- `/market` - Main marketplace page (display listings)
- `/market/create-listing` - Create a new listing
- `/market/listing/:listingId` - View individual listing details

You can add links to these pages in your navigation or from the `/market` page.

## Key Features Implemented

✅ Contract address validation (only allows ERC721 and ERC1155)  
✅ Create listing form with listing type selection  
✅ Listing detail view structure  
✅ Bid/offer/buy-now UI structure  
✅ Error handling and loading states  
✅ Dark mode support

## Key Features Needing Completion

⚠️ Fetch and display active listings  
⚠️ Complete transaction execution for creating listings  
⚠️ Complete bid/offer transaction logic  
⚠️ Complete buy-now transaction logic  
⚠️ Display listing images/metadata  
⚠️ Real-time bid updates (optional, for auctions)

## Security Considerations

1. **Contract Address Whitelist** - Only ERC721 and ERC1155 addresses are allowed
2. **User Ownership Check** - Verify user owns the NFT before allowing listing creation (add to create-listing.tsx)
3. **Price Validation** - Add minimum/maximum price checks
4. **Gas Fee Display** - Show estimated gas fees before transaction submission

## Integration with Existing Pages

To integrate marketplace listings into your existing `/market` page:

```typescript
// In client/pages/market.tsx, add:
import MarketplaceListings from "@/components/MarketplaceListings";

// Add in JSX:
<MarketplaceListings />

// Add button to create listing:
<Link to="/market/create-listing" className="btn">
  Create Listing
</Link>
```

## Testing

1. Deploy your marketplace contract (if not already done)
2. Mint test NFTs on your ERC721 or ERC1155 contract
3. Test creating listings with those NFTs
4. Test bidding/offering functionality
5. Test buy-now on direct listings

## Helpful Resources

- [Thirdweb Marketplace Docs](https://portal.thirdweb.com/contracts/marketplace)
- [Thirdweb SDK v5 Reference](https://portal.thirdweb.com/typescript/v5)
- [Polygon Testnet Faucet](https://faucet.polygon.technology/) - For MATIC test tokens
