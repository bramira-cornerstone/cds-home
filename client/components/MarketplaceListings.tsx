import { useActiveAccount } from "thirdweb/react";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";

export default function MarketplaceListings() {
  const account = useActiveAccount();
  const { listings, loading, error } = useMarketplaceListings();

  if (loading) {
    return (
      <div className="text-center py-8 dark:text-white">
        Loading marketplace...
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <p className="text-slate-600 dark:text-slate-400">
          No listings found
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((listing) => (
        <div
          key={listing.listingId}
          className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-lg transition"
        >
          <div className="aspect-square bg-slate-100 dark:bg-slate-700" />
          <div className="p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {listing.listingType === "direct" ? "Direct Listing" : "Auction"}
            </p>
            <h3 className="font-semibold mt-2 dark:text-white">
              Token #{listing.tokenId}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {listing.assetContract}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-bold dark:text-white">
                {(BigInt(listing.pricePerToken) / BigInt(1e18)).toString()}{" "}
                tokens
              </span>
              <a
                href={`/market/listing/${listing.listingId}`}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium"
              >
                View
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
