import { PropsWithChildren, useEffect } from "react";
import { useLocation } from "react-router-dom";

import AppHeader from "./AppHeader";
import PageFooter from "./PageFooter";
import FixedContactBar from "./FixedContactBar";
import { CookieConsentModal } from "@/components/CookieConsentModal";
import { loadFont, EDITION_FONT_URL } from "@/components/EditionSplineScene";

export default function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();

  // Preload font for EditionSplineScene at app bootstrap
  useEffect(() => {
    loadFont(EDITION_FONT_URL).catch(() => {});
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex flex-col overflow-x-hidden bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 text-foreground dark:bg-black dark:bg-none dark:text-white min-h-screen">
      <AppHeader />
      <main className="flex-1 overflow-x-hidden pb-24 dark:bg-black dark:text-white" style={{ backgroundColor: "rgba(255, 255, 255, 1)" }}>
        {children}
      </main>
      <PageFooter />
      <FixedContactBar />
      <CookieConsentModal />
    </div>
  );
}
