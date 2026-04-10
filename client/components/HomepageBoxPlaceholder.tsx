import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "@/hooks/useThirdwebStubs";

import {
  fetchPriorDropNFTs,
  PRIOR_DROPS_QUERY_PARAMS,
  getTokenIdString,
  resolveMediaUrl,
  type PriorDropNFT,
} from "@/lib/priorDrops";
import { fetchBoxesBalanceForWallet } from "@/lib/nftReads";
import EditionHoverPreview from "@/components/EditionHoverPreview";

export function useHomepageBoxHasContent() {
  const account = useActiveAccount();
  const [priorDrops, setPriorDrops] = useState<PriorDropNFT[] | null>(null);
  const [ownedBoxTokenIds, setOwnedBoxTokenIds] = useState<number[] | null>(
    null,
  );
  const [ownedBoxBalances, setOwnedBoxBalances] = useState<Record<
    number,
    number
  > | null>(null);

  useEffect(() => {
    let active = true;
    const loadDrops = async () => {
      try {
        const drops = await fetchPriorDropNFTs(PRIOR_DROPS_QUERY_PARAMS);
        if (active) {
          setPriorDrops(drops);
        }
      } catch (err) {
        if (active) {
          setPriorDrops([]);
        }
      }
    };
    loadDrops();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!account?.address) {
      setOwnedBoxTokenIds([]);
      setOwnedBoxBalances({});
      return;
    }

    let active = true;
    const fetchOwnedBoxes = async () => {
      try {
        const balances = await fetchBoxesBalanceForWallet(account.address);
        if (!active) return;

        const tokenIds = Object.keys(balances)
          .map((key) => {
            try {
              return Number(key);
            } catch {
              return NaN;
            }
          })
          .filter((num) => Number.isFinite(num))
          .sort((a, b) => a - b);

        const balancesMap: Record<number, number> = {};
        for (const [tokenId, balance] of Object.entries(balances)) {
          try {
            const num = Number(tokenId);
            if (Number.isFinite(num)) {
              balancesMap[num] = Number(balance);
            }
          } catch {
            // Skip
          }
        }

        setOwnedBoxTokenIds(tokenIds);
        setOwnedBoxBalances(balancesMap);
      } catch (err) {
        if (active) {
          setOwnedBoxTokenIds([]);
          setOwnedBoxBalances({});
        }
      }
    };

    fetchOwnedBoxes();
    return () => {
      active = false;
    };
  }, [account?.address]);

  const mostRecentBoxData = useMemo(() => {
    if (
      !priorDrops ||
      !Array.isArray(ownedBoxTokenIds) ||
      ownedBoxTokenIds.length === 0
    ) {
      return null;
    }

    const ownedSet = new Set<number>(ownedBoxTokenIds);

    let mostRecent: PriorDropNFT | null = null;
    let maxTokenId = -1;

    for (const drop of priorDrops) {
      const tokenIdStr = getTokenIdString(drop.id);
      if (!tokenIdStr) continue;

      let tokenIdNum: number;
      try {
        tokenIdNum = /^0x/i.test(tokenIdStr)
          ? Number(BigInt(tokenIdStr))
          : Number(tokenIdStr);
      } catch {
        continue;
      }

      if (Number.isFinite(tokenIdNum) && ownedSet.has(tokenIdNum)) {
        if (tokenIdNum > maxTokenId) {
          maxTokenId = tokenIdNum;
          mostRecent = drop;
        }
      }
    }

    return { drop: mostRecent, tokenId: maxTokenId };
  }, [priorDrops, ownedBoxTokenIds]);

  const imageUrl = mostRecentBoxData?.drop
    ? resolveMediaUrl(mostRecentBoxData.drop.metadata?.image ?? null)
    : null;
  const mostRecentTokenId = mostRecentBoxData?.tokenId ?? null;
  const balance =
    mostRecentTokenId !== null && ownedBoxBalances
      ? ownedBoxBalances[mostRecentTokenId]
      : null;

  return !!(account?.address &&
    ownedBoxTokenIds !== null &&
    ownedBoxBalances !== null &&
    priorDrops !== null &&
    imageUrl &&
    balance &&
    balance > 0);
}

