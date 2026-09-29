import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { useLanguage } from "@/contexts/LanguageContext";
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
        className="w-full min-w-[320px] table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg text-[15px] md:text-base lg:text-lg"
      >
        <caption className="sr-only">{copy.needs.title}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[36%] rounded-tl-lg bg-[#004FFF] px-2 py-2 text-left text-[11px] font-bold text-white sm:px-3 md:text-xs lg:text-sm">
              {copy.needs.matrix.options}
            </th>
            {columns.map((column, index) => (
              <th
                key={column.label}
                scope="col"
                className={`bg-[#004FFF] px-1 py-2 text-center text-[10px] font-bold leading-tight text-white sm:px-2 md:text-xs lg:text-sm ${index === columns.length - 1 ? "rounded-tr-lg" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item} className="odd:bg-white even:bg-slate-50">
              <th scope="row" className="border-b border-slate-200 px-2 py-1.5 text-left text-[15px] font-medium leading-tight text-slate-800 sm:px-3 md:text-base lg:text-lg">
                {item}
              </th>
              {columns.map((column) => {
                const included = column.items.includes(item);

                return (
                  <td key={column.label} className="border-b border-slate-200 px-0.5 py-1 text-center">
                    {included ? (
                      <span aria-label={copy.needs.matrix.notIncluded} className="text-[26px] font-bold leading-none text-red-600 md:text-[30px] lg:text-[32px]">
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
                <span aria-label={copy.needs.matrix.included} className="text-[24px] font-bold leading-none text-green-600 md:text-[28px] lg:text-[30px]">
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
  const [isFullscreenMounted, setIsFullscreenMounted] = useState(false);
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);

  useEffect(() => {
    if (!isFullscreenMounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const animationFrame = window.requestAnimationFrame(() => {
      setIsFullscreenVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreenMounted]);

  const openFullscreen = () => setIsFullscreenMounted(true);
  const closeFullscreen = () => setIsFullscreenVisible(false);

  return (
    <section
      lang={language}
      className="homepage-section my-6 rounded-lg px-4 py-8 text-center"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
    >
      <h2
        className="mx-auto mb-0 max-w-5xl text-center text-[42px] leading-[50px] tracking-wider text-black md:text-[52px] md:leading-[60px] lg:text-[60px] lg:leading-[68px]"
        style={{ fontWeight: 700 }}
      >
        {copy.pitch.sectionHeadingLines.map((line, index) => (
          <span
            key={line}
            className={
              index === 1
                ? "block text-[20px] leading-normal font-normal italic tracking-[1px] text-[rgba(74,74,74,1)] md:text-2xl lg:text-3xl"
                : "block"
            }
          >
            {line}
          </span>
        ))}
      </h2>
      <div className="group relative mx-auto mt-4 flex min-h-[140px] w-full max-w-5xl items-center justify-center overflow-hidden rounded-lg bg-black px-4 py-3 sm:min-h-[110px] md:min-h-[500px]">
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
        <button
          type="button"
          aria-label="Open fullscreen video"
          title="Open fullscreen video"
          onClick={openFullscreen}
          className="absolute bottom-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
        <h2 className="relative z-10 w-full text-center text-[32px] font-bold leading-tight text-[#FF6300] sm:text-4xl lg:text-5xl">
          <span className="inline-block animate-sample-product">{copy.pitch.sampleProduct}</span>
        </h2>
      </div>
      <div className="mx-auto mt-4 max-w-5xl space-y-4 text-[17px] leading-relaxed text-[rgba(74,74,74,1)] sm:text-xl md:text-2xl lg:text-[28px]">
        {copy.pitch.paragraphs.map((paragraph, index) => (
          <p key={paragraph}>
            <strong>{copy.pitch.paragraphPrefixes[index]}</strong>{" "}
            {paragraph}
          </p>
        ))}
      </div>
      {isFullscreenMounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Fullscreen video"
            onTransitionEnd={(event) => {
              if (event.target === event.currentTarget && !isFullscreenVisible) {
                setIsFullscreenMounted(false);
              }
            }}
            className={`fixed inset-0 z-[30] flex items-center justify-center bg-black/90 p-4 transition-opacity duration-500 ${isFullscreenVisible ? "opacity-100" : "opacity-0"}`}
          >
            <button
              type="button"
              autoFocus
              aria-label="Close fullscreen video"
              onClick={closeFullscreen}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeFullscreen();
              }}
              className="absolute inset-0 cursor-zoom-out"
            />
            <video
              className="pointer-events-none relative z-10 h-[min(100vw_-_2rem,100dvh_-_2rem)] w-[min(100vw_-_2rem,100dvh_-_2rem)] object-cover"
              src="/images/onboarding-video.mp4"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
            />
          </div>,
          document.body,
        )}
    </section>
  );
}

function PostRevealContent() {
  const { copy, language } = useLanguage();

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
          <p className="mt-4 max-w-3xl text-[20px] leading-relaxed md:text-[40px]">
            {copy.hero.description}
            <br />
            <br />
            {copy.hero.callToAction}
          </p>
        </div>
      </div>
      <section className="container mx-auto px-0 py-0 pb-0">
        <div
          className="homepage-section !mt-6 !mb-6 flex flex-col justify-center rounded-lg px-2 py-4 sm:px-4 sm:py-6"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
        >
          <div className="!mt-3 !mb-3 flex flex-col items-center justify-center">
            <h2
              className="text-center text-[42px] uppercase tracking-wider mb-0 leading-[50px] md:text-[52px] md:leading-[60px] lg:text-[60px] lg:leading-[68px]"
              style={{
                color: "#000000",
                fontWeight: 700,
              }}
            >
              {copy.needs.title}
            </h2>
            <p className="max-w-3xl text-center text-xl leading-[24px] italic text-[rgba(74,74,74,1)] md:text-2xl md:leading-[32px] lg:text-3xl lg:leading-[40px]">
              {copy.needs.subtitle}
            </p>
          </div>
          <OpportunityMatrix />
        </div>
      </section>
      <RotatingPitchSection />
    </section>
  );
}

export default function Home() {
  const { copy } = useLanguage();

  return (
    <section className="relative min-h-screen flex flex-col">
      <PostRevealContent />

      {/* Whitepaper Download Section */}
      <section className="container mx-auto px-2 py-0 pb-0">
        <div
          className="homepage-section grid grid-cols-1 lg:grid-cols-2 gap-[17px] py-8 px-4 my-6 rounded-lg"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
        >
          <div className="flex items-center justify-center">
            <div>
              <p
                className="px-6 text-center text-[28px] leading-tight text-black dark:text-white md:text-[32px] lg:text-[36px]"
                style={{ marginTop: "36px", marginBottom: "36px" }}
              >
                {copy.whitepaper.description}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 w-full">
            <a
              href="https://drive.google.com/file/d/1Zo6yUsL2T93D4j2ONv04EiDmQ_8MZCjN/view?usp=drive_link"
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
      <section className="container relative z-40 mx-auto px-2 py-0 pb-0">
        <div className="flex flex-col items-center justify-center gap-6 px-4 py-12 text-sm text-slate-600 dark:text-slate-400 sm:flex-row md:text-base lg:text-lg">
          <div className="flex flex-col items-center gap-2">
            <Link
              to="/privacy"
              className="text-[#004FFF] underline underline-offset-2 hover:text-[#003BCC]"
            >
              Privacy Policy
            </Link>
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
          </div>
          <div>
            <p>{copy.footer.tagline}</p>
          </div>
        </div>
      </section>
    </section>
  );
}
