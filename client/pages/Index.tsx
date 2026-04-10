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
    <section className="relative min-h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="container mx-auto px-2 py-8 flex-1">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6 py-12">
            <h1 className="text-5xl md:text-6xl font-bold text-black dark:text-white">
              Welcome to the Platform
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Explore, collect, and trade relics on our community-driven marketplace.
            </p>
          </div>

          {/* Explore Section */}
          <section className="space-y-4">
            <h2 className="text-3xl font-bold text-black dark:text-white">
              Explore
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
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

          {/* Features Section */}
          <section className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
              <div className="flex items-center justify-center">
                <div>
                  <p className="text-center text-[14px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF6300" }}>
                    Demand
                  </p>
                  <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                    Cards people want, trades people value
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
                    Rarity
                  </p>
                  <p className="text-center text-[32px] font-bold leading-tight text-black dark:text-white">
                    Rare cards, common cards. Your favorites.
                  </p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

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
