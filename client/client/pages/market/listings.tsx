import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";
import { ListingCard } from "@/components/market/ListingCard";

export default function ListingsPage() {
  const { listings, loading } = useMarketplaceListings();
  const [sortBy, setSortBy] = useState<"price-low" | "price-high" | "token-id">(
    "price-low",
  );
  const [filterListingType, setFilterListingType] = useState<
    "all" | "direct" | "auction"
  >("all");

  const filteredAndSortedListings = useMemo(() => {
    let filtered = listings;

    if (filterListingType !== "all") {
      filtered = filtered.filter((l) => l.listingType === filterListingType);
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return (
            BigInt(a.pricePerToken) - BigInt(b.pricePerToken) > 0n ? 1 : -1
          );
        case "price-high":
          return (
            BigInt(a.pricePerToken) - BigInt(b.pricePerToken) > 0n ? -1 : 1
          );
        case "token-id":
          return parseInt(a.tokenId, 10) - parseInt(b.tokenId, 10);
        default:
          return 0;
      }
    });

    return sorted;
  }, [listings, sortBy, filterListingType]);

  if (loading) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700 dark:text-slate-300">Loading listings...</div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">
          Token Listings
        </h1>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "price-low" | "price-high" | "token-id")
              }
              className="w-full px-4 py-2 border border-slate-300 rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            >
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="token-id">Token ID</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Listing Type
            </label>
            <select
              value={filterListingType}
              onChange={(e) =>
                setFilterListingType(e.target.value as "all" | "direct" | "auction")
              }
              className="w-full px-4 py-2 border border-slate-300 rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="direct">Direct Listings</option>
              <option value="auction">Auctions</option>
            </select>
          </div>
        </div>
      </div>

      {filteredAndSortedListings.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            No listings found
          </p>
          <Link
            to="/market"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Back to Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedListings.map((listing) => (
            <ListingCard key={listing.listingId} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}
