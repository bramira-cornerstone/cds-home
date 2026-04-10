import { useCallback, useEffect, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Link } from "react-router-dom";

type EmblaOptions = Parameters<typeof useEmblaCarousel>[0];

interface MiniCarouselProps {
  count: number;
  options?: EmblaOptions;
  itemWidthClass?: string;
  itemContainerClass?: string;
  imageClass?: string;
  caption?: string | ((index: number) => string);
  overlayCaption?: boolean;
  mediaForIndex?: (
    index: number,
  ) => { src: string; mediaType: "image" | "video" } | undefined;
  renderItemForIndex?: (index: number) => ReactNode | undefined;
  itemHrefForIndex?: (index: number) => string | undefined;
  onItemClick?: (index: number) => void;
  containerPaddingClass?: string;
  gapClass?: string;
  containMedia?: boolean;
  captionPlacement?: "center" | "bottom";
  itemFrameClass?: string;
  overlayTextClassName?: string;
  overlayCaptionInline?: boolean;
  overlayTextStyle?: React.CSSProperties;
  getItemDataAttributes?: (index: number) => Record<string, string>;
  isUserMarketplaceStatsCarousel?: boolean;
}

export default function MiniCarousel({
  count,
  options,
  itemWidthClass = "w-[56px] md:w-[64px]",
  itemContainerClass,
  imageClass = "h-full",
  caption,
  overlayCaption = false,
  mediaForIndex,
  renderItemForIndex,
  itemHrefForIndex,
  onItemClick,
  containerPaddingClass = "px-3",
  gapClass = "gap-3",
  containMedia = false,
  captionPlacement = "center",
  itemFrameClass = "relative w-full flex-1 rounded-md border border-slate-200 bg-slate-100 shadow-inner overflow-hidden",
  overlayTextClassName,
  overlayCaptionInline = false,
  overlayTextStyle,
  getItemDataAttributes,
  isUserMarketplaceStatsCarousel = false,
}: MiniCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
    ...options,
  });
  const [canNext, setCanNext] = useState(false);
  const [canPrev, setCanPrev] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanNext(emblaApi.canScrollNext());
    setCanPrev(emblaApi.canScrollPrev());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      try {
        emblaApi.off("select", onSelect);
        emblaApi.off("reInit", onSelect);
      } catch (e) {
        // Carousel might have been destroyed already
      }
    };
  }, [emblaApi, onSelect]);

  const splitIntoTwoLines = (text: string): [string, string] => {
    const t = text.trim();
    if (!t) return ["", ""];
    if (t.includes(" ")) {
      const parts = t.split(/\s+/);
      const mid = Math.ceil(parts.length / 2);
      return [parts.slice(0, mid).join(" "), parts.slice(mid).join(" ")];
    }
    const camel = t.match(/^(.+?)([A-Z][a-z0-9].*)$/);
    if (camel) return [camel[1], camel[2]];
    const mid = Math.ceil(t.length / 2);
    return [t.slice(0, mid), t.slice(mid)];
  };

  const getCaption = (i: number): string | undefined =>
    caption !== undefined
      ? typeof caption === "function"
        ? caption(i)
        : caption
      : undefined;

  return (
    <div
      className={`relative w-full flex flex-col h-[170px] max-lg:h-[180px] max-sm:h-[150px] ${isUserMarketplaceStatsCarousel ? "" : "flex-1 min-h-0"} ${containerPaddingClass}`}
    >
      <div
        className={`${isUserMarketplaceStatsCarousel ? "overflow-visible w-full" : "overflow-hidden flex-1 min-h-0 w-full"}`}
        ref={emblaRef}
      >
        <div
          className={`flex ${gapClass} will-change-transform transform-gpu`}
          style={{
            gap: "4px",
            width: "110%",
            backgroundColor: "rgba(0, 0, 0, 0)",
            padding: "2px",
            ...(isUserMarketplaceStatsCarousel
              ? { height: "auto" }
              : { flexGrow: "1", height: "110%" }),
          }}
        >
          {Array.from({ length: count }).map((_, i) => {
            const cap = getCaption(i);
            const [line1, line2] = cap ? splitIntoTwoLines(cap) : ["", ""];
            const media = mediaForIndex?.(i);
            const custom = renderItemForIndex?.(i);
            const dataAttributes = getItemDataAttributes?.(i) || {};
            return (
              <div
                key={i}
                className={`${
                  itemContainerClass ??
                  `flex h-[148px] w-[100px] shrink-0 flex-col`
                } max-sm:w-[100px] max-sm:h-[148px]`}
                style={
                  isUserMarketplaceStatsCarousel
                    ? {
                        height: "148px",
                        width: "100px",
                      }
                    : {}
                }
                {...dataAttributes}
              >
                <div
                  className={`${isUserMarketplaceStatsCarousel ? itemFrameClass.replace("flex-1", "").replace("overflow-hidden", "overflow-visible") : itemFrameClass} ${imageClass} ${isUserMarketplaceStatsCarousel ? "flex-shrink-0 h-auto" : "flex-1"}`}
                  style={{ backfaceVisibility: "hidden" }}
                >
                  {custom !== undefined ? (
                    <div
                      className={
                        isUserMarketplaceStatsCarousel
                          ? "w-full h-full"
                          : "absolute inset-0"
                      }
                    >
                      {custom}
                    </div>
                  ) : (
                    <>
                      {media?.src &&
                        (media.mediaType === "video" ? (
                          <video
                            className={`absolute inset-0 w-full h-full ${containMedia ? "object-contain" : "object-cover"}`}
                            src={media.src}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img
                            className={`absolute inset-0 w-full h-full ${containMedia ? "object-contain" : "object-cover"}`}
                            src={media.src}
                            alt={cap ?? `item-${i}`}
                            loading="lazy"
                            decoding="async"
                          />
                        ))}
                      {overlayCaption &&
                        cap !== undefined &&
                        (captionPlacement === "bottom" ? (
                          <div className="absolute inset-x-0 bottom-0 pointer-events-none">
                            <div className="bg-gradient-to-t from-black/70 via-black/30 to-transparent px-1 pt-4 pb-1 text-[10px] md:text-[11px] leading-tight text-white text-center font-medium drop-shadow-sm">
                              <div className="truncate">{line1}</div>
                              {line2 && <div className="truncate">{line2}</div>}
                            </div>
                          </div>
                        ) : (
                          <div
                            className={
                              overlayTextClassName ??
                              "absolute inset-0 w-full h-full flex flex-col items-center justify-center text-[9px] md:text-[10px] text-slate-50 leading-tight text-center pointer-events-none px-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                            }
                          >
                            {overlayCaptionInline ? (
                              <div
                                className="flex flex-wrap items-center justify-center"
                                style={overlayTextStyle}
                              >
                                {cap}
                              </div>
                            ) : (
                              <>
                                <div style={overlayTextStyle}>{line1}</div>
                                <div style={overlayTextStyle}>{line2}</div>
                              </>
                            )}
                          </div>
                        ))}
                    </>
                  )}
                  {itemHrefForIndex?.(i) && (
                    <Link
                      to={itemHrefForIndex(i)!}
                      onClick={() => onItemClick?.(i)}
                      className="absolute inset-0"
                      aria-label={cap ? `Open ${cap}` : `Open item ${i + 1}`}
                    />
                  )}
                </div>
                {!overlayCaption && cap !== undefined && (
                  <div className="mt-1 text-[9px] md:text-[10px] text-slate-600 text-center">
                    {cap}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        aria-label="Previous"
        onClick={() => emblaApi?.scrollPrev()}
        className={`absolute left-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow border border-slate-200 z-10 transition-opacity ${
          canPrev
            ? "opacity-100 text-slate-600 hover:bg-white cursor-pointer"
            : "opacity-50 text-slate-400 cursor-not-allowed"
        }`}
        disabled={!canPrev}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => emblaApi?.scrollNext()}
        className={`absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow border border-slate-200 z-10 transition-opacity ${
          canNext
            ? "opacity-100 text-slate-600 hover:bg-white cursor-pointer"
            : "opacity-50 text-slate-400 cursor-not-allowed"
        }`}
        disabled={!canNext}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
