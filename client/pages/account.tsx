import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { Copy, Check, Square } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { INVITE_CODE_VALIDATION_ENABLED } from "@/lib/config";
import { PriorDropCard } from "@/components/PriorDropCard";
import { TutorialVideoCard } from "@/components/TutorialVideoCard";
import { FreeMoneyCard } from "@/components/FreeMoneyCard";
import {
  fetchPriorDropNFTs,
  PRIOR_DROPS_QUERY_PARAMS,
  getTokenIdString,
  parseBigInt,
  priorDropsContract,
  corContract,
  type PriorDropNFT,
} from "@/lib/priorDrops";
import {
  getActiveClaimConditionId,
  getActiveClaimCondition,
} from "thirdweb/extensions/erc1155";

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
  if (!email) return true; // Null is valid
  const emailRegex = /.+@.+\..+/;
  return emailRegex.test(email);
};

export default function AccountPage() {
  const { toast } = useToast();
  const account = useActiveAccount();
  const address = account?.address ?? null;
  const baseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  const [email, setEmail] = useState<string>("");
  const [contactFrequency, setContactFrequency] =
    useState<ContactFrequency>("Immediately");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const abbreviateAddress = (addr: string): string => {
    if (!addr || addr.length < 10) return addr;
    const start = addr.slice(0, 6);
    const end = addr.slice(-4);
    return `${start}...${end}`;
  };

  const handleCopyAddress = async () => {
    if (!address) return;

    try {
      // Try the modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(address);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
        return;
      }

      // Fallback: use textarea + document.execCommand
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

  const queryEnabled = useMemo(
    () => Boolean(address && baseUrl && anonKey),
    [address, baseUrl, anonKey],
  );

  const { data, isLoading, isError, error } = useQuery<{
    found: boolean;
    row: ProfileRow | null;
  }>({
    queryKey: ["profile-by-wallet", address],
    enabled: queryEnabled,
    queryFn: async () => {
      if (!address || !baseUrl || !anonKey) return { found: false, row: null };

      const select =
        "wallet_address,username,tos_accepted_at,email,contact_frequency,invite_code";
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=ilike.${encodeURIComponent(address)}&select=${encodeURIComponent(select)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Supabase error ${res.status}`);
      }
      const rows = (await res.json()) as any[];
      const normalizedAddress = address.toLowerCase();
      // Find matching profile with case-insensitive wallet address comparison
      const row = Array.isArray(rows)
        ? (rows.find(
            (r) => r.wallet_address?.toLowerCase() === normalizedAddress,
          ) as ProfileRow | undefined) || null
        : null;
      return { found: !!row, row };
    },
  });

  // Check if anyone signed up using this user's invite code and fetch their username
  const { data: signupCheckData } = useQuery<{
    found: boolean;
    username?: string | null;
  }>({
    queryKey: ["signup-code-check", data?.row?.invite_code],
    enabled: Boolean(data?.row?.invite_code && baseUrl && anonKey),
    queryFn: async () => {
      if (!data?.row?.invite_code || !baseUrl || !anonKey) {
        return { found: false };
      }

      const select = "username";
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?signup_code=eq.${encodeURIComponent(data.row.invite_code)}&select=${encodeURIComponent(select)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        return { found: false };
      }
      const rows = (await res.json()) as any[];
      if (Array.isArray(rows) && rows.length > 0) {
        return { found: true, username: rows[0].username };
      }
      return { found: false };
    },
  });

  // Check if the referred user has won an auction
  const { data: referralAuctionWinData } = useQuery<{
    hasWonAuction: boolean;
  }>({
    queryKey: [
      "referral-auction-win-check",
      signupCheckData?.username,
      address,
    ],
    enabled: Boolean(
      signupCheckData?.username && baseUrl && anonKey && address,
    ),
    queryFn: async () => {
      if (!signupCheckData?.username || !baseUrl || !anonKey || !address) {
        return { hasWonAuction: false };
      }

      const username = signupCheckData.username.toLowerCase();
      const connectedWalletAddress = address.toLowerCase();

      try {
        // Check if username is in winning_bidder field for AuctionClosed events (case-insensitive)
        const selectFields = ["winning_bidder", "event_name"];
        if (INVITE_CODE_VALIDATION_ENABLED) {
          // Include additional fields for validation filtering
          selectFields.push("auction_creator", "seller", "listing_creator");
        }
        const select = selectFields.join(",");
        const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/marketplace_events_with_relics?event_name=eq.AuctionClosed&select=${encodeURIComponent(select)}&limit=1000`;
        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          return { hasWonAuction: false };
        }
        const rows = (await res.json()) as any[];

        // Check if referred user is found in winning_bidder field
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row.winning_bidder?.toLowerCase() === username) {
              // If validation is enabled, exclude records where the connected wallet is the auction_creator, seller, or listing_creator
              if (INVITE_CODE_VALIDATION_ENABLED) {
                const auctionCreator = row.auction_creator?.toLowerCase();
                const seller = row.seller?.toLowerCase();
                const listingCreator = row.listing_creator?.toLowerCase();

                if (
                  auctionCreator !== connectedWalletAddress &&
                  seller !== connectedWalletAddress &&
                  listingCreator !== connectedWalletAddress
                ) {
                  return { hasWonAuction: true };
                }
              } else {
                // If validation is disabled, accept any winning bidder match
                return { hasWonAuction: true };
              }
            }
          }
        }
        return { hasWonAuction: false };
      } catch (e) {
        console.error("Error checking referral auction win:", e);
        return { hasWonAuction: false };
      }
    },
  });

  // Fetch PriorDropNFT for token_id=0
  const { data: priorDropBoxData = null } = useQuery<PriorDropNFT | null>({
    queryKey: ["prior-drop-nft-0"],
    queryFn: async () => {
      try {
        const nfts = await fetchPriorDropNFTs(PRIOR_DROPS_QUERY_PARAMS);
        const boxZero = nfts.find((nft) => getTokenIdString(nft.id) === "0");
        return boxZero ?? null;
      } catch (err) {
        return null;
      }
    },
  });

  // Fetch active claim condition ID for token_id=0
  const { data: activeClaimConditionIdData } = useReadContract({
    contract: priorDropsContract,
    method:
      "function getActiveClaimConditionId(uint256 _tokenId) view returns (uint256)",
    params: [0n], // token_id = 0
    queryOptions: {
      enabled: Boolean(priorDropsContract),
    },
  });

  const activeClaimConditionId = useMemo(
    () => parseBigInt(activeClaimConditionIdData),
    [activeClaimConditionIdData],
  );

  // Fetch active claim condition details for token_id=0
  const {
    data: activeClaimConditionDetails,
    isPending: isClaimConditionLoading,
  } = useReadContract(getActiveClaimCondition, {
    contract: priorDropsContract,
    tokenId: 0n,
    queryOptions: {
      enabled: Boolean(priorDropsContract),
    },
  });

  // Fetch wallet claimed count for token_id=0
  const {
    data: walletClaimedData,
    isPending: isWalletClaimedLoading,
    refetch: refetchWalletClaimed,
  } = useReadContract({
    contract: priorDropsContract,
    method:
      "function getSupplyClaimedByWallet(uint256 _tokenId, uint256 _conditionId, address _claimer) view returns (uint256)",
    params:
      priorDropsContract && activeClaimConditionId !== null && address
        ? [0n, activeClaimConditionId, address]
        : undefined,
    queryOptions: {
      enabled: Boolean(
        priorDropsContract && activeClaimConditionId !== null && address,
      ),
    },
  });

  // Extract limit per wallet from claim condition
  const limitPerWallet = useMemo(() => {
    if (
      !activeClaimConditionDetails ||
      typeof activeClaimConditionDetails !== "object"
    ) {
      return null;
    }
    const record = activeClaimConditionDetails as Record<string, any>;
    // Try to access by name first, then by index
    const value =
      record["quantityLimitPerWallet"] ??
      record["3"] ??
      (Array.isArray(activeClaimConditionDetails)
        ? activeClaimConditionDetails[3]
        : undefined);
    return parseBigInt(value);
  }, [activeClaimConditionDetails]);

  // Parse wallet claimed count
  const walletClaimedCount = useMemo(
    () => parseBigInt(walletClaimedData),
    [walletClaimedData],
  );

  const isLoadingClaimData = isClaimConditionLoading || isWalletClaimedLoading;

  // Callback for after successful claim
  const handleClaimSuccess = useCallback(async () => {
    try {
      await refetchWalletClaimed();
    } catch {
      // ignore refresh errors
    }
  }, [refetchWalletClaimed]);



  // Initialize form fields when data loads
  useEffect(() => {
    if (data?.row) {
      setEmail(data.row.email || "");
      setContactFrequency(
        (data.row.contact_frequency as ContactFrequency) || "Immediately",
      );
    }
  }, [data?.row]);

  const handleUpdateSettings = async () => {
    if (!address || !baseUrl || !anonKey) {
      toast({
        title: "Error",
        description: "Missing required information",
        variant: "destructive",
      });
      return;
    }

    // Validation: if frequency is not "Never", email must be valid
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

      // Update local state after successful save
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

  return (
    <>
      <style>{`
        @media (max-width: 991px) {
          .account-responsive-wrapper {
            display: flex !important;
            flex-direction: column !important;
          }
          .privacy-link-wrapper {
            margin: 12px auto 0 !important;
          }
          .privacy-link-text {
            border-style: none !important;
            border-width: 1px !important;
          }
        }
      `}</style>
      <section className="container mx-auto px-4 py-6 nightmode_nocards account-responsive-wrapper">
        <h1 className="mb-1.5 md:mb-1.5 text-center uppercase font-sans text-[32px] leading-none text-slate-800">
          <p className="mb-1.5">My Account</p>
        </h1>

        <div className="flex flex-col md:grid md:grid-cols-2 gap-4 max-w-6xl mx-auto">
          {/* Account Column - Left on desktop, first on mobile */}
          <div className="flex flex-col gap-4 order-1 md:order-1 md:col-start-1 md:row-start-1">
            {/* Tutorial Video Card */}
            <TutorialVideoCard />

            {/* Connected Wallet Card */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 card-shadow account-card">
              <div className="text-base font-semibold text-slate-800 mb-2">
                <p>Account</p>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                {queryEnabled && !isLoading && !isError && data?.found && (
                  <div>
                    <span className="font-medium">Username:</span>
                    <span className="ml-2">{data?.row?.username ?? "—"}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Wallet Address:</span>
                  <div className="ml-2 flex items-center gap-2">
                    <span className="font-mono">
                      {address ? abbreviateAddress(address) : "Not connected"}
                    </span>
                    {address && (
                      <button
                        onClick={handleCopyAddress}
                        className="p-1 border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                        aria-label="Copy wallet address"
                        title="Copy to clipboard"
                      >
                        {copiedAddress ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-600" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {queryEnabled && !isLoading && !isError && data?.found && (
                  <div>
                    <span className="font-medium">Collector Since:</span>
                    <span className="ml-2">
                      {data?.row?.tos_accepted_at
                        ? new Date(data.row.tos_accepted_at).toLocaleString()
                        : "Not recorded"}
                    </span>
                  </div>
                )}
                {!queryEnabled && (
                  <p className="text-xs text-slate-600">
                    Connect a wallet to load profile.
                  </p>
                )}
                {queryEnabled && isLoading && (
                  <p className="text-xs text-slate-600">Loading…</p>
                )}
                {queryEnabled && isError && (
                  <p className="text-xs text-red-600">
                    Error: {(error as Error)?.message ?? "Failed to load"}
                  </p>
                )}
              </div>

              {/* Updates Section */}
              {queryEnabled && !isLoading && !isError && data?.found && (
                <>
                  <h2 className="text-base font-semibold text-slate-800 mb-2 mt-4 max-sm:mt-3">
                    Updates
                  </h2>
                  <div className="text-sm text-slate-600 mb-4 max-sm:mb-2">
                    <p>
                      Let you know about updates to your collection and new
                      opportunities for utility?
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* How often? */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        How often?
                      </label>
                      <div className="space-y-2">
                        {CONTACT_FREQUENCIES.map((freq) => (
                          <label key={freq} className="flex items-center gap-2">
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
                            <span className="text-sm text-slate-700">
                              {freq}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Email */}
                    <div className="mt-4 max-sm:mt-2">
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    <div
                      className="flex gap-2 pt-2"
                      style={{ marginTop: "4px" }}
                    >
                      <button
                        onClick={handleUpdateSettings}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                      {email && (
                        <button
                          onClick={handleRemoveEmail}
                          disabled={isSaving}
                          className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column - Claim Cards & Invite a Friend (right on desktop, second on mobile) */}
          <div className="flex flex-col gap-4 order-2 md:order-2 md:col-start-2 md:row-start-1">
            {priorDropBoxData &&
              limitPerWallet !== null &&
              walletClaimedCount !== null &&
              limitPerWallet > walletClaimedCount && (
                <div>
                  <PriorDropCard
                    nft={priorDropBoxData}
                    walletAddress={address}
                    isAccountPage={true}
                    walletClaimedCount={walletClaimedCount}
                    limitPerWallet={limitPerWallet}
                    isLoading={isLoadingClaimData}
                    contract={priorDropsContract}
                    activeClaimConditionId={activeClaimConditionId}
                    onClaimSuccess={handleClaimSuccess}
                  />
                </div>
              )}

            <FreeMoneyCard />

            {/* Be a Good Teammate Card - In right column */}
            {queryEnabled && !isLoading && !isError && data?.found && (
              <div
                className="rounded-lg border border-slate-200 bg-white p-4 card-shadow self-start teammate-card"
                style={{ height: "auto", flexGrow: "0" }}
              >
                <h2 className="text-base font-semibold text-slate-800 mb-2">
                  <p>Score an Assist</p>
                </h2>
                <div className="space-y-4 text-sm text-slate-700">
                  <div />
                  <div style={{ fontWeight: "400", marginTop: "16px" }}>
                    <p>
                      Copy this code. Send to a friend. They earn a free
                      Premiere Box and you earn one too:
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{ marginTop: 0, marginBottom: "6px" }}
                  >
                    <span className="font-mono text-sm">
                      {data?.row?.invite_code || "—"}
                    </span>
                    {data?.row?.invite_code && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            data.row.invite_code || "",
                          );
                          toast({
                            title: "Copied",
                            description: "Invite code copied to clipboard",
                          });
                        }}
                        className="p-1 border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                        aria-label="Copy invite code"
                        title="Copy to clipboard"
                      >
                        <Copy className="h-4 w-4 text-slate-600" />
                      </button>
                    )}
                  </div>
                  {/* Invite Code Video */}
                  <img
                    src="/invite_code_video.gif"
                    alt="Invite code video"
                    className="w-full"
                    style={{ display: "block", marginTop: "4px" }}
                  />
                  <div
                    style={{
                      marginTop: "0px",
                      color: "rgb(71, 85, 105)",
                      fontSize: "12px",
                      lineHeight: "19.5px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        lineHeight: "20px",
                      }}
                    >
                      <div style={{ fontWeight: "400" }}>
                        <p>
                          Once they buy at least one box or one relic on the
                          marketplace (from anyone in beta test, can not be from
                          invite sender in live product) you both earn a free
                          WFL Premiere Box containing 2 premiere collectibles
                          from 20 of the league's top stars.
                        </p>
                        <p>Their progress:</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Tracker */}
                <div
                  className="flex flex-col"
                  style={{ paddingTop: "2px", lineHeight: "16px" }}
                >
                  {[
                    "They signed up",
                    "They bought a box or relic",
                    "They claimed their free Premiere Box",
                  ].map((status, index) => {
                    const isFirstItem = index === 0;
                    const isSecondItem = index === 1;
                    const isCheckmarkVisible =
                      (isFirstItem && signupCheckData?.found) ||
                      (isSecondItem && referralAuctionWinData?.hasWonAuction);

                    return (
                      <div
                        key={status}
                        className="flex items-center"
                        style={{ gap: "2px" }}
                      >
                        {isCheckmarkVisible ? (
                          <Check
                            className="h-5 w-5"
                            style={{ color: "#FF6300" }}
                          />
                        ) : (
                          <Square className="h-5 w-5 text-slate-400" />
                        )}
                        <div className="text-xs text-slate-600">
                          <p>
                            {status}
                            {isCheckmarkVisible &&
                              signupCheckData?.username &&
                              isFirstItem && (
                                <>
                                  {": "}
                                  <a
                                    href={`/collection/${signupCheckData.username}`}
                                    className="underline text-blue-600 hover:text-blue-800"
                                  >
                                    {signupCheckData.username}
                                  </a>
                                </>
                              )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      </section>
    </>
  );
}
