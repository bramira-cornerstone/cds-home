import React, { useEffect, useMemo, useState } from "react";
import {
  getContract,
  sendTransaction,
  waitForReceipt,
  readContract,
  prepareEvent,
  parseEventLogs,
  prepareContractCall,
} from "thirdweb";
import { setApprovalForAll, isApprovedForAll } from "thirdweb/extensions/erc1155";
import { useActiveAccount } from "thirdweb/react";
import { polygon } from "thirdweb/chains";
import { encodeAbiParameters, keccak256, toHex } from "viem";
import { fetchRelicSerialByTokenId } from "@/lib/supabaseRelicSerialsJoined";

const ERC1155_BOX_ADDRESS = (import.meta as any).env.VITE_ERC1155_ADDRESS as
  | string
  | undefined;
const ERC721_RELIC_ADDRESS = (import.meta as any).env.VITE_ERC721_ADDRESS as
  | string
  | undefined;

/**
 * Retry fetching relic data with exponential backoff and timeout
 * Waits up to 5 minutes for relic data to be indexed in the database
 */
async function fetchRelicDataWithRetry(
  tokenIds: number[],
  maxWaitMs: number = 5 * 60 * 1000, // 5 minutes
  onStatusUpdate?: (status: string) => void
) {
  const startTime = Date.now();
  let lastError: Error | null = null;
  let attemptCount = 0;

  console.log(
    `[BoxOpenModal] Starting fetchRelicDataWithRetry for ${tokenIds.length} tokens with ${maxWaitMs}ms timeout`
  );

  while (Date.now() - startTime < maxWaitMs) {
    attemptCount++;
    try {
      const relicData = await Promise.all(
        tokenIds.map(async (rId) => {
          const row = await fetchRelicSerialByTokenId(rId);

          if (!row) {
            return {
              edition_id: 0,
              serial: 0,
              token_id: rId,
            };
          }

          return {
            edition_id: row.edition_id ?? 0,
            serial: row.serial ?? 0,
            token_id: rId,
            ...row,
          };
        }),
      );

      // Check if we got valid data for all tokens
      const allValidRows = relicData.every(
        (item) =>
          item.edition_id !== 0 || item.serial !== 0 || item.token_id !== undefined
      );

      if (allValidRows) {
        const elapsedMs = Date.now() - startTime;
        console.log(
          `[BoxOpenModal] Successfully fetched relic data after ${elapsedMs}ms (${attemptCount} attempts)`
        );
        onStatusUpdate?.(
          `✅ Relic data loaded (${elapsedMs / 1000} seconds)`
        );
        return relicData;
      }

      // If we didn't get valid data, wait and retry
      const elapsedMs = Date.now() - startTime;
      const remainingMs = maxWaitMs - elapsedMs;

      if (remainingMs > 0) {
        // Exponential backoff: 1s, 2s, 4s, 8s, etc., capped at 10s
        const backoffMs = Math.min(
          1000 * Math.pow(2, Math.floor(elapsedMs / 5000)),
          10000
        );
        const waitMs = Math.min(backoffMs, remainingMs);

        const statusMsg = `Waiting for relic data (${attemptCount} attempts, ${Math.round(elapsedMs / 1000)}s)...`;
        console.log(`[BoxOpenModal] ${statusMsg} Retrying in ${waitMs}ms`);
        onStatusUpdate?.(statusMsg);

        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const elapsedMs = Date.now() - startTime;
      const remainingMs = maxWaitMs - elapsedMs;

      console.log(
        `[BoxOpenModal] Attempt ${attemptCount} failed: ${lastError.message}`
      );

      if (remainingMs > 0) {
        const backoffMs = Math.min(
          1000 * Math.pow(2, Math.floor(elapsedMs / 5000)),
          10000
        );
        const waitMs = Math.min(backoffMs, remainingMs);

        const statusMsg = `Retry attempt ${attemptCount} failed. Retrying...`;
        console.log(`[BoxOpenModal] ${statusMsg} Retrying in ${waitMs}ms`);
        onStatusUpdate?.(statusMsg);

        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  // Timeout exceeded, return what we can
  console.log(
    `[BoxOpenModal] Timeout waiting for relic data (waited ${maxWaitMs}ms after ${attemptCount} attempts). Last error: ${lastError?.message}`
  );
  onStatusUpdate?.(
    `⚠️ Timeout fetching relic data (waited ${maxWaitMs / 1000}s, completed ${attemptCount} attempts)`
  );

  return tokenIds.map((rId) => ({
    edition_id: 0,
    serial: 0,
    token_id: rId,
  }));
}

// ---------------- ABIs ----------------

// Relics721 minimal ABI (updated for commit/reveal + your current contract signatures)
const RELICS_SAFE_READ_ABI = [
  // view
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "boxes", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },

  // boxSpecs(boxTokenId) -> (configured, dropWeek, tier)
  {
    type: "function",
    name: "boxSpecs",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "" }],
    outputs: [
      { type: "bool", name: "configured" },
      { type: "uint32", name: "dropWeek" },
      { type: "uint8", name: "tier" },
    ],
  },

  // claimPool(dropWeek,tier) -> uint256[]
  {
    type: "function",
    name: "claimPool",
    stateMutability: "view",
    inputs: [
      { type: "uint32", name: "dropWeek" },
      { type: "uint8", name: "tier" },
    ],
    outputs: [{ type: "uint256[]", name: "ids" }],
  },

  // commit rules (optional UX gating, kept here for possible future use)
  { type: "function", name: "commitMinDelayBlocks", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },

  // read commit state
  {
    type: "function",
    name: "getOpenCommit",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "user" },
      { type: "uint256", name: "boxTokenId" },
    ],
    outputs: [
      { type: "bytes32", name: "commitHash" },
      { type: "uint64", name: "commitBlock" },
    ],
  },

  // write
  {
    type: "function",
    name: "commitOpen",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "boxTokenId" },
      { type: "bytes32", name: "commitHash" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelOpenCommit",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256", name: "boxTokenId" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revealOpen",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "boxTokenId" },
      { type: "bytes32", name: "seed" },
    ],
    outputs: [{ type: "uint256[]", name: "mintedTokenIds" }],
  },

  // relicData(tokenId) -> (editionId, serial, dropWeek, tier)
  {
    type: "function",
    name: "relicData",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [
      { type: "uint32", name: "editionId" },
      { type: "uint32", name: "serial" },
      { type: "uint32", name: "dropWeek" },
      { type: "uint8", name: "tier" },
    ],
  },
] as const;

