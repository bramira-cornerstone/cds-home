import { useEffect, useState, type CSSProperties } from "react";

type FeatureCard = {
  title: string;
  titleColor: string;
  description: string[];
  descriptionClassName: string;
  image: string;
  imageAlt: string;
  background: string;
  imageContainerClassName: string;
  imageContainerStyle?: CSSProperties;
  imageClassName: string;
  imageStyle?: CSSProperties;
  caption?: string;
};

const featureCards: FeatureCard[] = [
  {
    title: "OWN THE PLAYS",
    titleColor: "#FF6300",
    description: [
      "Limited edition, interactive, 3d digital cards capturing sports history with owner name and market data on-card",
    ],
    descriptionClassName: "text-[22px]",
    image: "/images/relicGif2.gif",
    imageAlt: "Relic Card",
    background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)",
    imageContainerClassName: "w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900",
    imageContainerStyle: { height: "280px" },
    imageClassName: "w-full h-full object-contain",
    caption: "*Sample product with sample league",
  },
  {
    title: "VOTING",
    titleColor: "#FF6300",
    description: [
      "Users vote on supply released.",
      "Most popular becomes the most scarce.",
      "The least popular not released at all.",
    ],
    descriptionClassName: "text-[19px]",
    image: "/images/voteGif.gif",
    imageAlt: "Vote Card",
    background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)",
    imageContainerClassName: "w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900",
    imageContainerStyle: { height: "280px" },
    imageClassName: "w-full h-full object-contain",
  },
  {
    title: "CONFIDENCE",
    titleColor: "#FF6300",
    description: [
      "No loot boxes, no gambling.",
      "Guaranteed pulls, no losers.",
      "Higher tier access for supporting collectors.",
    ],
    descriptionClassName: "text-[20px]",
    image: "/images/basicBox.webp",
    imageAlt: "Basic Box",
    background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)",
    imageContainerClassName: "rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col justify-center items-start",
    imageContainerStyle: { height: "200px" },
    imageClassName: "object-cover",
    imageStyle: {
      width: "300px",
      height: "220px",
      marginLeft: "auto",
      marginRight: "auto",
      objectPosition: "center",
    },
  },
  {
    title: "UTILITY",
    titleColor: "#004FFF",
    description: [
      "Redeem team relics for new.",
      "Utility you can trust - no rug pulls",
      "or randomness.",
    ],
    descriptionClassName: "text-[20px]",
    image: "/images/teamGrid.webp",
    imageAlt: "Team Grid",
    background: "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)",
    imageContainerClassName: "rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex flex-col justify-center items-center flex-shrink-0",
    imageContainerStyle: { height: "250px" },
    imageClassName: "object-scale-down",
    imageStyle: { marginLeft: "auto", marginRight: "auto", height: "300px" },
  },
  {
    title: "SOCIAL",
    titleColor: "#FF6300",
    description: [
      "No more lonely marketplace.",
      "Friends can follow your trophy case, collecting events, badges, and ranks",
    ],
    descriptionClassName: "text-[20px]",
    image: "/images/trophyCaseSplash.webp",
    imageAlt: "Trophy Case",
    background: "linear-gradient(135deg, rgba(0, 79, 255, 0.05) 0%, rgba(255, 99, 0, 0.05) 100%)",
    imageContainerClassName: "w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex items-center justify-center",
    imageContainerStyle: { height: "250px" },
    imageClassName: "w-full h-auto object-cover",
  },
];

function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const activeCard = featureCards[activeIndex];

  useEffect(() => {
    if (isPaused) return;

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % featureCards.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isPaused]);

  const showPrevious = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? featureCards.length - 1 : currentIndex - 1,
    );
  };

  const showNext = () => {
    setActiveIndex((currentIndex) => (currentIndex + 1) % featureCards.length);
  };

  return (
    <section className="container mx-auto px-2 py-0 pb-0">
      <div className="relative left-1/2 h-[calc(100dvh-232px)] w-screen -translate-x-1/2 overflow-hidden md:h-screen">
        <video
          className="h-full w-full object-cover"
          src="/images/problem.mp4"
          autoPlay
          muted
          playsInline
          aria-hidden="true"
        />
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/20 px-6 text-center text-white">
          <h2 className="text-[50px] font-bold leading-tight md:text-[96px]">
            Media Fragmentation
          </h2>
          <p className="mt-4 max-w-3xl text-[24px] leading-relaxed md:text-[40px]">
            Live sports are among the most valuable IP in the world. But after the match, other platforms attract more of the attention and extract more of the value.
            <br />
            <br />
            We help you bring it back.
          </p>
        </div>
      </div>
      <div
        className="homepage-section relative grid grid-cols-1 lg:grid-cols-2 gap-[17px] py-8 px-4 my-6 rounded-lg min-h-[372px]"
        style={{ background: activeCard.background }}
      >
        <div className="flex items-center justify-center">
          <div>
            <p
              className="text-center text-[42px] uppercase tracking-wider mb-2"
              style={{
                color: activeCard.titleColor,
                fontWeight: 700,
                lineHeight: "50px",
                marginTop: "24px",
              }}
            >
              {activeCard.title}
            </p>
            <p
              className={`text-center ${activeCard.descriptionClassName} dark:text-white`}
              style={{
                fontWeight: 100,
                lineHeight: "26px",
                color: "rgba(74, 74, 74, 1)",
                fontStyle: "italic",
                fontFamily: "Roboto Condensed, sans-serif",
                marginTop: "36px",
                marginBottom: "36px",
              }}
            >
              {activeCard.description.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < activeCard.description.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div>
            <div
              className={activeCard.imageContainerClassName}
              style={activeCard.imageContainerStyle}
            >
              <img
                src={activeCard.image}
                alt={activeCard.imageAlt}
                className={activeCard.imageClassName}
                loading="lazy"
                style={activeCard.imageStyle}
              />
            </div>
            {activeCard.caption ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
                {activeCard.caption}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={showPrevious}
          aria-label="Previous feature"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-2xl leading-none text-slate-700 shadow-sm transition hover:bg-white dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={showNext}
          aria-label="Next feature"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-2xl leading-none text-slate-700 shadow-sm transition hover:bg-white dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          ›
        </button>

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {featureCards.map((card, index) => (
            <button
              key={card.title}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${card.title.toLowerCase()} feature`}
              className={`h-2.5 w-2.5 rounded-full border transition ${
                index === activeIndex
                  ? "border-slate-700 bg-slate-700 dark:border-slate-200 dark:bg-slate-200"
                  : "border-slate-400 bg-transparent dark:border-slate-500"
              }`}
            />
          ))}
          <button
            type="button"
            onClick={() => setIsPaused((currentPaused) => !currentPaused)}
            aria-label={isPaused ? "Resume carousel" : "Pause carousel"}
            className="ml-1 rounded border border-slate-400 px-1.5 text-[10px] leading-[10px] text-slate-600 transition hover:bg-white dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            {isPaused ? "▶" : "Ⅱ"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <section className="relative min-h-screen flex flex-col">
      <FeatureCarousel />

      {/* Whitepaper Download Section */}
      <section className="container mx-auto px-2 py-0 pb-0">
        <div
          className="homepage-section grid grid-cols-1 lg:grid-cols-2 gap-[17px] py-8 px-4 my-6 rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 99, 0, 0.05) 0%, rgba(0, 79, 255, 0.05) 100%)",
          }}
        >
          <div className="flex items-center justify-center">
            <div>
              <p
                className="text-center text-[28px] leading-tight text-black dark:text-white px-6"
                style={{ marginTop: "36px", marginBottom: "36px" }}
              >
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
