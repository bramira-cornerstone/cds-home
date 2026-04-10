export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-slate-600 dark:border-t-slate-300 animate-spin"></div>
      </div>
    </div>
  );
}
