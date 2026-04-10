import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import CollectionCards from "@/components/CollectionCards";
import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";

interface TrophyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxSlots: number;
  ownerWallet: string | null;
  connectedProfile: any;
  onSaveSuccess?: () => void;
  trophyCase?: any;
}

export function TrophyModal({
  open,
  onOpenChange,
  maxSlots,
  ownerWallet,
  connectedProfile,
  onSaveSuccess,
  trophyCase,
}: TrophyModalProps) {
  const { toast } = useToast();
  const [selectedRelicsOrder, setSelectedRelicsOrder] = useState<
    { editionId: number; serial: number; tokenId: number }[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset selections when modal opens
  useEffect(() => {
    if (open) {
      setSelectedRelicsOrder([]);
    }
  }, [open]);

  const handleRelicSelect = (editionId: number, serial: number) => {
    // First, find the tokenId by searching through the collection
    // We need to query for this relic in Supabase to get the tokenId
    handleRelicSelectForTrophy(editionId, serial);
  };

  const handleRelicSelectForTrophy = async (
    editionId: number,
    serial: number,
  ) => {
    try {
      // Fetch the relic data using existing utility function
      const relicData = await fetchRelicSerialByEditionAndSerial(
        editionId,
        serial,
      );

      if (!relicData) {
        toast({
          title: "Error",
          description: "Relic not found",
          variant: "destructive",
        });
        return;
      }

      const tokenId = Number(
        (relicData as any)?.token_id ?? (relicData as any)?.tokenId,
      );
      if (!tokenId) {
        toast({
          title: "Error",
          description: "Could not find token ID for this relic",
          variant: "destructive",
        });
        return;
      }

      const newRelic = { editionId, serial, tokenId };

      // Check if already selected
      const existingIndex = selectedRelicsOrder.findIndex(
        (r) => r.editionId === editionId && r.serial === serial,
      );

      if (existingIndex >= 0) {
        // Deselect
        const updatedOrder = selectedRelicsOrder.filter(
          (_, i) => i !== existingIndex,
        );
        setSelectedRelicsOrder(updatedOrder);
      } else {
        // Select only if not at max
        if (selectedRelicsOrder.length < maxSlots) {
          setSelectedRelicsOrder([...selectedRelicsOrder, newRelic]);
        }
      }
    } catch (error) {
      console.error("Error selecting relic:", error);
      toast({
        title: "Error",
        description: "Failed to select relic",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    console.debug("[TrophyModal] handleSave called with selectedRelicsOrder:", selectedRelicsOrder);
    setIsSaving(true);
    try {
      const baseUrl = (import.meta as any).env.SUPABASE_URL as
        | string
        | undefined;
      const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
        | string
        | undefined;

      if (!baseUrl || !anonKey) {
        toast({
          title: "Error",
          description: "Supabase configuration missing",
          variant: "destructive",
        });
        return;
      }

      if (!connectedProfile?.wallet_address) {
        toast({
          title: "Error",
          description: "Wallet address not found",
          variant: "destructive",
        });
        return;
      }

      const headers = {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "resolution=merge-duplicates",
      } as Record<string, string>;

      let patchData: Record<string, number | null>;

      if (selectedRelicsOrder.length === 0) {
        // Clear all trophy slots
        patchData = {
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
      } else {
        // Set trophies from selection
        patchData = {
          trophy1_tokenId: selectedRelicsOrder[0]?.tokenId ?? null,
          trophy1_editionId: selectedRelicsOrder[0]?.editionId ?? null,
          trophy1_serial: selectedRelicsOrder[0]?.serial ?? null,
          trophy2_tokenId: selectedRelicsOrder[1]?.tokenId ?? null,
          trophy2_editionId: selectedRelicsOrder[1]?.editionId ?? null,
          trophy2_serial: selectedRelicsOrder[1]?.serial ?? null,
          trophy3_tokenId: selectedRelicsOrder[2]?.tokenId ?? null,
          trophy3_editionId: selectedRelicsOrder[2]?.editionId ?? null,
          trophy3_serial: selectedRelicsOrder[2]?.serial ?? null,
          trophy4_tokenId: selectedRelicsOrder[3]?.tokenId ?? null,
          trophy4_editionId: selectedRelicsOrder[3]?.editionId ?? null,
          trophy4_serial: selectedRelicsOrder[3]?.serial ?? null,
          trophy5_tokenId: selectedRelicsOrder[4]?.tokenId ?? null,
          trophy5_editionId: selectedRelicsOrder[4]?.editionId ?? null,
          trophy5_serial: selectedRelicsOrder[4]?.serial ?? null,
        };
      }

      // Normalize wallet address to lowercase for consistent matching
      const normalizedWalletAddress = connectedProfile.wallet_address.toLowerCase();
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/UserTrophyCases?wallet_address=eq.${encodeURIComponent(normalizedWalletAddress)}`;

      console.debug("[TrophyModal] handleSave:", {
        normalizedWalletAddress,
        selectedRelicsOrder,
        patchData,
        url,
      });

      // Use the fallback architecture for the API call
      const result = await withSupabaseFallback(
        `update-trophy-case-${normalizedWalletAddress}`,
        async () => {
          const patchResponse = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify(patchData),
          });

          console.debug("[TrophyModal] PATCH response:", {
            status: patchResponse.status,
            ok: patchResponse.ok,
          });

          let shouldInsert = false;

          if (patchResponse.ok) {
            const responseText = await patchResponse
              .text()
              .catch(() => "");
            const responseData = responseText
              ? JSON.parse(responseText)
              : [];

            if (
              Array.isArray(responseData) &&
              responseData.length > 0
            ) {
              return { success: true, shouldInsert: false };
            } else {
              shouldInsert = true;
            }
          } else {
            shouldInsert = true;
          }

          if (shouldInsert) {
            const insertData = {
              wallet_address: normalizedWalletAddress,
              trophy1_tokenId: selectedRelicsOrder[0]?.tokenId ?? null,
              trophy1_editionId: selectedRelicsOrder[0]?.editionId ?? null,
              trophy1_serial: selectedRelicsOrder[0]?.serial ?? null,
              trophy2_tokenId: selectedRelicsOrder[1]?.tokenId ?? null,
              trophy2_editionId: selectedRelicsOrder[1]?.editionId ?? null,
              trophy2_serial: selectedRelicsOrder[1]?.serial ?? null,
              trophy3_tokenId: selectedRelicsOrder[2]?.tokenId ?? null,
              trophy3_editionId: selectedRelicsOrder[2]?.editionId ?? null,
              trophy3_serial: selectedRelicsOrder[2]?.serial ?? null,
              trophy4_tokenId: selectedRelicsOrder[3]?.tokenId ?? null,
              trophy4_editionId: selectedRelicsOrder[3]?.editionId ?? null,
              trophy4_serial: selectedRelicsOrder[3]?.serial ?? null,
              trophy5_tokenId: selectedRelicsOrder[4]?.tokenId ?? null,
              trophy5_editionId: selectedRelicsOrder[4]?.editionId ?? null,
              trophy5_serial: selectedRelicsOrder[4]?.serial ?? null,
            };

            const insertUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/UserTrophyCases`;
            console.debug("[TrophyModal] INSERT data:", {
              insertData,
              insertUrl,
            });
            const insertResponse = await fetch(insertUrl, {
              method: "POST",
              headers,
              body: JSON.stringify(insertData),
            });

            console.debug("[TrophyModal] INSERT response:", {
              status: insertResponse.status,
              ok: insertResponse.ok,
            });

            if (!insertResponse.ok) {
              throw new Error(`Failed to insert trophy case: ${insertResponse.status}`);
            }

            return { success: true, shouldInsert: true };
          }

          return { success: true, shouldInsert: false };
        },
        { success: true, shouldInsert: false },
        "update-trophy-case",
      );

      if (result.success) {
        toast({
          title: "Success",
          description:
            selectedRelicsOrder.length === 0
              ? "Trophy case cleared"
              : "Trophy case updated",
        });
        onOpenChange(false);
        onSaveSuccess?.();
      } else {
        toast({
          title: "Error",
          description: "Failed to update trophy case",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving trophy case:", error);
      toast({
        title: "Error",
        description: "Failed to save trophy case",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedRelicsOrder([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-6xl max-h-[90vh] p-0 flex flex-col" style={{ transform: "translate(-50%, calc(-50% + 20px))" }}>
        <div className="flex-shrink-0 px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="text-[26px] leading-[26px] text-center font-semibold tracking-tight">
              Choose from {maxSlots} of your relics to display in your trophy
              case
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Collection Cards Section */}
          <CollectionCards
            ownerWallet={ownerWallet}
            isOwnCollection={true}
            isSelectionMode={true}
            isTrophyCaseFull={selectedRelicsOrder.length >= maxSlots}
            selectedRelicsOrder={selectedRelicsOrder}
            onRelicSelectForTrophy={handleRelicSelect}
            hideHeader={true}
            showTrophyBadges={true}
          />
        </div>

        <div className="flex-shrink-0 px-6 pb-6">
          <div className="flex flex-row justify-between gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Set Trophy Case"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
