import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import { OfferCard } from "@/components/market/OfferCard";

export default function CurrentOffersPage() {
  const { editionId, serial } = useParams<{
    editionId?: string;
    serial?: string;
  }>();
  const betaAllowlist = useBetaAllowlist();
  const { offers, isLoading } = useActiveOffers();
  const [sortBy, setSortBy] = useState<
    "price-low" | "price-high" | "expiration"
  >("price-high");

  const filteredAndSortedOffers = useMemo(() => {
    let filtered = offers;

    // Filter by edition and serial if provided (page is a suffix route)
    if (editionId !== undefined && serial !== undefined) {
      const editionIdNum = parseInt(editionId, 10);
      const serialNum = parseInt(serial, 10);
      filtered = offers.filter(
        (offer) =>
          offer.editionId === editionIdNum && offer.serial === serialNum,
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return BigInt(a.totalPrice) - BigInt(b.totalPrice) > 0n ? 1 : -1;
        case "price-high":
          return BigInt(a.totalPrice) - BigInt(b.totalPrice) > 0n ? -1 : 1;
        case "expiration":
          return a.expirationTimestamp - b.expirationTimestamp;
        default:
          return 0;
      }
    });

    return sorted;
  }, [offers, sortBy, editionId, serial]);

  if (betaAllowlist !== true) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="w-full rounded-none bg-white text-black p-6 text-center text-base dark:bg-slate-800 dark:text-white">
          Platform is invitation only. Log in and enter your invite code to
          join.
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700 dark:text-slate-300">
          Loading offers...
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">
          Current Offers
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
                setSortBy(
                  e.target.value as "price-low" | "price-high" | "expiration",
                )
              }
              className="w-full px-4 py-2 border border-slate-300 rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            >
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
              <option value="expiration">Expiration</option>
            </select>
          </div>
        </div>
      </div>

      {filteredAndSortedOffers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            No offers found
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
          {filteredAndSortedOffers.map((offer) => (
            <OfferCard key={offer.offerId} offer={offer} />
          ))}
        </div>
      )}
    </section>
  );
}
