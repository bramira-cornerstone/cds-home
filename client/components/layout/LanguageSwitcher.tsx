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
      className={`flex flex-nowrap items-center gap-0.5 whitespace-nowrap ${className}`}
      role="group"
    >
      {languageOptions.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLanguage(option.code)}
          aria-label={option.name}
          aria-pressed={language === option.code}
          className={`px-0.5 text-[10px] font-semibold underline underline-offset-2 transition ${
            language === option.code
              ? "text-[#004FFF]"
              : "text-slate-700 hover:text-[#004FFF] dark:text-slate-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
