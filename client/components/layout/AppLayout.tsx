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
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-br from-[#004FFF]/50 to-[#FF6300]/50 text-foreground dark:text-white">
      <AppHeader />
      <main className="flex flex-1 flex-col overflow-x-hidden bg-transparent pb-0 pt-[129px] dark:text-white md:pt-[109px]">
        {children}
      </main>
      <FixedContactBar />
      <CookieConsentModal />
    </div>
  );
}
