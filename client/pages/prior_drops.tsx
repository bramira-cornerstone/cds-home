import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  Fragment,
  type ReactNode,
} from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { FilterStyleButton } from "@/components/ui/filter-style-button";

import MiniCarousel from "@/components/MiniCarousel";
import EditionCardMini from "@/components/EditionCardMini";
import {
  fetchMintedByTierAndDropWeek,
  fetchMintedByEditionId,
  type MintedRow,
} from "@/lib/supabaseMinted";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import BoxOpenModal from "@/components/BoxOpenModal";
import { PriorDropCard } from "@/components/PriorDropCard";
import { priorDropsClient } from "@/lib/priorDrops";
import { addToQueue } from "@/lib/dropQueueUtils";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Spline from "@splinetool/react-spline";
import SplineFitted from "@/components/SplineFitted";
import EditionSplineScene from "@/components/EditionSplineScene";
import EditionMetricsTable from "@/components/EditionMetricsTable";
import HoverPill from "@/components/ui/hover-pill";
import {
  useActiveAccount,
  useReadContract,
  useSendTransaction,
} from "thirdweb/react";
import {
  canClaim,
  claimTo,
  getActiveClaimCondition,
  getActiveClaimConditionId,
} from "thirdweb/extensions/erc1155";

import {
  fetchPriorDropNFTs,
  priorDropsContract,
  PRIOR_DROPS_QUERY_PARAMS,
  normalizeAttributes,
  buildPriorDropAttributeMap,
  getTokenIdString,
  resolveMediaUrl,
  type PriorDropNFT,
  type PriorDropAttributeMap,
} from "@/lib/priorDrops";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { countInPackTokensByEditionId } from "@/lib/supabaseRelicSerialsJoined";
import { countStakedTokensByEditionId } from "@/lib/public_staking";
import { countRedeemedTokensByEditionId } from "@/lib/supabaseRedemptionEvents";

type PriorDropsAccessResult = { ready: true; contract: typeof priorDropsContract | null };

function usePriorDropsAccess(): PriorDropsAccessResult {
  return {
    ready: true,
    contract: priorDropsContract ?? null,
  };
}

function parseBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(value);
  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && "toString" in value) {
    const str = (value as { toString(): string }).toString();
    if (str) {
      try {
        return BigInt(str);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function shortenAddress(address: string, visibleChars = 4): string {
  const trimmed = address.trim();
  if (trimmed.length <= visibleChars * 2 + 2) return trimmed;
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return `${trimmed.slice(0, visibleChars + 2)}…${trimmed.slice(-visibleChars)}`;
  }
  return `${trimmed.slice(0, visibleChars + 2)}…${trimmed.slice(-visibleChars)}`;
}

function shortenHash(hash: string, visibleChars = 4): string {
  const trimmed = hash.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= visibleChars * 2 + 2) return trimmed;
  if (trimmed.startsWith("0x")) {
    return `${trimmed.slice(0, visibleChars + 2)}…${trimmed.slice(-visibleChars)}`;
  }
  return `${trimmed.slice(0, visibleChars)}…${trimmed.slice(-visibleChars)}`;
}

type AttributeValue = string | number | bigint | boolean | null | undefined;

function formatTimestampToLocal(input: AttributeValue): string {
  const clean = toCleanString(input);
  if (!clean) return "—";

  const numeric = Number(clean);
  let date: Date | null = null;

  if (Number.isFinite(numeric)) {
    const maybeDate = new Date(numeric * 1000);
    if (!Number.isNaN(maybeDate.getTime())) {
      date = maybeDate;
    }
  }

  if (!date) {
    const isoCandidate = ensureIsoWithEstOffset(clean);
    if (isoCandidate) {
      const maybeDate = new Date(isoCandidate);
      if (!Number.isNaN(maybeDate.getTime())) {
        date = maybeDate;
      }
    }
  }

  if (!date) return clean;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const CLAIM_CONDITION_FIELD_INDEX_MAP = {
  startTimestamp: 0,
  maxClaimableSupply: 1,
  supplyClaimed: 2,
  quantityLimitPerWallet: 3,
  merkleRoot: 4,
  pricePerToken: 5,
  currency: 6,
  metadata: 7,
  endTimestamp: 8,
} as const;

type ClaimConditionFieldKey = keyof typeof CLAIM_CONDITION_FIELD_INDEX_MAP;

function getClaimConditionFieldValue(
  condition: unknown,
  key: ClaimConditionFieldKey,
): AttributeValue | undefined {
  if (!condition || typeof condition !== "object") return undefined;
  const record = condition as Record<string, AttributeValue>;
  if (key in record) {
    return record[key];
  }
  const index = CLAIM_CONDITION_FIELD_INDEX_MAP[key];
  const numericKey = String(index);
  if (numericKey in record) {
    return record[numericKey];
  }
  if (Array.isArray(condition) && condition.length > index) {
    return condition[index] as AttributeValue;
  }
  return undefined;
}

function formatBigIntValue(value: bigint | null): string {
  if (value === null) return "—";
  const str = value.toString();
  if (str.length <= 15) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber.toLocaleString();
    }
  }
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const DEFAULT_CLAIM_QUANTITY = 1n;

const BOX_DETAIL_TABLE_FIELDS = [
  { key: "series", label: "Series" },
  { key: "tier", label: "Tier" },
  { key: "drop_week", label: "Drop Week" },
  { key: "price", label: "Price" },
  { key: "snapshot", label: "Available to" },
  { key: "start_time", label: "Start Time" },
  { key: "end_time", label: "End Time" },
  { key: "max_claimable", label: "Boxes Released" },
  { key: "supply_claimed", label: "Supply Remaining" },
  { key: "limit_per_wallet", label: "Limit Per Wallet" },
] as const;

type BoxDetailFieldKey = (typeof BOX_DETAIL_TABLE_FIELDS)[number]["key"];

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

function formatAvailableTo(value: AttributeValue): string {
  const raw = toCleanString(value);
  if (!raw) return "Public";
  const normalized = raw.replace(/\s+/g, "").toLowerCase();
  // Accept values like "0x", "0x0", or any string with only zeros after an optional 0x prefix as Public
  const cleaned = normalized.startsWith("0x")
    ? normalized.slice(2)
    : normalized;
  if (cleaned === "" || /^0+$/.test(cleaned)) {
    return "Public";
  }
  return "Allow List";
}

function ensureIsoWithEstOffset(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(candidate)) {
    candidate = candidate.replace(" ", "T");
  }
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(candidate)) {
    if (!candidate.includes("T")) {
      candidate = candidate.replace(" ", "T");
    }
    candidate = `${candidate}-05:00`;
  }
  const testDate = new Date(candidate);
  if (Number.isNaN(testDate.getTime())) {
    return null;
  }
  return candidate;
}

