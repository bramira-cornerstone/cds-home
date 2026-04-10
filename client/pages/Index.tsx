import { useEffect, useState } from "react";

export default function Home() {
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

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
                    Recent Sales
                  </div>
                  <p
                    className="break-words text-center"
                    style={{
                      color: "#FF6300",
                      fontSize: "12px",
                      fontWeight: "400",
                      lineHeight: "14.4px",
                      overflowWrap: "break-word",
                      wordWrap: "break-word",
                    }}
                  >
                    Sign in to see marketplace activity
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#004FFF" }}>
                  Explore
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Buy cards on the market
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
                <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                  Rewards
                </p>
                <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                  Build your collection for weekly rewards
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
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
