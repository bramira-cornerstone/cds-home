import { PropsWithChildren, useEffect } from "react";
import { useLocation } from "react-router-dom";

import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import SiteNav from "@/components/SiteNav";
import { CookieConsentModal } from "@/components/CookieConsentModal";
import { loadFont, EDITION_FONT_URL } from "@/components/EditionSplineScene";
import { useMarketplaceEventAlerts } from "@/hooks/useMarketplaceEventAlerts";
import { useInitialAlerts } from "@/hooks/useInitialAlerts";

export default function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const account = useActiveAccount();

  // Monitor marketplace events and show toast alerts
  useMarketplaceEventAlerts();

  // Generate and sync alerts when wallet connects
  useInitialAlerts();

  // Preload font for EditionSplineScene at app bootstrap
  useEffect(() => {
    loadFont(EDITION_FONT_URL).catch(() => {});
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex flex-col overflow-x-hidden bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 text-foreground dark:bg-black dark:bg-none dark:text-white sm:min-h-screen">
      <SiteHeader />
      <main className="flex-1 overflow-x-hidden dark:bg-black dark:text-white pt-16 max-sm:pt-[57px]" style={{ backgroundColor: "rgba(255, 255, 255, 1)" }}>
        {children}
      </main>
      <SiteFooter />
      {account && <SiteNav />}
      <CookieConsentModal />
    </div>
  );
}
