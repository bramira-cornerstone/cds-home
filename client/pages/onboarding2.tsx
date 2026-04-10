import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  useActiveWallet,
  useReadContract,
  useSendTransaction,
} from "thirdweb/react";
import {
  getActiveClaimCondition,
  canClaim,
  claimTo,
} from "thirdweb/extensions/erc1155";
import {
  priorDropsContract,
  fetchPriorDropNFTs,
  PRIOR_DROPS_QUERY_PARAMS,
  getTokenIdString,
  resolveMediaUrl,
  type PriorDropNFT,
} from "@/lib/priorDrops";

function parseBigInt(value: any): bigint | null {
  if (value === null || value === undefined) return null;
  try {
    const bigIntVal = BigInt(value);
    return bigIntVal;
  } catch {
    return null;
  }
}

export default function Onboarding2() {
  const navigate = useNavigate();
  const wallet = useActiveWallet();
  const address = wallet?.getAccount()?.address;
  const [claimQuantity, setClaimQuantity] = useState(1n);
  const [claimStatus, setClaimStatus] = useState<
    "idle" | "verifying" | "verified" | "submitting" | "success" | "error"
  >("idle");
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const { mutateAsync: sendTransaction, isPending: isSendPending } =
    useSendTransaction();

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

  // Get image URL from NFT metadata
  const imageUrl = useMemo(
    () => resolveMediaUrl(priorDropBoxData?.metadata?.image),
    [priorDropBoxData],
  );

  // Fetch active claim condition ID for token_id=0
  const { data: activeClaimConditionIdData } = useReadContract({
    contract: priorDropsContract,
    method:
      "function getActiveClaimConditionId(uint256 _tokenId) view returns (uint256)",
    params: [0n],
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

  // Calculate remaining claims
  const remainingClaims = useMemo(() => {
    if (limitPerWallet === null || walletClaimedCount === null) {
      return 0;
    }
    const remaining = limitPerWallet - walletClaimedCount;
    return Number(remaining > 0n ? remaining : 0n);
  }, [limitPerWallet, walletClaimedCount]);

  const maxQuantity = remainingClaims;

  const isClaimProcessing = claimStatus !== "idle" && claimStatus !== "error";

  const handleDecrement = () => {
    if (claimQuantity > 0n) {
      setClaimQuantity(claimQuantity - 1n);
    }
  };

  const handleIncrement = () => {
    if (Number(claimQuantity) < maxQuantity) {
      setClaimQuantity(claimQuantity + 1n);
    }
  };

  const handleClaim = useCallback(async () => {
    if (
      !priorDropsContract ||
      !address ||
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
        contract: priorDropsContract,
        claimer: address,
        quantity: claimQuantity,
        tokenId: 0n,
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
        contract: priorDropsContract,
        to: address,
        tokenId: 0n,
        quantity: claimQuantity,
        from: address,
      });

      const receipt = await sendTransaction(transaction);

      setClaimStatus("success");
      setClaimMessage("Success!");

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
  }, [priorDropsContract, address, limitPerWallet, claimQuantity, sendTransaction]);

  const handleNext = () => {
    navigate("/onboarding3");
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-white px-4 mt-6">
      <div className="flex flex-col items-center gap-0 max-w-2xl">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-black">
          Claim Your Free Relics
        </h1>

        {/* Subtitle */}
        <p className="text-center text-slate-600">
          Get started with free boxes to build your collection
        </p>

        {/* Claim Card */}
        <article className="w-full grid gap-0 rounded-lg border border-slate-200 bg-white/70 px-6 py-1.5 md:grid-cols-[minmax(0,280px)_1fr] dark:bg-slate-700 dark:border-white/10 card-shadow account-prior-drop-card">
          {/* Image */}
          <div className="flex flex-col gap-3">
            {imageUrl ? (
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-slate-100 dark:bg-black">
                <img
                  src={imageUrl}
                  alt={
                    priorDropBoxData?.metadata?.name ??
                    "Prior drop box"
                  }
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500 dark:bg-black dark:text-white aspect-square">
                Image unavailable
              </div>
            )}
          </div>

          {/* Claim Details */}
          <div className="flex flex-col gap-0.5">
            <div className="rounded-lg border border-white sm:border-blue-200 bg-white sm:bg-blue-50 px-2 py-1 sm:p-4 dark:border-blue-900/50 dark:bg-blue-950/30 flex flex-col gap-0">
              <p className="text-center text-sm md:text-base font-medium text-blue-900 dark:text-blue-100 mb-0">
                You can claim{" "}
                <span className="font-bold text-lg text-black dark:text-blue-400">
                  {remainingClaims}
                </span>{" "}
                more free boxes:
              </p>

              {/* Quantity Selector and Claim Button */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-1">
                    <button
                      type="button"
                      onClick={handleDecrement}
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
                      className="w-12 text-center bg-transparent dark:text-white border-none focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleIncrement}
                      disabled={
                        Number(claimQuantity) >= maxQuantity ||
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
                    disabled={
                      isClaimProcessing ||
                      isSendPending ||
                      remainingClaims === 0
                    }
                    className="flex-1 inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white card-shadow transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 mt-0 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Claim
                  </button>
                </div>
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
            </div>
          </div>
        </article>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="w-full text-white font-medium rounded transition-colors max-w-md"
          style={{
            backgroundColor: "rgba(0, 79, 255, 1)",
            padding: "12px 16px",
            lineHeight: "20px",
            fontSize: "16px",
            marginTop: "8px",
            marginBottom: "8px",
            boxShadow: "1px 1px 3px 0px rgba(0, 0, 0, 1)",
          }}
        >
          <p>I'm done. Click for the next step...</p>
        </button>
      </div>
    </div>
  );
}
