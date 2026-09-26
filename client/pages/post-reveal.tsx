import { useEffect, useState, type CSSProperties } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { type FeatureKey } from "@/i18n";

type FeatureCard = {
  key: FeatureKey;
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
    key: "ownThePlays",
    title: "OWN THE PLAYS",
    titleColor: "#FF6300",
    description: [
      "Limited edition, interactive, 3d digital cards capturing sports history with owner name and market data on-card",
    ],
    descriptionClassName: "text-[22px]",
    image: "/images/relicGif2.gif",
    imageAlt: "Relic Card",
    background: "linear-gradient(135deg, rgba(0, 79, 255, 0.5) 0%, rgba(255, 99, 0, 0.5) 100%)",
    imageContainerClassName: "w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900",
    imageContainerStyle: { height: "280px" },
    imageClassName: "w-full h-full object-contain",
    caption: "*Sample product with sample league",
  },
  {
    key: "voting",
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
    background: "linear-gradient(135deg, rgba(255, 99, 0, 0.5) 0%, rgba(0, 79, 255, 0.5) 100%)",
    imageContainerClassName: "w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900",
    imageContainerStyle: { height: "280px" },
    imageClassName: "w-full h-full object-contain",
  },
  {
    key: "social",
    title: "SOCIAL",
    titleColor: "#FF6300",
    description: [
      "No more lonely marketplace.",
      "Friends can follow your trophy case, collecting events, badges, and ranks",
    ],
    descriptionClassName: "text-[20px]",
    image: "/images/trophyCaseSplash.webp",
    imageAlt: "Trophy Case",
    background: "linear-gradient(135deg, rgba(0, 79, 255, 0.5) 0%, rgba(255, 99, 0, 0.5) 100%)",
    imageContainerClassName: "w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex items-center justify-center",
    imageContainerStyle: { height: "250px" },
    imageClassName: "w-full h-auto object-cover",
  },
  {
    key: "utility",
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
    background: "linear-gradient(135deg, rgba(255, 99, 0, 0.5) 0%, rgba(0, 79, 255, 0.5) 100%)",
    imageContainerClassName: "rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-900 flex flex-col justify-center items-center flex-shrink-0",
    imageContainerStyle: { height: "250px" },
    imageClassName: "object-scale-down",
    imageStyle: { marginLeft: "auto", marginRight: "auto", height: "300px" },
  },
];

