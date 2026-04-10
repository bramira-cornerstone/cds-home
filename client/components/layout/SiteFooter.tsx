export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10 pb-[60px]">
      <div className="container mx-auto px-4 py-3 text-sm text-slate-600 flex flex-col sm:flex-row items-start justify-between gap-2 dark:text-white">
        <div className="flex items-center gap-2">
          <img
            src="/images/cornerstone-logo.webp"
            alt="Cornerstone Digital Sports logo"
            className="h-6 w-6 rounded-md object-cover shadow-md"
          />
          <p className="">© {year} Cornerstone Digital Sports</p>
        </div>
        <div className="text-slate-500 dark:text-slate-300">
          <p>Where fandom has value</p>
        </div>
      </div>
    </footer>
  );
}