// Minimal ABI for ERC1155: balanceOf
const ERC1155_SAFE_READ_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "id" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// RelicBatchMinted event (only listen for batch events, not individual RelicMinted)
const relicBatchMintedEvent = prepareEvent({
  signature: "event RelicBatchMinted(address indexed to, uint256[] tokenIds)",
});

// ---------------- Types ----------------

export type BoxOpenModalProps = {
  client: any | null;
  tokenId?: bigint | number | null;
  onBoxOpenComplete?: (result: {
    success: boolean;
    message: string;
    awardedTokenIds?: number[];
    relicData?: Array<{ edition_id: number; serial: number; token_id: number }>;
  }) => void;
  onApprovalTxHash?: (hash: string) => void;
  onClose?: () => void;
};

// ---------------- Commit storage helpers ----------------

type StoredOpenCommit = {
  seed: `0x${string}`;
  commitHash: `0x${string}`;
  boxId: number;
  userAddress: string;
  contractAddress: string;
  chainId: number;
  createdAtMs: number;
};

function makeStorageKey(args: {
  chainId: number;
  contractAddress: string;
  userAddress: string;
  boxId: number;
}) {
  // separate per chain + contract + user + box
  return `relic_open_commit:${args.chainId}:${args.contractAddress.toLowerCase()}:${args.userAddress.toLowerCase()}:${args.boxId}`;
}

