import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { PrivacyModal } from "@/components/COPPAGDPRModal";
import { useToast } from "@/components/ui/use-toast";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

export function CookieConsentModal() {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const address = account?.address ?? null;
  const { toast } = useToast();
  const { isCookieConsentOpen, closeCookieConsent, openCookieConsent, navigateTo } = useCookieConsent();

  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowModal, setShouldShowModal] = useState<boolean>(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState<boolean>(true);

  const COOKIE_KEY = `cookie_consent_${address}`;

  // Check if user has a wallet_address and if analytics_optout is NULL
  useEffect(() => {
    if (!address) {
      setIsCheckingProfile(false);
      setShouldShowModal(false);
      return;
    }

    const checkAnalyticsPreference = async () => {
      try {
        const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
        const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;

        if (!baseUrl || !anonKey) {
          setIsCheckingProfile(false);
          return;
        }

        // Query for wallet_address and analytics_optout
        const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(address)}&select=wallet_address,analytics_optout`;

        console.debug("[checkAnalyticsPreference] Checking for wallet:", address);

        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.debug("[checkAnalyticsPreference] Profile data:", data);

          if (data && data.length > 0) {
            const record = data[0];
            // Only show modal if wallet_address exists AND analytics_optout is NULL
            if (record.wallet_address && (record.analytics_optout === null || record.analytics_optout === undefined)) {
              console.debug("[checkAnalyticsPreference] Showing modal - wallet_address exists and analytics_optout is NULL");
              setShouldShowModal(true);
              openCookieConsent();
            } else {
              console.debug("[checkAnalyticsPreference] Not showing modal - wallet_address or analytics_optout already set");
              setShouldShowModal(false);
            }
          } else {
            // No profile record exists
            console.debug("[checkAnalyticsPreference] No profile record found");
            setShouldShowModal(false);
          }
        } else {
          console.debug("[checkAnalyticsPreference] Response not OK:", response.status);
          setShouldShowModal(false);
        }
      } catch (err) {
        console.error("Error checking analytics preference:", err);
        setShouldShowModal(false);
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkAnalyticsPreference();
  }, [address, openCookieConsent]);

  const handleConsent = async (analytics_optout: boolean) => {
    if (!address) return;

    setIsLoading(true);
    try {
      const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
      const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;

      if (!baseUrl || !anonKey) {
        toast({
          title: "Error",
          description: "Unable to save preferences",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Use case-sensitive match like the working examples (SiteFooter, COPPAGDPRModal)
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(address)}`;

      console.debug("[handleConsent] Updating profile", {
        address,
        analytics_optout,
        url,
      });

      // Update analytics preference to database
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analytics_optout,
        }),
      });

      console.debug("[handleConsent] Response status:", response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.error("[handleConsent] Error response:", responseText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Store in localStorage for reference
      localStorage.setItem(COOKIE_KEY, JSON.stringify({ analytics_optout, timestamp: new Date().toISOString() }));

      toast({
        title: "Preferences Saved",
        description: analytics_optout
          ? "You've opted out of analytics. Thank you for your privacy choice."
          : "Analytics enabled. Thank you for helping us improve.",
      });

      // Save navigateTo before closing the modal (which resets it)
      const destinationPath = navigateTo;
      closeCookieConsent();

      // Navigate if a destination was set when opening the modal
      if (destinationPath) {
        navigate(destinationPath);
      }
    } catch (err) {
      console.error("Error saving cookie preferences:", err);
      toast({
        title: "Error",
        description: "Failed to save your preferences",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivacyClick = () => {
    closeCookieConsent();
    setIsPrivacyModalOpen(true);
  };

  if (!address || isCheckingProfile || !shouldShowModal) {
    return null;
  }

  return (
    <>
      {/* Cookie Consent Modal */}
      {isCookieConsentOpen && shouldShowModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeCookieConsent}
          />

          {/* Modal */}
          <div className="relative w-full bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="container mx-auto px-4 py-6 max-w-2xl">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                <p>Analytics Consent & Privacy Policy</p>
              </h3>

              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                We respect your privacy. This site uses essential cookies and analytics (optional). 
                We do not sell your data. Please choose your preferences below:
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleConsent(false)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  Accept All
                </button>

                <button
                  onClick={() => handleConsent(true)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-70 disabled:cursor-not-allowed text-slate-900 dark:text-white font-medium rounded-lg transition-colors"
                >
                  Reject All
                </button>

                <button
                  onClick={handlePrivacyClick}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 disabled:opacity-70 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
                >
                  Privacy Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal - opened from cookie consent modal */}
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        walletAddress={address}
        onSubmit={async (analyticsOptout) => {
          await handleConsent(analyticsOptout);
        }}
      />
    </>
  );
}
