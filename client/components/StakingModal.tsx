import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, getContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";
import CollectionCards from "@/components/CollectionCards";
import SerialCardMini from "@/components/SerialCardMini";
import { X, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";
import { useToast } from "@/hooks/use-toast";

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

interface StakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  team?: string | null;
}

export function StakingModal({ isOpen, onClose, team }: StakingModalProps) {
  const account = useActiveAccount();
  const walletAddress = account?.address ?? null;
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const { mutate: sendTransaction } = useSendTransaction();
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
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleStake = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setSubmitError(null);

    if (confirmationInput.toUpperCase() !== "SUBMIT") {
      setSubmitError('Please type "SUBMIT" to confirm staking.');
      return;
    }

    if (!selectedCard || !team || !walletAddress) {
      setSubmitError("Missing card or wallet information");
      return;
    }

    try {
      setIsSubmitting(true);

      // Get the token_id from selectedCard
      const tokenId = selectedCard.tokenId;

      if (!tokenId) {
        throw new Error("Could not find relic token ID");
      }

      const erc721Address = import.meta.env.VITE_ERC721_ADDRESS as
        | string
        | undefined;

      if (!erc721Address) {
        throw new Error("ERC721 contract address not configured");
      }

      // Create contract instance on Polygon
      const thirdwebClient = getAlchemyThirdwebClient();
      const contract = getContract({
        client: thirdwebClient,
        address: erc721Address,
        chain: polygon,
      });

      // Prepare the stake transaction
      const transaction = prepareContractCall({
        contract,
        method:
          "function stake(uint256 tokenId, bool longStake, string holderAuth)",
        params: [BigInt(tokenId), true, confirmationInput],
      });

      // Send the transaction
      sendTransaction(transaction, {
        onSuccess: async () => {
          // Insert staking event record into the database
          const baseUrl = import.meta.env.SUPABASE_URL as
            | string
            | undefined;
          const anonKey = import.meta.env.SUPABASE_ANON_KEY as
            | string
            | undefined;

          if (baseUrl && anonKey && walletAddress) {
            try {
              const insertUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/stakingEvents`;

              await fetch(insertUrl, {
                method: "POST",
                headers: {
                  apikey: anonKey,
                  Authorization: `Bearer ${anonKey}`,
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify({
                  token_id: tokenId,
                  staker: walletAddress,
                  longStake: true,
                  timestamp: new Date().toISOString(),
                }),
              });
            } catch (err) {
              console.error("Failed to record staking event:", err);
            }
          }

          setSubmitSuccess(true);
          toast({
            title: "Success",
            description: "Your relic has been staked successfully!",
          });

          // Close modal after success
          setTimeout(() => {
            setConfirmationInput("");
            setSelectedCard(null);
            setSubmitSuccess(false);
            setSubmitError(null);
            onClose();
          }, 2000);
        },
        onError: (error) => {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to send transaction";
          setSubmitError(errorMessage);
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
          setIsSubmitting(false);
        },
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to stake relic";
      setSubmitError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
              {selectedCard ? "Confirm Stake" : `Stake your ${team} relics. Earn rewards.`}
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
          {!selectedCard && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a relic from your collection to stake for the {team}{" "}
              leaderboard
            </p>
          )}
        </div>

        {/* Modal content */}
        <div className="flex-1 flex flex-col p-6 pt-0.5 sm:pt-6 overflow-y-auto">
          {selectedCard ? (
            // Confirmation view
            <div className="flex flex-col h-full gap-4">
              <div className="flex-1 flex flex-col gap-4">
                {isLoading ? (
                  <p className="text-slate-600 dark:text-slate-400">
                    Loading relic details...
                  </p>
                ) : (
                  <>
                    <p
                      className="text-slate-900 dark:text-white text-[16px] sm:text-[18px] font-light sm:font-medium leading-[20px] sm:leading-[29px] max-lg:mx-auto"
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

                    {/* Confirmation info box */}
                    <div
                      style={{
                        fontWeight: 300,
                        fontSize: "12px",
                        lineHeight: "12px",
                        color: "currentColor",
                      }}
                      className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700"
                    >
                      <p>
                        Staking this relic will help you climb the{" "}
                        <strong>{team}</strong> leaderboard rankings. Your relic
                        will remain in your collection but you will be unable to
                        sell, transfer, or redeem it for 365 days until it
                        unlocks. Confirm and stake it below.
                      </p>
                    </div>

                    {submitError && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded">
                        {submitError}
                      </div>
                    )}

                    {submitSuccess && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-4 rounded">
                        Relic staked successfully!
                      </div>
                    )}

                    {/* Confirmation input */}
                    <input
                      type="text"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      placeholder='Type "SUBMIT" to confirm'
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Stake button */}
                    <button
                      onClick={handleStake}
                      disabled={
                        confirmationInput.toUpperCase() !== "SUBMIT" ||
                        isSubmitting ||
                        submitSuccess
                      }
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitSuccess
                        ? "Success!"
                        : isSubmitting
                          ? "Staking..."
                          : "STAKE"}
                    </button>
                  </>
                )}
              </div>

              {/* Back button */}
              <button
                onClick={handleBack}
                disabled={isSubmitting || submitSuccess}
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
