/**
 * Redeem Configuration
 * Maps redeem IDs (redeem01, redeem02, etc.) to their index positions
 * Used to link homepage carousel items with /redeem page rows
 */

export const REDEEM_ITEMS_COUNT = 10;

export const generateRedeemId = (index: number): string => {
  return `redeem${String(index + 1).padStart(2, "0")}`;
};

export const getIndexFromRedeemId = (redeemId: string): number => {
  const match = redeemId.match(/redeem(\d+)/);
  return match ? parseInt(match[1], 10) - 1 : -1;
};

/**
 * Maps each carousel item to its corresponding page row
 * Example: redeem01 refers to the first carousel item and first row on /redeem page
 */
export const redeemItemsMap = Array.from({ length: REDEEM_ITEMS_COUNT }).map(
  (_, index) => ({
    id: generateRedeemId(index),
    index,
    pageRoute: `/redeem/Redeem${String(index + 1).padStart(2, "0")}`,
  })
);

export type RedeemItem = (typeof redeemItemsMap)[number];
