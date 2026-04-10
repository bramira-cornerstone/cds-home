import { useActiveAccount } from "thirdweb/react";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { polygon } from "thirdweb/chains";
import CollectionCards from "@/components/CollectionCards";
import SerialCardMini from "@/components/SerialCardMini";
import { X, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";
import { insertStakingEvent } from "@/lib/supabaseRedemptionEvents";
import { useToast } from "@/hooks/use-toast";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";

interface SelectedCard {
  editionId: number;
  serial: number;
  tokenId?: string | null;
  playerName?: string;
  setName?: string;
  tierValue?: string;
  seriesName?: string;
  gameDate?: string;
  minted?: number | null;
  imageUrl?: string | null;
  badge1?: string | null;
  badge2?: string | null;
  badge3?: string | null;
}

interface RedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRedemptionSuccess?: () => void;
  team?: string | null;
  editionId?: number | null;
}

export function RedemptionModal({
  isOpen,
  onClose,
  onRedemptionSuccess,
  team,
  editionId,
}: RedemptionModalProps) {
  const account = useActiveAccount();
  const walletAddress = account?.address ?? null;
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollBarWidth}px`;
      return () => {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      };
    }
  }, [isOpen]);

  // Close modal after success screen displays for 3 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setConfirmationInput("");
        setSelectedCard(null);
        setShowSuccess(false);
        onRedemptionSuccess?.();
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, onRedemptionSuccess, onClose]);

  if (!isOpen) return null;

  const handleCardSelect = async (cardData: {
    editionId: number;
    serial: number;
    name?: string;
    setName?: string;
    tier?: string;
    team?: string;
    gameDate?: string;
    minted?: number;
    series?: string;
  }) => {
    setIsLoading(true);
    try {
      // Fetch the full record from RelicSerialsJoined to ensure we have correct data
      const fullRecord = await fetchRelicSerialByEditionAndSerial(
        cardData.editionId,
        cardData.serial,
      );

      setSelectedCard({
        editionId: cardData.editionId,
        serial: cardData.serial,
        tokenId: (fullRecord?.token_id || fullRecord?.tokenId) as string | null,
        playerName: fullRecord?.PlayerName || cardData.name,
        setName: fullRecord?.SetName || cardData.setName,
        tierValue: fullRecord?.TierValue || cardData.tier,
        seriesName: fullRecord?.SeriesName || cardData.team,
        gameDate: fullRecord?.GameDate || cardData.gameDate,
        minted: fullRecord?.Minted || cardData.minted,
        imageUrl: fullRecord?.image_url || null,
        badge1: fullRecord?.Badge1 || null,
        badge2: fullRecord?.Badge2 || null,
        badge3: fullRecord?.Badge3 || null,
      });
    } catch (err) {
      console.error("Failed to fetch relic details:", err);
      // Fall back to card data if fetch fails
      setSelectedCard({
        editionId: cardData.editionId,
        serial: cardData.serial,
        playerName: cardData.name,
        setName: cardData.setName,
        tierValue: cardData.tier,
        seriesName: cardData.team,
        gameDate: cardData.gameDate,
        minted: cardData.minted,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedCard(null);
    setConfirmationInput("");
  };

  const handleRedeem = async () => {
    if (
      confirmationInput !== "SUBMIT" ||
      !selectedCard ||
      !editionId ||
      !walletAddress
    ) {
      console.log("Validation failed:", {
        confirmationInput,
        selectedCard,
        editionId,
        walletAddress,
      });
      return;
    }

    if (!selectedCard.tokenId) {
      toast({
        title: "Error",
        description: "Token ID not found. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    let success = false;

    try {
      console.log("Submitting staking event:", {
        editionId,
        walletAddress,
        tokenId: selectedCard.tokenId,
      });
      const result = await insertStakingEvent(
        editionId,
        walletAddress,
        selectedCard.tokenId,
      );

      console.log("Staking event result:", result);

      if (result && result.id) {
        console.log("Success! Staking event ID:", result.id);

        // Now submit the smart contract call
        try {
          const contractAddress = import.meta.env.VITE_ERC721_ADDRESS as
            | string
            | undefined;
          if (!contractAddress) {
            throw new Error("ERC721 contract address not configured");
          }

          const client = getAlchemyThirdwebClient();
          const contract = getContract({
            client,
            chain: polygon,
            address: contractAddress,
          });

          const transaction = prepareContractCall({
            contract,
            method:
              "function stake(uint256 tokenId, bool longStake, string calldata holderAuth) external",
            params: [BigInt(selectedCard.tokenId), false, confirmationInput],
          });

          const txHash = await sendTransaction({
            transaction,
            account,
          });

          console.log("Smart contract stake transaction submitted:", txHash);
          success = true;
          setShowSuccess(true);
        } catch (contractErr) {
          console.error("Failed to submit contract transaction:", contractErr);
          toast({
            title: "Warning",
            description:
              "Redemption recorded but contract transaction failed. Please contact support.",
            variant: "destructive",
          });
          success = true; // Still consider it a partial success since Supabase record was created
          setShowSuccess(true);
        }
      } else {
        console.log("Result was falsy or missing ID:", result);
        toast({
          title: "Error",
          description: "Failed to submit relic. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to redeem relic:", err);
      toast({
        title: "Error",
        description: "An error occurred while submitting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed z-50 bg-black/50 flex items-start justify-center overflow-y-auto"
      style={{
        top: "4rem", // below SiteHeader (pt-16 = 4rem = 64px)
        left: "2px",
        right: "2px",
        bottom: "5rem", // before SiteNav (~80px)
        borderRadius: "2px",
        margin: "2px",
      }}
    >
      {/* Modal container */}
      <div className="w-full bg-white dark:bg-slate-900 relative flex flex-col max-h-full overflow-y-auto">
        {/* Modal header */}
        <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-6">
          {/* Title and Close button inline */}
          <div className="flex items-start justify-between gap-[2px] sm:gap-4 mb-2">
            <h2 className="text-[22px] sm:text-2xl my-auto sm:my-auto font-semibold text-slate-900 dark:text-white flex-1">
              {showSuccess
                ? "Redemption Submitted"
                : selectedCard
                  ? "Redeem Relic"
                  : "Select a Relic to Redeem"}
            </h2>
            {/* Close button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-6 w-6 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {showSuccess
              ? "Your submission has been processed"
              : selectedCard
                ? "Confirm your relic selection"
                : "Choose from your collection to redeem with the team rankings"}
          </p>
        </div>

        {/* Modal content */}
        <div className="flex-1 flex flex-col p-6 pt-0.5 sm:pt-6 overflow-y-auto">
          {showSuccess ? (
            // Success screen
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div>
                <h2
                  className="text-4xl font-bold mb-2"
                  style={{ color: "#00b341" }}
                >
                  Success!
                </h2>
                <p className="text-slate-700 dark:text-slate-300 text-lg">
                  Your relic has been submitted for the redemption leaderboard.
                  You will be redirected shortly or you can close this menu.
                </p>
              </div>
            </div>
          ) : selectedCard ? (
            // Selected card detail view
            <div className="flex flex-col h-full gap-4">
              <div className="flex-1 flex flex-col gap-4">
                {isLoading ? (
                  <p className="text-slate-600 dark:text-slate-400">
                    Loading relic details...
                  </p>
                ) : (
                  <>
                    <p
                      className="text-slate-900 dark:text-white text-[16px] sm:text-[18px] font-light sm:font-medium leading-[20px] sm:leading-[29px]"
                      style={{
                        margin: "0",
                      }}
                    >
                      {selectedCard.playerName} - {selectedCard.setName} -{" "}
                      {selectedCard.tierValue} - {selectedCard.seriesName} -
                      Game Date: {selectedCard.gameDate} - #
                      {selectedCard.serial} of {selectedCard.minted}
                    </p>

                    {/* SerialCardMini */}
                    <div className="flex justify-center">
                      <div style={{ width: "130px", height: "175px" }}>
                        <SerialCardMini
                          id={selectedCard.editionId}
                          name={selectedCard.playerName}
                          thumb={selectedCard.imageUrl}
                          tier={selectedCard.tierValue}
                          serial={selectedCard.serial}
                          minted={selectedCard.minted}
                          gameDate={selectedCard.gameDate}
                          setName={selectedCard.setName}
                          badge={selectedCard.badge1}
                          badge2={selectedCard.badge2}
                          badge3={selectedCard.badge3}
                          team={selectedCard.seriesName}
                        />
                      </div>
                    </div>

                    {/* Confirmation warning box */}
                    <div
                      style={{
                        fontWeight: 300,
                        fontSize: "12px",
                        lineHeight: "12px",
                        color: "currentColor",
                      }}
                      className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700"
                    >
                      Are you sure? The relic will be held in escrow, unable to
                      be bought, sold, or transferred for two weeks. If you win
                      a spot on the redemption leaderboard it will be burned
                      forever and your reward will be airdropped to you. If you
                      do not place on the redemption leaderboard, it will be
                      unlocked and returned to you when the redemption window
                      ends. If you're sure, type "SUBMIT" in the text box below
                      then press the "REDEEM" button.
                    </div>

                    {/* Confirmation input */}
                    <input
                      type="text"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      placeholder="Type SUBMIT to confirm"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Redeem button */}
                    <button
                      onClick={handleRedeem}
                      disabled={confirmationInput !== "SUBMIT" || isLoading}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      REDEEM
                    </button>
                  </>
                )}
              </div>

              {/* Back button */}
              <button
                onClick={handleBack}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          ) : (
            // Card selection view
            <CollectionCards
              ownerWallet={walletAddress}
              isOwnCollection={true}
              isRedemptionView={true}
              redemptionTeamFilter={team}
              onRelicSelectForRedemption={handleCardSelect}
              team={team}
            />
          )}
        </div>
      </div>
    </div>
  );
}
