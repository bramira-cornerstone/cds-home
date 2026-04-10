import { priorDropsContract } from "@/lib/priorDrops";
import { canClaim, claimTo } from "thirdweb/extensions/erc1155";

export type ClaimValidationResult =
  | { success: true; message: string }
  | { success: false; message: string };

export type PurchaseResult =
  | { success: true; transactionHash: string | null }
  | { success: false; message: string };

/**
 * Validates if a wallet can claim a box
 */
export async function validateClaimEligibility(
  contract: typeof priorDropsContract | null,
  claimerAddress: string | undefined,
  tokenId: bigint | null,
  quantity: bigint,
  limitPerWallet: bigint | null,
): Promise<ClaimValidationResult> {
  if (!contract) {
    return { success: false, message: "Contract not available." };
  }

  if (!claimerAddress) {
    return { success: false, message: "Connect your wallet to claim." };
  }

  if (tokenId === null) {
    return { success: false, message: "Token is unavailable." };
  }

  if (quantity <= 0n) {
    return { success: false, message: "Invalid claim quantity." };
  }

  try {
    const result = await canClaim({
      contract,
      claimer: claimerAddress,
      quantity,
      tokenId,
    });

    if (result.result) {
      const successMessage =
        limitPerWallet !== null && limitPerWallet > 0n
          ? `Eligible to claim up to ${limitPerWallet.toString()} per wallet.`
          : "Eligible to claim.";
      return { success: true, message: successMessage };
    } else {
      const failureMessage =
        result.reason ??
        (limitPerWallet !== null && limitPerWallet > 0n
          ? `Claim conditions not satisfied. Limit per wallet is ${limitPerWallet.toString()}.`
          : "Claim conditions not satisfied.");
      return { success: false, message: failureMessage };
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unable to verify claim eligibility.";
    return { success: false, message };
  }
}

/**
 * Executes a claim transaction
 */
export async function executePurchase(
  contract: typeof priorDropsContract | null,
  claimerAddress: string | undefined,
  tokenId: bigint | null,
  quantity: bigint,
  sendTransaction: (tx: any) => Promise<{ transactionHash?: string }>,
): Promise<PurchaseResult> {
  if (!claimerAddress) {
    return { success: false, message: "Connect your wallet to purchase." };
  }

  if (tokenId === null) {
    return { success: false, message: "Token is unavailable for purchase." };
  }

  if (quantity <= 0n) {
    return { success: false, message: "Invalid claim quantity." };
  }

  try {
    const transaction = claimTo({
      contract: contract!,
      to: claimerAddress,
      tokenId,
      quantity,
      from: claimerAddress,
    });

    const receipt = await sendTransaction(transaction);
    const hash = receipt?.transactionHash ?? null;

    return { success: true, transactionHash: hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed.";
    return { success: false, message };
  }
}

/**
 * Queue management using sessionStorage
 */
export interface QueueEntry {
  walletAddress: string;
  tokenId: string;
  verifiedAt: number; // timestamp when claim was verified
  verifiedUntil: number; // timestamp when buffer expires
  claimConditionStartTime?: number; // timestamp of the claim condition start time
  isLateEntry?: boolean; // true if user joined after the 15-minute buffer window
}

export interface QueueState {
  entries: QueueEntry[];
  lastRandomized: number;
  randomizedOrder: string[]; // wallet addresses in randomized order
}

const QUEUE_STORAGE_KEY = "dropQueue";
const BUFFER_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds for queue buffer period
const TURN_TIMEOUT_DURATION = 3 * 60 * 1000; // 3 minutes in milliseconds for each user's turn
const MOUNT_TRACKING_KEY = "dropQueueMounts"; // Track component mounts for re-entry detection
const TURN_TIMEOUT_KEY = "dropQueueTurnTimeout"; // Track when a user's turn expires
const RANDOMIZATION_MARKER_KEY = "dropQueueRandomizationMarker"; // Mark when randomization is happening

export function getQueueState(tokenId: string): QueueState {
  try {
    const stored = sessionStorage.getItem(`${QUEUE_STORAGE_KEY}:${tokenId}`);
    return stored
      ? JSON.parse(stored)
      : { entries: [], lastRandomized: 0, randomizedOrder: [] };
  } catch {
    return { entries: [], lastRandomized: 0, randomizedOrder: [] };
  }
}

export function saveQueueState(tokenId: string, state: QueueState): void {
  try {
    sessionStorage.setItem(
      `${QUEUE_STORAGE_KEY}:${tokenId}`,
      JSON.stringify(state),
    );
  } catch {
    // Ignore storage errors
  }
}

export function addToQueue(
  tokenId: string,
  walletAddress: string,
  claimConditionStartTime?: number,
): QueueEntry {
  const state = getQueueState(tokenId);
  const now = Date.now();

  console.log("addToQueue: Adding user to queue", { tokenId, walletAddress, claimConditionStartTime, now });

  // Remove if already exists
  state.entries = state.entries.filter(
    (e) => e.walletAddress !== walletAddress,
  );

  // Calculate verifiedUntil: either based on claim condition start time or current time
  const verifiedUntil = claimConditionStartTime
    ? claimConditionStartTime + BUFFER_DURATION
    : now + BUFFER_DURATION;

  // Check if user is entering late (after the 15-minute buffer window from start time)
  const isLateEntry = claimConditionStartTime
    ? now > claimConditionStartTime + BUFFER_DURATION
    : false;

  const entry: QueueEntry = {
    walletAddress,
    tokenId,
    verifiedAt: now,
    verifiedUntil,
    claimConditionStartTime,
    isLateEntry,
  };

  console.log("addToQueue: Created queue entry", { verifiedUntil, isLateEntry });

  state.entries.push(entry);
  saveQueueState(tokenId, state);

  return entry;
}

export function getQueuePosition(
  tokenId: string,
  walletAddress: string,
): number | null {
  const state = getQueueState(tokenId);
  const now = Date.now();

  console.log("getQueuePosition: Getting position", { tokenId, walletAddress, now, entriesCount: state.entries.length, randomizedCount: state.randomizedOrder.length });

  // Check if buffer has expired for any entries
  let shouldRandomize = false;
  let bufferExpiredCount = 0;

  for (const entry of state.entries) {
    console.log("getQueuePosition: Checking entry", { walletAddress: entry.walletAddress, verifiedUntil: entry.verifiedUntil, now, bufferExpired: now >= entry.verifiedUntil });
    if (now >= entry.verifiedUntil) {
      bufferExpiredCount++;
      if (!state.randomizedOrder.includes(entry.walletAddress)) {
        shouldRandomize = true;
      }
    }
  }

  console.log("getQueuePosition: shouldRandomize:", shouldRandomize, "lastRandomized:", state.lastRandomized, "bufferExpiredCount:", bufferExpiredCount, "entriesLength:", state.entries.length);

  // Randomize if needed and all entries have passed buffer
  // Also randomize if lastRandomized is set but randomizedOrder is empty (state corruption)
  if (shouldRandomize && (state.lastRandomized === 0 || state.randomizedOrder.length === 0)) {
    // Separate early and late entries
    const earlyEntries = state.entries.filter((e) => !e.isLateEntry);
    const lateEntries = state.entries.filter((e) => e.isLateEntry);

    // Randomize early entries and then append late entries at the end
    const earlyAddresses = earlyEntries.map((e) => e.walletAddress);
    const lateAddresses = lateEntries.map((e) => e.walletAddress);

    // Special case: if only 1 person in queue, they go straight to position 0
    if (earlyAddresses.length === 1 && lateAddresses.length === 0) {
      state.randomizedOrder = earlyAddresses;
      console.log("getQueuePosition: Only 1 person in queue, fast-tracking to position 0");
    } else {
      state.randomizedOrder = [
        ...shuffleArray(earlyAddresses),
        ...lateAddresses,
      ];
      console.log("getQueuePosition: Randomized order", state.randomizedOrder);
    }

    state.lastRandomized = now;
    saveQueueState(tokenId, state);
  }

  // If randomized, return position in randomized order
  if (state.randomizedOrder.length > 0) {
    const index = state.randomizedOrder.indexOf(walletAddress);
    console.log("getQueuePosition: Found in randomized order at index:", index);
    if (index >= 0) return index;

    // Fallback: if user is in entries but not in randomizedOrder, add them to the end
    const userInEntries = state.entries.some((e) => e.walletAddress === walletAddress);
    if (userInEntries) {
      state.randomizedOrder.push(walletAddress);
      saveQueueState(tokenId, state);
      console.log("getQueuePosition: Added user to end of randomized order at position", state.randomizedOrder.length - 1);
      return state.randomizedOrder.length - 1;
    }

    console.log("getQueuePosition: User not found in entries or randomized order, returning null");
    return null;
  }

  // During buffer period, position is not assigned yet
  console.log("getQueuePosition: During buffer period, no position assigned yet");
  return null;
}

export function getBufferEndTime(
  tokenId: string,
  walletAddress: string,
): number | null {
  const state = getQueueState(tokenId);
  const entry = state.entries.find((e) => e.walletAddress === walletAddress);
  return entry ? entry.verifiedUntil : null;
}

export function isBufferExpired(
  tokenId: string,
  walletAddress: string,
): boolean {
  const endTime = getBufferEndTime(tokenId, walletAddress);
  if (!endTime) return false;
  return Date.now() >= endTime;
}

export function removeFromQueue(tokenId: string, walletAddress: string): void {
  const state = getQueueState(tokenId);
  state.entries = state.entries.filter(
    (e) => e.walletAddress !== walletAddress,
  );
  state.randomizedOrder = state.randomizedOrder.filter(
    (a) => a !== walletAddress,
  );
  saveQueueState(tokenId, state);
  clearTurnTimeout(tokenId, walletAddress);
}

/**
 * Set turn timeout for when someone is first in queue
 * They have 3 minutes to complete their purchase before being moved to end
 */
export function setTurnTimeout(tokenId: string, walletAddress: string): number {
  const turnStartTime = Date.now();
  const timeoutKey = `${TURN_TIMEOUT_KEY}:${tokenId}:${walletAddress}`;
  sessionStorage.setItem(timeoutKey, turnStartTime.toString());
  return turnStartTime;
}

/**
 * Get when the current turn started
 */
export function getTurnStartTime(
  tokenId: string,
  walletAddress: string,
): number | null {
  const timeoutKey = `${TURN_TIMEOUT_KEY}:${tokenId}:${walletAddress}`;
  const stored = sessionStorage.getItem(timeoutKey);
  return stored ? parseInt(stored, 10) : null;
}

/**
 * Get remaining time for current turn (3 minutes = 180000ms)
 */
export function getTurnTimeRemaining(
  tokenId: string,
  walletAddress: string,
): number {
  const startTime = getTurnStartTime(tokenId, walletAddress);
  if (!startTime) return 0;
  const elapsed = Date.now() - startTime;
  const remaining = TURN_TIMEOUT_DURATION - elapsed;
  return Math.max(0, remaining);
}

/**
 * Check if turn time has expired
 */
export function isTurnExpired(tokenId: string, walletAddress: string): boolean {
  return getTurnTimeRemaining(tokenId, walletAddress) <= 0;
}

/**
 * Clear turn timeout when user is removed from queue
 */
export function clearTurnTimeout(tokenId: string, walletAddress: string): void {
  const timeoutKey = `${TURN_TIMEOUT_KEY}:${tokenId}:${walletAddress}`;
  sessionStorage.removeItem(timeoutKey);
}

/**
 * Move user to end of queue (for when their turn expires)
 * @deprecated Use removeFromQueue instead - users should be kicked off queue on timeout
 */
export function moveToEndOfQueue(tokenId: string, walletAddress: string): void {
  const state = getQueueState(tokenId);

  console.log("moveToEndOfQueue: Before move", { randomizedOrder: state.randomizedOrder });

  // Remove from current position
  state.randomizedOrder = state.randomizedOrder.filter(
    (a) => a !== walletAddress,
  );

  // Add to end
  state.randomizedOrder.push(walletAddress);

  console.log("moveToEndOfQueue: After move", { randomizedOrder: state.randomizedOrder });

  // Clear the turn timeout for this user
  clearTurnTimeout(tokenId, walletAddress);

  saveQueueState(tokenId, state);
}

/**
 * Process expired turns in the queue
 * This checks if the person currently at position 0 has a turn timeout and has expired
 * If so, remove them from the queue entirely
 */
export function processExpiredTurns(tokenId: string): boolean {
  const state = getQueueState(tokenId);

  if (state.randomizedOrder.length === 0) {
    return false;
  }

  // Get the wallet address currently at position 0
  const personAtFront = state.randomizedOrder[0];
  if (!personAtFront) {
    return false;
  }

  // Check if this person has a turn timeout
  const turnStartTime = getTurnStartTime(tokenId, personAtFront);
  if (!turnStartTime) {
    // No turn timeout set yet, they haven't reached the front yet
    return false;
  }

  // Check if their turn has expired
  const remaining = getTurnTimeRemaining(tokenId, personAtFront);
  if (remaining > 0) {
    // Turn hasn't expired yet
    return false;
  }

  // Turn has expired! Remove them from the queue entirely
  console.log("processExpiredTurns: Person at front has expired, removing from queue", { personAtFront });
  removeFromQueue(tokenId, personAtFront);
  return true;
}

/**
 * Handles re-entry detection and buffer reset
 * Returns true if this is a re-entry (buffer should be reset), false if it's a refresh (keep buffer)
 */
export function detectReentryAndResetBuffer(
  tokenId: string,
  walletAddress: string,
): boolean {
  const mountKey = `${MOUNT_TRACKING_KEY}:${tokenId}:${walletAddress}`;
  const lastMountTime = sessionStorage.getItem(mountKey);
  const now = Date.now();

  // Record current mount time
  sessionStorage.setItem(mountKey, now.toString());

  // If no previous mount time, this is first entry in this session
  if (!lastMountTime) {
    return false;
  }

  const timeSinceLastMount = now - parseInt(lastMountTime, 10);
  // If more than 5 seconds have passed, it's likely a re-entry (not a refresh)
  const REENTRY_THRESHOLD = 5 * 1000; // 5 seconds

  if (timeSinceLastMount > REENTRY_THRESHOLD) {
    // This is a re-entry, reset the buffer
    const state = getQueueState(tokenId);
    const entry = state.entries.find((e) => e.walletAddress === walletAddress);

    if (entry) {
      // Reset the verified time and buffer end time
      entry.verifiedAt = now;
      // Preserve the original claim condition start time if it exists
      entry.verifiedUntil = entry.claimConditionStartTime
        ? entry.claimConditionStartTime + BUFFER_DURATION
        : now + BUFFER_DURATION;
      saveQueueState(tokenId, state);
      return true;
    }
  }

  return false;
}

/**
 * Check if the queue is currently randomizing (buffer expired, randomization in progress)
 */
export function isQueueRandomizing(tokenId: string): boolean {
  const state = getQueueState(tokenId);
  const now = Date.now();

  // Check if any entries have expired buffer and we haven't randomized yet
  for (const entry of state.entries) {
    if (now >= entry.verifiedUntil && state.randomizedOrder.length === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Mark a user as having timed out and remove them from queue
 * This removes their queue position and entry from cache
 */
export function handleTurnTimeout(tokenId: string, walletAddress: string): void {
  console.log("handleTurnTimeout: User timed out, removing from queue", { tokenId, walletAddress });
  removeFromQueue(tokenId, walletAddress);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
