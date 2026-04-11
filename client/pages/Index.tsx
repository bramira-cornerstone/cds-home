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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px" }}>
                  OWN THE PLAYS
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
                  Limited edition, interactive, 3d digital cards capturing sports history with owner name and market data on-card
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#004FFF", fontWeight: 700, lineHeight: "50px" }}>
                  RELICS
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
                  Physical card don't capture the event.
                  <br />
                  Video clips don't feel ownable.
                  <br />
                  Ours bridge this gap.
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "rgba(0, 79, 255, 1)", fontWeight: 700, lineHeight: "50px" }}>
                  POWER
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
                  The first collectible that listens to its fans.
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px" }}>
                  VOTE TO MINT
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
                  Users vote on supply released.Most popular made the highest tier.The least popular not released at all.
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px" }}>
                  Get Started
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#004FFF", fontWeight: 700, lineHeight: "50px" }}>
                  SELL
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#004FFF", fontWeight: 700, lineHeight: "50px" }}>
                  REDEEM
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px" }}>
                  Value
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px" }}>
                  Showcase
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
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
                <p className="text-center text-[44px] uppercase tracking-wider mb-2" style={{ color: "#004FFF", fontWeight: 700, lineHeight: "50px" }}>
                  Community
                </p>
                <p className="text-center text-[24px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif" }}>
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
              <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white px-6">
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
              <img
                src="/images/drive-icon.webp"
                alt="Google Drive"
                className="w-8 h-8 object-contain"
              />
            </a>
            <a
              href="#"
              className="flex items-center justify-center w-16 h-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:shadow-lg transition"
              title="Download from Microsoft Word"
            >
              <img
                src="/images/word-icon.webp"
                alt="Microsoft Word"
                className="w-8 h-8 object-contain"
              />
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
