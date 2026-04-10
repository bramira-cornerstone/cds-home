import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ProfileRow {
  wallet_address?: string | null;
  username?: string | null;
  tos_accepted_at?: string | null;
  email?: string | null;
  contact_frequency?: string | null;
  invite_code?: string | null;
}

type ContactFrequency =
  | "Immediately"
  | "Daily"
  | "Weekly"
  | "Monthly"
  | "Never";

const CONTACT_FREQUENCIES: ContactFrequency[] = [
  "Immediately",
  "Daily",
  "Weekly",
  "Monthly",
  "Never",
];

const isValidEmail = (email: string | null | undefined): boolean => {
  if (!email) return true;
  const emailRegex = /.+@.+\..+/;
  return emailRegex.test(email);
};

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string | null;
  profileData: ProfileRow | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function AccountModal({
  isOpen,
  onClose,
  address,
  profileData,
  isLoading,
  isError,
  error,
}: AccountModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState<string>("");
  const [contactFrequency, setContactFrequency] =
    useState<ContactFrequency>("Immediately");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const baseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  const queryEnabled = Boolean(address && baseUrl && anonKey);

  // Initialize form fields when modal opens or data loads
  useEffect(() => {
    if (profileData) {
      setEmail(profileData.email || "");
      setContactFrequency(
        (profileData.contact_frequency as ContactFrequency) || "Immediately",
      );
    }
  }, [profileData, isOpen]);

  const abbreviateAddress = (addr: string): string => {
    if (!addr || addr.length < 10) return addr;
    const start = addr.slice(0, 6);
    const end = addr.slice(-4);
    return `${start}...${end}`;
  };

  const handleCopyAddress = async () => {
    if (!address) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(address);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
        return;
      }

      const textArea = document.createElement("textarea");
      textArea.value = address;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const success = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (success) {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        throw new Error("execCommand failed");
      }
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      toast({
        title: "Error",
        description: "Failed to copy address to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSettings = async () => {
    if (!address || !baseUrl || !anonKey) {
      toast({
        title: "Error",
        description: "Missing required information",
        variant: "destructive",
      });
      return;
    }

    if (contactFrequency !== "Never" && !isValidEmail(email)) {
      toast({
        title: "Invalid Email",
        description:
          "Please enter a valid email address or set frequency to 'Never'",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        email: email || null,
        contact_frequency: contactFrequency,
      };

      const updateUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(address)}`;
      const res = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Supabase error ${res.status}`);
      }

      toast({
        title: "Success",
        description: "Your update preferences have been saved",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveEmail = async () => {
    if (!address || !baseUrl || !anonKey) {
      toast({
        title: "Error",
        description: "Missing required information",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        email: null,
        contact_frequency: "Never",
      };

      const updateUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(address)}`;
      const res = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Supabase error ${res.status}`);
      }

      setEmail("");
      setContactFrequency("Never");

      toast({
        title: "Success",
        description: "Your email has been removed and notifications disabled",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to remove email",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Content */}
          <div className="p-4 space-y-6">
            {/* Account Section */}
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white">
                Account
              </h3>
              <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {queryEnabled && !isLoading && !isError && profileData && (
                  <div>
                    <span className="font-medium">Username:</span>
                    <span className="ml-2">{profileData?.username ?? "—"}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Wallet Address:</span>
                  <div className="ml-2 flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs">
                      {address ? abbreviateAddress(address) : "Not connected"}
                    </span>
                    {address && (
                      <button
                        onClick={handleCopyAddress}
                        className="p-1 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Copy wallet address"
                        title="Copy to clipboard"
                      >
                        {copiedAddress ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {queryEnabled && !isLoading && !isError && profileData && (
                  <div>
                    <span className="font-medium">Collector Since:</span>
                    <span className="ml-2">
                      {profileData?.tos_accepted_at
                        ? new Date(profileData.tos_accepted_at).toLocaleString()
                        : "Not recorded"}
                    </span>
                  </div>
                )}
                {!queryEnabled && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Connect a wallet to load profile.
                  </p>
                )}
                {queryEnabled && isLoading && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Loading…
                  </p>
                )}
                {queryEnabled && isError && (
                  <p className="text-xs text-red-600">
                    Error: {(error as Error)?.message ?? "Failed to load"}
                  </p>
                )}
              </div>
            </div>

            {/* Updates Section */}
            {queryEnabled && !isLoading && !isError && profileData && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-2">
                    Updates
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Let you know about updates to your collection and new
                    opportunities for utility?
                  </p>
                </div>

                {/* How often? */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    How often?
                  </label>
                  <div className="space-y-2">
                    {CONTACT_FREQUENCIES.map((freq) => (
                      <label
                        key={freq}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="contact-frequency"
                          value={freq}
                          checked={contactFrequency === freq}
                          onChange={(e) =>
                            setContactFrequency(
                              e.target.value as ContactFrequency,
                            )
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {freq}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="modal-email"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                  >
                    Email
                  </label>
                  <input
                    id="modal-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSaving}
                  />
                  {email && !isValidEmail(email) && (
                    <p className="text-xs text-red-600 mt-1">
                      Please enter a valid email address (e.g.,
                      user@example.com)
                    </p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-2" style={{ marginTop: "4px" }}>
                  <button
                    onClick={handleUpdateSettings}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{
                      boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
                    }}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  {email && (
                    <button
                      onClick={handleRemoveEmail}
                      disabled={isSaving}
                      className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="ml-auto px-4 py-2 bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
