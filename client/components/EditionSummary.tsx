import { useMemo } from "react";

interface ChartDataPoint {
  fullData?: {
    seriesName?: string;
    tierValue?: string;
  };
  edition_id: number;
}

interface EditionSummaryProps {
  enrichedChartData: ChartDataPoint[];
  selectedTeam: string | null;
}

interface SeriesTierGroup {
  seriesName: string;
  tiers: {
    tierValue: string;
    count: number;
  }[];
}

export function EditionSummary({
  enrichedChartData,
  selectedTeam,
}: EditionSummaryProps) {
  const summaryData = useMemo(() => {
    // Filter data by selected team if one is selected
    let dataToSummarize = enrichedChartData;
    if (selectedTeam) {
      dataToSummarize = enrichedChartData.filter(
        (item) => (item as any).fullData?.team === selectedTeam,
      );
    }

    // Group by series and tier
    const seriesMap = new Map<string, Map<string, Set<number>>>();

    dataToSummarize.forEach((item) => {
      const seriesName = item.fullData?.seriesName || "Unknown";
      const tierValue = item.fullData?.tierValue || "Unknown";
      const editionId = item.edition_id;

      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, new Map());
      }

      const tierMap = seriesMap.get(seriesName)!;
      if (!tierMap.has(tierValue)) {
        tierMap.set(tierValue, new Set());
      }

      tierMap.get(tierValue)!.add(editionId);
    });

    // Convert to summary format
    const summary: SeriesTierGroup[] = Array.from(seriesMap.entries())
      .sort(([seriesA], [seriesB]) => seriesA.localeCompare(seriesB))
      .map(([seriesName, tierMap]) => ({
        seriesName,
        tiers: Array.from(tierMap.entries())
          .sort(([tierA], [tierB]) => tierA.localeCompare(tierB))
          .map(([tierValue, editionSet]) => ({
            tierValue,
            count: editionSet.size,
          })),
      }));

    return summary;
  }, [enrichedChartData, selectedTeam]);

  if (summaryData.length === 0) {
    return null;
  }

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .edition-summary-root {
            padding-top: 6px !important;
            margin-top: 12px !important;
          }
          .edition-tier-flex {
            margin-bottom: 2px !important;
          }
        }
      `}</style>
      <div className="edition-summary-root mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="space-y-0">
        {summaryData.map((seriesGroup) => (
          <div key={seriesGroup.seriesName} className="py-0">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white underline mb-2">
              {seriesGroup.seriesName}
            </h4>
            <div className="flex flex-wrap gap-4 edition-tier-flex">
              {seriesGroup.tiers.map((tier) => (
                <div key={tier.tierValue} className="flex items-center gap-2">
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {tier.tierValue}
                  </span>
                  <div className="w-8 h-8 rounded border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-slate-200">
                    {tier.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      </div>
    </>
  );
}
