export const ALLOWED_CONTRACT_ADDRESSES: string[] = [];

export function useMarketplace() {
  return {
    marketplace: null,
    error: null,
    loading: false,
  };
}
