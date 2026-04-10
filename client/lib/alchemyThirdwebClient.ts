import { createThirdwebClient, type ThirdwebClient } from "thirdweb";
import { polygon } from "thirdweb/chains";

const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";
const ALCHEMY_RPC_KEY = import.meta.env.RPC_KEY || "";

/**
 * Creates a Thirdweb client with Alchemy RPC support
 * Uses the Alchemy RPC key for authenticated contract reads to avoid 401 errors
 */
export function createAlchemyThirdwebClient(): ThirdwebClient {
  const clientConfig: any = {
    clientId: THIRDWEB_CLIENT_ID,
  };

  // Add Alchemy RPC URL if RPC key is available
  if (ALCHEMY_RPC_KEY) {
    const alchemyRpcUrl = `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_RPC_KEY}`;
    clientConfig.rpcUrls = {
      [polygon.id]: {
        http: [alchemyRpcUrl],
      },
    };
  }

  return createThirdwebClient(clientConfig);
}

let cachedClient: ThirdwebClient | null = null;

/**
 * Get or create the cached Alchemy-backed Thirdweb client
 */
export function getAlchemyThirdwebClient(): ThirdwebClient {
  if (!cachedClient) {
    cachedClient = createAlchemyThirdwebClient();
  }
  return cachedClient;
}
