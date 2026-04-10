import { useState } from "react";
import { PrivacyModal } from "@/components/COPPAGDPRModal";
import { useToast } from "@/components/ui/use-toast";
import { useActiveAccount } from "thirdweb/react";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const account = useActiveAccount();
  const address = account?.address ?? null;
  const { toast } = useToast();
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const handlePrivacySubmit = async (analyticsOptout: boolean) => {
    if (!address) return;

    try {
      const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
      const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;

      if (!baseUrl || !anonKey) {
        toast({
          title: "Error",
          description: "Unable to save preferences",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${baseUrl}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(address)}`,
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
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast({
        title: "Success",
        description: analyticsOptout
          ? "You've opted out of analytics"
          : "Analytics preferences updated",
      });

      setIsPrivacyModalOpen(false);
    } catch (err) {
      console.error("Error saving analytics preference:", err);
      toast({
        title: "Error",
        description: "Failed to save your preferences",
        variant: "destructive",
      });
    }
  };

  return (
    <footer className="w-full border-t border-black/5 bg-white/80 dark:bg-black/80 dark:border-white/10 pb-[60px]">
      <div className="container mx-auto px-4 py-3 text-sm text-slate-600 flex flex-col sm:flex-row items-start justify-between gap-2 dark:text-white">
        <div className="flex items-center gap-2">
          <img
            src="/images/cornerstone-logo.webp"
            alt="Cornerstone Digital Sports logo"
            className="h-6 w-6 rounded-md object-cover shadow-md"
          />
          <p className="">© {year} Cornerstone Digital Sports</p>
        </div>
        <div className="text-slate-500 dark:text-slate-300">
          <p>Where fandom has value</p>
        </div>
      </div>
      <div className="container mx-auto px-4 py-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-start justify-start gap-3">
        <button
          onClick={() => setIsPrivacyModalOpen(true)}
          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium cursor-pointer transition-colors"
        >
          Privacy Policy & Analytics Opt-Out
        </button>
      </div>

      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        walletAddress={address}
        onSubmit={handlePrivacySubmit}
      />
    </footer>
  );
}
