import React, { useState } from "react";
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import type { TrophySlot } from "@/hooks/useTrophyCase";

export interface OwnedRelic {
  editionId: number;
  serial: number;
  tokenId: number;
  name?: string;
  thumb?: string;
}

interface TrophyCaseOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot: TrophySlot | null;
  ownedRelics: OwnedRelic[];
  onSelectRelic: (relic: OwnedRelic) => void;
  isLoading?: boolean;
}

export default function TrophyCaseOverlay({
  open,
  onOpenChange,
  selectedSlot,
  ownedRelics,
  onSelectRelic,
  isLoading = false,
}: TrophyCaseOverlayProps) {
  const [hoveredTokenId, setHoveredTokenId] = useState<number | null>(null);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold dark:text-white">
              Select Relic for {selectedSlot}
            </h2>
            <button
              onClick={() => onOpenChange(false)}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ✕
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-slate-500">
              Loading relics...
            </div>
          ) : ownedRelics.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No owned relics found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {ownedRelics.map((relic) => (
                <div
                  key={relic.tokenId}
                  className="relative cursor-pointer"
                  onMouseEnter={() => setHoveredTokenId(relic.tokenId)}
                  onMouseLeave={() => setHoveredTokenId(null)}
                  onClick={() => {
                    onSelectRelic(relic);
                    onOpenChange(false);
                  }}
                >
                  <div className="relative aspect-video rounded-sm border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {relic.thumb ? (
                      <img
                        src={relic.thumb}
                        alt={relic.name || `Relic ${relic.tokenId}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-sm text-slate-500">
                        No image
                      </div>
                    )}
                    {hoveredTokenId === relic.tokenId && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          Select
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-slate-700 dark:text-slate-300 truncate text-center">
                    {relic.name || `Edition ${relic.editionId}`}
                  </div>
                  <div className="text-xs text-slate-500 text-center">
                    Serial #{relic.serial}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <FilterStyleButton
              onClick={() => onOpenChange(false)}
              className="px-4 py-2"
            >
              Cancel
            </FilterStyleButton>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
