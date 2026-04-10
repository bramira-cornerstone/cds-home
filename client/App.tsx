import "./global.css";

import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThirdwebProvider, useActiveAccount } from "thirdweb/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ChatPollingProvider } from "@/contexts/ChatPollingContext";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { initializeAnalytics } from "@/utils/analytics";
import Home from "./pages/Index";
import PriorDropsPage, {
  BoxOwnedDetailPage,
} from "./pages/prior_drops";
import CollectionPage from "./pages/collection";
import DataPage from "./pages/data";
import InfoPage from "./pages/info";
import EarnPage from "./pages/earn";
import TeamLeaderboardPage from "./pages/earn/team-leaderboard";
import InfoBlogPage from "./pages/info-blog";
import InfoFaqPage from "./pages/info-faq";
import InfoContactPage from "./pages/info-contact";
import NotFound from "./pages/NotFound";
import VoteDetailPage from "./pages/vote-detail";
import MyTeamPage from "./pages/my_team";
import RedeemPage from "./pages/redeem";
import RedeemDetailPage from "./pages/redeem/redeem-detail";
import ProfilePage from "./pages/join";
import AccountPage from "./pages/account";
import MarketPage from "./pages/market";
import ManageListingPage from "./pages/market/manage-listing";
import ListingDetailPage from "./pages/market/listing";
import ActiveAuctionsPage from "./pages/active-auctions";
import CurrentOffersPage from "./pages/current-offers";
import EditionDetailPage from "./pages/edition_detail";
import EditionSerialsPage from "./pages/edition/serials";
import BuyOfferBidPage from "./pages/edition/serial/buy-offer-bid";
import StakePage from "./pages/edition/serial/stake";
import AlertsPage from "./pages/alerts";
import VotePage from "./pages/vote";
import BoxQueuePage from "./pages/box/queue";
import EventsPage from "./pages/events";
import SettleAuctionPage from "./pages/settle-auction";
import SnapshotRelicPage from "./pages/snapshot-relic";
import Onboarding1 from "./pages/onboarding1";
import Onboarding2 from "./pages/onboarding2";
import Onboarding3 from "./pages/onboarding3";
import Onboarding4 from "./pages/onboarding4";
import AppLayout from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

// Global handlers to catch and suppress noisy network-related errors
if (typeof window !== "undefined") {
  // Suppress unhandled promise rejections from third-party scripts that cause noisy console errors
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (
      reason &&
      (typeof reason === "string" ? reason : reason?.message)?.includes?.(
        "Failed to fetch",
      )
    ) {
      // prevent default logging for known transient network errors
      event.preventDefault();
      // Optionally report to an internal logger here
      // console.warn("Suppressed unhandledrejection: ", reason);
    }
  });

  // Prevent global error events for specific messages
  window.addEventListener("error", (ev) => {
    try {
      const err = ev.error || (ev as any).message || "";
      const msg = typeof err === "string" ? err : err?.message;
      if (typeof msg === "string" && msg.includes("Failed to fetch")) {
        ev.preventDefault();
        // console.warn("Suppressed window error:", msg);
      }
    } catch (e) {
      // no-op
    }
  });
}

function AnalyticsInitializer() {
  const account = useActiveAccount();

  useEffect(() => {
    const gaId = (import.meta as any).env.GOOGLE_ANALYTICS_TOKEN as string;
    const mixpanelToken = (import.meta as any).env
      .MIXPANEL_TOKEN as string;

    // Pass wallet address to analytics initialization
    // Only collects if wallet exists and user has explicitly opted in
    initializeAnalytics(account?.address, {
      gaId,
      mixpanelToken,
    });
  }, [account?.address]);

  return null;
}

