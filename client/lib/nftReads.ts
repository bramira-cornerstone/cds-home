import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { polygon } from "thirdweb/chains";

const clientId = (import.meta as any).env.THIRDWEB_CLIENT_ID as
  | string
  | undefined;

const client = clientId ? createThirdwebClient({ clientId }) : null;

const ERC721_ADDRESS = (import.meta as any).env.VITE_ERC721_ADDRESS as
  | string
  | undefined;
const ERC1155_BOX_ADDRESS = (import.meta as any).env.VITE_ERC1155_ADDRESS as
  | string
  | undefined;

// Fallback if VITE_ERC1155_ADDRESS is not set
const BOXES_CONTRACT_ADDRESS =
  ERC1155_BOX_ADDRESS || "0xdF4c403D4A9c1b4Ead5ac60A91A1E652d749e31d";

interface RelicsNFT {
  tokenId: string;
  edition_id?: number;
  serial?: number;
}

interface BoxesBalance {
  [tokenId: string]: bigint;
}

/**
 * Fetch relics for a wallet address using Alchemy's NFT API
 * Returns the raw Alchemy response for processing by CollectionCards
 */
export async function fetchRelicsForWallet(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<Array<any>> {
  if (!walletAddress?.trim()) {
    console.warn("[fetchRelicsForWallet] No wallet address provided");
    return [];
  }

  const rpcKey = (import.meta as any).env.RPC_KEY as string | undefined;
  if (!rpcKey) {
    console.warn("[fetchRelicsForWallet] No RPC_KEY configured");
    return [];
  }

  if (!ERC721_ADDRESS) {
    console.warn("[fetchRelicsForWallet] No ERC721_ADDRESS configured");
    return [];
  }

  try {
    const alchemyUrl = `https://polygon-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(
      rpcKey,
    )}/getNFTsForOwner?owner=${encodeURIComponent(
      walletAddress,
    )}&contractAddresses%5B%5D=${encodeURIComponent(
      ERC721_ADDRESS,
    )}&withMetadata=true&pageSize=100`;

    console.log("[fetchRelicsForWallet] Fetching relics for:", walletAddress);
    console.log("[fetchRelicsForWallet] Contract:", ERC721_ADDRESS);

    const res = await fetch(alchemyUrl, {
      mode: "cors",
      cache: "no-store",
      signal,
    });

    if (!res.ok) {
      if (res.status >= 500) {
        const errorText = await res.text();
        const statusMessage = res.statusText || `HTTP ${res.status}`;
        console.warn(
          `[fetchRelicsForWallet] Alchemy API error: ${res.status} ${statusMessage}`,
          errorText,
        );
      }
      return [];
    }

    const data = await res.json();
    const nfts = (data?.ownedNfts || []) as Array<any>;
    console.log("[fetchRelicsForWallet] Got", nfts.length, "relics");
    return nfts;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return [];
    }
    console.warn("[fetchRelicsForWallet] Error:", e?.message || e);
    return [];
  }
}

/**
 * Fetch boxes for a wallet address using Alchemy's getNFTsForOwner
 */
export async function fetchBoxesForOwnerAlchemy(
  walletAddress: string,
): Promise<BoxesBalance> {
  if (!walletAddress?.trim()) {
    console.warn("[fetchBoxesForOwnerAlchemy] No wallet address provided");
    return {};
  }

  const rpcKey = (import.meta as any).env.RPC_KEY as string | undefined;
  if (!rpcKey) {
    console.warn("[fetchBoxesForOwnerAlchemy] No RPC_KEY configured");
    return {};
  }

  try {
    const alchemyUrl = `https://polygon-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(
      rpcKey,
    )}/getNFTsForOwner?owner=${encodeURIComponent(
      walletAddress,
    )}&contractAddresses%5B%5D=${encodeURIComponent(
      BOXES_CONTRACT_ADDRESS,
    )}&withMetadata=true&pageSize=100`;

    console.log(
      "[fetchBoxesForOwnerAlchemy] Fetching boxes for:",
      walletAddress,
    );
    console.log(
      "[fetchBoxesForOwnerAlchemy] Contract:",
      BOXES_CONTRACT_ADDRESS,
    );

    const res = await fetch(alchemyUrl, {
      mode: "cors",
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        const errorText = await res.text();
        const statusMessage = res.statusText || `HTTP ${res.status}`;
        console.warn(
          `[fetchBoxesForOwnerAlchemy] Alchemy API error: ${res.status} ${statusMessage}`,
          errorText,
        );
      }
      return {};
    }

    const data = await res.json();
    const nfts = (data?.ownedNfts || []) as Array<any>;
    const balances: BoxesBalance = {};

    for (const nft of nfts) {
      const tokenId = nft?.tokenId || nft?.id?.tokenId;
      if (tokenId) {
        const balance = nft?.balance ? BigInt(nft.balance) : 1n;
        balances[String(tokenId)] = balance;
      }
    }

    console.log(
      "[fetchBoxesForOwnerAlchemy] Got",
      Object.keys(balances).length,
      "box token IDs",
    );
    return balances;
  } catch (e: any) {
    console.warn("[fetchBoxesForOwnerAlchemy] Error:", e?.message || e);
    return {};
  }
}

/**
 * Fetch box balances for a wallet address using direct contract reads
 * First calls nextTokenIdToMint() to discover the highest token ID,
 * then batches balance checks downward from that value to 0
 */
export async function fetchBoxesBalanceForWallet(
  walletAddress: string,
): Promise<BoxesBalance> {
  if (!walletAddress?.trim() || !client || !BOXES_CONTRACT_ADDRESS) return {};

  try {
    const contract = getContract({
      client,
      address: BOXES_CONTRACT_ADDRESS,
      chain: polygon,
    });

    const balances: BoxesBalance = {};

    // Get the next token ID to mint (highest existing token ID is nextTokenIdToMint - 1)
    let maxTokenId = 0;
    try {
      const nextId = await readContract({
        contract,
        method: "function nextTokenIdToMint() view returns (uint256)",
        params: [],
      });

      if (nextId) {
        const num = Number(nextId);
        if (Number.isFinite(num) && num > 0) {
          maxTokenId = num - 1;
        }
      }
    } catch (e) {
      console.warn("Error calling nextTokenIdToMint():", e);
      return {};
    }

    // Create array of token IDs from 0 to maxTokenId
    const tokenIdsToCheck: number[] = [];
    for (let i = maxTokenId; i >= 0; i--) {
      tokenIdsToCheck.push(i);
    }

    // Create batches of requests to avoid overwhelming the RPC
    const batchSize = 20;
    for (let i = 0; i < tokenIdsToCheck.length; i += batchSize) {
      const batch = tokenIdsToCheck.slice(i, i + batchSize);
      const promises = batch.map((tokenId) =>
        (async () => {
          try {
            const balance = await readContract({
              contract,
              method:
                "function balanceOf(address account, uint256 id) view returns (uint256)",
              params: [walletAddress, BigInt(tokenId)],
            });

            if (balance && Number(balance) > 0) {
              return { tokenId: String(tokenId), balance: balance as bigint };
            }
            return null;
          } catch (e) {
            // Ignore errors for individual token IDs
            return null;
          }
        })(),
      );

      const results = await Promise.all(promises);
      for (const result of results) {
        if (result) {
          balances[result.tokenId] = result.balance;
        }
      }
    }

    return balances;
  } catch (e: any) {
    return {};
  }
}
