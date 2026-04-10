import { useEffect, useState } from "react";
import { getContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { polygon } from "thirdweb/chains";

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
const ERC721_ADDRESS = import.meta.env.VITE_ERC721_ADDRESS || "";
const ERC1155_ADDRESS = import.meta.env.VITE_ERC1155_ADDRESS || "";
const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

export const ALLOWED_CONTRACT_ADDRESSES = [ERC721_ADDRESS, ERC1155_ADDRESS];

export function useMarketplace() {
  const account = useActiveAccount();
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!MARKETPLACE_ADDRESS) {
      setError("Marketplace address not configured");
      setLoading(false);
      return;
    }

    if (!THIRDWEB_CLIENT_ID) {
      setError("Thirdweb client ID not configured");
      setLoading(false);
      return;
    }

    try {
      const marketplaceContract = getContract({
        address: MARKETPLACE_ADDRESS,
        chain: polygon,
        client: {
          clientId: THIRDWEB_CLIENT_ID,
        },
      });

      setContract(marketplaceContract);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load marketplace",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    contract,
    loading,
    error,
    isValidContractAddress: (address: string) =>
      ALLOWED_CONTRACT_ADDRESSES.some(
        (allowed) => allowed.toLowerCase() === address.toLowerCase(),
      ),
  };
}

export function isValidMarketplaceContractAddress(address: string): boolean {
  return ALLOWED_CONTRACT_ADDRESSES.some(
    (allowed) => allowed.toLowerCase() === address.toLowerCase(),
  );
}