function saveCommitToStorage(entry: StoredOpenCommit) {
  const key = makeStorageKey({
    chainId: entry.chainId,
    contractAddress: entry.contractAddress,
    userAddress: entry.userAddress,
    boxId: entry.boxId,
  });
  localStorage.setItem(key, JSON.stringify(entry));
}

function loadCommitFromStorage(args: {
  chainId: number;
  contractAddress: string;
  userAddress: string;
  boxId: number;
}): StoredOpenCommit | null {
  const key = makeStorageKey(args);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredOpenCommit;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.chainId !== args.chainId ||
      (parsed.contractAddress || "").toLowerCase() !== args.contractAddress.toLowerCase() ||
      (parsed.userAddress || "").toLowerCase() !== args.userAddress.toLowerCase() ||
      parsed.boxId !== args.boxId ||
      typeof parsed.seed !== "string" ||
      typeof parsed.commitHash !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearCommitFromStorage(args: {
  chainId: number;
  contractAddress: string;
  userAddress: string;
  boxId: number;
}) {
  const key = makeStorageKey(args);
  localStorage.removeItem(key);
}

// ---------------- Hash helpers ----------------

function randomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes) as `0x${string}`;
}

// MUST match Solidity:
// keccak256(abi.encode("OPEN_COMMIT", chainid, address(this), seed, msg.sender, boxTokenId))
function computeOpenCommitHash(args: {
  chainId: number;
  contractAddress: string;
  seed: `0x${string}`; // bytes32
  userAddress: string;
  boxTokenId: bigint;
}): `0x${string}` {
  const encoded = encodeAbiParameters(
    [
      { type: "string" },
      { type: "uint256" },
      { type: "address" },
      { type: "bytes32" },
      { type: "address" },
      { type: "uint256" },
    ],
    [
      "OPEN_COMMIT",
      BigInt(args.chainId),
      args.contractAddress as `0x${string}`,
      args.seed,
      args.userAddress as `0x${string}`,
      args.boxTokenId,
    ],
  );
  return keccak256(encoded);
}

// ---------------- Component ----------------

type OpenPhase = "idle" | "committing" | "committed" | "revealing";

