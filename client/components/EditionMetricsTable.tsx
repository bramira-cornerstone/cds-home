import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Listing } from "@/hooks/useMarketplaceListings";
import { findListingByTokenId } from "@/hooks/useMarketplaceListings";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { formatOfferPrice } from "@/lib/activeOffers";

function formatRMSFromWei(value: string | number | null): string | null {
  if (!value) return null;
  try {
    const valueStr = String(value).trim();
    const bigValue = BigInt(valueStr);
    const wholePart = bigValue / BigInt(1e18);
    const remainder = bigValue % BigInt(1e18);
    const decimalValue = Number(wholePart) + Number(remainder) / 1e18;
    return `$${decimalValue.toFixed(2)}`;
  } catch {
    return null;
  }
}

export type EditionMetricsTableProps = {
  lowAsk?: string | number | null;
  highOffer?: string | number | null;
  rollingMedianSale?: string | number | null;
  tokenId?: number | null;
  ownerAddress?: string | null;
  connectedWalletAddress?: string | null;
  className?: string;
  listingPrice?: string | number | null;
  auctionMinimumBid?: string | number | null;
  marketplaceListings?: Listing[];
  editionLowAsk?: string | null;
  editionId?: number | null;
  allListingsForEdition?: any[];
};

/**
 * Metrics table with optional rows at top.
 * On serial pages (when connectedWalletAddress is provided):
 *   - Displays rows for Token ID, Alchemy Owner, Thirdweb connected wallet, and Owner (if applicable)
 *   - Shows "—" for null values
 * Below these optional rows is the 2x3 financial metrics grid.
 * If marketplaceListings is provided and tokenId matches a listing, displays the listing price.
 */
