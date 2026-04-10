import { getContract, readContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";
import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";

// Cache for active offers to prevent repeated blockchain queries
let activeOffersCache: ActiveOffer[] | null = null;
let activeOffersCacheTime: number = 0;
const CACHE_DURATION_MS = 60 * 1000; // Cache for 60 seconds

export interface ActiveOffer {
  offerId: string;
  tokenId: string;
  quantity: string;
  totalPrice: string;
  expirationTimestamp: number;
  offeror: string;
  assetContract: string;
  currency: string;
  tokenType: number;
  status: number;
  editionId: number | null;
  serial: number | null;
  formattedPrice?: string;
}

async function fetchTokenMetadata(
  tokenId: string,
): Promise<{ editionId: number | null; serial: number | null }> {
  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return { editionId: null, serial: null };
  }

  return withSupabaseFallback(
    `token-metadata-${tokenId}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      const url = `${root}/rest/v1/RelicSerialsJoined?token_id=eq.${encodeURIComponent(tokenId)}&select=edition_id,serial`;

      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const data = (await response.json()) as Array<{
        edition_id: number;
        serial: number;
      }>;
      if (Array.isArray(data) && data[0]) {
        return {
          editionId: data[0].edition_id,
          serial: data[0].serial,
        };
      }

      return { editionId: null, serial: null };
    },
    { editionId: null, serial: null },
    "fetchTokenMetadata",
  );
}

async function fetchCancelledOfferIds(): Promise<Set<string>> {
  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return new Set();
  }

  return withSupabaseFallback(
    "cancelled-offer-ids",
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      const url = `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.CancelledOffer&select=offer_id`;

      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return new Set();
      }

      const events = (await response.json()) as Array<{ offer_id: string }>;
      return new Set(
        Array.isArray(events) ? events.map((e) => e.offer_id) : [],
      );
    },
    new Set(),
    "fetchCancelledOfferIds",
  );
}

export async function fetchAllActiveOffers(): Promise<ActiveOffer[]> {
  try {
    // Check cache first
    const nowMs = Date.now();
    if (activeOffersCache !== null && nowMs - activeOffersCacheTime < CACHE_DURATION_MS) {
      return activeOffersCache;
    }

    if (!MARKETPLACE_ADDRESS) {
      return [];
    }

    const client = getAlchemyThirdwebClient();
    const contract = getContract({
      address: MARKETPLACE_ADDRESS,
      chain: polygon,
      client,
    });

    // Fetch cancelled offer IDs from marketplace events
    const cancelledOfferIds = await fetchCancelledOfferIds();

    // Get total number of offers
    const totalOffers = (await readContract({
      contract,
      method: "function totalOffers() view returns (uint256)",
      params: [],
    })) as bigint;

    const totalOffersNum = Number(totalOffers);

    const offers: ActiveOffer[] = [];
    const now = Math.floor(Date.now() / 1000);

    // Fetch all offers
    for (let i = 0; i < totalOffersNum; i++) {
      try {
        const offerDataRaw = await readContract({
          contract,
          method:
            "function getOffer(uint256 _offerId) view returns ((uint256 offerId, uint256 tokenId, uint256 quantity, uint256 totalPrice, uint256 expirationTimestamp, address offeror, address assetContract, address currency, uint8 tokenType, uint8 status) _offer)",
          params: [BigInt(i)],
        });

        // Handle both array and object return formats
        let offerData: any;
        if (Array.isArray(offerDataRaw)) {
          const [
            offerId,
            tokenId,
            quantity,
            totalPrice,
            expirationTimestamp,
            offeror,
            assetContract,
            currency,
            tokenType,
            status,
          ] = offerDataRaw;
          offerData = {
            offerId,
            tokenId,
            quantity,
            totalPrice,
            expirationTimestamp,
            offeror,
            assetContract,
            currency,
            tokenType,
            status,
          };
        } else {
          offerData = offerDataRaw;
        }

        const expirationTime = Number(offerData.expirationTimestamp);

        const offerIdStr = String(offerData.offerId);
        const isCancelled = cancelledOfferIds.has(offerIdStr);

        // Only include active (status == 1), non-expired, and non-cancelled offers
        if (offerData.status === 1 && expirationTime > now && !isCancelled) {
          const tokenIdStr = String(offerData.tokenId);
          const metadata = await fetchTokenMetadata(tokenIdStr);

          offers.push({
            offerId: offerIdStr,
            tokenId: tokenIdStr,
            quantity: String(offerData.quantity),
            totalPrice: String(offerData.totalPrice),
            expirationTimestamp: expirationTime,
            offeror: offerData.offeror,
            assetContract: offerData.assetContract,
            currency: offerData.currency,
            tokenType: Number(offerData.tokenType),
            status: Number(offerData.status),
            editionId: metadata.editionId,
            serial: metadata.serial,
          });
        }
      } catch (err) {
        // Continue to next offer
      }
    }

    // Cache the result
    activeOffersCache = offers;
    activeOffersCacheTime = Date.now();
    return offers;
  } catch (err) {
    // Return cached data on error if available
    if (activeOffersCache !== null) {
      return activeOffersCache;
    }
    return [];
  }
}

export function getHighestOfferForToken(
  offers: ActiveOffer[],
  tokenId: string,
): ActiveOffer | null {
  const tokenOffers = offers.filter((offer) => offer.tokenId === tokenId);

  if (tokenOffers.length === 0) {
    return null;
  }

  // Sort by totalPrice descending and return the highest
  const highest = tokenOffers.reduce((highest, current) => {
    const currentPrice = BigInt(current.totalPrice);
    const highestPrice = BigInt(highest.totalPrice);
    return currentPrice > highestPrice ? current : highest;
  });

  return highest;
}

export function formatOfferPrice(
  totalPrice: string,
  currency: string,
  decimals: number = 18,
): string {
  try {
    const divisor = 10 ** decimals;
    const priceBigInt = BigInt(totalPrice);
    const priceInTokens = Number(priceBigInt) / divisor;
    return `$${priceInTokens.toFixed(2)}`;
  } catch (err) {
    return "$0.00";
  }
}
