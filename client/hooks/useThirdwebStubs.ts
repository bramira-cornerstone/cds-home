// Stub implementations for removed thirdweb hooks
// These allow components to compile without thirdweb while gracefully handling missing wallet functionality

export function useActiveAccount() {
  return null;
}

export function useSendTransaction() {
  return {
    mutate: () => {},
    isPending: false,
    error: null,
  };
}

export function useReadContract() {
  return null;
}

export function useContractRead() {
  return { data: null, isLoading: false, error: null };
}

export function useContractWrite() {
  return { mutate: () => {}, isPending: false };
}
