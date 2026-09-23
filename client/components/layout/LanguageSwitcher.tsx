import { languageOptions } from "@/i18n";
import { useLanguage } from "@/contexts/LanguageContext";

type LanguageSwitcherProps = {
  className?: string;
};

export default function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { language, setLanguage, copy } = useLanguage();

  return (
    <div
      aria-label={copy.language.select}
      className={`flex flex-wrap items-center gap-1 ${className}`}
      role="group"
    >
      {languageOptions.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLanguage(option.code)}
          aria-label={option.name}
          aria-pressed={language === option.code}
          className={`rounded border px-2 py-1 text-xs font-semibold transition ${
            language === option.code
              ? "border-[#004FFF] bg-[#004FFF] text-white"
              : "border-slate-300 bg-white/70 text-slate-700 hover:border-[#004FFF] hover:text-[#004FFF] dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
