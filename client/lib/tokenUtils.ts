export async function getTokenDecimals(): Promise<number> {
  return 18;
}

export function convertToTokenWei(amount: string | number): bigint {
  return BigInt(0);
}

export async function checkERC20Allowance(): Promise<bigint> {
  return BigInt(0);
}

export async function approveERC20(): Promise<void> {
  return;
}

export async function getTokenAllowance(): Promise<bigint> {
  return BigInt(0);
}

export async function approveToken(): Promise<void> {
  return;
}