export default function EditionMetricsTable({
  lowAsk = null,
  highOffer = null,
  rollingMedianSale = null,
  tokenId = null,
  ownerAddress = null,
  connectedWalletAddress = null,
  className = "",
  listingPrice = null,
  auctionMinimumBid = null,
  marketplaceListings,
  editionLowAsk = null,
  editionId = null,
  allListingsForEdition = [],
}: EditionMetricsTableProps) {
  const isSerialView = connectedWalletAddress != null;
  const { formattedHighestOffer } = useActiveOffers(tokenId);
  const { offers: allOffers } = useActiveOffers();
  const [fetchedRMS, setFetchedRMS] = useState<string | null>(null);
  const [fetchedLowAsk, setFetchedLowAsk] = useState<string | null>(null);
  const [fetchedHighOffer, setFetchedHighOffer] = useState<string | null>(null);

  // Fetch RMV metrics: low_ask, high_offer, rolling_median_sale
  // Falls back to props (lowAsk, highOffer) if RMV fails
  useEffect(() => {
    if (!editionId) return;

    const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
    const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;
    if (!baseUrl || !anonKey) return;

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/RMV?edition_id=eq.${encodeURIComponent(
      editionId,
    )}&select=low_ask,high_offer,rolling_median_sale`;

    let cancelled = false;

    fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    })
      .then((res) => res.json())
      .then((rows) => {
        if (cancelled) return;

        if (Array.isArray(rows) && rows[0]) {
          const row = rows[0];
          if (row.rolling_median_sale) {
            const formatted = formatRMSFromWei(row.rolling_median_sale);
            setFetchedRMS(formatted);
          }
          if (row.low_ask) {
            const formatted = formatRMSFromWei(row.low_ask);
            setFetchedLowAsk(formatted);
          }
          if (row.high_offer) {
            const formatted = formatRMSFromWei(row.high_offer);
            setFetchedHighOffer(formatted);
          }
        } else {
          // No RMV data, use prop fallbacks
          if (lowAsk) setFetchedLowAsk(String(lowAsk));
          if (highOffer) setFetchedHighOffer(String(highOffer));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(`[EditionMetricsTable] RMV fetch error, using fallback props:`, err);
        // RMV query failed (500 error, timeout, etc) - use prop fallbacks
        if (lowAsk) setFetchedLowAsk(String(lowAsk));
        if (highOffer) setFetchedHighOffer(String(highOffer));
      });

    return () => {
      cancelled = true;
    };
  }, [editionId, lowAsk, highOffer]);

  // Use provided rollingMedianSale or fetched value
  const rmsToDisplay = rollingMedianSale || fetchedRMS;

  // Ensure RMS is properly formatted as $#.##
  const formattedRMS = useMemo(() => {
    if (!rmsToDisplay) return null;

    const strValue = String(rmsToDisplay).trim();

    // If already formatted as $#.##, return as-is
    if (strValue.startsWith('$')) {
      return strValue;
    }

    // Use helper function to convert
    return formatRMSFromWei(rmsToDisplay);
  }, [rmsToDisplay]);

  const highestEditionOfferFormatted = useMemo(() => {
    if (!editionId || !allOffers || allOffers.length === 0) {
      return null;
    }

    // Filter offers for this edition
    const editionOffers = allOffers.filter(
      (offer) => offer.editionId === editionId,
    );

    if (editionOffers.length === 0) {
      return null;
    }

    // Find the highest offer by totalPrice
    const highestOffer = editionOffers.reduce((highest, current) => {
      const currentPrice = BigInt(current.totalPrice);
      const highestPrice = BigInt(highest.totalPrice);
      return currentPrice > highestPrice ? current : highest;
    });

    return formatOfferPrice(highestOffer.totalPrice, highestOffer.currency);
  }, [editionId, allOffers]);

  const rmsRef = useRef<HTMLDivElement | null>(null);
  const lowAskRef = useRef<HTMLSpanElement | null>(null);
  const highOfferRef = useRef<HTMLSpanElement | null>(null);
  const rollingMedianSaleRef = useRef<HTMLSpanElement | null>(null);

  const [labelFontPx, setLabelFontPx] = useState<number>(10);
  const [lowAskFontPx, setLowAskFontPx] = useState<number>(16);
  const [highOfferFontPx, setHighOfferFontPx] = useState<number>(16);
  const [rmsValueFontPx, setRmsValueFontPx] = useState<number>(16);

  const ctx = useMemo(() => {
    const canvas = document.createElement("canvas");
    return canvas.getContext("2d");
  }, []);

  const calculateOptimalFontSize = (
    element: HTMLSpanElement | null,
    text: string,
  ): number => {
    if (!element || !ctx) return 16;

    const computed = window.getComputedStyle(element);
    const fontFamily = computed.fontFamily || "sans-serif";
    const fontWeight = computed.fontWeight || "400";
    const paddingLeft = parseFloat(computed.paddingLeft || "0") || 0;
    const paddingRight = parseFloat(computed.paddingRight || "0") || 0;

    // Measure width at a base size
    const base = 24; // px - start with a larger base
    ctx.font = `${fontWeight} ${base}px ${fontFamily}`;
    const widthAtBase = ctx.measureText(text).width || 0;

    // Available content width (clientWidth includes padding)
    const available = Math.max(0, element.clientWidth - paddingLeft - paddingRight);
    if (available <= 0 || widthAtBase <= 0) {
      return 16;
    }

    const scale = available / widthAtBase;
    const target = Math.max(12, Math.min(40, Math.floor(base * scale)));
    return target;
  };

  const recompute = () => {
    const el = rmsRef.current;
    if (!el || !ctx) return;
    const text = "Rolling Median Sale";
    const computed = window.getComputedStyle(el);
    const fontFamily = computed.fontFamily || "sans-serif";
    const fontWeight = computed.fontWeight || "400";
    const paddingLeft = parseFloat(computed.paddingLeft || "0") || 0;
    const paddingRight = parseFloat(computed.paddingRight || "0") || 0;

    // Measure width at a base size
    const base = 16; // px
    ctx.font = `${fontWeight} ${base}px ${fontFamily}`;
    const widthAtBase = ctx.measureText(text).width || 0;

    // Available content width (clientWidth includes padding)
    const available = Math.max(0, el.clientWidth - paddingLeft - paddingRight);
    if (available <= 0 || widthAtBase <= 0) {
      setLabelFontPx(10);
      return;
    }

    const scale = available / widthAtBase;
    const target = Math.max(8, Math.min(14, Math.floor(base * scale)));
    setLabelFontPx(target);

    // Calculate optimal font sizes for metric values
    if (lowAskRef.current) {
      const lowAskText = lowAskRef.current.textContent || "";
      setLowAskFontPx(calculateOptimalFontSize(lowAskRef.current, lowAskText));
    }
    if (highOfferRef.current) {
      const highOfferText = highOfferRef.current.textContent || "";
      setHighOfferFontPx(calculateOptimalFontSize(highOfferRef.current, highOfferText));
    }
    if (rollingMedianSaleRef.current) {
      const rmsText = rollingMedianSaleRef.current.textContent || "";
      setRmsValueFontPx(calculateOptimalFontSize(rollingMedianSaleRef.current, rmsText));
    }
  };

  useLayoutEffect(() => {
    recompute();
    const id = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowAsk, highOffer, formattedRMS, editionLowAsk, auctionMinimumBid, formattedHighestOffer, highestEditionOfferFormatted, fetchedLowAsk, fetchedHighOffer]);

  useEffect(() => {
    const el = rmsRef.current;
    if (!el) return;

    let resizeObserverRaf = 0;
    const ro = new ResizeObserver(() => {
      if (resizeObserverRaf) cancelAnimationFrame(resizeObserverRaf);
      resizeObserverRaf = requestAnimationFrame(() => recompute());
    });
    ro.observe(el);

    let resizeWindowRaf = 0;
    const onResize = () => {
      if (resizeWindowRaf) cancelAnimationFrame(resizeWindowRaf);
      resizeWindowRaf = requestAnimationFrame(() => recompute());
    };
    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      if (resizeObserverRaf) cancelAnimationFrame(resizeObserverRaf);
      if (resizeWindowRaf) cancelAnimationFrame(resizeWindowRaf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`w-full ${className}`} style={{ marginBottom: "12px" }}>
      <div className="rounded-md border border-slate-200 overflow-hidden bg-white dark:bg-slate-700 dark:border-white/10 dark:text-white">
        <div className="grid grid-cols-3">
          {/* Top row: value boxes */}
          <div className="h-20 flex items-center justify-center font-light">
            {fetchedLowAsk != null && fetchedLowAsk !== "" ? (
              <span
                ref={lowAskRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${lowAskFontPx}px` }}
              >
                {String(fetchedLowAsk)}
              </span>
            ) : editionLowAsk != null && editionLowAsk !== "" ? (
              <span
                ref={lowAskRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${lowAskFontPx}px` }}
              >
                {String(editionLowAsk)}
              </span>
            ) : lowAsk != null && lowAsk !== "" ? (
              <span
                ref={lowAskRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${lowAskFontPx}px` }}
              >
                {String(lowAsk)}
              </span>
            ) : (
              <span aria-label="low_ask" className="sr-only">
                low_ask
              </span>
            )}
          </div>
          <div className="h-20 flex items-center justify-center font-light border-l border-slate-200 dark:border-white/10">
            {fetchedHighOffer != null && fetchedHighOffer !== "" ? (
              <span
                ref={highOfferRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${highOfferFontPx}px` }}
              >
                {String(fetchedHighOffer)}
              </span>
            ) : auctionMinimumBid != null && auctionMinimumBid !== "" ? (
              <span
                ref={highOfferRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${highOfferFontPx}px` }}
              >
                {String(auctionMinimumBid)}
              </span>
            ) : formattedHighestOffer ? (
              <span
                ref={highOfferRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${highOfferFontPx}px` }}
              >
                {String(formattedHighestOffer)}
              </span>
            ) : highestEditionOfferFormatted ? (
              <span
                ref={highOfferRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${highOfferFontPx}px` }}
              >
                {String(highestEditionOfferFormatted)}
              </span>
            ) : highOffer == null || highOffer === "" ? (
              <span aria-label="high_offer" className="sr-only">
                high_offer
              </span>
            ) : (
              <span
                ref={highOfferRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${highOfferFontPx}px` }}
              >
                {String(highOffer)}
              </span>
            )}
          </div>
          <div className="h-20 flex items-center justify-center font-light border-l border-slate-200 dark:border-white/10">
            {!formattedRMS ? (
              <span aria-label="rolling_median_sale" className="sr-only">
                rolling_median_sale
              </span>
            ) : (
              <span
                ref={rollingMedianSaleRef}
                className="flex-1 block px-2 text-center leading-tight font-light whitespace-nowrap"
                style={{ fontSize: `${rmsValueFontPx}px` }}
              >
                {formattedRMS}
              </span>
            )}
          </div>

          {/* Bottom row: labels - all share the same font size based on RMS fit */}
          <div className="px-2 py-2 text-center text-slate-800 dark:text-white">
            <span
              className="block w-full text-center whitespace-nowrap overflow-hidden"
              style={{ fontSize: labelFontPx }}
            >
              Low Ask
            </span>
          </div>
          <div className="px-2 py-2 text-center text-slate-800 border-l border-slate-200 dark:text-white dark:border-white/10">
            <span
              className="block w-full text-center whitespace-nowrap overflow-hidden"
              style={{ fontSize: labelFontPx }}
            >
              High Offer
            </span>
          </div>
          <div
            ref={rmsRef}
            className="px-2 py-2 text-center text-slate-800 border-l border-slate-200 dark:text-white dark:border-white/10"
          >
            <span
              className="block w-full text-center whitespace-nowrap overflow-hidden"
              style={{ fontSize: labelFontPx }}
            >
              Rolling Median Sale
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
