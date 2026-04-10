export default function PageFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10">
      <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <img
            src="/images/cornerstone-logo.webp"
            alt="Cornerstone Digital Sports logo"
            className="h-6 w-6 rounded-md object-cover shadow-md"
          />
          <p>© {year} Cornerstone Digital Sports</p>
        </div>
        <div>
          <p>Where fandom has value</p>
        </div>
      </div>
    </footer>
  );
}
