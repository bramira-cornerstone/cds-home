import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getTokenIdString,
  resolveMediaUrl,
  normalizeAttributes,
  buildPriorDropAttributeMap,
  parseBigInt,
  type PriorDropNFT,
  type PriorDropAttributeMap,
} from "@/lib/priorDrops";
import { useSendTransaction } from "thirdweb/react";
import { useSharedCountdownBreakdown } from "@/hooks/useSharedCountdown";
import {
  canClaim,
  claimTo,
  type BaseContract,
} from "thirdweb/extensions/erc1155";

type AttributeValue = string | number | bigint | boolean | null | undefined;

function toCleanString(value: AttributeValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    if (!Number.isFinite(Number(value))) return null;
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return null;
}

function formatPlain(value: AttributeValue): string {
  return toCleanString(value) ?? "—";
}

function formatPrice(value: AttributeValue): string {
  const numeric = toCleanString(value);
  if (!numeric) return "—";
  const withoutSymbol = numeric.replace(/^[\$\s]+/, "");
  return `$${withoutSymbol}`;
}

function parseNumeric(value: AttributeValue): number | null {
  const raw = toCleanString(value);
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function DropStartOverlay({
  startTimeString,
  tier,
}: {
  startTimeString: string | null | undefined;
  tier?: string | null;
}) {
  // Parse the start time on demand
  const startTimeMs = useMemo(() => {
    if (!startTimeString) return 0;
    const raw = String(startTimeString).trim();
    if (!raw) return 0;

    let isoDate = raw;
    if (
      isoDate &&
      /^\d{4}-\d{2}-\d{2}/.test(isoDate) &&
      !isoDate.includes("+") &&
      !isoDate.includes("Z")
    ) {
      isoDate += "-05:00";
    }

    return new Date(isoDate).getTime();
  }, [startTimeString]);

  const countdown = useSharedCountdownBreakdown(startTimeMs);

  if (!startTimeString) return null;

  const isLive = startTimeMs <= Date.now();
  const tierName = tier ?? "Drop";

  if (isLive) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="text-center px-2">
          <p
            className="italic font-bold break-words leading-tight"
            style={{ color: "#FF6300" }}
          >
            {tierName} drop LIVE!
          </p>
        </div>
      </div>
    );
  }

  let timeLeftStr = "";
  if (countdown) {
    if (countdown.days > 0) {
      timeLeftStr = `${countdown.days}d ${countdown.hours}h`;
    } else if (countdown.hours > 0) {
      timeLeftStr = `${countdown.hours}h ${countdown.minutes}m`;
    } else if (countdown.minutes > 0) {
      timeLeftStr = `${countdown.minutes}m ${countdown.seconds}s`;
    } else {
      timeLeftStr = `${countdown.seconds}s`;
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="text-center px-2">
        <p className="text-white italic font-medium break-words leading-tight text-xs md:text-sm">
          {tierName} drop in {timeLeftStr}
        </p>
      </div>
    </div>
  );
}

interface PriorDropCardProps {
  nft: PriorDropNFT;
  walletAddress?: string | null;
  isAccountPage?: boolean;
  walletClaimedCount?: bigint | null;
  limitPerWallet?: bigint | null;
  isLoading?: boolean;
  contract?: BaseContract | null;
  activeClaimConditionId?: bigint | null;
  onClaimSuccess?: () => Promise<void>;
}

