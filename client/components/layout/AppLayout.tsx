import { PropsWithChildren, useEffect } from "react";
import { useLocation } from "react-router-dom";

import AppHeader from "./AppHeader";
import FixedContactBar from "./FixedContactBar";
import { CookieConsentModal } from "@/components/CookieConsentModal";

export default function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex flex-col overflow-x-hidden bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 text-foreground dark:bg-black dark:bg-none dark:text-white min-h-screen">
      <AppHeader />
      <main className="flex flex-col flex-1 overflow-x-hidden pb-0 dark:bg-black dark:text-white" style={{ backgroundColor: "rgba(255, 255, 255, 1)" }}>
        {children}
      </main>
      <FixedContactBar />
      <CookieConsentModal />
    </div>
  );
}