function formatDateFromEst(value: AttributeValue): string {
  const raw = toCleanString(value);
  if (!raw) return "—";
  const isoCandidate = ensureIsoWithEstOffset(raw);
  if (!isoCandidate) return raw;
  const date = new Date(isoCandidate);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseNumeric(value: AttributeValue): number | null {
  const raw = toCleanString(value);
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function formatCount(
  value: AttributeValue,
  fallbackRaw?: AttributeValue,
): string {
  const numeric = parseNumeric(value ?? fallbackRaw ?? null);
  if (numeric !== null) {
    return Math.max(numeric, 0).toLocaleString();
  }
  return formatPlain(value ?? fallbackRaw ?? null);
}

type ClaimVerificationButtonProps = {
  tokenIdString: string | null;
  contract: typeof priorDropsContract | null;
  attributeMap: PriorDropAttributeMap;
  linkHref?: string;
};

type ClaimVerificationWithContractProps = Omit<
  ClaimVerificationButtonProps,
  "contract"
> & { contract: NonNullable<typeof priorDropsContract> };

type VerificationStatus = "idle" | "loading" | "true" | "false" | "error";
type PurchaseStatus = "idle" | "pending" | "success" | "error";

function ClaimVerificationButtonWithContract({
  tokenIdString,
  contract,
  attributeMap,
  linkHref,
}: ClaimVerificationWithContractProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [checkedWallet, setCheckedWallet] = useState<string | null>(null);
  const [checkedToken, setCheckedToken] = useState<string | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>("idle");
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const {
    mutateAsync: sendTransaction,
    reset: resetSendTransaction,
    isPending: isSendPending,
  } = useSendTransaction();

  const { address: profileAddress } = useWalletProfile();
  const activeAccount = useActiveAccount();
  const walletAddress = profileAddress ?? activeAccount?.address ?? null;

  const claimerAddress = useMemo(() => {
    if (typeof walletAddress !== "string") return null;
    const trimmed = walletAddress.trim();
    return trimmed ? trimmed : null;
  }, [walletAddress]);

  const parsedTokenId = useMemo(
    () => (tokenIdString ? parseBigInt(tokenIdString) : null),
    [tokenIdString],
  );

  const limitPerWalletRaw = attributeMap.limit_per_wallet;
  const parsedLimitPerWallet = useMemo(
    () => parseBigInt(limitPerWalletRaw),
    [limitPerWalletRaw],
  );
  const claimQuantity = DEFAULT_CLAIM_QUANTITY;
  const limitPerWalletDisplay =
    typeof limitPerWalletRaw === "string"
      ? limitPerWalletRaw.trim() || "—"
      : limitPerWalletRaw === null || limitPerWalletRaw === undefined
        ? "—"
        : String(limitPerWalletRaw);

  const {
    data: activeClaimConditionIdData,
    isPending: isActiveClaimConditionIdPending,
  } = useReadContract({
    contract,
    method:
      "function getActiveClaimConditionId(uint256 _tokenId) view returns (uint256)",
    params: parsedTokenId !== null ? [parsedTokenId] : undefined,
    queryOptions: {
      enabled: Boolean(contract && parsedTokenId !== null),
    },
  });

  const activeClaimConditionId = useMemo(
    () => parseBigInt(activeClaimConditionIdData),
    [activeClaimConditionIdData],
  );

  const {
    data: walletClaimedData,
    isPending: isWalletClaimedPending,
    refetch: refetchWalletClaimed,
  } = useReadContract({
    contract,
    method:
      "function getSupplyClaimedByWallet(uint256 _tokenId, uint256 _conditionId, address _claimer) view returns (uint256)",
    params:
      contract &&
      parsedTokenId !== null &&
      activeClaimConditionId !== null &&
      claimerAddress
        ? [parsedTokenId, activeClaimConditionId, claimerAddress]
        : undefined,
    queryOptions: {
      enabled: Boolean(
        contract &&
          parsedTokenId !== null &&
          activeClaimConditionId !== null &&
          claimerAddress,
      ),
    },
  });

  const {
    data: activeClaimConditionDetails,
    isPending: isActiveClaimConditionDetailsPending,
  } = useReadContract(getActiveClaimCondition, {
    contract,
    tokenId: parsedTokenId ?? 0n,
    queryOptions: {
      enabled: Boolean(contract && parsedTokenId !== null),
    },
  });

  const walletClaimedAmount = useMemo(
    () => parseBigInt(walletClaimedData),
    [walletClaimedData],
  );

  const claimConditionMaxSupply = useMemo(
    () =>
      parseBigInt(
        getClaimConditionFieldValue(
          activeClaimConditionDetails,
          "maxClaimableSupply",
        ),
      ),
    [activeClaimConditionDetails],
  );

  const claimConditionSupplyClaimed = useMemo(
    () =>
      parseBigInt(
        getClaimConditionFieldValue(
          activeClaimConditionDetails,
          "supplyClaimed",
        ),
      ),
    [activeClaimConditionDetails],
  );

  const claimConditionRemaining = useMemo(() => {
    if (claimConditionMaxSupply === null) return null;
    const claimed = claimConditionSupplyClaimed ?? 0n;
    const remaining = claimConditionMaxSupply - claimed;
    return remaining >= 0n ? remaining : 0n;
  }, [claimConditionMaxSupply, claimConditionSupplyClaimed]);

  const claimConditionStartTimestamp = useMemo(
    () =>
      getClaimConditionFieldValue(
        activeClaimConditionDetails,
        "startTimestamp",
      ),
    [activeClaimConditionDetails],
  );

  const claimConditionEndTimestamp = useMemo(
    () =>
      getClaimConditionFieldValue(activeClaimConditionDetails, "endTimestamp"),
    [activeClaimConditionDetails],
  );

  const claimConditionLimitPerWallet = useMemo(
    () =>
      parseBigInt(
        getClaimConditionFieldValue(
          activeClaimConditionDetails,
          "quantityLimitPerWallet",
        ),
      ),
    [activeClaimConditionDetails],
  );

  const packsClaimedDisplay = useMemo(() => {
    if (!claimerAddress) return "Connect wallet";
    if (
      isActiveClaimConditionIdPending ||
      isWalletClaimedPending ||
      isActiveClaimConditionDetailsPending
    ) {
      return "Loading…";
    }
    if (walletClaimedAmount !== null) {
      const asNumber = Number(walletClaimedAmount);
      if (Number.isSafeInteger(asNumber)) {
        return asNumber.toLocaleString();
      }
      return walletClaimedAmount.toString();
    }
    return "—";
  }, [
    claimerAddress,
    isActiveClaimConditionIdPending,
    isWalletClaimedPending,
    isActiveClaimConditionDetailsPending,
    walletClaimedAmount,
  ]);

  const resetDialog = useCallback(() => {
    setStatus("idle");
    setFeedback(null);
    setCheckedWallet(null);
    setCheckedToken(null);
    setPurchaseStatus("idle");
    setPurchaseMessage(null);
    setTransactionHash(null);
    resetSendTransaction();
  }, [resetSendTransaction]);

  const handleDialogChange = useCallback(
    (open: boolean) => {
      setIsDialogOpen(open);
      if (!open) {
        resetDialog();
      }
    },
    [resetDialog],
  );

  const navigate = useNavigate();

  const handleVerify = useCallback(async () => {
    setPurchaseStatus("idle");
    setPurchaseMessage(null);
    setTransactionHash(null);
    resetSendTransaction();

    if (!tokenIdString || parsedTokenId === null) {
      setStatus("error");
      setFeedback("Token is unavailable for verification.");
      setCheckedToken(tokenIdString ?? null);
      setIsDialogOpen(true);
      return;
    }

    if (!claimerAddress) {
      setStatus("error");
      setFeedback("Connect your wallet to verify claim eligibility.");
      setCheckedToken(tokenIdString);
      setIsDialogOpen(true);
      return;
    }

    setStatus("loading");
    setFeedback(null);
    setCheckedWallet(claimerAddress);
    setCheckedToken(tokenIdString);

    try {
      // Check if claim start time is in the future
      const now = Math.floor(Date.now() / 1000);
      if (
        claimConditionStartTimestamp &&
        claimConditionStartTimestamp > BigInt(now)
      ) {
        setStatus("false");
        setFeedback(
          `Claim has not started yet. It will be available on ${formatTimestampToLocal(
            claimConditionStartTimestamp,
          )}.`,
        );
        setIsDialogOpen(true);
        return;
      }

      if (
        activeClaimConditionId !== null &&
        claimerAddress &&
        parsedTokenId !== null
      ) {
        try {
          await refetchWalletClaimed();
        } catch {
          // ignore refresh errors
        }
      }

      const result = await canClaim({
        contract,
        claimer: claimerAddress,
        quantity: claimQuantity,
        tokenId: parsedTokenId,
      });

      if (result.result) {
        // Claim verified successfully, add to queue and navigate to queue page
        if (claimerAddress && tokenIdString) {
          let startTimeMs: number | undefined;

          // Prefer the drop phase start time from Supabase (attributeMap.start_time)
          const startTimeStr = attributeMap.start_time;
          if (startTimeStr) {
            const isoCandidate = ensureIsoWithEstOffset(toCleanString(startTimeStr));
            if (isoCandidate) {
              const date = new Date(isoCandidate);
              if (!Number.isNaN(date.getTime())) {
                startTimeMs = date.getTime();
              }
            }
          }

          // Fallback to claim condition start time if available
          if (!startTimeMs && claimConditionStartTimestamp) {
            startTimeMs = Number(claimConditionStartTimestamp) * 1000;
          }

          addToQueue(tokenIdString, claimerAddress, startTimeMs);
        }
        navigate(`/box/${parsedTokenId}/queue`);
      } else {
        // Claim failed, show error dialog
        setStatus("false");
        const failureMessage =
          result.reason ??
          (parsedLimitPerWallet !== null && parsedLimitPerWallet > 0n
            ? `Claim conditions not satisfied. Limit per wallet is ${parsedLimitPerWallet.toString()}.`
            : "Claim conditions not satisfied.");
        setFeedback(failureMessage);
        setIsDialogOpen(true);
      }
    } catch (err) {
      setStatus("error");
      setFeedback(
        err instanceof Error
          ? err.message
          : "Unable to verify claim eligibility.",
      );
      setIsDialogOpen(true);
    }
  }, [
    tokenIdString,
    parsedTokenId,
    contract,
    claimerAddress,
    claimQuantity,
    parsedLimitPerWallet,
    activeClaimConditionId,
    refetchWalletClaimed,
    resetSendTransaction,
    navigate,
    claimConditionStartTimestamp,
    attributeMap,
  ]);

  const handlePurchase = useCallback(async () => {
    if (!claimerAddress) {
      setPurchaseStatus("error");
      setPurchaseMessage("Connect your wallet to purchase.");
      return;
    }

    if (parsedTokenId === null) {
      setPurchaseStatus("error");
      setPurchaseMessage("Token is unavailable for purchase.");
      return;
    }

    if (claimQuantity <= 0n) {
      setPurchaseStatus("error");
      setPurchaseMessage("Invalid claim quantity.");
      return;
    }

    try {
      setPurchaseStatus("pending");
      setPurchaseMessage("Trying to get you a box");
      setTransactionHash(null);

      const transaction = claimTo({
        contract,
        to: claimerAddress,
        tokenId: parsedTokenId,
        quantity: claimQuantity,
        from: claimerAddress,
      });

      const receipt = await sendTransaction(transaction);
      const hash = receipt?.transactionHash ?? null;

      setPurchaseStatus("success");
      setPurchaseMessage(
        hash
          ? `Success! Transaction submitted.`
          : "Success! Claim transaction submitted.",
      );
      setTransactionHash(hash);

      try {
        await refetchWalletClaimed();
      } catch {
        // ignore refresh errors
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transaction failed.";
      setPurchaseStatus("error");
      setPurchaseMessage(message);
      setTransactionHash(null);
    }
  }, [
    claimerAddress,
    parsedTokenId,
    claimQuantity,
    contract,
    sendTransaction,
    refetchWalletClaimed,
  ]);

  const attributeBoxesRemaining = formatPlain(
    attributeMap.boxes_remaining ?? attributeMap.minted,
  );
  const attributeTotalBoxes = formatPlain(
    attributeMap.max_supply ?? attributeMap.minted,
  );
  const formattedStartTime = formatTimestampToLocal(
    claimConditionStartTimestamp,
  );
  const formattedEndTime = formatTimestampToLocal(claimConditionEndTimestamp);
  const boxesRemaining =
    claimConditionRemaining !== null
      ? formatBigIntValue(claimConditionRemaining)
      : attributeBoxesRemaining;
  const totalBoxes =
    claimConditionMaxSupply !== null
      ? formatBigIntValue(claimConditionMaxSupply)
      : attributeTotalBoxes;
  const displayLimitPerWallet =
    claimConditionLimitPerWallet !== null
      ? formatBigIntValue(claimConditionLimitPerWallet)
      : limitPerWalletDisplay;
  const priceDisplay = formatPrice(attributeMap.price);
  const tierValueDisplay = formatPlain(
    attributeMap.tier ?? attributeMap.tier_value ?? attributeMap.tiervalue,
  );
  const dropWeekDisplay = formatPlain(
    attributeMap.drop_week ?? attributeMap.drop_start ?? attributeMap.series,
  );
  const merkleRoot = attributeMap.merkle_root ?? "";
  const allowlistEnforced = Boolean(
    merkleRoot && !/^(0x)?0+$/.test(merkleRoot.toLowerCase()),
  );
  const allowlistStatusValue = allowlistEnforced ? "Allow List" : "Public";

  const displayedWallet = checkedWallet ?? claimerAddress;
  const isVerifying = status === "loading";
  const purchaseInFlight = purchaseStatus === "pending" || isSendPending;
  const isProcessing = isVerifying || purchaseInFlight;

  const displayTransactionHash = useMemo(
    () => (transactionHash ? transactionHash : null),
    [transactionHash],
  );

  const isVerificationSuccessful = status === "true";
  const canAttemptPurchase =
    isVerificationSuccessful &&
    !purchaseInFlight &&
    !isVerifying &&
    purchaseStatus !== "success" &&
    claimerAddress !== null &&
    parsedTokenId !== null &&
    claimQuantity > 0n;

  const verifyButtonLabel = isVerifying
    ? "Verifying…"
    : purchaseInFlight
      ? "Processing…"
      : "Enter the Drop";

  const purchaseButtonLabel =
    purchaseStatus === "success" ? "Claimed" : "PURCHASE";

  const resolvedMessage =
    purchaseStatus !== "idle" ? purchaseMessage : feedback;

  const messageColor =
    purchaseStatus === "success"
      ? "text-emerald-600"
      : purchaseStatus === "error"
        ? "text-red-600"
        : purchaseStatus === "pending"
          ? "text-slate-900"
          : status === "true"
            ? "text-emerald-600"
            : status === "false"
              ? "text-red-600"
              : status === "error"
                ? "text-amber-600"
                : "text-slate-600";

  const endTimestampString = toCleanString(claimConditionEndTimestamp);
  const shouldRenderEndTimeRow = Boolean(
    endTimestampString &&
      endTimestampString !== "0" &&
      formattedEndTime !== "—",
  );

  const verificationRows = useMemo(
    () => [
      {
        label: "Drop Week",
        value: dropWeekDisplay,
      },
      {
        label: "Allowlist",
        value: allowlistStatusValue,
      },
      {
        label: "Current Price",
        value: priceDisplay,
      },
      {
        label: "Start Time",
        value: formattedStartTime,
      },
      ...(shouldRenderEndTimeRow
        ? [
            {
              label: "End Time",
              value: formattedEndTime,
            },
          ]
        : []),
      {
        label: "Total Boxes",
        value: totalBoxes,
      },
      {
        label: "Boxes Remaining",
        value: boxesRemaining,
      },
      {
        label: "Limit Per Wallet",
        value: displayLimitPerWallet,
      },
      {
        label: "Packs Claimed by Wallet",
        value: packsClaimedDisplay,
      },
    ],
    [
      dropWeekDisplay,
      allowlistStatusValue,
      priceDisplay,
      formattedStartTime,
      shouldRenderEndTimeRow,
      formattedEndTime,
      totalBoxes,
      boxesRemaining,
      displayLimitPerWallet,
      packsClaimedDisplay,
    ],
  );

  const dialogDescriptionText =
    tierValueDisplay !== "—" && tierValueDisplay.trim().length > 0
      ? `${tierValueDisplay} Box`
      : "Selected drop";

  if (!tokenIdString) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="relative overflow-hidden inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-sm opacity-50 border border-slate-300 before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out"
          style={{ fontFamily: '"Roboto", sans-serif' }}
          disabled
        >
          GET YOURS
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleVerify}
        className="relative overflow-hidden inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 border border-slate-300 before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out"
        style={{ fontFamily: '"Roboto", sans-serif' }}
        disabled={isProcessing}
      >
        <p>{verifyButtonLabel}</p>
      </button>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Verification</DialogTitle>
            <DialogDescription>{dialogDescriptionText}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-4">
              <span>Wallet</span>
              <span className="font-medium text-slate-900">
                {displayedWallet
                  ? shortenAddress(displayedWallet)
                  : "Not connected"}
              </span>
            </div>
            {verificationRows.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4"
              >
                <span>{label}</span>
                <span className="font-medium text-slate-900">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-3 py-6">
            {purchaseStatus === "success" ? (
              <Fragment>
                <span className="text-lg font-semibold text-emerald-600">
                  Box secured!
                </span>
                {displayTransactionHash && (
                  <span className="font-mono text-xs text-slate-500">
                    Tx: {displayTransactionHash}
                  </span>
                )}
              </Fragment>
            ) : purchaseStatus === "error" ? (
              <span className="text-lg font-semibold text-red-600">
                Transaction failed
              </span>
            ) : isProcessing ? (
              <Fragment>
                <Loader2 className="h-12 w-12 animate-spin text-slate-900" />
                <span className="text-sm font-semibold text-slate-900">
                  Trying to get you a box
                </span>
              </Fragment>
            ) : isVerificationSuccessful ? (
              <span className="text-sm font-semibold text-emerald-600">
                Claim verified. You can purchase now.
              </span>
            ) : status === "false" ? (
              <span className="text-sm font-semibold text-red-600">
                Claim conditions not satisfied.
              </span>
            ) : status === "error" ? (
              <span className="text-sm font-semibold text-amber-600">
                Claim verification unavailable.
              </span>
            ) : (
              <span className="text-sm font-semibold text-slate-600">
                Verify eligibility to continue.
              </span>
            )}
          </div>

          {resolvedMessage && (
            <p className={`text-center text-xs ${messageColor}`}>
              {resolvedMessage}
            </p>
          )}

          <div className="mt-4 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Close
            </button>
            {purchaseStatus !== "success" && (
              <button
                type="button"
                onClick={handlePurchase}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
                disabled={!canAttemptPurchase}
              >
                {purchaseButtonLabel}
              </button>
            )}
            {linkHref && purchaseStatus === "success" && (
              <Link
                to={linkHref}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                View Box
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClaimVerificationButton({
  tokenIdString,
  contract,
  attributeMap,
  linkHref,
}: ClaimVerificationButtonProps) {
  if (!tokenIdString) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="relative overflow-hidden inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-sm opacity-50 border border-slate-300 before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out"
          style={{ fontFamily: '"Roboto", sans-serif' }}
          disabled
        >
          GET YOURS
        </button>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="relative overflow-hidden inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-sm opacity-50 border border-slate-300 before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out"
          style={{ fontFamily: '"Roboto", sans-serif' }}
          disabled
        >
          GET YOURS
        </button>
        <p className="text-center text-xs text-slate-500">
          Claim verification is unavailable right now.
        </p>
      </div>
    );
  }

  return (
    <ClaimVerificationButtonWithContract
      tokenIdString={tokenIdString}
      contract={contract}
      attributeMap={attributeMap}
      linkHref={linkHref}
    />
  );
}

function PriorDropsLayout({
  children,
  showHeader = true,
}: {
  children: ReactNode;
  showHeader?: boolean;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-4 nightmode_cards overflow-x-hidden">
      {showHeader && (
        <div className="w-full mb-8" style={{ marginBottom: "32px" }}>
          <img
            src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F5e5d15179a1d43cd858ff1a44a0fac35"
            alt="Drops banner"
            className="block w-full h-auto object-cover"
            style={{ borderRadius: "6px" }}
          />
        </div>
      )}
      {showHeader && (
        <header className="mb-2 md:mb-8 text-center">
          <h1 className="font-sans text-[40px] uppercase leading-none text-slate-800 dark:text-white">
            ALL BOXES
          </h1>
        </header>
      )}
      {children}
    </section>
  );
}

function LoadingState() {
  return (
    <article className="rounded-lg border border-slate-200 bg-white/70 p-6 shadow-sm dark:bg-slate-700 dark:border-white/10">
      <div className="space-y-4 animate-pulse">
        <div className="h-48 rounded-md bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
        <div className="h-3 w-1/3 rounded bg-slate-200" />
        <div className="h-3 w-full rounded bg-slate-200" />
        <div className="h-3 w-5/6 rounded bg-slate-200" />
      </div>
    </article>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <article className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
      {message}
    </article>
  );
}

function EmptyState() {
  return (
    <article className="rounded-lg border border-slate-200 bg-white/70 p-6 text-slate-600 dark:bg-slate-700 dark:border-white/10 dark:text-white">
      No prior drops found for the specified contract.
    </article>
  );
}

function PriorDropsList({ nfts }: { nfts: PriorDropNFT[] }) {
  const entries = nfts
    .map((nft) => ({ nft, tokenId: getTokenIdString(nft.id) }))
    .filter(
      (entry): entry is { nft: PriorDropNFT; tokenId: string } =>
        entry.tokenId !== null,
    );

  if (!entries.length) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {entries.map(({ nft, tokenId }) => (
        <PriorDropCard key={tokenId} nft={nft} />
      ))}
    </div>
  );
}

function PriorDropDetail({
  nft,
  contract,
  ownedMode = false,
}: {
  nft: PriorDropNFT;
  contract: typeof priorDropsContract | null;
  ownedMode?: boolean;
}) {
  const navigate = useNavigate();
  const tokenId = getTokenIdString(nft.id);
  const { address: profileAddress } = useWalletProfile();
  const activeAccount = useActiveAccount();
  const walletAddress = profileAddress ?? activeAccount?.address ?? null;
  const parsedTokenId = useMemo(
    () => (tokenId ? parseBigInt(tokenId) : null),
    [tokenId],
  );
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    contract,
    method:
      "function balanceOf(address account, uint256 id) view returns (uint256)",
    params:
      contract && walletAddress && parsedTokenId !== null
        ? [walletAddress, parsedTokenId]
        : undefined,
    queryOptions: {
      enabled: Boolean(contract && walletAddress && parsedTokenId !== null),
    },
  });
  const ownedQty = useMemo(() => {
    const v = balanceData as any;
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      try {
        return Number(BigInt(v));
      } catch {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      }
    }
    return 0;
  }, [balanceData]);
  const metadata = nft.metadata ?? undefined;
  const imageUrl = resolveMediaUrl(metadata?.image);
  const attributeMap = useMemo(
    () => buildPriorDropAttributeMap(metadata?.attributes),
    [metadata?.attributes],
  );

  // Fetch on-chain active claim condition ID
  const { data: activeClaimConditionIdData } = useReadContract({
    contract,
    method:
      "function getActiveClaimConditionId(uint256 _tokenId) view returns (uint256)",
    params: parsedTokenId !== null ? [parsedTokenId] : undefined,
    queryOptions: {
      enabled: Boolean(contract && parsedTokenId !== null),
    },
  });

  const activeClaimConditionId = useMemo(
    () => parseBigInt(activeClaimConditionIdData),
    [activeClaimConditionIdData],
  );

  // Fetch on-chain claim condition details
  const { data: activeClaimConditionDetails } = useReadContract(
    getActiveClaimCondition,
    {
      contract,
      tokenId: parsedTokenId ?? 0n,
      queryOptions: {
        enabled: Boolean(contract && parsedTokenId !== null),
      },
    },
  );

  // Parse claim condition values
  const claimConditionMaxSupply = useMemo(
    () =>
      parseBigInt(
        getClaimConditionFieldValue(
          activeClaimConditionDetails,
          "maxClaimableSupply",
        ),
      ),
    [activeClaimConditionDetails],
  );

  const claimConditionSupplyClaimed = useMemo(
    () =>
      parseBigInt(
        getClaimConditionFieldValue(
          activeClaimConditionDetails,
          "supplyClaimed",
        ),
      ),
    [activeClaimConditionDetails],
  );

  const claimConditionStartTimestamp = useMemo(
    () =>
      getClaimConditionFieldValue(
        activeClaimConditionDetails,
        "startTimestamp",
      ),
    [activeClaimConditionDetails],
  );

  const claimConditionEndTimestamp = useMemo(
    () =>
      getClaimConditionFieldValue(activeClaimConditionDetails, "endTimestamp"),
    [activeClaimConditionDetails],
  );

  const claimConditionLimitPerWallet = useMemo(
    () =>
      parseBigInt(
        getClaimConditionFieldValue(
          activeClaimConditionDetails,
          "quantityLimitPerWallet",
        ),
      ),
    [activeClaimConditionDetails],
  );

  const claimConditionAvailability = useMemo(() => {
    const merkleRoot = getClaimConditionFieldValue(
      activeClaimConditionDetails,
      "merkleRoot",
    );
    const merkleRootStr = toCleanString(merkleRoot);
    const isPublic =
      merkleRootStr ===
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    return isPublic ? "Public" : "Allow List Only";
  }, [activeClaimConditionDetails]);

  const tableRows = useMemo(() => {
    const boxesReleasingNumber =
      claimConditionMaxSupply !== null
        ? Number(claimConditionMaxSupply)
        : parseNumeric(attributeMap.max_claimable);
    const supplyClaimedNumber =
      claimConditionSupplyClaimed !== null
        ? Number(claimConditionSupplyClaimed)
        : parseNumeric(attributeMap.supply_claimed);

    const boxesReleasingValue = formatCount(
      boxesReleasingNumber ?? attributeMap.max_claimable,
      attributeMap.max_claimable,
    );

    const supplyRemainingValue =
      boxesReleasingNumber !== null && supplyClaimedNumber !== null
        ? Math.max(
            boxesReleasingNumber - supplyClaimedNumber,
            0,
          ).toLocaleString()
        : formatPlain(attributeMap.supply_claimed);

    const endTimeToDisplay =
      claimConditionEndTimestamp ?? attributeMap.end_time;
    const endTimeRaw = toCleanString(endTimeToDisplay);
    const shouldShowEndTime =
      endTimeRaw !== null ? !endTimeRaw.startsWith("1970-01-01") : true;

    return BOX_DETAIL_TABLE_FIELDS.flatMap(({ key, label }) => {
      let value: string;
      switch (key as BoxDetailFieldKey) {
        case "series":
          value = formatPlain(attributeMap.series);
          break;
        case "tier":
          value = formatPlain(attributeMap.tier);
          break;
        case "drop_week":
          value = formatPlain(attributeMap.drop_week);
          break;
        case "price":
          value = formatPrice(attributeMap.price);
          break;
        case "snapshot":
          value = formatAvailableTo(attributeMap.snapshot);
          break;
        case "start_time":
          value = claimConditionStartTimestamp
            ? formatTimestampToLocal(claimConditionStartTimestamp)
            : formatDateFromEst(attributeMap.start_time);
          break;
        case "end_time":
          if (!shouldShowEndTime) {
            return [];
          }
          value = claimConditionEndTimestamp
            ? formatTimestampToLocal(claimConditionEndTimestamp)
            : formatDateFromEst(attributeMap.end_time);
          break;
        case "max_claimable":
          value = boxesReleasingValue;
          break;
        case "supply_claimed":
          value = supplyRemainingValue;
          break;
        case "limit_per_wallet":
          value =
            claimConditionLimitPerWallet !== null
              ? formatBigIntValue(claimConditionLimitPerWallet)
              : formatPlain(attributeMap.limit_per_wallet);
          break;
        default:
          value = formatPlain(attributeMap[key]);
      }
      return [{ key, label, value }];
    });
  }, [
    attributeMap,
    claimConditionMaxSupply,
    claimConditionSupplyClaimed,
    claimConditionStartTimestamp,
    claimConditionEndTimestamp,
    claimConditionLimitPerWallet,
  ]);

  const splineSceneUrl = useMemo(
    () =>
      toCleanString(
        (attributeMap as any).model ??
          attributeMap.external_id ??
          attributeMap.external_url,
      ),
    [attributeMap],
  );

  const [openModal, setOpenModal] = useState(false);
  const [showOpenVideo, setShowOpenVideo] = useState(false);
  const [showOpenCarousel, setShowOpenCarousel] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareImageSrc, setShareImageSrc] = useState<string | null>(null);

  // Transaction + awarded tokens flow
  const [txPending, setTxPending] = useState(false);
  const [awardedTokenIds, setAwardedTokenIds] = useState<number[] | null>(null);
  const [txResult, setTxResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Relic carousel state: items derived from awarded tokens (or fallback random)
  const [relicLoading, setRelicLoading] = useState(false);
  const [relicItems, setRelicItems] = useState<
    { row: MintedRow; serial: number }[]
  >([]);

  // Hooks and state for edition counts
  const { listings: activeListings } = useActiveListings();
  const { auctions: activeAuctions } = useActiveAuctions();
  const [stakedCount, setStakedCount] = useState<number>(0);
  const [inPacksCount, setInPacksCount] = useState<number>(0);
  const [redeemedCount, setRedeemedCount] = useState<number>(0);

  // Cleanup when closing carousel - do not re-fetch on open
  useEffect(() => {
    if (!showOpenCarousel) {
      setRelicLoading(false);
      setRelicItems([]);
    }
  }, [showOpenCarousel]);

  // Get the current relic's edition_id
  const currentRelicEditionId = useMemo(() => {
    if (!relicItems.length) return null;
    return (
      relicItems[carouselIndex % relicItems.length]?.row?.edition_id ?? null
    );
  }, [relicItems, carouselIndex]);

  // Calculate active listings count for the current relic's edition
  const activeListingsCount = useMemo(() => {
    if (!currentRelicEditionId) return 0;

    const serialsSet = new Set<number>();

    // Add serials from active listings
    if (activeListings) {
      for (const listing of activeListings) {
        if (
          listing.editionId === currentRelicEditionId &&
          listing.serial !== null &&
          listing.status === "active"
        ) {
          serialsSet.add(listing.serial);
        }
      }
    }

    // Add serials from active auctions
    if (activeAuctions) {
      for (const auction of activeAuctions) {
        if (
          auction.editionId === currentRelicEditionId &&
          auction.serial !== null &&
          auction.status === "active"
        ) {
          serialsSet.add(auction.serial);
        }
      }
    }

    return serialsSet.size;
  }, [currentRelicEditionId, activeListings, activeAuctions]);

  // Fetch staked count for the current relic's edition
  useEffect(() => {
    if (!currentRelicEditionId) {
      setStakedCount(0);
      return;
    }
    let cancelled = false;
    countStakedTokensByEditionId(currentRelicEditionId, undefined)
      .then((count) => {
        if (!cancelled) setStakedCount(count);
      })
      .catch(() => {
        if (!cancelled) setStakedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentRelicEditionId]);

  // Fetch in-packs count for the current relic's edition
  useEffect(() => {
    if (!currentRelicEditionId) {
      setInPacksCount(0);
      return;
    }
    let cancelled = false;
    countInPackTokensByEditionId(currentRelicEditionId, undefined)
      .then((count) => {
        if (!cancelled) setInPacksCount(count);
      })
      .catch(() => {
        if (!cancelled) setInPacksCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentRelicEditionId]);

  // Fetch redeemed count for the current relic's edition
  useEffect(() => {
    if (!currentRelicEditionId) {
      setRedeemedCount(0);
      return;
    }
    let cancelled = false;
    countRedeemedTokensByEditionId(currentRelicEditionId, undefined, undefined)
      .then((count) => {
        if (!cancelled) setRedeemedCount(count);
      })
      .catch(() => {
        if (!cancelled) setRedeemedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentRelicEditionId]);

  const handleOpenClick = useCallback(() => {
    setOpenModal(true);
  }, []);

  const handleListClick = useCallback(() => {
    if (!tokenId) return;

    navigate(`/box/${tokenId}/manage-listing`);
  }, [tokenId, navigate]);

  const handleBuyMoreClick = useCallback(() => {
    if (!tokenId) return;

    navigate(`/box/${tokenId}/queue`);
  }, [tokenId, navigate]);

  // When modal closes, if success and have awarded ids, start video then carousel
  useEffect(() => {
    if (openModal) return;
    if (
      txResult?.success &&
      Array.isArray(awardedTokenIds) &&
      awardedTokenIds.length
    ) {
      setShowOpenVideo(true);
      setShowOpenCarousel(false);
      setCarouselIndex(0);
    }
  }, [openModal, txResult, awardedTokenIds]);

  return (
    <div className="space-y-4 nightmode_nocards">
      <div className="w-full md:hidden mb-4">
        <img
          src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F5e5d15179a1d43cd858ff1a44a0fac35"
          alt="Drops banner"
          className="w-full h-auto object-cover rounded-md"
        />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
          {metadata?.name ?? "Untitled Drop"}
        </h1>
        {metadata?.description ? (
          <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">
            {metadata.description}
          </p>
        ) : (
          <p className="text-base leading-relaxed text-slate-500 dark:text-slate-400">
            No description provided for this drop.
          </p>
        )}
      </div>
      <div className="grid w-full overflow-hidden gap-6 min-w-0 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:items-start">
        <div className="w-full flex flex-col gap-4 min-w-0 mb-1.5">
          {splineSceneUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              {txPending ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-base text-black">
                      Transaction Pending...
                    </div>
                    <div className="h-[4.5rem] w-[4.5rem] border-2 border-black border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              ) : showOpenVideo ? (
                <video
                  src="/box_open_video.mp4"
                  className="h-full w-full object-cover"
                  autoPlay
                  playsInline
                  volume={0.5}
                  onEnded={() => {
                    setShowOpenVideo(false);
                    setShowOpenCarousel(true);
                    setCarouselIndex(0);
                  }}
                />
              ) : showOpenCarousel ? (
                <div
                  className="relative h-full w-full"
                  style={{
                    backgroundImage: "url(/images/box_open_carousel_bg.jpg)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  {/* Close control */}
                  <HoverPill
                    className="absolute top-2 left-2 z-20"
                    label="Close"
                    onClick={() => {
                      setShowOpenCarousel(false);
                      setShowOpenVideo(false);
                      setCarouselIndex(0);
                      try {
                        refetchBalance && refetchBalance();
                      } catch {}
                    }}
                  />

                  {/* Share control (expands to the left) */}
                  <HoverPill
                    className="absolute top-2 right-2 z-20"
                    label="Share"
                    direction="left"
                    icon={
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <path d="M8.59 13.51l6.83 3.98"></path>
                        <path d="M15.41 6.51L8.59 10.49"></path>
                      </svg>
                    }
                    onClick={() => {
                      setShareOpen(true);
                    }}
                  />

                  {/* Bottom-center: Open My Collection */}
                  <div className="absolute inset-x-0 bottom-2 z-20 flex items-center justify-center">
                    <FilterStyleButton
                      asChild
                      className="px-3 py-1.5 text-xs shadow-none dark:shadow-none"
                    >
                      <Link to="/collection">Open My Collection</Link>
                    </FilterStyleButton>
                  </div>

                  <div className="absolute inset-0 z-10">
                    {relicLoading ? (
                      <div className="absolute inset-0 z-20 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="text-base text-black">
                            Retrieving this relic from the vault
                          </div>
                          <div className="h-[4.5rem] w-[4.5rem] border-2 border-black border-t-transparent rounded-full animate-spin" />
                        </div>
                      </div>
                    ) : relicItems.length ? (
                      <EditionSplineScene
                        key={`${relicItems[carouselIndex % relicItems.length]!.row.edition_id}-${relicItems[carouselIndex % relicItems.length]!.serial}`}
                        edition_id={relicItems[carouselIndex % relicItems.length]!.row.edition_id ?? null}
                        sceneUrl={((relicItems[carouselIndex % relicItems.length]!.row as any)?.external_url || (relicItems[carouselIndex % relicItems.length]!.row as any)?.model) ?? undefined}
                        overlayUrl={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.video_location
                            ? `https://stream.mux.com/${relicItems[carouselIndex % relicItems.length]!.row.video_location}.m3u8`
                            : undefined
                        }
                        className="absolute inset-0"
                        playerName={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerName ?? null
                        }
                        productName={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.ProductName ?? null
                        }
                        minted={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.Minted ?? null
                        }
                        seriesName={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.SeriesName ?? null
                        }
                        tierValue={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.TierValue ?? null
                        }
                        playDescription={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayDescription ?? null
                        }
                        setName={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.SetName ?? null
                        }
                        finalScore={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.FinalScore ?? null
                        }
                        gameDate={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.GameDate ?? null
                        }
                        statValue1={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStatValue1 ?? null
                        }
                        statValue2={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStatValue2 ?? null
                        }
                        statValue3={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStatValue3 ?? null
                        }
                        statValue4={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStatValue4 ?? null
                        }
                        statValue5={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStatValue5 ?? null
                        }
                        statName1={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStat1 ?? null
                        }
                        statName2={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStat2 ?? null
                        }
                        statName3={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStat3 ?? null
                        }
                        statName4={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStat4 ?? null
                        }
                        statName5={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.PlayerStat5 ?? null
                        }
                        badge1={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.Badge1 ?? null
                        }
                        badge2={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.Badge2 ?? null
                        }
                        badge3={
                          relicItems[carouselIndex % relicItems.length]!.row
                            ?.Badge3 ?? null
                        }
                        serialNumber={
                          relicItems[carouselIndex % relicItems.length]!.serial
                        }
                        showControls={false}
                        activeListingsCount={activeListingsCount}
                        stakedCount={stakedCount}
                        inPacksCount={inPacksCount}
                        redeemedCount={redeemedCount}
                      />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  {relicItems.length > 1 && carouselIndex > 0 && (
                    <button
                      type="button"
                      aria-label="Previous"
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 border border-black/20 shadow focus:outline-none"
                      onClick={() =>
                        setCarouselIndex((i) => Math.max(0, i - 1))
                      }
                    >
                      ‹
                    </button>
                  )}
                  {relicItems.length > 1 &&
                    carouselIndex < relicItems.length - 1 && (
                      <button
                        type="button"
                        aria-label="Next"
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 border border-black/20 shadow focus:outline-none"
                        onClick={() =>
                          setCarouselIndex((i) =>
                            Math.min(relicItems.length - 1, i + 1),
                          )
                        }
                      >
                        ›
                      </button>
                    )}
                </div>
              ) : (
                <>
                  {ownedMode && ownedQty > 0 ? (
                    <div className="absolute top-2 left-2 z-30 pointer-events-none bg-[#4169E1] text-white text-xs font-bold px-1.5 py-0.5 rounded">
                      x{ownedQty}
                    </div>
                  ) : null}
                  <SplineFitted
                    scene={splineSceneUrl}
                    className="h-full w-full"
                  />
                </>
              )}
            </div>
          ) : null}

          {/* Share info modal (same as /vote page) */}
          <AlertDialog open={shareOpen} onOpenChange={setShareOpen}>
            <AlertDialogContent>
              <AlertDialogTitle>
                Sharing your relics pulled will be made available after pilot
                group phase.
              </AlertDialogTitle>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <button type="button">Close</button>
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {ownedMode && !showOpenCarousel ? (
            <div
              className="mb-0 relative flex flex-nowrap items-stretch gap-1.5 w-full"
              role="toolbar"
              aria-label="Box actions"
            >
              {ownedQty > 0 ? (
                <>
                  <FilterStyleButton
                    type="button"
                    onClick={handleOpenClick}
                    className="flex-1 basis-0 px-3 h-[30px] text-[14px] bg-[#4169E1] text-white before:opacity-0 after:opacity-0 hover:after:opacity-0 dark:bg-[#4169E1] sm-mobile:h-[50px] sm-mobile:text-[20px] lg-desktop:h-[40px] lg-desktop:text-[16px]"
                    style={{ boxShadow: "1px 1px 3px 0px rgba(0, 0, 0, 1)", border: "0.727273px none rgb(203, 213, 225)" }}
                  >
                    <p className="sm-mobile:leading-[20px] lg-desktop:leading-[20px]" style={{ fontSize: "20px" }}>OPEN BOX</p>
                  </FilterStyleButton>
                  <FilterStyleButton
                    type="button"
                    onClick={handleBuyMoreClick}
                    className="flex-1 basis-0 px-3 h-[30px] text-[14px] sm-mobile:h-[50px] sm-mobile:text-[20px] lg-desktop:h-[40px] lg-desktop:text-[16px]"
                    style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
                  >
                    <p className="sm-mobile:leading-[20px] lg-desktop:leading-[20px]" style={{ fontSize: "20px" }}>BUY MORE</p>
                  </FilterStyleButton>
                </>
              ) : (
                <>
                  <FilterStyleButton
                    type="button"
                    onClick={handleBuyMoreClick}
                    className="w-full px-3 py-1.5 text-xs bg-[#4169E1] text-white before:opacity-0 after:opacity-0 hover:after:opacity-0 dark:bg-[#4169E1]"
                    style={{ boxShadow: "1px 1px 3px 0px rgba(0, 0, 0, 1)" }}
                  >
                    <p style={{ fontSize: "20px" }}>BUY BOX</p>
                  </FilterStyleButton>
                </>
              )}
            </div>
          ) : ownedMode ? null : (
            <>
              <ClaimVerificationButton
                tokenIdString={tokenId}
                contract={contract}
                attributeMap={attributeMap}
                linkHref={tokenId ? `/box/${tokenId}` : undefined}
              />
            </>
          )}
        </div>

        <Dialog
          open={openModal}
          onOpenChange={(isOpen) => {
            setOpenModal(isOpen);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open Box</DialogTitle>
            </DialogHeader>
            <BoxOpenModal
              client={priorDropsClient}
              tokenId={parsedTokenId}
              onBoxOpenComplete={async (result) => {
                setTxResult({ success: result.success, message: result.message });
                if (!result.success) {
                  setTxPending(false);
                  setAwardedTokenIds(null);
                  return;
                }

                // Treat relicData as source of truth
                const ids = Array.isArray(result.awardedTokenIds)
                  ? result.awardedTokenIds
                  : [];
                setAwardedTokenIds(ids);

                // Set relicItems directly from relicData (no re-fetching)
                if (
                  Array.isArray(result.relicData) &&
                  result.relicData.length > 0
                ) {
                  const items: { row: MintedRow; serial: number }[] = result.relicData.map(
                    (relic) => ({
                      row: relic as MintedRow,
                      serial: relic.serial ?? 0,
                    }),
                  );
                  setRelicItems(items);
                  setRelicLoading(false);
                } else {
                  setRelicItems([]);
                  setRelicLoading(false);
                }

                setTxPending(false);
                setOpenModal(false);
              }}
              onClose={() => setOpenModal(false)}
            />
          </DialogContent>
        </Dialog>

        <div className="w-full min-w-0 flex flex-col gap-px">
          <div className="mb-2 min-w-0">
            {(() => {
              const series = formatPlain(attributeMap.series);
              const tier = formatPlain(
                attributeMap.tier ??
                  attributeMap.tier_value ??
                  attributeMap.tiervalue,
              );
              const dropWeek = formatPlain(attributeMap.drop_week);

              if (series && tier && dropWeek) {
                return (
                  <p
                    style={{
                      fontFamily: "Allura",
                      lineHeight: "1.2",
                      textAlign: "center",
                    }}
                    className="text-[24.1px] text-slate-900 dark:text-white break-words sm-mobile:text-[40px] sm-mobile:leading-[40px]"
                  >
                    {series}, {tier}, {dropWeek}
                  </p>
                );
              }
              return null;
            })()}
          </div>
          <div className="w-full min-w-0">
            {/* Claim Conditions Card */}
            <div className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-[2px_2px_2px_0_rgba(155,155,155,1)] mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                <div className="font-semibold">Drop Phase</div>
              </h3>
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="font-medium">Available to</span>
                  <span>{claimConditionAvailability}</span>
                </div>
                {claimConditionStartTimestamp && (
                  <div className="flex justify-between">
                    <span className="font-medium">Start Time</span>
                    <span>
                      {formatTimestampToLocal(claimConditionStartTimestamp)}
                    </span>
                  </div>
                )}
                {claimConditionMaxSupply !== null && (
                  <div className="flex justify-between">
                    <span className="font-medium">Boxes Released</span>
                    <span>{claimConditionMaxSupply.toLocaleString()}</span>
                  </div>
                )}
                {claimConditionSupplyClaimed !== null &&
                  claimConditionMaxSupply !== null && (
                    <div className="flex justify-between">
                      <span className="font-medium">Supply Remaining</span>
                      <span>
                        {Math.max(
                          Number(
                            claimConditionMaxSupply -
                              claimConditionSupplyClaimed,
                          ),
                          0,
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                {claimConditionLimitPerWallet !== null && (
                  <div className="flex justify-between">
                    <span className="font-medium">Limit Per Wallet</span>
                    <span>{claimConditionLimitPerWallet.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {(() => {
            const t = toCleanString(attributeMap.tier);
            const msg =
              t === "Epic Tier"
                ? "Boxes contain any one Epic tier, one Rare tier, and one Basic tier from the following relics (three total):"
                : t === "Rare Tier"
                  ? "Boxes contain any one Rare tier and one Basic tier from the following relics (two total):"
                  : t === "Basic Tier"
                    ? "Boxes contain any two of the following relics (two total):"
                    : null;
            return msg ? (
              <p className="text-base font-normal text-slate-900 dark:text-white mt-4 mb-2">
                {msg}
              </p>
            ) : null;
          })()}

          <div className="w-full min-w-0">
            {(() => {
              const tierVal = toCleanString(attributeMap.tier);
              const dropWeek = toCleanString(attributeMap.drop_week);
              return tierVal && dropWeek ? (
                <BoxEditionsCarousel tier={tierVal} dropWeek={dropWeek} />
              ) : null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function BoxEditionsCarousel({
  tier,
  dropWeek,
}: {
  tier: string;
  dropWeek: string;
}) {
  const { data = [] } = useQuery({
    queryKey: ["box-editions", tier, dropWeek],
    queryFn: ({ signal }) =>
      fetchMintedByTierAndDropWeek(tier, dropWeek, signal),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(() => {
    return data
      .map((row) => {
        const video = row?.video_location && String(row.video_location).trim();
        const thumb = video
          ? `https://image.mux.com/${video}/thumbnail.png?time=5`
          : null;
        const id = Number(row?.edition_id);
        const name = row?.PlayerName ? String(row.PlayerName) : null;
        const tierVal = row?.TierValue ? String(row.TierValue) : null;
        const minted = (row as any)?.Minted ?? null;
        const gameDate = row?.GameDate ? String(row.GameDate) : null;
        const rawCreate =
          (row as any)?.CreateDate ??
          (row as any)?.CreatedDate ??
          (row as any)?.created_at ??
          (row as any)?.createdAt ??
          (row as any)?.inserted_at ??
          (row as any)?.InsertedAt ??
          null;
        const createDate = rawCreate != null ? String(rawCreate) : null;
        const setName =
          (row as any)?.SetName != null ? String((row as any).SetName) : null;
        const b1 = (row?.Badge1 ? String(row.Badge1) : "").toUpperCase();
        const badge =
          b1 === "CP"
            ? "/images/cp-badge.webp"
            : b1 === "RY"
              ? "/images/ry-badge.webp"
              : b1 === "CY"
                ? "/images/cy-badge.webp"
                : null;
        const b2 = (row?.Badge2 ? String(row.Badge2) : "").toUpperCase();
        const badge2 =
          b2 === "CP"
            ? "/images/cp-badge.webp"
            : b2 === "RY"
              ? "/images/ry-badge.webp"
              : b2 === "CY"
                ? "/images/cy-badge.webp"
                : null;
        const b3 = (row?.Badge3 ? String(row.Badge3) : "").toUpperCase();
        const badge3 =
          b3 === "CP"
            ? "/images/cp-badge.webp"
            : b3 === "RY"
              ? "/images/ry-badge.webp"
              : b3 === "CY"
                ? "/images/cy-badge.webp"
                : null;
        return {
          id,
          thumb,
          name,
          tier: tierVal,
          minted,
          gameDate,
          createDate,
          setName,
          badge,
          badge2,
          badge3,
          team: (row as any)?.team ? String((row as any).team) : null,
        };
      })
      .filter((it) => Number.isFinite(it.id) && it.thumb);
  }, [data]);

  if (!items.length) return null;

  return (
    <div className="mb-[5px] mt-[2px] flex w-full flex-1">
      <MiniCarousel
        count={items.length}
        containerPaddingClass="px-0 w-full h-[160px] sm:h-[180px] lg:h-[170px] mb-5"
        gapClass="gap-[2px]"
        itemWidthClass="w-[calc((100%-4px)/3)] sm:w-[calc((100%-6px)/4)] lg:w-[calc((100%-8px)/5)]"
        imageClass="h-full"
        itemFrameClass="relative w-full flex-1 h-full bg-transparent"
        renderItemForIndex={(i) => (
          <EditionCardMini
            id={items[i]!.id}
            name={items[i]!.name}
            thumb={items[i]!.thumb}
            tier={items[i]!.tier}
            minted={items[i]!.minted}
            gameDate={items[i]!.gameDate}
            createDate={items[i]!.createDate}
            setName={items[i]!.setName}
            badge={items[i]!.badge}
            badge2={items[i]!.badge2}
            badge3={items[i]!.badge3}
            team={items[i]!.team}
          />
        )}
        itemHrefForIndex={(i) => `/edition/${items[i]?.id}`}
      />
    </div>
  );
}

type PriorDropsContentProps = {
  contract: typeof priorDropsContract | null;
  selectedTokenId?: string | null;
  ownedMode?: boolean;
};

function PriorDropsContent({
  contract,
  selectedTokenId,
  ownedMode = false,
}: PriorDropsContentProps) {
  const { data, isLoading, isError } = useQuery<PriorDropNFT[]>({
    queryKey: [
      "prior-drops",
      PRIOR_DROPS_QUERY_PARAMS.start,
      PRIOR_DROPS_QUERY_PARAMS.count,
    ],
    queryFn: ({ signal }) =>
      fetchPriorDropNFTs({
        ...PRIOR_DROPS_QUERY_PARAMS,
        signal,
      }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const showHeader = !selectedTokenId;

  if (isLoading) {
    return (
      <PriorDropsLayout showHeader={showHeader}>
        <LoadingState />
      </PriorDropsLayout>
    );
  }

  if (isError) {
    return (
      <PriorDropsLayout showHeader={showHeader}>
        <ErrorState message="Failed to load the prior drop details. Please try again later." />
      </PriorDropsLayout>
    );
  }

  const nfts: PriorDropNFT[] = data ?? [];

  if (!nfts.length) {
    return (
      <PriorDropsLayout showHeader={showHeader}>
        <EmptyState />
      </PriorDropsLayout>
    );
  }

  if (selectedTokenId) {
    const normalizedTokenId = selectedTokenId.trim();
    const matchingNft =
      nfts.find((nft) => getTokenIdString(nft.id) === normalizedTokenId) ??
      null;

    if (!matchingNft) {
      return (
        <PriorDropsLayout showHeader={false}>
          <ErrorState message="No prior drop found for this token." />
          <div className="mt-4 text-center">
            <Link
              to="/prior-drops"
              className="text-sm font-medium uppercase tracking-wide text-slate-700 underline-offset-4 hover:underline"
            >
              Back to Prior Drops
            </Link>
          </div>
        </PriorDropsLayout>
      );
    }

    return (
      <PriorDropsLayout showHeader={false}>
        <PriorDropDetail
          nft={matchingNft}
          contract={contract}
          ownedMode={ownedMode}
        />
      </PriorDropsLayout>
    );
  }

  return (
    <PriorDropsLayout showHeader={showHeader}>
      <PriorDropsList nfts={nfts} />
    </PriorDropsLayout>
  );
}

export default function PriorDropsPage() {
  const access = usePriorDropsAccess();

  if (access.ready !== true) {
    return access.element;
  }

  return <PriorDropsContent contract={access.contract} />;
}

export function BoxOwnedDetailPage() {
  const access = usePriorDropsAccess();
  const { tokenId } = useParams<{ tokenId?: string }>();
  if (access.ready !== true) return access.element;
  if (!tokenId) return <Navigate to="/prior-drops" replace />;
  return (
    <PriorDropsContent
      contract={access.contract}
      selectedTokenId={tokenId}
      ownedMode={true}
    />
  );
}