export function PriorDropCard({
  nft,
  walletAddress,
  isAccountPage = false,
  walletClaimedCount,
  limitPerWallet,
  isLoading = false,
  contract = null,
  activeClaimConditionId = null,
  onClaimSuccess,
}: PriorDropCardProps) {
  const tokenId = getTokenIdString(nft.id);
  const metadata = nft.metadata ?? undefined;
  const imageUrl = resolveMediaUrl(metadata?.image);
  const normalizedAttributes = useMemo(
    () => normalizeAttributes(metadata?.attributes ?? []),
    [metadata?.attributes],
  );
  const attributeMap = useMemo(
    () => buildPriorDropAttributeMap(metadata?.attributes),
    [metadata?.attributes],
  );

  // Wallet-specific state - only used on account page
  const [claimStatus, setClaimStatus] = useState<
    "idle" | "verifying" | "verified" | "submitting" | "success" | "error"
  >("idle");
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimQuantity, setClaimQuantity] = useState<bigint>(1n);
  const { mutateAsync: sendTransaction, isPending: isSendPending } =
    useSendTransaction();

  const parsedTokenId = tokenId ? BigInt(tokenId) : null;

  // Calculate max quantity based on remaining claims (account page only)
  const maxQuantity = useMemo(() => {
    if (
      limitPerWallet !== null &&
      walletClaimedCount !== null
    ) {
      const remaining = Number(limitPerWallet) - Number(walletClaimedCount);
      return Math.max(0, remaining);
    }
    return 0;
  }, [limitPerWallet, walletClaimedCount]);

  // Initialize claim quantity to max when it loads
  useEffect(() => {
    if (maxQuantity > 0) {
      setClaimQuantity(BigInt(maxQuantity));
    }
  }, [maxQuantity]);

  const incrementQuantity = useCallback(() => {
    setClaimQuantity((prev) => {
      const next = prev + 1n;
      return next > BigInt(maxQuantity) ? BigInt(maxQuantity) : next;
    });
  }, [maxQuantity]);

  const decrementQuantity = useCallback(() => {
    setClaimQuantity((prev) => (prev > 0n ? prev - 1n : 0n));
  }, []);

  const handleClaim = useCallback(async () => {
    if (
      !contract ||
      !walletAddress ||
      parsedTokenId === null ||
      limitPerWallet === null
    ) {
      setClaimMessage("Missing required information for claim");
      setClaimStatus("error");
      return;
    }

    try {
      setClaimStatus("verifying");
      setClaimMessage(null);

      // Step 1: Verify claim eligibility
      const verifyResult = await canClaim({
        contract,
        claimer: walletAddress,
        quantity: claimQuantity,
        tokenId: parsedTokenId,
      });

      if (!verifyResult.result) {
        setClaimStatus("error");
        setClaimMessage(
          verifyResult.reason || "Claim conditions not satisfied",
        );
        return;
      }

      setClaimStatus("verified");
      setClaimMessage("Claim approved...");

      // Step 2: Submit claim transaction
      setClaimStatus("submitting");
      setClaimMessage("Claim submitting...");

      const transaction = claimTo({
        contract,
        to: walletAddress,
        tokenId: parsedTokenId,
        quantity: claimQuantity,
        from: walletAddress,
      });

      const receipt = await sendTransaction(transaction);

      setClaimStatus("success");
      setClaimMessage("Success!");

      // Step 3: Refresh claimed count and reset button
      if (onClaimSuccess) {
        try {
          await onClaimSuccess();
        } catch {
          // ignore refresh errors
        }
      }

      // Reset status after a short delay
      setTimeout(() => {
        setClaimStatus("idle");
        setClaimMessage(null);
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Claim failed";
      setClaimStatus("error");
      setClaimMessage(message);
      setTimeout(() => {
        setClaimStatus("idle");
        setClaimMessage(null);
      }, 3000);
    }
  }, [
    contract,
    walletAddress,
    parsedTokenId,
    limitPerWallet,
    sendTransaction,
    onClaimSuccess,
    claimQuantity,
  ]);

  // Calculate remaining claims and button visibility
  const remainingClaims =
    limitPerWallet !== null && walletClaimedCount !== null
      ? Math.max(0, Number(limitPerWallet) - Number(walletClaimedCount))
      : 0;
  const showClaimButton = remainingClaims > 0;

  const isClaimProcessing = claimStatus !== "idle" && claimStatus !== "error";

  // IMPORTANT: All hooks must be called before conditional returns
  // Calculate displayRows for standard page view
  const displayRows = useMemo(() => {
    const boxesReleasingNumber = parseNumeric(attributeMap.max_claimable);
    const supplyClaimedNumber = parseNumeric(attributeMap.supply_claimed);
    const supplyRemainingValue =
      boxesReleasingNumber !== null && supplyClaimedNumber !== null
        ? Math.max(
            boxesReleasingNumber - supplyClaimedNumber,
            0,
          ).toLocaleString()
        : formatPlain(attributeMap.supply_claimed);

    const baseRows = [
      {
        key: "series",
        label: "Series",
        value: formatPlain(attributeMap.series),
      },
      {
        key: "drop_week",
        label: "Drop Week",
        value: formatPlain(attributeMap.drop_week),
      },
      {
        key: "tier",
        label: "Tier",
        value: formatPlain(
          attributeMap.tier ??
            attributeMap.tier_value ??
            attributeMap.tiervalue,
        ),
      },
      { key: "price", label: "Price", value: formatPrice(attributeMap.price) },
      {
        key: "supply_remaining",
        label: "Supply Remaining",
        value: supplyRemainingValue,
      },
    ];

    return baseRows;
  }, [attributeMap]);

  // ACCOUNT PAGE RENDER - separate path to avoid flash
  // Render account page version when on /account page
  if (isAccountPage) {
    return (
      <article className="grid gap-2 rounded-lg border border-slate-200 bg-white/70 p-6 md:grid-cols-[minmax(0,280px)_1fr] dark:bg-slate-700 dark:border-white/10 card-shadow account-prior-drop-card">
        <div className="md:col-span-2 space-y-2">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white text-center">
            Claim 10 free boxes to help us try out the product
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300 text-center">
            Each box contains two random relics from twenty WFL MatchMaker
            Premieres
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {imageUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-slate-100 dark:bg-black">
              <img
                src={imageUrl}
                alt={
                  metadata?.name ??
                  (tokenId ? `Token ${tokenId}` : "Prior drop")
                }
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500 dark:bg-black dark:text-white">
              Image unavailable
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="rounded-lg border border-white sm:border-blue-200 bg-white sm:bg-blue-50 px-2 py-1 sm:p-4 dark:border-blue-900/50 dark:bg-blue-950/30 flex flex-col gap-0">
            {isLoading ? (
              <p className="text-center text-sm md:text-base font-medium text-blue-900 dark:text-blue-100">
                Loading claim details...
              </p>
            ) : (
              <>
                <p className="text-center text-sm md:text-base font-medium text-blue-900 dark:text-blue-100 mb-0">
                  You can claim{" "}
                  <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                    {remainingClaims}
                  </span>{" "}
                  more free boxes:
                </p>
                <div className="flex flex-col gap-2">
                  {showClaimButton ? (
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-1">
                        <button
                          type="button"
                          onClick={decrementQuantity}
                          disabled={
                            claimQuantity === 0n ||
                            isClaimProcessing ||
                            isSendPending
                          }
                          className="w-[25px] bg-white text-blue-600 sm:bg-transparent sm:text-slate-700 sm:dark:text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:text-blue-600"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={claimQuantity.toString()}
                          onChange={(e) => {
                            const val = BigInt(
                              Math.max(
                                0,
                                Math.min(Number(e.target.value), maxQuantity),
                              ),
                            );
                            setClaimQuantity(val);
                          }}
                          disabled={isClaimProcessing || isSendPending}
                          className="w-12 text-center bg-transparent dark:text-white border-none focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={incrementQuantity}
                          disabled={
                            claimQuantity >= BigInt(maxQuantity) ||
                            isClaimProcessing ||
                            isSendPending
                          }
                          className="w-[25px] bg-white text-blue-600 sm:bg-transparent sm:text-slate-700 sm:dark:text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:text-blue-600"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleClaim}
                        disabled={isClaimProcessing || isSendPending}
                        className="flex-1 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white card-shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-0 disabled:opacity-70"
                      >
                        <p>CLAIM YOURS</p>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center rounded-md bg-slate-400 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 mt-0"
                    >
                      OPEN BOXES
                    </button>
                  )}
                  {claimMessage && (
                    <p
                      className={`text-center text-xs ${
                        claimStatus === "error"
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {claimMessage}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  // STANDARD PRIOR DROPS PAGE RENDER
  return (
    <article className="grid gap-6 rounded-lg border border-slate-200 bg-white/70 p-6 shadow-sm md:grid-cols-[minmax(0,280px)_1fr] dark:bg-slate-700 dark:border-white/10">
      <div className="md:col-span-2 space-y-2">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white text-center">
          {metadata?.name ?? "Untitled Drop"}
        </h2>
        {metadata?.description ? (
          <p className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300 text-center">
            {metadata.description}
          </p>
        ) : (
          <p className="text-sm md:text-base leading-relaxed text-slate-500 dark:text-slate-400 text-center">
            No description provided for this drop.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {imageUrl ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-slate-100 dark:bg-black">
            <img
              src={imageUrl}
              alt={
                metadata?.name ?? (tokenId ? `Token ${tokenId}` : "Prior drop")
              }
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <DropStartOverlay
              startTimeString={
                attributeMap.start_time ??
                attributeMap.startTime ??
                attributeMap.StartTime
              }
              tier={
                attributeMap.tier ??
                attributeMap.tier_value ??
                attributeMap.tiervalue
              }
            />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500 dark:bg-black dark:text-white">
            Image unavailable
          </div>
        )}
        <div>
          {tokenId ? (
            <Link
              to={`/box/${tokenId}`}
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              CLAIM YOURS
            </Link>
          ) : (
            <button
              type="button"
              className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-md bg-slate-300 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white"
              disabled
            >
              CLAIM YOURS
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {displayRows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
              <tbody className="bg-white dark:bg-black dark:text-white">
                {displayRows.map((attr) => (
                  <tr
                    key={attr.key}
                    className="odd:bg-white even:bg-slate-50 dark:odd:bg-black dark:even:bg-black"
                  >
                    <td className="px-3 py-2 align-top font-medium text-slate-700 dark:text-white">
                      {attr.label}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600 dark:text-white">
                      {attr.value ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div></div>
      </div>
    </article>
  );
}
