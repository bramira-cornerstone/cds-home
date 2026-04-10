import { useLocation, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import { hasOpenAlerts, markAllAlertsAsSeen } from "@/lib/alerts";
import SiteSearch from "@/components/SiteSearch";
import RankBar from "@/components/RankBar";
import TeamBar from "@/components/TeamBar";

export default function SiteNav() {
  const { pathname } = useLocation();
  const account = useActiveAccount();
  const addr = account?.address ?? null;

  const [searchOpen, setSearchOpen] = useState(false);
  const searchBtnRef = useRef<HTMLButtonElement | null>(null);

  const [unread, setUnread] = useState(false);
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Update alert bell fill color based on open alerts (including Supabase)
    // If any alert has closed = false, show orange, otherwise default color
    const update = async () => {
      const hasOpen = await hasOpenAlerts(addr);
      setUnread(hasOpen);
    };
    update();
    const onStorage = () => update();
    const onAlertsUpdated = () => update();
    window.addEventListener("storage", onStorage);
    window.addEventListener("alertsUpdated", onAlertsUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("alertsUpdated", onAlertsUpdated);
    };
  }, [addr]);

  useEffect(() => {
    const path = pathname;
    const prev = prevPathRef.current;
    if (path !== prev) {
      // Close search after route change has committed
      setSearchOpen(false);

      if (prev === "/alerts" && path !== "/alerts") {
        // User navigated away from /alerts page
        // Mark all alerts as seen (clears unseen state)
        console.debug(
          "[SiteNav] Navigating away from /alerts page, marking all alerts as seen",
        );
        if (addr) {
          markAllAlertsAsSeen(addr);
        }
      }
      prevPathRef.current = path;
    }
  }, [pathname, addr]);

  // Show orange bell if there are any unclosed alerts
  const filled = unread;

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 h-[60px] sm:h-16 border-t border-slate-200/70 bg-white/80 backdrop-blur-md shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:bg-white/10 dark:border-white/10"
        aria-label="Primary"
      >
        <ul className="mx-auto flex h-full w-full items-center justify-between gap-2 sm:gap-6 px-4">
          <li className="flex-1 flex items-center justify-center mr-auto">
            <button
              ref={searchBtnRef}
              type="button"
              aria-label={searchOpen ? "Close search" : "Open search"}
              onClick={() => setSearchOpen((v) => !v)}
              className="group mx-auto flex h-[42px] w-[42px] sm:h-12 sm:w-12 items-center justify-center rounded-md transition text-slate-700 hover:text-black dark:text-white/70 hover:dark:text-white bg-white/70 dark:bg-white/20"
              title={searchOpen ? "Close search" : "Open search"}
            >
              {searchOpen ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
            </button>
          </li>
          <li className="flex-1 flex items-center justify-center">
            <RankBar />
          </li>
          <li className="flex-1 flex items-center justify-center">
            <TeamBar />
          </li>
          <li className="flex-1 flex items-center justify-center">
            <Link
              to="/alerts"
              aria-label="Alerts"
              className={`group mx-auto flex h-[42px] w-[42px] sm:h-12 sm:w-12 items-center justify-center rounded-md transition bg-white/70 dark:bg-white/20 ${filled ? "text-orange-500" : "text-slate-700 hover:text-black dark:text-white/70 hover:dark:text-white"}`}
              title="Alerts"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 21h4"></path>
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
              </svg>
            </Link>
          </li>
        </ul>
      </nav>
      <SiteSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        variant="bottom"
        hideTrigger={true}
        triggerRef={searchBtnRef}
      />
    </>
  );
}
