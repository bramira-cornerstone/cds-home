import { useEffect, useState, useMemo } from "react";
import { fetchHomepageMarketplaceCards } from "@/lib/homepageMarketplaceCards";
import SerialCardMini from "@/components/SerialCardMini";

export default function Home() {
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);
  const [newRelics, setNewRelics] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [activeAuctionCards, setActiveAuctionCards] = useState<any[]>([]);
  const [marketplaceIndex, setMarketplaceIndex] = useState(0);

  // Marketplace item type
  type MarketplaceItem = {
    type: "listing" | "sale" | "auction";
    id: number;
    serial: number | null;
    name: string | null;
    thumb?: string | null;
    price: string | null;
    username?: string | null;
    auctionCreatorUsername?: string | null;
    increaseFromAsking?: string | null;
    auctionEndTs?: number;
    minted?: number | null;
    gameDate?: string | null;
    createDate?: string | null;
    setName?: string | null;
    badge?: string | null;
    badge2?: string | null;
    badge3?: string | null;
    team?: string | null;
  };

  // Combine marketplace items
  const marketplaceItems = useMemo(() => {
    const items: MarketplaceItem[] = [];
    const maxLength = Math.max(
      newRelics.length,
      recentSales.length,
      activeAuctionCards.length,
    );

    for (let i = 0; i < maxLength; i++) {
      if (i < newRelics.length) {
        const relic = newRelics[i];
        items.push({
          type: "listing",
          id: relic.editionId || relic.id,
          serial: relic.serial,
          name: relic.name,
          thumb: relic.thumb,
          price: relic.price,
          username: relic.listing_creator_username,
          minted: relic.minted,
          gameDate: relic.gameDate,
          createDate: relic.createDate,
          setName: relic.setName,
          badge: relic.badge,
          badge2: relic.badge2,
          badge3: relic.badge3,
          team: relic.team,
        });
      }
      if (i < recentSales.length) {
        const sale = recentSales[i];
        items.push({
          type: "sale",
          id: sale.editionId || sale.id,
          serial: sale.serial,
          name: sale.name,
          thumb: sale.thumb,
          price: sale.price,
          username: sale.saleUsername,
          minted: sale.minted,
          gameDate: sale.gameDate,
          createDate: sale.createDate,
          setName: sale.setName,
          badge: sale.badge,
          badge2: sale.badge2,
          badge3: sale.badge3,
          team: sale.team,
        });
      }
      if (i < activeAuctionCards.length) {
        const auction = activeAuctionCards[i];
        items.push({
          type: "auction",
          id: auction.editionId,
          serial: auction.serial,
          name: auction.name,
          thumb: auction.thumb,
          price: auction.bidPrice,
          increaseFromAsking: auction.increaseFromAsking,
          auctionEndTs: auction.auctionEndTs,
          auctionCreatorUsername: auction.auctionCreatorUsername,
          minted: auction.minted,
          gameDate: auction.gameDate,
          createDate: auction.createDate,
          setName: auction.setName,
          badge: auction.badge,
          badge2: auction.badge2,
          badge3: auction.badge3,
          team: auction.team,
        });
      }
    }
    return items;
  }, [newRelics, recentSales, activeAuctionCards]);

  // Fetch marketplace data
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    const fetchData = async () => {
      try {
        const data = await fetchHomepageMarketplaceCards(ctrl.signal);
        if (!mounted) return;

        setNewRelics(data?.newRelics || []);
        setRecentSales(data?.recentSales || []);
        setActiveAuctionCards(data?.previousAuctions || []);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.debug("[Homepage] Error fetching marketplace cards:", err);
      }
    };

    fetchData();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, []);

  // Rotate carousel every 5 seconds
  useEffect(() => {
    if (marketplaceItems.length === 0) return;

    const interval = setInterval(() => {
      setMarketplaceIndex((prev) => (prev + 1) % marketplaceItems.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [marketplaceItems.length]);

  // Detect scroll position to hide scroll indicator when at bottom
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const isAtBottom = scrollTop + windowHeight >= documentHeight - 100;
      setShowScrollIndicator(!isAtBottom);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col">
      {/* Pre-login homepage sections */}
      <>
        {/* Explore & Rewards Section */}
        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  Explore
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  A new kind of sports collectible
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900" style={{ height: "280px" }}>
                <img
                  src="/images/relicGif.gif"
                  alt="Relic Card"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  Rewards
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Build your collection for weekly rewards
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* DEMAND & CONTROL Section */}
        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  DEMAND
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  You decide the supply
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900">
                <img
                  src="/images/voteGif.gif"
                  alt="Vote Card"
                  className="w-full object-cover"
                  loading="lazy"
                  style={{ marginLeft: "auto", marginRight: "auto", height: "250px" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  CONTROL
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Vote for what releases next
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Get Started & Sell Section */}
        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-4 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  Get Started
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Open a box of digital sports cards
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col justify-center items-start" style={{ height: "200px" }}>
                <img
                  src="/images/basicBox.webp"
                  alt="Basic Box"
                  className="object-cover"
                  style={{ width: "300px", height: "220px", marginLeft: "auto", marginRight: "auto", objectPosition: "center" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  SELL
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Sell on the market for cash
                </p>
              </div>
            </div>
            {marketplaceItems.length > 0 && (
              <div className="flex items-center justify-center">
                <div
                  className="flex h-full w-full min-h-0 min-w-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
                  style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.08) 0%, rgba(0, 79, 255, 0.08) 100%)", paddingLeft: "16px", paddingRight: "16px", height: "280px" }}
                >
                  <div
                    className="flex h-full w-full flex-col items-start justify-center p-3 pointer-events-none"
                    style={{ flex: 1 }}
                  >
                    <div
                      className="font-normal text-slate-700 dark:text-slate-200 text-center"
                      style={{
                        fontSize: "20px",
                        lineHeight: "20px",
                        margin: "0 auto 8px",
                      }}
                    >
                      {marketplaceItems[marketplaceIndex].type === "listing"
                        ? "New Listing"
                        : marketplaceItems[marketplaceIndex].type === "sale"
                          ? "Recent Sale"
                          : "Auction"}
                    </div>
                    {marketplaceItems[marketplaceIndex].type === "auction" ? (
                      <>
                        <p
                          className="font-bold break-words text-center"
                          style={{
                            color: "#FF6300",
                            fontSize: "18px",
                            lineHeight: "24px",
                            margin: "0 auto 4px",
                            overflowWrap: "break-word",
                            wordWrap: "break-word",
                          }}
                        >
                          {(() => {
                            const currentItem = marketplaceItems[marketplaceIndex];
                            const auctionEndTs = currentItem.auctionEndTs || 0;
                            const now = Math.floor(Date.now() / 1000);
                            const isActive = auctionEndTs > 0 && auctionEndTs > now;
                            if (isActive) {
                              return "Bidding";
                            } else {
                              return currentItem.increaseFromAsking || "Closed";
                            }
                          })()}
                        </p>
                        {(() => {
                          const currentItem = marketplaceItems[marketplaceIndex];
                          const auctionEndTs = currentItem.auctionEndTs || 0;
                          const now = Math.floor(Date.now() / 1000);
                          const isActive = auctionEndTs > 0 && auctionEndTs > now;
                          if (!isActive) {
                            return (
                              <p
                                className="break-words text-center"
                                style={{
                                  color: "#FF6300",
                                  fontSize: "12px",
                                  fontWeight: "400",
                                  lineHeight: "14.4px",
                                  overflowWrap: "break-word",
                                  margin: "0 auto",
                                }}
                              >
                                from asking
                              </p>
                            );
                          }
                        })()}
                      </>
                    ) : (
                      <p
                        className="font-bold break-words text-center"
                        style={{
                          color: "#FF6300",
                          fontSize: "40px",
                          fontWeight: "700",
                          lineHeight: "40px",
                          margin: "0 auto 4px",
                          overflowWrap: "break-word",
                          wordWrap: "break-word",
                        }}
                      >
                        {marketplaceItems[marketplaceIndex].price || ""}
                      </p>
                    )}
                    {marketplaceItems[marketplaceIndex].username && (
                      <p
                        className="break-words text-center"
                        style={{
                          color: "#000000",
                          fontSize: "20px",
                          fontWeight: "300",
                          lineHeight: "20px",
                          marginLeft: "auto",
                          marginRight: "auto",
                        }}
                      >
                        {marketplaceItems[marketplaceIndex].username}
                      </p>
                    )}
                    {marketplaceItems[marketplaceIndex].auctionCreatorUsername && (
                      <p
                        className="break-words text-center"
                        style={{
                          color: "#000000",
                          fontSize: "20px",
                          fontWeight: "300",
                          lineHeight: "20px",
                          marginLeft: "auto",
                          marginRight: "auto",
                        }}
                      >
                        {marketplaceItems[marketplaceIndex].auctionCreatorUsername}
                      </p>
                    )}
                  </div>
                  <div
                    className="flex items-center justify-center p-0 pointer-events-none"
                    style={{ flex: 1 }}
                  >
                    <div
                      className="aspect-[3/4] relative"
                      style={{ marginRight: "auto", width: "150px", height: "180px" }}
                    >
                      <div className="block h-full w-full">
                        <SerialCardMini
                          id={marketplaceItems[marketplaceIndex].id}
                          name={marketplaceItems[marketplaceIndex].name}
                          thumb={marketplaceItems[marketplaceIndex].thumb}
                          serial={marketplaceItems[marketplaceIndex].serial ?? 0}
                          minted={marketplaceItems[marketplaceIndex].minted}
                          gameDate={marketplaceItems[marketplaceIndex].gameDate}
                          createDate={marketplaceItems[marketplaceIndex].createDate}
                          setName={marketplaceItems[marketplaceIndex].setName}
                          badge={marketplaceItems[marketplaceIndex].badge}
                          badge2={marketplaceItems[marketplaceIndex].badge2}
                          badge3={marketplaceItems[marketplaceIndex].badge3}
                          team={marketplaceItems[marketplaceIndex].team}
                          disableBadgeTooltips={true}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-4 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  REDEEM
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Turn in old cards to earn a team's new one
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex flex-col justify-center items-center flex-shrink-0" style={{ height: "250px" }}>
                <img
                  src="/images/teamGrid.webp"
                  alt="Team Grid"
                  className="object-scale-down"
                  loading="lazy"
                  style={{ marginLeft: "auto", marginRight: "auto", height: "300px" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  Value
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Hold to see more scarcity over time
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex items-center justify-center" style={{ height: "250px" }}>
                <img
                  src="/images/collectionValue.webp"
                  alt="Collection Value"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  Showcase
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Customize your collection page
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex items-center justify-center" style={{ height: "250px" }}>
                <img
                  src="/images/trophyCaseSplash.webp"
                  alt="Trophy Case"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  Community
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Show off, connect, and chat with fellow fans
                </p>
              </div>
            </div>
          </div>
        </section>
      </>

      {/* Whitepaper Download Section */}
      <section className="container mx-auto px-2 py-0 pb-0">
        <div className="homepage-section grid grid-cols-1 lg:grid-cols-2 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)", height: "314px" }}>
          <div className="flex items-center justify-center">
            <div>
              <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                Download the whitepaper to understand what makes us different
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4">
            <a
              href="#"
              className="flex items-center justify-center w-16 h-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:shadow-lg transition"
              title="Download from Google Drive"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#1F8FD4" }}>
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 5.23 11.08 5 12 5c3.04 0 5.5 2.46 5.5 5.5v.5H19c2.05 0 3.71 1.66 3.71 3.71 0 1.71-1.04 2.95-2.05 3.12.02-.23.02-.47.02-.71.5-.5.99-1.01 1.41-1.61.05-.09.1-.18.14-.27.05-.1.09-.21.13-.31.04-.1.08-.2.11-.31.07-.22.12-.45.16-.68.04-.23.06-.46.06-.7z"/>
                <path d="M12 4C6.48 4 2 8.48 2 14s4.48 10 10 10 10-4.48 10-10S17.52 4 12 4m-1.5 15l-3-3h2V10h3v6h2l-3 3z"/>
              </svg>
            </a>
            <a
              href="#"
              className="flex items-center justify-center w-16 h-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:shadow-lg transition"
              title="Download from Microsoft Word"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#0078D4" }}>
                <path d="M3 3h9v9H3V3m0 11h9v9H3v-9m11-11h9v9h-9V3m0 11h9v9h-9v-9z"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Scroll Indicator */}
      {showScrollIndicator && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-bounce">
          <span className="text-sm text-slate-500 dark:text-slate-400 mb-2">Scroll to explore</span>
          <svg className="w-6 h-6 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      )}
    </section>
  );
}