function AppContent() {
  return (
    <CookieConsentProvider>
      <ChatPollingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ThirdwebProvider>
            <AnalyticsInitializer />
            <Routes>
              <Route
                path="/snapshot/relic/:token_id"
                element={<SnapshotRelicPage />}
              />
              <Route
                path="*"
                element={
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/onboarding1" element={<Onboarding1 />} />
                      <Route path="/onboarding2" element={<Onboarding2 />} />
                      <Route path="/onboarding3" element={<Onboarding3 />} />
                      <Route path="/onboarding4" element={<Onboarding4 />} />
                      <Route path="/prior-drops" element={<PriorDropsPage />} />
                      <Route path="/box/:tokenId" element={<BoxOwnedDetailPage />} />
                      <Route
                        path="/box/:token_id/queue"
                        element={<BoxQueuePage />}
                      />
                      <Route
                        path="/marketplace"
                        element={<Navigate to="/market" replace />}
                      />
                      <Route path="/collection" element={<CollectionPage />} />
                      <Route
                        path="/collection/:username"
                        element={<CollectionPage />}
                      />
                      <Route path="/data" element={<DataPage />} />
                      <Route path="/info" element={<InfoPage />} />
                      <Route path="/info/blog" element={<InfoBlogPage />} />
                      <Route path="/info/faq" element={<InfoFaqPage />} />
                      <Route
                        path="/info/contact"
                        element={<InfoContactPage />}
                      />
                      <Route path="/reward" element={<EarnPage />} />
                      <Route
                        path="/reward/:team"
                        element={<TeamLeaderboardPage />}
                      />

                      {/* Join */}
                      <Route path="/join" element={<ProfilePage />} />

                      {/* Mid-level pages */}
                      <Route path="/redeem" element={<RedeemPage />} />
                      <Route
                        path="/redeem/:redeemId"
                        element={<RedeemDetailPage />}
                      />
                      <Route path="/account" element={<AccountPage />} />

                      {/* Detail pages for placeholder items */}
                      <Route path="/vote" element={<VotePage />} />
                      <Route
                        path="/vote/:component"
                        element={<VoteDetailPage section="VOTE" />}
                      />
                      <Route
                        path="/redeem/:component"
                        element={<VoteDetailPage section="REDEEM" />}
                      />
                      <Route
                        path="/reward/:component"
                        element={<VoteDetailPage section="EARN" />}
                      />

                      {/* My Club */}
                      <Route path="/my_club" element={<MyTeamPage />} />

                      {/* Marketplace */}
                      <Route path="/market" element={<MarketPage />} />
                      <Route
                        path="/active-auctions"
                        element={<ActiveAuctionsPage />}
                      />
                      <Route
                        path="/market/listing/:listingId"
                        element={<ListingDetailPage />}
                      />

                      <Route path="/alerts" element={<AlertsPage />} />
                      <Route path="/events" element={<EventsPage />} />
                      <Route
                        path="/edition-:editionId"
                        element={<EditionDetailPage />}
                      />
                      <Route
                        path="/edition/:editionId"
                        element={<EditionDetailPage />}
                      />
                      <Route
                        path="/edition/:editionId/serials"
                        element={<EditionSerialsPage />}
                      />
                      <Route
                        path="/edition/:editionId/serial/:serial"
                        element={<EditionDetailPage />}
                      />
                      <Route
                        path="/edition/:editionId/serial/:serial/current-offers"
                        element={<CurrentOffersPage />}
                      />
                      <Route
                        path="/edition/:editionId/serial/:serial/manage-listing"
                        element={<ManageListingPage />}
                      />
                      <Route
                        path="/edition/:editionId/serial/:serial/stake"
                        element={<StakePage />}
                      />
                      <Route
                        path="/edition/:editionId/serial/:serial/buy-offer-bid"
                        element={<BuyOfferBidPage />}
                      />
                      <Route
                        path="/box/:tokenId/manage-listing"
                        element={<ManageListingPage />}
                      />
                      <Route
                        path="/settle-auction/:auctionId"
                        element={<SettleAuctionPage />}
                      />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                }
              />
            </Routes>
            </ThirdwebProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ChatPollingProvider>
    </CookieConsentProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
