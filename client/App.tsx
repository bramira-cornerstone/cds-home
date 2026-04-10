import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import Home from "./pages/Index";
import NotFound from "./pages/NotFound";
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
    }
  });

  // Prevent global error events for specific messages
  window.addEventListener("error", (ev) => {
    try {
      const err = ev.error || (ev as any).message || "";
      const msg = typeof err === "string" ? err : err?.message;
      if (typeof msg === "string" && msg.includes("Failed to fetch")) {
        ev.preventDefault();
      }
    } catch (e) {
      // no-op
    }
  });
}

function AppContent() {
  return (
    <CookieConsentProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
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
