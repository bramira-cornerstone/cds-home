export default function AppHeader() {
  return (
    <header className="w-full border-b border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10">
      <div className="container mx-auto px-4 py-2 flex items-center gap-4 mt-6 mb-6">
        <img
          src="/images/cds-logo-color-text.webp"
          alt="Cornerstone Digital Sports"
          className="h-20 w-20 object-contain flex-shrink-0"
        />
        <h1 className="mx-auto text-[40px] md:text-[50px] lg:text-[60px] leading-[40px] md:leading-[50px] lg:leading-[60px]" style={{ fontFamily: "Roboto", fontWeight: 600 }}>
          Cornerstone Digital Sports
        </h1>
      </div>
    </header>
  );
}