function OpportunityMatrix() {
  const { copy, language } = useLanguage();
  const columns = [
    { label: copy.needs.cards.aggregates.title, items: copy.needs.cardItems.aggregates },
    { label: copy.needs.cards.converts.title, items: copy.needs.cardItems.converts },
    { label: copy.needs.cards.sustainable.title, items: copy.needs.cardItems.sustainable },
    { label: copy.needs.matrix.value, items: copy.needs.cardItems.valuable },
  ];
  const rows = [...new Set(columns.flatMap((column) => column.items))];

  return (
    <div lang={language} className="mt-5 w-full overflow-x-auto">
      <table
        aria-label={copy.needs.title}
        className="w-full min-w-[320px] table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg text-[15px]"
      >
        <caption className="sr-only">{copy.needs.title}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[36%] rounded-tl-lg bg-[#004FFF] px-2 py-2 text-left text-[11px] font-bold text-white sm:px-3">
              {copy.needs.matrix.options}
            </th>
            {columns.map((column, index) => (
              <th
                key={column.label}
                scope="col"
                className={`bg-[#004FFF] px-1 py-2 text-center text-[11px] font-bold leading-tight text-white sm:px-2 ${index === columns.length - 1 ? "rounded-tr-lg" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item} className="odd:bg-white even:bg-slate-50">
              <th scope="row" className="border-b border-slate-200 px-2 py-1.5 text-left font-medium leading-tight text-slate-800 sm:px-3">
                {item}
              </th>
              {columns.map((column) => {
                const included = column.items.includes(item);

                return (
                  <td key={column.label} className="border-b border-slate-200 px-1 py-1.5 text-center">
                    {included ? (
                      <span aria-label={copy.needs.matrix.notIncluded} className="text-[24px] font-bold leading-none text-red-600">
                        ✕
                      </span>
                    ) : (
                      <span className="sr-only">{copy.needs.matrix.notIncluded}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-white">
            <th scope="row" className="rounded-bl-lg border-t-2 border-slate-200 px-2 py-2 text-left font-bold leading-tight text-slate-900 sm:px-3">
              {copy.needs.matrix.cornerstoneModel}
            </th>
            {columns.map((column, index) => (
              <td
                key={column.label}
                className={`border-t-2 border-slate-200 px-1 py-2 text-center ${index === columns.length - 1 ? "rounded-br-lg" : ""}`}
              >
                <span aria-label={copy.needs.matrix.included} className="text-[24px] font-bold leading-none text-green-600">
                  ✓
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RotatingPitchSection() {
  const { copy, language } = useLanguage();
  const [activeHeadlineIndex, setActiveHeadlineIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setActiveHeadlineIndex((index) => (index + 1) % copy.pitch.headlines.length);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [copy.pitch.headlines.length]);

  return (
    <section
      lang={language}
      className="homepage-section my-6 rounded-lg px-4 py-8 text-center"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
    >
      <h2
        className="mx-auto mb-0 max-w-5xl text-center text-[42px] uppercase tracking-wider text-black"
        style={{ fontWeight: 700, lineHeight: "50px" }}
      >
        {copy.pitch.sectionHeadingLines.map((line, index) => (
          <span key={line}>
            {line}
            {index < copy.pitch.sectionHeadingLines.length - 1 ? <br /> : null}
          </span>
        ))}
      </h2>
      <div className="relative mx-auto mt-4 flex min-h-[140px] w-full max-w-5xl items-center justify-center overflow-hidden rounded-lg bg-black px-4 py-3 sm:min-h-[110px] lg:min-h-[100px]">
        <video
          className="absolute inset-0 z-0 h-full w-full object-cover"
          src="/images/onboarding-video.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div aria-hidden="true" className="absolute inset-0 z-[1] bg-black/50" />
        <h2 className="relative z-10 w-full text-center text-[32px] font-bold leading-tight text-[#FF6300] sm:text-4xl lg:text-5xl">
          <span
            key={activeHeadlineIndex}
            className="inline-block"
          >
            {copy.pitch.headlines[activeHeadlineIndex]}
          </span>
        </h2>
      </div>
      <div className="mx-auto mt-4 max-w-5xl space-y-4 text-[17px] leading-relaxed text-[rgba(74,74,74,1)] sm:text-xl">
        {copy.pitch.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const activeCard = featureCards[activeIndex];
  const { copy, language } = useLanguage();
  const activeCopy = copy.features[activeCard.key];

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
    <section className="container mx-auto px-1.5 py-0 pb-0">
      <div className="relative left-1/2 h-[calc(100dvh-216px)] w-screen -translate-x-1/2 overflow-hidden bg-black/30 md:h-screen">
        <video
          className="h-full w-full object-cover"
          src="/images/problem.mp4"
          autoPlay
          muted
          playsInline
          aria-hidden="true"
        />
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/20 px-6 text-center text-white">
          <h2
            lang={language}
            className="text-[40px] font-bold leading-tight hyphens-auto sm:text-[50px] md:text-[96px] [overflow-wrap:anywhere]"
          >
            {copy.hero.title}
          </h2>
          <p className="mt-4 max-w-3xl text-[24px] leading-relaxed md:text-[40px]">
            {copy.hero.description}
            <br />
            <br />
            {copy.hero.callToAction}
          </p>
        </div>
      </div>
      <RotatingPitchSection />
      <section className="container mx-auto px-0 py-0 pb-0">
        <div
          className="homepage-section my-4 flex flex-col justify-center rounded-lg px-2 py-4 sm:px-4 sm:py-6"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
        >
          <div className="flex flex-col items-center justify-center">
            <h2
              className="text-center text-[42px] uppercase tracking-wider mb-0"
              style={{
                color: "#000000",
                fontWeight: 700,
                lineHeight: "50px",
              }}
            >
              {copy.needs.title}
            </h2>
            <p className="max-w-3xl text-center text-xl leading-[24px] text-[rgba(74,74,74,1)]">
              {copy.needs.subtitle}
            </p>
          </div>
          <OpportunityMatrix />
        </div>
      </section>
      <div
        className="homepage-section relative grid grid-cols-1 lg:grid-cols-2 gap-[17px] py-8 px-4 my-6 rounded-lg min-h-[372px]"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
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
              {activeCopy.title}
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
              {activeCopy.description.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < activeCopy.description.length - 1 ? <br /> : null}
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
                alt={activeCopy.imageAlt}
                className={activeCard.imageClassName}
                loading="lazy"
                style={activeCard.imageStyle}
              />
            </div>
            {activeCopy.caption ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
                {activeCopy.caption}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={showPrevious}
          aria-label={copy.carousel.previousFeature}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-2xl leading-none text-slate-700 shadow-sm transition hover:bg-white dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={showNext}
          aria-label={copy.carousel.nextFeature}
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
              aria-label={copy.carousel.featureLabels[card.key]}
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
            aria-label={
              isPaused ? copy.carousel.resumeCarousel : copy.carousel.pauseCarousel
            }
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
  const { copy } = useLanguage();

  return (
    <section className="relative min-h-screen flex flex-col">
      <FeatureCarousel />

      {/* Whitepaper Download Section */}
      <section className="container mx-auto px-2 py-0 pb-0">
        <div
          className="homepage-section grid grid-cols-1 lg:grid-cols-2 gap-[17px] py-8 px-4 my-6 rounded-lg"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
        >
          <div className="flex items-center justify-center">
            <div>
              <p
                className="text-center text-[28px] leading-tight text-black dark:text-white px-6"
                style={{ marginTop: "36px", marginBottom: "36px" }}
              >
                {copy.whitepaper.description}
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
              title={copy.whitepaper.downloadTitle}
            >
              <img
                src="/images/drive-icon.webp"
                alt={copy.whitepaper.driveAlt}
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
              alt={copy.footer.logoAlt}
              className="h-6 w-6 rounded-md object-cover shadow-md"
            />
            <p>
              {copy.footer.copyright.replace(
                "{year}",
                String(new Date().getFullYear()),
              )}
            </p>
          </div>
          <div>
            <p>{copy.footer.tagline}</p>
          </div>
        </div>
      </section>
    </section>
  );
}
