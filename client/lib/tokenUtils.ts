import { getContract, readContract, prepareContractCall, sendAndConfirmTransaction } from "thirdweb";
import { polygon } from "thirdweb/chains";

const RPC_URL = "https://polygon-rpc.com";

// Standard ERC20 function selectors
const DECIMALS_SELECTOR = "0x313ce567";
const ALLOWANCE_SELECTOR = "0xdd62ed3e";
const APPROVE_SELECTOR = "0x095ea7b3";

// Cache for token decimals to avoid redundant RPC calls
const decimalCache = new Map<string, number>();

export async function getTokenDecimals(tokenAddress: string): Promise<number> {
  // Check cache first
  if (decimalCache.has(tokenAddress)) {
    return decimalCache.get(tokenAddress)!;
  }

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          { to: tokenAddress, data: DECIMALS_SELECTOR },
          "latest",
        ],
      }),
    });

    const json = await response.json();
    const decimals = json?.result ? Number(BigInt(json.result)) : 18;
    
    // Cache the result
    decimalCache.set(tokenAddress, decimals);
    
    return decimals;
  } catch (error) {
    // Default to 18 decimals on error
    return 18;
  }
}

export function convertToTokenWei(amount: number, decimals: number): bigint {
  const divisor = 10 ** decimals;
  return BigInt(Math.floor(amount * divisor));
}

export async function checkERC20Allowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  clientId: string,
): Promise<bigint> {
  try {
    const tokenContract = getContract({
      address: tokenAddress,
      chain: polygon,
      client: { clientId },
    });

    const allowance = await readContract({
      contract: tokenContract,
      method: "function allowance(address owner, address spender) view returns (uint256)",
      params: [ownerAddress, spenderAddress],
    });

    return BigInt(allowance);
  } catch (error) {
    console.error("Failed to check ERC20 allowance:", error);
    return 0n;
  }
}

export async function approveERC20(
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
  account: any,
  clientId: string,
): Promise<void> {
  try {
    const tokenContract = getContract({
      address: tokenAddress,
      chain: polygon,
      client: { clientId },
    });

    const transaction = prepareContractCall({
      contract: tokenContract,
      method: "function approve(address spender, uint256 amount) returns (bool)",
      params: [spenderAddress, amount],
    });

    await sendAndConfirmTransaction({
      transaction,
      account,
    });
  } catch (error) {
    console.error("Failed to approve ERC20 token:", error);
    throw error;
  }
}