export default function BoxOpenModal({
  client,
  tokenId,
  onBoxOpenComplete,
  onApprovalTxHash,
  onClose,
}: BoxOpenModalProps) {
  const account = useActiveAccount();

  const [approved, setApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [approvalTxHash, setApprovalTxHash] = useState("");

  const [phase, setPhase] = useState<OpenPhase>("idle");
  const [seed, setSeed] = useState<`0x${string}` | null>(null);
  const [commitHash, setCommitHash] = useState<`0x${string}` | null>(null);

  // ---------- Contract Instances ----------
  const packContract = useMemo(
    () =>
      client && ERC1155_BOX_ADDRESS
        ? getContract({
            client,
            address: ERC1155_BOX_ADDRESS,
            chain: polygon,
            abi: ERC1155_SAFE_READ_ABI,
          })
        : null,
    [client],
  );

  const relicContract = useMemo(
    () =>
      client && ERC721_RELIC_ADDRESS
        ? getContract({
            client,
            address: ERC721_RELIC_ADDRESS,
            chain: polygon,
            abi: RELICS_SAFE_READ_ABI,
          })
        : null,
    [client],
  );

  // ---------- Derive boxId ----------
  const boxId: number | null = useMemo(() => {
    if (tokenId === null || tokenId === undefined) return null;
    const n = typeof tokenId === "bigint" ? Number(tokenId) : Number(tokenId);
    return Number.isFinite(n) ? n : null;
  }, [tokenId]);

  // ---------- Restore commit from localStorage (if any) ----------
  useEffect(() => {
    if (!account || !ERC721_RELIC_ADDRESS || boxId === null) return;

    const stored = loadCommitFromStorage({
      chainId: polygon.id,
      contractAddress: ERC721_RELIC_ADDRESS,
      userAddress: account.address,
      boxId,
    });

    if (stored) {
      setSeed(stored.seed);
      setCommitHash(stored.commitHash);
      setPhase("committed");
      setTxStatus("ℹ️ Restored combination to open the Box. You can Reveal or Cancel.");
    }
  }, [account?.address, boxId]);

  // ---------- Check Approval ----------
  useEffect(() => {
    if (!account || !packContract || !ERC721_RELIC_ADDRESS) return;
    let cancelled = false;

    async function checkApproval() {
      try {
        const ok = await isApprovedForAll({
          contract: packContract,
          owner: account.address,
          operator: ERC721_RELIC_ADDRESS,
        });
        if (!cancelled) setApproved(ok);
      } catch {
        if (!cancelled) setApproved(false);
      }
    }

    checkApproval();
    return () => {
      cancelled = true;
    };
  }, [account, packContract]);

  // ---------- Approve ----------
  async function handleApprove() {
    if (!packContract || !account) {
      setTxStatus("❌ Missing wallet or contract");
      return;
    }

    setLoading(true);
    setTxStatus("Processing approval...");

    try {
      const tx = setApprovalForAll({
        contract: packContract,
        operator: ERC721_RELIC_ADDRESS!,
        approved: true,
      });

      const sentTx = await sendTransaction({ transaction: tx, account });
      const hash = sentTx?.transactionHash || (sentTx as any)?.hash;

      if (hash) {
        onApprovalTxHash?.(hash);
        setApprovalTxHash(hash);
      }

      setTxStatus("✅ Approval complete");
      setApproved(true);
    } catch (err: any) {
      const msg =
        err?.message || err?.reason || err?.shortMessage || "Approval failed";
      setTxStatus(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // ---------- OPEN BOX (COMMIT) ----------
  async function handleCommitOpen() {
    if (!relicContract || !packContract || !account) {
      setTxStatus("❌ Missing required information.");
      return;
    }
    if (boxId === null) {
      setTxStatus("❌ No valid boxId was provided.");
      return;
    }
    if (loading) return;

    // Capture account address at start to verify it doesn't change mid-transaction
    const accountAddressAtStart = account.address;

    setLoading(true);
    setPhase("committing");
    setTxStatus("Validating...");

    try {
      // Helper to verify wallet is still connected
      const ensureConnected = () => {
        if (!account || account.address !== accountAddressAtStart) {
          throw new Error("⚠️ Wallet was disconnected. Please ensure your wallet stays connected and try again.");
        }
      };
      // ---- 1. Paused check ----
      ensureConnected();
      const pausedRaw = await readContract({
        contract: relicContract,
        method: "paused",
        params: [],
      });
      const paused =
        typeof pausedRaw === "boolean"
          ? pausedRaw
          : Array.isArray(pausedRaw)
            ? pausedRaw[0]
            : !!pausedRaw;

      if (paused) throw new Error("Box opening is temporarily paused. Please try again later.");

      // ---- 2. boxes() address must match ERC1155_BOX_ADDRESS ----
      ensureConnected();
      const boxesAddrRaw = await readContract({
        contract: relicContract,
        method: "boxes",
        params: [],
      });

      const boxesAddr =
        typeof boxesAddrRaw === "string"
          ? boxesAddrRaw
          : Array.isArray(boxesAddrRaw)
            ? boxesAddrRaw[0]
            : String(boxesAddrRaw);

      if (
        !ERC1155_BOX_ADDRESS ||
        boxesAddr.toLowerCase() !== ERC1155_BOX_ADDRESS.toLowerCase()
      ) {
        throw new Error(
          `Relic contract is configured to redeem a different Boxes contract.\nOn-chain boxes(): ${boxesAddr}\nFrontend ERC1155: ${ERC1155_BOX_ADDRESS}`,
        );
      }

      // ---- 3. boxSpecs(boxId) ----
      ensureConnected();
      const specRaw = await readContract({
        contract: relicContract,
        method: "boxSpecs",
        params: [BigInt(boxId)],
      });

      let configured = false;
      let dropWeek = 0;
      let tier = 0;

      if (Array.isArray(specRaw)) {
        configured = !!specRaw[0];
        dropWeek = Number(specRaw[1] ?? 0);
        tier = Number(specRaw[2] ?? 0);
      } else if (specRaw && typeof specRaw === "object") {
        configured = !!(specRaw as any).configured;
        dropWeek = Number((specRaw as any).dropWeek ?? 0);
        tier = Number((specRaw as any).tier ?? 0);
      }

      if (!configured) throw new Error("This box is not unlocked for Relics yet.");
      if (tier < 1 || tier > 5) throw new Error(`Box tier ${tier} is invalid (expected 1–5).`);

      // ---- 4. User ERC1155 balance ----
      ensureConnected();
      const balRaw = await readContract({
        contract: packContract,
        method: "balanceOf",
        params: [accountAddressAtStart, BigInt(boxId)],
      });

      const balance =
        typeof balRaw === "bigint"
          ? Number(balRaw)
          : Array.isArray(balRaw)
            ? Number(balRaw[0] ?? 0)
            : Number(balRaw ?? 0);

      if (!Number.isFinite(balance) || balance <= 0) {
        throw new Error("You do not own this Box.");
      }

      // ---- 5. ERC1155 approval (on-chain) ----
      ensureConnected();
      const approval = await isApprovedForAll({
        contract: packContract,
        owner: accountAddressAtStart,
        operator: ERC721_RELIC_ADDRESS!,
      });

      if (!approval) {
        throw new Error(
          "Box approval is not yet finalized in ledger. Please approve again or wait for confirmation.",
        );
      }

      // ---- 6. Prize pool checks using claimPool() ----
      ensureConnected();
      setTxStatus("Checking available Relics...");

      let neededBasic = 0,
        neededRare = 0,
        neededEpic = 0;

      if (tier === 1) neededBasic = 2;
      else if (tier === 2) {
        neededBasic = 1;
        neededRare = 1;
      } else if (tier === 3) {
        neededBasic = 1;
        neededRare = 1;
        neededEpic = 1;
      }

      async function poolCount(t: number) {
        const poolRaw = await readContract({
          contract: relicContract,
          method: "claimPool",
          params: [dropWeek, t],
        });
        const arr = Array.isArray(poolRaw) ? poolRaw : ((poolRaw as any)?.ids ?? []);
        return arr.length;
      }

      const basicCount = await poolCount(1);
      const rareCount = await poolCount(2);
      const epicCount = await poolCount(3);

      if (basicCount < neededBasic) throw new Error("Not enough Basic relics available to open this box.");
      if (rareCount < neededRare) throw new Error("Not enough Rare relics available to open this box.");
      if (epicCount < neededEpic) throw new Error("Not enough Epic relics available to open this box.");

      // ---- 7. Commit Open ----
      ensureConnected();
      setTxStatus("Committing open...");

      const seedLocal = randomBytes32();
      const commitHashLocal = computeOpenCommitHash({
        chainId: polygon.id,
        contractAddress: ERC721_RELIC_ADDRESS!,
        seed: seedLocal,
        userAddress: accountAddressAtStart,
        boxTokenId: BigInt(boxId),
      });

      // Save to state + localStorage BEFORE sending (so refresh mid-send still restores)
      setSeed(seedLocal);
      setCommitHash(commitHashLocal);

      saveCommitToStorage({
        seed: seedLocal,
        commitHash: commitHashLocal,
        boxId,
        userAddress: accountAddressAtStart,
        contractAddress: ERC721_RELIC_ADDRESS!,
        chainId: polygon.id,
        createdAtMs: Date.now(),
      });

      const commitTx = prepareContractCall({
        contract: relicContract,
        method: "commitOpen",
        params: [BigInt(boxId), commitHashLocal],
      });

      // Final wallet check before sending transaction
      ensureConnected();
      const sentCommit = await sendTransaction({ transaction: commitTx, account });
      await waitForReceipt(sentCommit);

      setTxStatus("✅ Commit confirmed. Press Reveal when ready.");
      setPhase("committed");
    } catch (err: any) {
      // if commit failed, clear storage so you don't get stuck restoring junk
      if (ERC721_RELIC_ADDRESS && boxId !== null) {
        clearCommitFromStorage({
          chainId: polygon.id,
          contractAddress: ERC721_RELIC_ADDRESS,
          userAddress: accountAddressAtStart,
          boxId,
        });
      }

      setSeed(null);
      setCommitHash(null);
      setPhase("idle");

      const msg =
        err?.message || err?.reason || err?.shortMessage || "Error while committing.";
      setTxStatus(`❌ ${msg}`);
      onBoxOpenComplete?.({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  }

  // ---------- REVEAL ----------
  async function handleReveal() {
    if (!relicContract || !packContract || !account) return;
    if (boxId === null) return;

    // Capture account address at start to verify it doesn't change mid-transaction
    const accountAddressAtStart = account.address;

    // Prefer localStorage restore if state lost
    let seedToUse = seed;
    let commitHashToUse = commitHash;

    if ((!seedToUse || !commitHashToUse) && ERC721_RELIC_ADDRESS) {
      const stored = loadCommitFromStorage({
        chainId: polygon.id,
        contractAddress: ERC721_RELIC_ADDRESS,
        userAddress: accountAddressAtStart,
        boxId,
      });
      if (stored) {
        seedToUse = stored.seed;
        commitHashToUse = stored.commitHash;
        setSeed(stored.seed);
        setCommitHash(stored.commitHash);
        setPhase("committed");
      }
    }

    // missing seed phrase
    if (!seedToUse) {
      setTxStatus("❌ Missing secret combination. Please Commit again.");
      setPhase("idle");
      return;
    }

    setLoading(true);
    setPhase("revealing");
    setTxStatus("Revealing...");

    try {
      // Helper to verify wallet is still connected
      const ensureConnected = () => {
        if (!account || account.address !== accountAddressAtStart) {
          throw new Error("⚠️ Wallet was disconnected. Please ensure your wallet stays connected and try again.");
        }
      };

      const revealTx = prepareContractCall({
        contract: relicContract,
        method: "revealOpen",
        params: [BigInt(boxId), seedToUse],
        gas: 20_000_000n,
      });

      // Final wallet check before sending transaction
      ensureConnected();
      const sent = await sendTransaction({ transaction: revealTx, account });
      const receipt = await waitForReceipt(sent);

      setTxStatus("Reveal confirmed. Decoding events...");

      const logs = (receipt as any).logs ?? [];
      const parsed = parseEventLogs({
        logs,
        events: [relicBatchMintedEvent],
      });

      const awardedTokenIds: number[] = [];

      // Process RelicBatchMinted events (only batch events contain all tokens)
      const relevant = parsed.filter((ev) => {
        const to = (ev as any)?.args?.to;
        return to && to.toLowerCase() === accountAddressAtStart.toLowerCase();
      });

      for (const ev of relevant) {
        const tokenIds = (ev as any).args?.tokenIds;
        if (Array.isArray(tokenIds)) {
          tokenIds.forEach((id: any) =>
            awardedTokenIds.push(typeof id === "bigint" ? Number(id) : id),
          );
        }
      }

      // Fetch full relic data for each token from RelicSerialsJoined
      // With retry logic and 5-minute timeout to allow data to be indexed
      setTxStatus("Fetching relic data from database...");
      const relicData = await fetchRelicDataWithRetry(awardedTokenIds, undefined, setTxStatus);

      // Clear localStorage + reset state
      if (ERC721_RELIC_ADDRESS) {
        clearCommitFromStorage({
          chainId: polygon.id,
          contractAddress: ERC721_RELIC_ADDRESS,
          userAddress: accountAddressAtStart,
          boxId,
        });
      }

      setSeed(null);
      setCommitHash(null);
      setPhase("idle");

      setTxStatus("✅ Box opened successfully!");
      onBoxOpenComplete?.({
        success: true,
        message: "Box opened successfully!",
        awardedTokenIds,
        relicData,
      });
    } catch (err: any) {
      const msg =
        err?.message || err?.reason || err?.shortMessage || "Reveal failed";
      setTxStatus(`❌ ${msg}`);
      setPhase("committed"); // let them retry reveal / cancel
    } finally {
      setLoading(false);
    }
  }

  // ---------- CANCEL ----------
  async function handleCancel() {
    if (!relicContract || !account) return;
    if (boxId === null) return;

    // Capture account address at start to verify it doesn't change mid-transaction
    const accountAddressAtStart = account.address;

    setLoading(true);
    setTxStatus("Cancelling commit...");

    try {
      const cancelTx = prepareContractCall({
        contract: relicContract,
        method: "cancelOpenCommit",
        params: [BigInt(boxId)],
      });

      const sent = await sendTransaction({ transaction: cancelTx, account });
      await waitForReceipt(sent);

      // Clear localStorage + reset state
      if (ERC721_RELIC_ADDRESS) {
        clearCommitFromStorage({
          chainId: polygon.id,
          contractAddress: ERC721_RELIC_ADDRESS,
          userAddress: accountAddressAtStart,
          boxId,
        });
      }

      setSeed(null);
      setCommitHash(null);
      setPhase("idle");

      setTxStatus("✅ Commit cancelled.");
    } catch (err: any) {
      const msg =
        err?.message || err?.reason || err?.shortMessage || "Cancel failed";
      setTxStatus(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // ---------- UI ----------
  if (!client) return <div className="text-sm text-slate-800">Client not available.</div>;

  return (
    <div className="space-y-3">
      {!account ? (
        <p>Please connect your wallet.</p>
      ) : approved ? (
        <>
          <p className="text-sm text-slate-600">
            Select "Open Box" to commit. Then press "Reveal" to complete the open.
          </p>

          {phase === "idle" && (
            <button
              disabled={loading}
              onClick={handleCommitOpen}
              className="px-3 py-1.5 bg-[#4169E1] text-white rounded disabled:opacity-50"
            >
              {loading ? "Committing..." : "Open Box"}
            </button>
          )}

          {phase === "committed" && (
            <>
              <div className="flex gap-2">
                <button
                  disabled={loading}
                  onClick={handleReveal}
                  className="px-3 py-1.5 bg-[#4169E1] text-white rounded disabled:opacity-50"
                >
                  {loading ? "Revealing..." : "Reveal"}
                </button>

                <button
                  disabled={loading}
                  onClick={handleCancel}
                  className="px-3 py-1.5 bg-slate-200 text-slate-900 rounded disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              <p className="text-sm mt-2 italic text-slate-600">
                Warning: sound and flashing lights ahead. May not be suitable for those with light or sound sensitivity
              </p>
            </>
          )}

          <p className="text-sm mt-2 whitespace-pre-line">{txStatus}</p>
        </>
      ) : (
        <>
          <p className="text-left">
            Approve once to grant our smart contract permission to redeem your boxes for relics.
          </p>

          <div className="flex justify-between items-center gap-2 mt-4">
            <button
              disabled={loading}
              onClick={handleApprove}
              className="px-3 py-1.5 bg-[#4169E1] text-white rounded disabled:opacity-50"
              style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
            >
              {loading ? "Authorizing..." : "I Approve"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}
            >
              Close
            </button>
          </div>

          <p className="text-sm mt-2">{txStatus}</p>

          {approvalTxHash && (
            <a
              href={`https://polygonscan.com/tx/${approvalTxHash}`}
              target="_blank"
              className="text-sm hover:underline"
              style={{ color: "#004FFF" }}
              rel="noreferrer"
            >
              Approval Tx
            </a>
          )}
        </>
      )}
    </div>
  );
}
