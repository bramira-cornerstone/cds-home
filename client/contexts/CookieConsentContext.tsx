import { createContext, useContext, useState, ReactNode } from "react";

interface CookieConsentContextType {
  isCookieConsentOpen: boolean;
  openCookieConsent: (navigateTo?: string) => void;
  closeCookieConsent: () => void;
  navigateTo: string | null;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [isCookieConsentOpen, setIsCookieConsentOpen] = useState(false);
  const [navigateTo, setNavigateTo] = useState<string | null>(null);

  const openCookieConsent = (navigateTo?: string) => {
    if (navigateTo) {
      setNavigateTo(navigateTo);
    }
    setIsCookieConsentOpen(true);
  };
  const closeCookieConsent = () => {
    setIsCookieConsentOpen(false);
    setNavigateTo(null);
  };

  return (
    <CookieConsentContext.Provider
      value={{
        isCookieConsentOpen,
        openCookieConsent,
        closeCookieConsent,
        navigateTo,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return context;
}
