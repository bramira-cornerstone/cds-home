import { useCallback, useEffect, useState } from "react";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { useToast } from "@/components/ui/use-toast";
import { corContract } from "@/lib/priorDrops";

export function FreeMoneyCard() {
  const { toast } = useToast();
  const account = useActiveAccount();
  const address = account?.address ?? null;

  const [corAmount, setCorAmount] = useState<bigint>(1n);
  const [isClaimingCOR, setIsClaimingCOR] = useState(false);

  const { mutate: sendTransaction } = useSendTransaction();

  // Get the amount of COR already claimed by this wallet
  const { data: supplyClaimedByWallet } = useReadContract({
    contract: corContract,
    method: "function getSupplyClaimedByWallet(uint256 _conditionId, address _claimer) view returns (uint256 supplyClaimedByWallet)",
    params: address ? [0n, address] : undefined,
    queryOptions: {
      enabled: Boolean(corContract && address),
    },
  });

  // Set default corAmount to max available (5000 - already claimed)
  useEffect(() => {
    if (supplyClaimedByWallet != null) {
      // supplyClaimedByWallet is in 18-decimal format, need to convert back to standard integers
      const claimedBigInt = typeof supplyClaimedByWallet === "bigint"
        ? supplyClaimedByWallet
        : BigInt(supplyClaimedByWallet);
      const decimals = 10n ** 18n;
      const claimedStandardFormat = claimedBigInt / decimals;
      const claimed = Number(claimedStandardFormat);
      const maxAvailable = Math.max(1, 5000 - claimed); // min 1, max 5000
      setCorAmount(BigInt(maxAvailable));
    }
  }, [supplyClaimedByWallet]);

  // Handler for claiming COR tokens
  const handleClaimCOR = useCallback(async () => {
    if (!address || !corContract) {
      toast({
        title: "Error",
        description: "Wallet or contract not available",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsClaimingCOR(true);

      // Convert amount to 18 decimals (GWEI format)
      const decimals = 10n ** 18n;
      const quantityWithDecimals = corAmount * decimals;
      const maxLimitWithDecimals = 5000n * decimals;

      const transaction = prepareContractCall({
        contract: corContract,
        method: "function claim(address _receiver, uint256 _quantity, address _currency, uint256 _pricePerToken, (bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) _allowlistProof, bytes _data) payable",
        params: [
          address, // _receiver (connected wallet)
          quantityWithDecimals, // _quantity (converted to 18 decimals)
          "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // _currency (native chain token)
          0n, // _pricePerToken
          {
            proof: [], // empty allowlist proof (public claim)
            quantityLimitPerWallet: maxLimitWithDecimals, // max limit (converted to 18 decimals)
            pricePerToken: 0n, // free
            currency: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // native chain token
          }, // _allowlistProof struct
          "0x", // _data (empty bytes)
        ],
      });

      sendTransaction(transaction, {
        onSuccess: () => {
          toast({
            title: "Success!",
            description: `You've claimed $${corAmount.toString()} COR free`,
          });
          // Reset the amount
          setCorAmount(1n);
          setIsClaimingCOR(false);
          // Trigger balance refresh in wallet display
          document.dispatchEvent(new CustomEvent("wallet:balance:refresh"));
        },
        onError: (error) => {
          const errorMsg = error instanceof Error ? error.message : "Claim failed";
          toast({
            title: "Error",
            description: errorMsg,
            variant: "destructive",
          });
          setIsClaimingCOR(false);
        },
      });
    } catch (error) {
      setIsClaimingCOR(false);
      const errorMsg = error instanceof Error ? error.message : "Failed to prepare claim";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  }, [address, corContract, corAmount, sendTransaction, toast]);

  return (
    <article className="grid gap-2 sm:gap-6 rounded-lg border border-slate-200 bg-white/70 p-6 shadow-sm md:grid-cols-[minmax(0,280px)_1fr] dark:bg-slate-700 dark:border-white/10 account-free-money-card">
      <div className="md:col-span-2 space-y-2">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white text-center">
          Free Money
        </h2>
        <img
          src="/images/sampleWallet.webp"
          alt="Sample wallet interface"
          className="max-w-sm rounded-md shadow-sm sm:mx-0"
          style={{
            margin: "0 auto",
          }}
        />
        <p className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300 text-center">
          No really. Click below to claim $5000 free in COR site
          currency in order to test the product.
          <br />
          <br />
          This is what you'll use to buy collectibles and boxes, and what you'll earn from selling them. Not exchangeable for cash.
        </p>
      </div>
      <div className="md:col-span-2 flex flex-col items-center gap-4">
        {/* COR Amount Selector - Slider and Text Input */}
        <style>{`
          input[type="range"] {
            width: 200px;
            height: 4px;
            accent-color: #004FFF;
          }
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #004FFF;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #004FFF;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
        `}</style>
        <div className="flex flex-col items-center gap-3">
          <input
            type="range"
            min="1"
            max="5000"
            value={corAmount.toString()}
            onChange={(e) => {
              setCorAmount(BigInt(Number(e.target.value)));
            }}
            className="cursor-pointer mt-6 mb-6"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="5000"
              value={corAmount.toString()}
              onChange={(e) => {
                const val = BigInt(
                  Math.max(
                    1,
                    Math.min(Number(e.target.value), 5000),
                  ),
                );
                setCorAmount(val);
              }}
              className="w-20 text-center px-2 py-1 border border-slate-300 rounded dark:bg-slate-600 dark:text-white dark:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              COR
            </span>
          </div>
        </div>
        {/* Fill Wallet Button */}
        <button
          type="button"
          onClick={handleClaimCOR}
          disabled={isClaimingCOR}
          className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <p>{isClaimingCOR ? "Claiming..." : "Fill Your Wallet"}</p>
        </button>
      </div>
    </article>
  );
}
