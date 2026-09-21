import SerialCardMini from "@/components/SerialCardMini";

export default function Home() {
  const marketplaceItem = {
    id: 1,
    serial: 42,
    name: "Santiago Rojas",
    thumb: "https://image.mux.com/oTsgg00J7l9SCEQtYLz02RzTtZvEprkaHHj00TxfIvU7iI/thumbnail.png?time=5",
    price: "$38",
    username: "Caterina",
    minted: 50,
    gameDate: "2025-09-27",
    setName: "Cornerstone Premiere",
    team: "Lagos",
  };

  return (
    <section className="relative min-h-screen flex flex-col">
      {/* Pre-login homepage sections */}
      <>
        {/* Explore & Rewards Section */}
        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[42px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px", marginTop: "24px" }}>
                  OWN THE PLAYS
                </p>
                <p className="text-center text-[22px] dark:text-white" style={{ fontWeight: 100, lineHeight: "22px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif", marginTop: "36px", marginBottom: "36px" }}>
                  Limited edition, interactive, 3d digital cards capturing sports history with owner name and market data on-card
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900" style={{ height: "280px" }}>
                  <img
                    src="/images/relicGif2.gif"
                    alt="Relic Card"
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
                  *Sample product with sample league
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Voting Section */}
        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900">
                <img
                  src="/images/voteGif.gif"
                  alt="Vote Card"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[42px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px", marginTop: "24px" }}>
                  VOTING
                </p>
                <p className="text-center text-[19px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif", marginTop: "36px", marginBottom: "36px" }}>
                  Users vote on supply released.
                  <br />
                  Most popular becomes the most scarce.
                  <br />
                  The least popular not released at all.
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
                <p className="text-center text-[42px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px", marginTop: "24px" }}>
                  CONFIDENCE
                </p>
                <p className="text-center text-[20px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif", marginTop: "36px", marginBottom: "36px" }}>
                  No loot boxes, no gambling.
                  <br />
                  Guaranteed pulls, no losers.
                  <br />
                  Higher tier access for supporting collectors.
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
                    style={{ fontSize: "20px", lineHeight: "20px", margin: "0 auto 8px" }}
                  >
                    New Listing
                  </div>
                  <p
                    className="font-bold break-words text-center"
                    style={{ color: "#FF6300", fontSize: "40px", fontWeight: "700", lineHeight: "40px", margin: "0 auto 4px", overflowWrap: "break-word", wordWrap: "break-word" }}
                  >
                    $38
                  </p>
                  <p
                    className="break-words text-center"
                    style={{ color: "#000000", fontSize: "20px", fontWeight: "300", lineHeight: "20px", marginLeft: "auto", marginRight: "auto" }}
                  >
                    Caterina
                  </p>
                </div>
                <div className="flex items-center justify-center p-0 pointer-events-none" style={{ flex: 1 }}>
                  <div className="aspect-[3/4] relative" style={{ marginRight: "auto", width: "150px", height: "180px" }}>
                    <div className="block h-full w-full">
                      <SerialCardMini
                        id={marketplaceItem.id}
                        name={marketplaceItem.name}
                        thumb={marketplaceItem.thumb}
                        serial={marketplaceItem.serial}
                        minted={marketplaceItem.minted}
                        gameDate={marketplaceItem.gameDate}
                        setName={marketplaceItem.setName}
                        team={marketplaceItem.team}
                        disableBadgeTooltips={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-4 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[42px] uppercase tracking-wider mb-2" style={{ color: "#004FFF", fontWeight: 700, lineHeight: "50px", marginTop: "24px" }}>
                  UTILITY
                </p>
                <p className="text-center text-[20px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif", marginTop: "36px", marginBottom: "36px" }}>
                  Redeem team relics for new.
                  <br />
                  Utility you can trust - no rug pulls
                  <br />
                  or randomness.
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
          </div>
        </section>

        <section className="container mx-auto px-2 py-0 pb-0">
          <div className="homepage-section grid grid-cols-1 lg:grid-cols-3 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)" }}>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-center text-[42px] uppercase tracking-wider mb-2" style={{ color: "#FF6300", fontWeight: 700, lineHeight: "50px", marginTop: "24px" }}>
                  SOCIAL
                </p>
                <p className="text-center text-[20px] dark:text-white" style={{ fontWeight: 100, lineHeight: "26px", color: "rgba(74, 74, 74, 1)", fontStyle: "italic", fontFamily: "Roboto Condensed, sans-serif", marginTop: "36px", marginBottom: "36px" }}>
                  No more lonely marketplace.
                  <br />
                  Friends can follow your trophy case, collecting events, badges, and ranks
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
          </div>
        </section>
      </>

      {/* Whitepaper Download Section */}
      <section className="container mx-auto px-2 py-0 pb-0">
        <div className="homepage-section grid grid-cols-1 lg:grid-cols-2 gap-[17px] py-8 px-4 my-6 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)" }}>
          <div className="flex items-center justify-center">
            <div>
              <p className="text-center text-[28px] leading-tight text-black dark:text-white px-6" style={{ marginTop: "36px", marginBottom: "36px" }}>
                Read the whitepaper to understand how we will succeed to hold users, value, and demand where others have failed:
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 w-full">
            <a
              href="https://docs.google.com/document/d/1vifP9MGHMMv3hYUqVMFZ4yl3WiHcAoDI/edit?usp=sharing&ouid=103100335654011855903&rtpof=true&sd=true"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center aspect-square rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:shadow-lg transition"
              style={{ maxWidth: "165px" }}
              title="Download from Google Drive"
            >
              <img
                src="/images/drive-icon.webp"
                alt="Google Drive"
                className="w-full h-full object-contain"
              />
            </a>
          </div>
        </div>
      </section>

      {/* Footer Content Section */}
      <section className="container mx-auto px-2 py-0 pb-0">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-600 dark:text-slate-400 py-12 px-4">
          <div className="flex items-center gap-2">
            <img
              src="/images/cornerstone-logo.webp"
              alt="Cornerstone Digital Sports logo"
              className="h-6 w-6 rounded-md object-cover shadow-md"
            />
            <p>© {new Date().getFullYear()} Cornerstone Digital Sports</p>
          </div>
          <div>
            <p>Where fandom has value</p>
          </div>
        </div>
      </section>

    </section>
  );
}
