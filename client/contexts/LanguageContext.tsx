import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  languageOptions,
  translations,
  type LanguageCode,
  type TranslationSet,
} from "@/i18n";

const LANGUAGE_STORAGE_KEY = "cds-language";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  copy: TranslationSet;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";

  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (languageOptions.some((option) => option.code === savedLanguage)) {
    return savedLanguage as LanguageCode;
  }

  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, copy: translations[language] }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
