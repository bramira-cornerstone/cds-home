/**
 * Utility to use Alchemy RPC instead of Thirdweb for read calls
 * This reduces RPC load on Thirdweb's endpoints
 */

const RPC_KEY = import.meta.env.RPC_KEY || "";
const ALCHEMY_RPC_URL = `https://polygon-mainnet.g.alchemy.com/v2/${RPC_KEY}`;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params: unknown[];
  id: number;
}

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

async function alchemyJsonRpc<T>(
  method: string,
  params: unknown[],
): Promise<T> {
  if (!RPC_KEY) {
    throw new Error("RPC_KEY environment variable is not set");
  }

  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    method,
    params,
    id: Math.floor(Math.random() * 1000000),
  };

  try {
    const response = await fetch(ALCHEMY_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const statusMessage = response.statusText || `HTTP ${response.status}`;
      throw new Error(
        `Alchemy RPC request failed: ${response.status} ${statusMessage}`,
      );
    }

    const data = (await response.json()) as JsonRpcResponse<T>;

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    if (data.result === undefined) {
      throw new Error("RPC response missing result field");
    }

    return data.result;
  } catch (err) {
    console.warn(
      `[AlchemyRPC] Error calling ${method}:`,
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
}

/**
 * Make an eth_call to a contract
 * @param to Contract address
 * @param data Encoded function call
 * @param blockTag Block number or tag (default: "latest")
 * @returns Encoded return data
 */
export async function ethCall(
  to: string,
  data: string,
  blockTag: string = "latest",
): Promise<string> {
  return alchemyJsonRpc<string>("eth_call", [{ to, data }, blockTag]);
}

/**
 * Get the current block number
 */
export async function getCurrentBlockNumber(): Promise<number> {
  const blockHex = await alchemyJsonRpc<string>("eth_blockNumber", []);
  return parseInt(blockHex, 16);
}

/**
 * Get balance of an address
 */
export async function getBalance(address: string): Promise<string> {
  return alchemyJsonRpc<string>("eth_getBalance", [address, "latest"]);
}

export const alchemyRpc = {
  ethCall,
  getCurrentBlockNumber,
  getBalance,
};