export default function HomepageBoxPlaceholder() {
  const account = useActiveAccount();
  const [priorDrops, setPriorDrops] = useState<PriorDropNFT[] | null>(null);
  const [ownedBoxTokenIds, setOwnedBoxTokenIds] = useState<number[] | null>(
    null,
  );
  const [ownedBoxBalances, setOwnedBoxBalances] = useState<Record<
    number,
    number
  > | null>(null);

  // Fetch all prior drops
  useEffect(() => {
    let active = true;
    const loadDrops = async () => {
      try {
        const drops = await fetchPriorDropNFTs(PRIOR_DROPS_QUERY_PARAMS);
        if (active) {
          setPriorDrops(drops);
        }
      } catch (err) {
        if (active) {
          setPriorDrops([]);
        }
      }
    };
    loadDrops();
    return () => {
      active = false;
    };
  }, []);

  // Fetch owned box token IDs for connected wallet
  useEffect(() => {
    if (!account?.address) {
      setOwnedBoxTokenIds([]);
      setOwnedBoxBalances({});
      return;
    }

    let active = true;
    const fetchOwnedBoxes = async () => {
      try {
        const balances = await fetchBoxesBalanceForWallet(account.address);
        if (!active) return;

        const tokenIds = Object.keys(balances)
          .map((key) => {
            try {
              return Number(key);
            } catch {
              return NaN;
            }
          })
          .filter((num) => Number.isFinite(num))
          .sort((a, b) => a - b);

        const balancesMap: Record<number, number> = {};
        for (const [tokenId, balance] of Object.entries(balances)) {
          try {
            const num = Number(tokenId);
            if (Number.isFinite(num)) {
              balancesMap[num] = Number(balance);
            }
          } catch {
            // Skip
          }
        }

        setOwnedBoxTokenIds(tokenIds);
        setOwnedBoxBalances(balancesMap);
      } catch (err) {
        if (active) {
          setOwnedBoxTokenIds([]);
          setOwnedBoxBalances({});
        }
      }
    };

    fetchOwnedBoxes();
    return () => {
      active = false;
    };
  }, [account?.address]);

  // Find the most recent box owned by the user
  const mostRecentBoxData = useMemo(() => {
    if (
      !priorDrops ||
      !Array.isArray(ownedBoxTokenIds) ||
      ownedBoxTokenIds.length === 0
    ) {
      return null;
    }

    const ownedSet = new Set<number>(ownedBoxTokenIds);

    // Find the most recent (highest token ID) owned box
    let mostRecent: PriorDropNFT | null = null;
    let maxTokenId = -1;

    for (const drop of priorDrops) {
      const tokenIdStr = getTokenIdString(drop.id);
      if (!tokenIdStr) continue;

      let tokenIdNum: number;
      try {
        tokenIdNum = /^0x/i.test(tokenIdStr)
          ? Number(BigInt(tokenIdStr))
          : Number(tokenIdStr);
      } catch {
        continue;
      }

      if (Number.isFinite(tokenIdNum) && ownedSet.has(tokenIdNum)) {
        if (tokenIdNum > maxTokenId) {
          maxTokenId = tokenIdNum;
          mostRecent = drop;
        }
      }
    }

    return { drop: mostRecent, tokenId: maxTokenId };
  }, [priorDrops, ownedBoxTokenIds]);

  const imageUrl = mostRecentBoxData?.drop
    ? resolveMediaUrl(mostRecentBoxData.drop.metadata?.image ?? null)
    : null;
  const mostRecentTokenId = mostRecentBoxData?.tokenId ?? null;
  const balance =
    mostRecentTokenId !== null && ownedBoxBalances
      ? ownedBoxBalances[mostRecentTokenId]
      : null;

  // No wallet connected, loading, or no boxes owned - return null (don't render)
  if (!account?.address) {
    return null;
  }

  if (
    ownedBoxTokenIds === null ||
    ownedBoxBalances === null ||
    priorDrops === null
  ) {
    return null;
  }

  if (!imageUrl || !balance || balance <= 0) {
    return null;
  }

  // Display most recent box
  return (
    <div className="h-full w-full border border-slate-300 bg-white overflow-hidden relative">
      <div className="h-full w-full bg-slate-100 flex items-center justify-center">
        <EditionHoverPreview thumb={imageUrl} streamId={null} />
      </div>
      {balance !== null && balance > 0 ? (
        <div className="absolute top-2 left-2 bg-[#4169E1] text-white text-xs font-bold px-1.5 py-0.5 rounded">
          x{balance}
        </div>
      ) : null}
    </div>
  );
}
