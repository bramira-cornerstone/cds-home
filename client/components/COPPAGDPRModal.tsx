import { useState, useEffect } from "react";

interface PrivacyComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (analyticsOptout: boolean) => void;
  walletAddress?: string;
}

export function PrivacyModal({
  isOpen,
  onClose,
  onSubmit,
  walletAddress,
}: PrivacyComplianceModalProps) {
  const [analyticsOptout, setAnalyticsOptout] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch current analytics_optout setting when modal opens
  useEffect(() => {
    if (!isOpen || !walletAddress) {
      setSubmitted(false);
      return;
    }

    const fetchCurrentSetting = async () => {
      try {
        setIsLoading(true);
        const baseUrl = (import.meta as any).env.SUPABASE_URL as
          | string
          | undefined;
        const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
          | string
          | undefined;

        if (!baseUrl || !anonKey) return;

        const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=analytics_optout`;
        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setAnalyticsOptout(data[0].analytics_optout || false);
          }
        }
      } catch (err) {
        console.error("Error fetching privacy settings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentSetting();
  }, [isOpen, walletAddress]);

  const handleSubmit = async () => {
    if (!walletAddress) return;

    try {
      setIsLoading(true);
      const baseUrl = (import.meta as any).env.SUPABASE_URL as
        | string
        | undefined;
      const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
        | string
        | undefined;

      if (!baseUrl || !anonKey) return;

      const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(walletAddress)}`,
        {
          method: "PATCH",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            analytics_optout: analyticsOptout,
          }),
        }
      );

      if (response.ok) {
        setSubmitted(true);
        onSubmit?.(analyticsOptout);
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } catch (err) {
      console.error("Error saving privacy preferences:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Privacy Compliance
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-700 dark:text-slate-300">
          <div className="space-y-4">
            <section>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                Your Privacy Matters
              </h3>
              <p>
                Cornerstone Digital Sports Limited ("the Company") is committed
                to protecting the privacy of all users in compliance with
                applicable laws, including the General Data Protection
                Regulation (GDPR) in the European Union, the California
                Consumer Privacy Act (CCPA), and any data protection laws in
                other relevant jurisdictions.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                1. No Data Selling
              </h4>
              <p>
                The Company does <strong>NOT</strong> sell, rent, lease, or
                share user data with third parties for marketing, advertising,
                analytics, or any commercial purpose. Your privacy is paramount.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                2. Minimal Data Collection
              </h4>
              <p>
                No personally identifiable information (PII) is collected beyond
                your login method. We only store your wallet address or
                authentication credential necessary to provide the Services.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                3. Payment Processing & KYC
              </h4>
              <p>
                All Know-Your-Customer (KYC) verification, payment processing,
                and fiat currency onboarding/offboarding is handled exclusively
                by Stripe, a third-party payment processor. The Company:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  Does <strong>NOT</strong> handle user currency directly
                </li>
                <li>
                  Does <strong>NOT</strong> view, store, or access user KYC
                  information
                </li>
                <li>
                  Does <strong>NOT</strong> act as a fiduciary with respect to
                  user funds
                </li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                4. Age Requirement
              </h4>
              <p>
                This platform is restricted to users 13 years of age and older.
                By using this service, you confirm that you meet this minimum
                age requirement.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                5. Territorial Eligibility
              </h4>
              <p>
                As a U.S.-based digital collectibles company, we operate within
                applicable regulatory frameworks. By accessing this platform,
                you confirm that you are a resident of a jurisdiction where we
                are legally permitted to conduct business.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                6. GDPR & Data Subject Rights
              </h4>
              <p>
                Users within the European Union and other jurisdictions with
                equivalent privacy protections have additional rights,
                including:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Right to access your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure ("right to be forgotten")</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, contact us at{" "}
                <strong>contact@cornerstonedigitalcollectibles.com</strong>.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                7. Data Security
              </h4>
              <p>
                The Company implements appropriate technical and organizational
                measures to protect user data against unauthorized access,
                alteration, disclosure, or destruction. However, no method of
                transmission over the internet is 100% secure.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                8. Analytics & De-Identified Data
              </h4>
              <p>
                The Company shares de-identified, aggregated data with analytics
                partners to understand platform usage patterns, improve user
                experience, and optimize performance. This data does not include
                any personally identifiable information and cannot be used to
                identify you. You have the right to opt out of this analytics
                data gathering.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                9. Contact Us
              </h4>
              <p>
                For questions about our privacy practices or to exercise your
                rights, please contact:
              </p>
              <p className="mt-2">
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:contact@cornerstonedigitalcollectibles.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  contact@cornerstonedigitalcollectibles.com
                </a>
              </p>
            </section>
          </div>
        </div>

        {/* Footer with Checkbox and Buttons */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
          {isLoading && walletAddress ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Loading your preferences...
            </p>
          ) : (
            <>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={analyticsOptout}
                  onChange={(e) => setAnalyticsOptout(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-blue-600 rounded cursor-pointer flex-shrink-0"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  I opt out of analytics data gathering. De-identified data will
                  not be shared with analytics partners.
                </span>
              </label>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!walletAddress || isLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded transition-colors"
                >
                  {isLoading ? "Saving..." : submitted ? "Preference Saved" : "Save Preference"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
