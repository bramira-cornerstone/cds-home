export default function AppHeader() {
  return (
    <header className="w-full border-b border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10">
      <div className="container mx-auto px-4 py-2 flex items-center gap-4">
        <img
          src="/images/cds-logo-color-text.webp"
          alt="Cornerstone Digital Sports"
          className="h-20 w-20 object-contain flex-shrink-0"
        />
        <h1 style={{ fontFamily: "Roboto", fontSize: "40px", lineHeight: "40px", fontWeight: 600 }}>
          Cornerstone Digital Sports
        </h1>
      </div>
    </header>
  );
}
