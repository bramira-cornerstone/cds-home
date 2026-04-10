import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { useSendTransaction } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  sendAndConfirmTransaction,
  readContract,
} from "thirdweb";
import { polygon } from "thirdweb/chains";
import { useEditionMetadata } from "@/hooks/useEditionMetadata";
import { useSharedCountdownBreakdown } from "@/hooks/useSharedCountdown";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import { checkAuctionClosed } from "@/lib/marketplaceEvents";
import SerialCardMiniWrapper from "@/components/SerialCardMiniWrapper";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";
import { isAuctionExpired } from "@/lib/activeAuctionsFromEvents";

interface AuctionCardProps {
  auction: ActiveAuction;
  onCancelSuccess?: () => void;
  onClose?: () => void;
  editionIdProp?: number;
  serialProp?: number;
  showTitleAndSerial?: boolean;
}

export function AuctionCard({
  auction,
  onCancelSuccess,
  onClose,
  editionIdProp,
  serialProp,
  showTitleAndSerial = true,
}: AuctionCardProps) {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const redirectScheduledRef = useRef(false);
  const settlementRedirectScheduledRef = useRef(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [settlementSuccess, setSettlementSuccess] = useState(false);
  const [editionId, setEditionId] = useState<number | null>(
    editionIdProp || auction.editionId || null,
  );
  const [serialNum, setSerialNum] = useState<number | null>(
    serialProp || auction.serial || null,
  );
  const { metadata: editionMetadata } = useEditionMetadata(editionId);
  const [editionData, setEditionData] = useState<
    (MintedRow & { SeriesName?: string; TierValue?: string }) | null
  >(null);
  const [currentHighBid, setCurrentHighBid] = useState<string | null>(null);
  const [bidderAddress, setBidderAddress] = useState<string | null>(null);
  const [bidderUsername, setBidderUsername] = useState<string | null>(null);
  const [countdownTime, setCountdownTime] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [auctionClosed, setAuctionClosed] = useState<boolean>(false);

  const isOwned = useMemo(() => {
    if (!account) return false;
    const auctionCreatorAddr = auction.auctionCreator;
    if (!auctionCreatorAddr) return false;
    return account.address.toLowerCase() === auctionCreatorAddr.toLowerCase();
  }, [account, auction.auctionCreator]);

  const isWinner = useMemo(() => {
    if (!account || !bidderAddress) return false;
    return account.address.toLowerCase() === bidderAddress.toLowerCase();
  }, [account, bidderAddress]);

  const isAuctionEnded = useMemo(() => {
    return isAuctionExpired(auction);
  }, [auction]);

  useEffect(() => {
    if (cancelSuccess && editionId !== null && serialNum !== null) {
      if (redirectScheduledRef.current) {
        return;
      }

      redirectScheduledRef.current = true;
      const timer = setTimeout(() => {
        navigate(`/edition/${editionId}/serial/${serialNum}`);
        // Call the callback after navigating
        if (onCancelSuccess) {
          onCancelSuccess();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cancelSuccess, editionId, serialNum]);

  useEffect(() => {
    if (settlementSuccess) {
      if (settlementRedirectScheduledRef.current) {
        return;
      }

      settlementRedirectScheduledRef.current = true;
      const timer = setTimeout(() => {
        navigate("/collection");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [settlementSuccess, navigate]);

  useEffect(() => {
    if (!editionId) {
      setEditionData(null);
      return;
    }

    const loadEditionData = async () => {
      try {
        const data = await fetchMintedByEditionId(editionId);
        setEditionData(data);
      } catch (err) {
        setEditionData(null);
      }
    };

    loadEditionData();
  }, [editionId]);

  useEffect(() => {
    const fetchWinningBid = async () => {
      try {
        const MARKETPLACE_ADDRESS =
          import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
        const THIRDWEB_CLIENT_ID =
          import.meta.env.THIRDWEB_CLIENT_ID || "";

        if (!MARKETPLACE_ADDRESS || !THIRDWEB_CLIENT_ID) {
          console.log("[AuctionCard] Missing marketplace config");
          return;
        }

        console.log(
          "[AuctionCard] Attempting to fetch winning bid for auction:",
          auction.auctionId,
        );

        const contract = getContract({
          address: MARKETPLACE_ADDRESS,
          chain: polygon,
          client: {
            clientId: THIRDWEB_CLIENT_ID,
          },
        });

        const winningBid = await readContract({
          contract,
          method:
            "function getWinningBid(uint256 _auctionId) returns (address, address, uint256)",
          params: [BigInt(auction.auctionId)],
        });

        console.log("[AuctionCard] getWinningBid response:", winningBid);

        if (
          winningBid &&
          Array.isArray(winningBid) &&
          winningBid.length >= 3 &&
          winningBid[2]
        ) {
          console.log(
            "[AuctionCard] Setting current high bid:",
            String(winningBid[2]),
          );
          console.log("[AuctionCard] Bidder address:", winningBid[0]);
          setCurrentHighBid(String(winningBid[2]));
          setBidderAddress(String(winningBid[0]));
        } else {
          console.log("[AuctionCard] No valid winning bid found");
          setBidderAddress(null);
        }
      } catch (err) {
        // If getWinningBid fails or no bid exists, currentHighBid remains null
        // Component will fall back to showing minimum bid
      }
    };

    fetchWinningBid();
  }, [auction.auctionId]);

  useEffect(() => {
    const fetchBidderUsername = async () => {
      if (!bidderAddress) {
        setBidderUsername(null);
        return;
      }

      try {
        const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
        const anonKey =
          (import.meta.env.SUPABASE_ANON_KEY as string) || "";

        if (!baseUrl || !anonKey) {
          return;
        }

        const root = baseUrl.replace(/\/$/, "");
        const url = `${root}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(bidderAddress)}&select=username`;

        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const data = (await response.json()) as Array<{ username?: string }>;
          const username = data[0]?.username || null;
          console.log("[AuctionCard] Bidder username:", username);
          setBidderUsername(username);
        } else {
          console.error(
            `[AuctionCard] Failed to fetch username for ${bidderAddress}: ${response.status}`,
          );
          setBidderUsername(null);
        }
      } catch (err) {
        setBidderUsername(null);
      }
    };

    fetchBidderUsername();
  }, [bidderAddress]);

  const countdownBreakdown = useSharedCountdownBreakdown(
    auction.endTimestamp ? auction.endTimestamp * 1000 : 0,
  );

  useEffect(() => {
    setCountdownTime(countdownBreakdown);
  }, [countdownBreakdown]);

  useEffect(() => {
    const checkClosed = async () => {
      const closed = await checkAuctionClosed(String(auction.auctionId));
      setAuctionClosed(closed);
    };
    checkClosed();
  }, [auction.auctionId]);

  const handleCollectAuctionPayout = async () => {
    try {
      setSettlementError(null);
      setIsSettling(true);

      if (!account) {
        throw new Error("Wallet not connected");
      }

      const MARKETPLACE_ADDRESS =
        import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
      const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

      if (!MARKETPLACE_ADDRESS || !THIRDWEB_CLIENT_ID) {
        throw new Error("Marketplace configuration is missing");
      }

      const contract = await getContract({
        address: MARKETPLACE_ADDRESS,
        chain: polygon,
        client: {
          clientId: THIRDWEB_CLIENT_ID,
        },
      });

      const transaction = prepareContractCall({
        contract,
        method: "function collectAuctionPayout(uint256 _auctionId)",
        params: [BigInt(auction.auctionId)],
      });

      await sendAndConfirmTransaction({
        account,
        transaction,
      });

      setSettlementSuccess(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to collect payout";
      setSettlementError(errorMessage);
    } finally {
      setIsSettling(false);
    }
  };

  const handleCollectAuctionTokens = async () => {
    try {
      setSettlementError(null);
      setIsSettling(true);

      if (!account) {
        throw new Error("Wallet not connected");
      }

      const MARKETPLACE_ADDRESS =
        import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
      const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

      if (!MARKETPLACE_ADDRESS || !THIRDWEB_CLIENT_ID) {
        throw new Error("Marketplace configuration is missing");
      }

      const contract = await getContract({
        address: MARKETPLACE_ADDRESS,
        chain: polygon,
        client: {
          clientId: THIRDWEB_CLIENT_ID,
        },
      });

      const transaction = prepareContractCall({
        contract,
        method: "function collectAuctionTokens(uint256 _auctionId)",
        params: [BigInt(auction.auctionId)],
      });

      await sendAndConfirmTransaction({
        account,
        transaction,
      });

      setSettlementSuccess(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to collect tokens";
      setSettlementError(errorMessage);
    } finally {
      setIsSettling(false);
    }
  };

  const handleCancelAuction = async () => {
    try {
      setCancelError(null);
      setIsCanceling(true);

      if (!account) {
        throw new Error("Wallet not connected");
      }

      const MARKETPLACE_ADDRESS =
        import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
      const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

      if (!MARKETPLACE_ADDRESS || !THIRDWEB_CLIENT_ID) {
        throw new Error("Marketplace configuration is missing");
      }

      const contract = await getContract({
        address: MARKETPLACE_ADDRESS,
        chain: polygon,
        client: {
          clientId: THIRDWEB_CLIENT_ID,
        },
      });

      const transaction = prepareContractCall({
        contract,
        method: "function cancelAuction(uint256 _auctionId)",
        params: [BigInt(auction.auctionId)],
      });

      const transactionResult = await sendAndConfirmTransaction({
        account,
        transaction,
      });

      setCancelSuccess(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel auction";
      setCancelError(errorMessage);
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="relative p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow listing-card-mobile-shadow max-sm:mt-3 card-shadow">
      {isAuctionEnded && auction.increaseFromAsking && (
        <div className="absolute top-4 right-4 bg-black/40 px-3 py-2 rounded">
          <p
            className="text-lg font-semibold"
            style={{ color: "rgb(255, 99, 0)" }}
          >
            {auction.increaseFromAsking}
          </p>
        </div>
      )}
      {showTitleAndSerial && editionData && serialNum !== null && (
        <h6 className="text-xs font-medium leading-none text-slate-600 dark:text-slate-400 text-center mx-auto sm:text-left sm:mx-0 mb-3">
          <span className="whitespace-nowrap">{editionData.PlayerName}</span>
          <div className="inline">{" - "}</div>
          <span className="whitespace-nowrap">
            #{serialNum} of {editionData.Minted}
          </span>
          <div className="inline">{" - "}</div>
          <span className="whitespace-nowrap">{editionData.TierValue}</span>
          <div className="inline">{" - "}</div>
          <span className="whitespace-nowrap">{editionData.GameDate}</span>
          <div className="inline">{" - "}</div>
          <span className="whitespace-nowrap">{editionData.SetName}</span>
          {editionData.SeriesName && (
            <>
              <div className="inline">{" - "}</div>
              <span className="whitespace-nowrap">
                {editionData.SeriesName}
              </span>
            </>
          )}
        </h6>
      )}

      {showTitleAndSerial && editionId !== null && serialNum !== null && (
        <div className="flex justify-between items-center mb-6 max-sm:mb-3">
          <div className="text-4xl font-bold text-slate-800 dark:text-white">
            #{serialNum}
          </div>
          <SerialCardMiniWrapper
            id={editionId}
            name={editionMetadata?.name}
            thumb={editionMetadata?.thumb}
            serial={serialNum}
            minted={editionData?.Minted || null}
            gameDate={editionMetadata?.gameDate}
            createDate={editionMetadata?.createDate}
            setName={editionMetadata?.setName}
            badge={editionMetadata?.badge}
            badge2={editionMetadata?.badge2}
            badge3={editionMetadata?.badge3}
            team={editionMetadata?.team}
            outerClassName=""
          />
        </div>
      )}

      <div className="space-y-3 mb-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {currentHighBid ? "Current High Bid" : "Minimum Bid"}
          </p>
          <p className="text-xl font-bold text-slate-800 dark:text-white">
            $
            {(
              Number(BigInt(currentHighBid || auction.minimumBidAmount)) / 1e18
            ).toFixed(2)}
          </p>
          {bidderUsername && (
            <p className="text-xs italic text-slate-500 dark:text-slate-400 mt-1 max-sm:-mt-1.5 max-sm:text-[10px]">
              by {bidderUsername}
            </p>
          )}
          {!currentHighBid &&
            !isAuctionExpired(auction) &&
            auction.auctionCreatorUsername && (
              <p className="text-xs italic text-slate-500 dark:text-slate-400 mt-1 max-sm:-mt-1.5 max-sm:text-[10px]">
                by {auction.auctionCreatorUsername}
              </p>
            )}
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Buyout Price
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            ${(Number(BigInt(auction.buyoutBidAmount)) / 1e18).toFixed(2)}
          </p>
        </div>

        {auction.endTimestamp && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {isAuctionEnded ? "Auction Ended" : "Auction Ends In"}
            </p>
            <p
              className="text-sm text-slate-700 dark:text-slate-300 font-mono max-sm:font-extrabold max-sm:[color:rgba(245,166,35,1)] max-sm:[text-shadow:1px_1px_12px_rgba(0,0,0,1)]"
              style={{ color: "rgba(255, 99, 0, 1)" }}
            >
              {isAuctionEnded ? (
                <span
                  style={{
                    display: "inline",
                    color: "rgb(74, 74, 74)",
                    fontWeight: "400",
                  }}
                >
                  Ended
                </span>
              ) : countdownTime ? (
                <span
                  className="max-sm:font-semibold max-sm:[text-shadow:1px_1px_14px_rgba(155,155,155,1)]"
                  style={{
                    display: "inline",
                    fontWeight: "600",
                  }}
                >
                  {countdownTime.days > 0 && `${countdownTime.days}d `}
                  {countdownTime.hours.toString().padStart(2, "0")}h{" "}
                  {countdownTime.minutes.toString().padStart(2, "0")}m{" "}
                  {countdownTime.seconds.toString().padStart(2, "0")}s
                </span>
              ) : (
                "Calculating..."
              )}
            </p>
          </div>
        )}
      </div>

      {cancelError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded mb-4 text-sm">
          {cancelError}
        </div>
      )}

      {settlementError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded mb-4 text-sm">
          {settlementError}
        </div>
      )}

      {settlementSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-3 rounded mb-4 text-sm">
          Success! Redirecting to collection...
        </div>
      )}

      <div className="flex gap-2">
        {auction.status === "cancelled" ? (
          <>
            <button
              onClick={() => navigate(`/settle-auction/${auction.auctionId}`)}
              className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
            >
              Enter Auction
            </button>
          </>
        ) : isAuctionEnded ? (
          <>
            {!auctionClosed ? (
              <button
                onClick={() => navigate(`/settle-auction/${auction.auctionId}`)}
                className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
                style={{
                  boxShadow: "1px 1px 3px 1px rgba(155, 155, 155, 1)",
                }}
              >
                Settle Auction
              </button>
            ) : (
              <button
                onClick={() => navigate(`/settle-auction/${auction.auctionId}`)}
                className="flex-1 text-center bg-gray-400 hover:bg-gray-500 font-medium py-2 px-4 rounded transition sm:text-sm"
                style={{
                  color: "rgba(255, 255, 255, 1)",
                  boxShadow: "1px 1px 3px 1px rgba(155, 155, 155, 1)",
                }}
              >
                View History
              </button>
            )}
          </>
        ) : isOwned ? (
          editionId !== null && serialNum !== null ? (
            <>
              <button
                onClick={handleCancelAuction}
                disabled={isCanceling || cancelSuccess}
                className="flex-1 text-center bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
                style={{
                  boxShadow: "1px 1px 3px 1px rgba(155, 155, 155, 1)",
                }}
              >
                {cancelSuccess
                  ? "Success!"
                  : isCanceling
                    ? "Canceling..."
                    : "Cancel Auction"}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="flex-1 text-center bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-700 dark:text-white text-slate-900 font-medium py-2 px-4 rounded transition sm:text-sm"
                >
                  Close
                </button>
              )}
              <button
                onClick={() =>
                  navigate(
                    `/edition/${editionId}/serial/${serialNum}/buy-offer-bid`,
                  )
                }
                className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
                style={{
                  boxShadow: "1px 1px 3px 1px rgba(155, 155, 155, 1)",
                }}
              >
                Enter Auction
              </button>
            </>
          ) : null
        ) : editionId !== null && serialNum !== null ? (
          <>
            <button
              onClick={() =>
                navigate(
                  `/edition/${editionId}/serial/${serialNum}/buy-offer-bid`,
                )
              }
              className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
              style={{
                boxShadow: "1px 1px 3px 1px rgba(155, 155, 155, 1)",
              }}
            >
              Enter Auction
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function AuctionCardCompact(props: AuctionCardProps) {
  return <AuctionCard {...props} showTitleAndSerial={false} />;
}
