import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  getContract,
  readContract,
} from "thirdweb";
import { polygon } from "thirdweb/chains";
import { useEditionMetadata } from "@/hooks/useEditionMetadata";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import SerialCardMiniWrapper from "@/components/SerialCardMiniWrapper";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";
import { useNewBidEvents } from "@/hooks/useNewBidEvents";
import BidHistoryCard from "@/components/BidHistoryCard";

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

interface AuctionEvent {
  auction_id?: string | number;
  token_id?: string | number;
  minimum_bid_amount?: string | number;
  buyout_bid_amount?: string | number;
  time_buffer_seconds?: string | number;
  bid_buffer_bps?: string | number;
  auction_start_ts?: string | number;
  auction_end_ts?: string | number;
  auction_creator?: string;
  currency?: string;
  quantity?: string | number;
  winning_bidder?: string | null;
  bid_amount?: string | number;
  serial?: number;
  Minted?: number;
  PlayerName?: string;
}

async function fetchAuctionData(
  auctionId: string,
): Promise<AuctionEvent | null> {
  try {
    const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
    const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

    if (!baseUrl || !anonKey) {
      console.error("[fetchAuctionData] Missing Supabase configuration");
      return null;
    }

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/marketplace_events_with_relics?auction_id=eq.${encodeURIComponent(auctionId)}&event_name=eq.NewAuction&limit=1`;

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        "[fetchAuctionData] Failed to fetch auction:",
        response.status,
      );
      return null;
    }

    const data = (await response.json()) as Array<AuctionEvent>;
    if (data.length === 0) {
      console.log("[fetchAuctionData] No auction found for ID:", auctionId);
      return null;
    }

    return data[0];
  } catch (error) {
    console.error("[fetchAuctionData] Error:", error);
    return null;
  }
}

async function checkAuctionClosed(auctionId: string): Promise<boolean> {
  try {
    const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
    const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

    if (!baseUrl || !anonKey) {
      console.error("[checkAuctionClosed] Missing Supabase configuration");
      return false;
    }

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/marketplace_events_with_relics?auction_id=eq.${encodeURIComponent(auctionId)}&event_name=eq.AuctionClosed&limit=1`;

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        "[checkAuctionClosed] Failed to fetch auction closed event:",
        response.status,
      );
      return false;
    }

    const data = (await response.json()) as Array<AuctionEvent>;
    return data.length > 0;
  } catch (error) {
    console.error("[checkAuctionClosed] Error:", error);
    return false;
  }
}

