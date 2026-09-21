export default function Home() {
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
