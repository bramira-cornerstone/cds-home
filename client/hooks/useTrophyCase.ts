import { useEffect, useState } from "react";
import {
  getEligibleDisplays,
  getHighestEligibleDisplay,
  isDisplayEligible,
  getDisplaySlotNumber,
  getFieldsToClear,
} from "@/lib/trophyEligibility";

export type TrophySlot =
  | "trophy1"
  | "trophy2"
  | "trophy3"
  | "trophy4"
  | "trophy5";

export interface UserTrophyCase {
  wallet_address: string;
  trophy_style?: string | null;
  trophy1_tokenId: number | null;
  trophy1_editionId?: number | null;
  trophy1_serial?: number | null;
  trophy2_tokenId: number | null;
  trophy2_editionId?: number | null;
  trophy2_serial?: number | null;
  trophy3_tokenId: number | null;
  trophy3_editionId?: number | null;
  trophy3_serial?: number | null;
  trophy4_tokenId: number | null;
  trophy4_editionId?: number | null;
  trophy4_serial?: number | null;
  trophy5_tokenId: number | null;
  trophy5_editionId?: number | null;
  trophy5_serial?: number | null;
}

export function useTrophyCase(
  walletAddress: string | null | undefined,
  refetchTrigger?: number,
) {
  const [trophyCase, setTrophyCase] = useState<UserTrophyCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setTrophyCase(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchTrophyCase = async () => {
      try {
        const baseUrl = import.meta.env.SUPABASE_URL;
        const anonKey = import.meta.env.SUPABASE_ANON_KEY;

        if (!baseUrl || !anonKey) {
          if (isMounted) setError("Supabase configuration missing");
          return;
        }

        // Normalize wallet address to lowercase for consistent matching
        const normalizedWalletAddress = walletAddress.toLowerCase();
        const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/UserTrophyCases?wallet_address=eq.${encodeURIComponent(normalizedWalletAddress)}`;
        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });

        if (!isMounted) return;

        if (!res.ok) {
          if (res.status === 404) {
            setTrophyCase({
              wallet_address: normalizedWalletAddress,
              trophy_style: "Display 1",
              trophy1_tokenId: null,
              trophy1_editionId: null,
              trophy1_serial: null,
              trophy2_tokenId: null,
              trophy2_editionId: null,
              trophy2_serial: null,
              trophy3_tokenId: null,
              trophy3_editionId: null,
              trophy3_serial: null,
              trophy4_tokenId: null,
              trophy4_editionId: null,
              trophy4_serial: null,
              trophy5_tokenId: null,
              trophy5_editionId: null,
              trophy5_serial: null,
            });
          } else {
            setError("Failed to fetch trophy case");
          }
          return;
        }

        const rows = (await res.json()) as UserTrophyCase[];
        if (!isMounted) return;

        const row =
          rows.length > 0
            ? rows[0]
            : {
                wallet_address: normalizedWalletAddress,
                trophy_style: "Display 1",
                trophy1_tokenId: null,
                trophy1_editionId: null,
                trophy1_serial: null,
                trophy2_tokenId: null,
                trophy2_editionId: null,
                trophy2_serial: null,
                trophy3_tokenId: null,
                trophy3_editionId: null,
                trophy3_serial: null,
                trophy4_tokenId: null,
                trophy4_editionId: null,
                trophy4_serial: null,
                trophy5_tokenId: null,
                trophy5_editionId: null,
                trophy5_serial: null,
              };
        setTrophyCase(row);
      } catch (err) {
        if (isMounted) {
          setError("Error fetching trophy case");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTrophyCase();
    return () => {
      isMounted = false;
    };
  }, [walletAddress, refetchTrigger]);

  const convertDisplayToEnum = (display: string): string => {
    // Convert trophy_display1 -> Display 1, etc.
    const match = display.match(/trophy_display(\d+)/);
    if (match) {
      const num = match[1];
      return `Display ${num}`;
    }
    return display;
  };

  const updateTrophyStyle = async (style: string) => {
    if (!walletAddress) return false;

    try {
      const baseUrl = import.meta.env.SUPABASE_URL;
      const anonKey = import.meta.env.SUPABASE_ANON_KEY;

      if (!baseUrl || !anonKey) {
        setError("Supabase configuration missing");
        return false;
      }

      const enumValue = convertDisplayToEnum(style);
      // Normalize wallet address to lowercase for consistent matching
      const normalizedWalletAddress = walletAddress.toLowerCase();
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/UserTrophyCases?wallet_address=eq.${encodeURIComponent(normalizedWalletAddress)}`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          trophy_style: enumValue,
        }),
      });

      let shouldInsert = false;

      if (response.ok) {
        const responseText = await response.text().catch(() => "");
        try {
          const updated = responseText
            ? (JSON.parse(responseText) as UserTrophyCase[])
            : [];
          if (Array.isArray(updated) && updated.length > 0) {
            setTrophyCase(updated[0]);
            return true;
          } else {
            shouldInsert = true;
          }
        } catch {
          shouldInsert = true;
        }
      } else if (response.status === 409 || response.status === 404) {
        shouldInsert = true;
      } else {
        setError("Failed to update trophy style");
        return false;
      }

      if (shouldInsert) {
        const insertUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/UserTrophyCases?on_conflict=wallet_address`;
        const insertResponse = await fetch(insertUrl, {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            wallet_address: normalizedWalletAddress,
            trophy_style: enumValue,
          }),
        });

        if (!insertResponse.ok) {
          setError("Failed to update trophy style");
          return false;
        }

        const insertedText = await insertResponse.text().catch(() => "");
        try {
          const inserted = insertedText
            ? (JSON.parse(insertedText) as UserTrophyCase[])
            : [];
          if (Array.isArray(inserted) && inserted.length > 0) {
            setTrophyCase(inserted[0]);
          }
        } catch {
          // Response might be 204 No Content, which is fine
        }
        return true;
      }
    } catch (err) {
      console.error("Error updating trophy style:", err);
      setError("Error updating trophy style");
      return false;
    }
  };

  const updateTrophySlot = async (slot: TrophySlot, tokenId: number | null) => {
    if (!walletAddress) return false;

    try {
      const baseUrl = import.meta.env.SUPABASE_URL;
      const anonKey = import.meta.env.SUPABASE_ANON_KEY;

      if (!baseUrl || !anonKey) {
        setError("Supabase configuration missing");
        return false;
      }

      // Normalize wallet address to lowercase for consistent matching
      const normalizedWalletAddress = walletAddress.toLowerCase();
      const columnName = `${slot}_tokenId`;
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/UserTrophyCases?wallet_address=eq.${encodeURIComponent(normalizedWalletAddress)}`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          [columnName]: tokenId,
        }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 409) {
          const insertUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/UserTrophyCases?on_conflict=wallet_address`;
          const insertResponse = await fetch(insertUrl, {
            method: "POST",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify({
              wallet_address: normalizedWalletAddress,
              [columnName]: tokenId,
            }),
          });

          if (!insertResponse.ok) {
            setError("Failed to update trophy case");
            return false;
          }

          const inserted = (await insertResponse.json()) as UserTrophyCase[];
          setTrophyCase(inserted[0]);
          return true;
        }
        setError("Failed to update trophy case");
        return false;
      }

      const updated = (await response.json()) as UserTrophyCase[];
      setTrophyCase(updated[0]);
      return true;
    } catch (err) {
      console.error("Error updating trophy case:", err);
      setError("Error updating trophy case");
      return false;
    }
  };

  const ensureEligibleTrophyStyle = async (
    rankLevel: string | null,
  ): Promise<boolean> => {
    if (!walletAddress || !trophyCase) return true;

    try {
      const baseUrl = import.meta.env.SUPABASE_URL;
      const anonKey = import.meta.env.SUPABASE_ANON_KEY;

      if (!baseUrl || !anonKey) return false;

      // Check current trophy_style (if any)
      const currentStyle = (trophyCase as any)?.trophy_style;

      // If no style set, no need to downgrade
      if (!currentStyle) return true;

      // Check if current style is still eligible
      const currentSlotNumber = parseInt(
        currentStyle.match(/\d+/)?.[0] || "1",
        10,
      );
      const currentDisplay = `trophy_display${currentSlotNumber}`;

      // If still eligible, no action needed
      if (isDisplayEligible(rankLevel, currentDisplay)) {
        return true;
      }

      // Need to downgrade to highest eligible display
      const newDisplay = getHighestEligibleDisplay(rankLevel);
      const newSlotNumber = getDisplaySlotNumber(newDisplay);

      // Build update object - set new style and clear ineligible fields
      const updateData: any = {
        trophy_style: convertDisplayToEnum(newDisplay),
      };

      // Clear all fields for slots higher than the new eligible slot
      for (let slot = newSlotNumber + 1; slot <= 5; slot++) {
        updateData[`trophy${slot}_tokenId`] = null;
        updateData[`trophy${slot}_editionId`] = null;
        updateData[`trophy${slot}_serial`] = null;
      }

      // Normalize wallet address to lowercase for consistent matching
      const normalizedWalletAddress = walletAddress.toLowerCase();
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/UserTrophyCases?wallet_address=eq.${encodeURIComponent(normalizedWalletAddress)}`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        console.error("Failed to downgrade trophy style");
        return false;
      }

      const updated = (await response.json()) as UserTrophyCase[];
      if (updated.length > 0) {
        setTrophyCase(updated[0]);
      }
      return true;
    } catch (err) {
      console.error("Error ensuring eligible trophy style:", err);
      return false;
    }
  };

  return {
    trophyCase,
    loading,
    error,
    updateTrophySlot,
    updateTrophyStyle,
    ensureEligibleTrophyStyle,
  };
}
