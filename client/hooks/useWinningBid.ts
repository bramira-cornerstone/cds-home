import { useQuery } from "@tanstack/react-query";
import { getContract, readContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";

export function useWinningBid(auctionId: string | number | null) {
  return useQuery({
    queryKey: ["winningBid", auctionId],
    queryFn: async () => {
      if (!auctionId || !MARKETPLACE_ADDRESS) {
        return null;
      }

      try {
        const client = getAlchemyThirdwebClient();
        const contract = getContract({
          address: MARKETPLACE_ADDRESS,
          chain: polygon,
          client,
        });

        const result = await readContract({
          contract,
          method:
            "function getWinningBid(uint256 _auctionId) returns (address, address, uint256)",
          params: [BigInt(auctionId)],
        });

        if (result && result[2] !== undefined) {
          return Number(result[2]) / 1e18;
        }
        return null;
      } catch (err) {
        return null;
      }
    },
    enabled: Boolean(auctionId && MARKETPLACE_ADDRESS),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
  });
}