async function fetchEditionFromTokenId(
  tokenId: string,
): Promise<number | null> {
  try {
    const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
    const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

    if (!baseUrl || !anonKey) {
      return null;
    }

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/RelicSerialsJoined?token_id=eq.${encodeURIComponent(tokenId)}&select=edition_id&limit=1`;

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = (await response.json()) as Array<{ edition_id: number }>;
      if (data.length > 0) {
        return data[0].edition_id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export default function SettleAuctionPage() {
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();
  const account = useActiveAccount();

  const [auction, setAuction] = useState<AuctionEvent | null>(null);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [serialNum, setSerialNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [settlementSuccess, setSettlementSuccess] = useState(false);
  const [editionData, setEditionData] = useState<
    (MintedRow & { SeriesName?: string; TierValue?: string }) | null
  >(null);
  const [currentHighBid, setCurrentHighBid] = useState<string | null>(null);
  const [bidderAddress, setBidderAddress] = useState<string | null>(null);
  const [bidderUsername, setBidderUsername] = useState<string | null>(null);
  const [auctionClosed, setAuctionClosed] = useState<boolean>(false);

  const { metadata: editionMetadata } = useEditionMetadata(editionId);

  const { data: bidHistoryEvents = [] } = useNewBidEvents(auctionId ?? null);

  useEffect(() => {
    console.log("[SettleAuctionPage] bidHistoryEvents:", bidHistoryEvents);
  }, [bidHistoryEvents]);

  useEffect(() => {
    const checkClosed = async () => {
      if (!auctionId) return;
      try {
        const closed = await checkAuctionClosed(auctionId);
        setAuctionClosed(closed);
      } catch (err) {
        // If we can't check the database event, assume not closed yet
        setAuctionClosed(false);
      }
    };
    checkClosed();
  }, [auctionId]);

  // Check if auction has expired by reading from contract
  // Must account for time buffer - contract won't allow settlement until endTime + timeBuffer has passed
  const isAuctionExpired = useMemo(() => {
    if (!auction || !auction.auction_end_ts) return false;
    const endTime = Number(auction.auction_end_ts);
    const timeBuffer = Number(auction.time_buffer_seconds || 0);
    const settleTime = endTime + timeBuffer;
    const now = Math.floor(Date.now() / 1000);
    return now > settleTime;
  }, [auction]);

  useEffect(() => {
    const loadAuctionData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!auctionId) {
          setError("No auction ID provided");
          setLoading(false);
          return;
        }

        const auctionData = await fetchAuctionData(auctionId);
        if (!auctionData) {
          setError("Auction not found");
          setLoading(false);
          return;
        }

        setAuction(auctionData);
        setSerialNum(auctionData.serial ?? null);

        // Fetch edition ID from token ID
        if (auctionData.token_id) {
          const fetchedEditionId = await fetchEditionFromTokenId(
            String(auctionData.token_id),
          );
          setEditionId(fetchedEditionId);
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("[SettleAuction] Error loading auction:", err);
        }
        setError("Failed to load auction data");
      } finally {
        setLoading(false);
      }
    };

    loadAuctionData();
  }, [auctionId]);

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
        if (!auctionId) return;

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
          params: [BigInt(auctionId)],
        });

        if (
          winningBid &&
          Array.isArray(winningBid) &&
          winningBid.length >= 3 &&
          winningBid[2]
        ) {
          setCurrentHighBid(String(winningBid[2]));
          setBidderAddress(String(winningBid[0]));
        }
      } catch (err) {
      }
    };

    fetchWinningBid();
  }, [auctionId]);

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
          setBidderUsername(username);
        } else {
          setBidderUsername(null);
        }
      } catch (err) {
        setBidderUsername(null);
      }
    };

    fetchBidderUsername();
  }, [bidderAddress]);

  useEffect(() => {
    if (settlementSuccess) {
      const timer = setTimeout(() => {
        navigate("/collection");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [settlementSuccess, navigate]);

  const handleSettleAuction = async () => {
    try {
      setSettlementError(null);
      setIsSettling(true);

      if (!account) {
        throw new Error("Wallet not connected");
      }

      if (!auctionId) {
        throw new Error("No auction ID");
      }

      if (!isAuctionExpired) {
        throw new Error("Auction has not ended yet. Please wait for the auction to end before settling.");
      }

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

      // First, call collectAuctionPayout
      const payoutTransaction = prepareContractCall({
        contract,
        method: "function collectAuctionPayout(uint256 _auctionId)",
        params: [BigInt(auctionId)],
      });

      await sendAndConfirmTransaction({
        account,
        transaction: payoutTransaction,
      });

      // Then, call collectAuctionTokens
      const tokensTransaction = prepareContractCall({
        contract,
        method: "function collectAuctionTokens(uint256 _auctionId)",
        params: [BigInt(auctionId)],
      });

      await sendAndConfirmTransaction({
        account,
        transaction: tokensTransaction,
      });

      setSettlementSuccess(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to settle auction";
      setSettlementError(errorMessage);
      console.error("[handleSettleAuction] Error:", err);
    } finally {
      setIsSettling(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="animate-spin">
              <div className="h-12 w-12 border-4 border-orange-300 border-t-orange-600 rounded-full"></div>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            Loading auction...
          </h2>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-slate-600">
            Please connect your wallet to settle auction
          </p>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Auction Not Found</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            {error || "This auction is not available"}
          </p>
          <button
            onClick={() => navigate("/active-auctions")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Auctions
          </button>
        </div>
      </div>
    );
  }

  if (settlementSuccess) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">
            Auction Settled
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Redirecting to your collection...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-8">
      <h1 className="text-3xl font-bold mb-[12px] dark:text-white lg:order-1">
        Settle Auction
      </h1>

      {editionData && serialNum !== null && (
        <h6 className="text-sm text-slate-600 dark:text-slate-400 text-center mx-auto sm:text-left sm:mx-0 mb-6 lg:order-2 lg:text-left">
          <span className="whitespace-nowrap">{editionData.PlayerName}</span>
          {" - "}
          <span className="whitespace-nowrap">
            #{serialNum} of {editionData.Minted}
          </span>
          {" - "}
          <span className="whitespace-nowrap">{editionData.TierValue}</span>
          {" - "}
          <span className="whitespace-nowrap">{editionData.GameDate}</span>
          {" - "}
          <span className="whitespace-nowrap">{editionData.SetName}</span>
          {editionData.SeriesName && (
            <>
              {" - "}
              <span className="whitespace-nowrap">
                {editionData.SeriesName}
              </span>
            </>
          )}
        </h6>
      )}

      <div className="flex flex-col lg:flex-row lg:mx-auto lg:justify-center items-center gap-3">
        {editionId && serialNum !== null && (
          <div className="mb-4 lg:order-3 lg:sticky lg:top-8">
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
              wrapperClassName="bg-slate-700 dark:bg-slate-800 rounded overflow-hidden flex items-center justify-center p-2 max-sm:mx-auto lg:aspect-[3/4] lg:h-[400px]"
            />
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 pt-3 px-[18px] pb-2 shadow-[1px_1px_3px_1px_rgba(155,155,155,1)] min-w-[200px] sm:min-w-auto lg:order-4">
          <div className="space-y-4 mb-2 sm:mb-6">
            <div className="w-full text-center">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                <p>Starting Bid</p>
              </label>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                $
                {(
                  Number(BigInt(auction.minimum_bid_amount || "0")) / 1e18
                ).toFixed(2)}
              </p>
              <label className="text-sm text-slate-600 dark:text-slate-300 mt-2 block">
                <p>Winning Bid</p>
              </label>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                $
                {(
                  Number(
                    BigInt(currentHighBid || auction.minimum_bid_amount || "0"),
                  ) / 1e18
                ).toFixed(2)}
              </p>
              {bidderUsername && (
                <p className="text-xs italic text-slate-500 dark:text-slate-400 mt-1 max-sm:-mt-1.5 max-sm:text-[10px]">
                  by {bidderUsername}
                </p>
              )}
              <label className="text-sm text-slate-600 dark:text-slate-300 mt-2 block">
                <p>Increase from asking</p>
              </label>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {(() => {
                  const startingBid =
                    Number(BigInt(auction.minimum_bid_amount || "0")) / 1e18;
                  const winningBid =
                    Number(
                      BigInt(
                        currentHighBid || auction.minimum_bid_amount || "0",
                      ),
                    ) / 1e18;
                  const percentage =
                    startingBid > 0
                      ? (
                          ((winningBid - startingBid) / startingBid) *
                          100
                        ).toFixed(2)
                      : "0.00";
                  return `+${percentage}%`;
                })()}
              </p>
              <label className="text-sm text-slate-600 dark:text-slate-300 mt-2 block">
                <p>Auction End</p>
              </label>
              <p className="text-sm text-slate-900 dark:text-white">
                {(() => {
                  if (!auction.auction_end_ts) return "—";
                  const endTime = new Date(
                    Number(auction.auction_end_ts) * 1000,
                  );
                  const year = endTime.getFullYear();
                  const month = String(endTime.getMonth() + 1).padStart(2, "0");
                  const day = String(endTime.getDate()).padStart(2, "0");
                  const hours = String(endTime.getHours()).padStart(2, "0");
                  const minutes = String(endTime.getMinutes()).padStart(2, "0");
                  const seconds = String(endTime.getSeconds()).padStart(2, "0");
                  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                })()}
              </p>
            </div>

            {settlementError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded text-sm">
                {settlementError}
              </div>
            )}

            {isAuctionExpired && !auctionClosed ? (
              <>
                <button
                  onClick={handleSettleAuction}
                  disabled={isSettling}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium rounded transition"
                >
                  {isSettling ? "Processing..." : "Settle Auction"}
                </button>

                <button
                  onClick={() => navigate("/active-auctions")}
                  className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded transition"
                >
                  Cancel
                </button>
              </>
            ) : auctionClosed ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 p-3 rounded text-sm text-center">
                This auction has already been settled
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 p-3 rounded text-sm text-center">
                Auction is still active. Please wait for it to end.
              </div>
            )}
          </div>

          {bidHistoryEvents.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mb-2">
              <BidHistoryCard bids={bidHistoryEvents} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
