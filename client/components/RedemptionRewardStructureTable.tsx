interface RedemptionRewardStructureTableProps {
  minted?: number | null;
}

export function RedemptionRewardStructureTable({
  minted,
}: RedemptionRewardStructureTableProps) {
  // Generate rows based on minted count
  const mintedValue = minted || 0;
  const rows = (() => {
    if (mintedValue < 5) {
      // Special case: only Rank 1 gets a reward
      return [
        { rank: 1, displayRank: "1", serialStart: 1, serialEnd: mintedValue },
      ];
    }

    // Break into 5 equal bins, 2 ranks per bin (10 ranks total)
    const binSize = Math.ceil(mintedValue / 5);
    const result = [];

    for (let i = 0; i < 5; i++) {
      const rankStart = i * 2 + 1;
      const rankEnd = (i + 1) * 2;
      const serialStart = i * binSize + 1;
      const serialEnd = Math.min((i + 1) * binSize, mintedValue);

      result.push({
        rank: i,
        displayRank: `${rankStart}-${rankEnd}`,
        serialStart,
        serialEnd,
      });
    }

    return result;
  })();

  return (
    <div className="mb-6 max-sm:mb-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-4 py-0 text-left text-slate-700 dark:text-slate-300 font-semibold">
              Rank
            </th>
            <th className="px-4 py-0 text-left text-slate-700 dark:text-slate-300 font-semibold">
              Receives Reward
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map((row) => (
            <tr
              key={row.rank}
              className="hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <td className="px-4 py-0 text-slate-700 dark:text-slate-300 font-medium">
                <p>{row.displayRank}</p>
              </td>
              <td className="px-4 py-0 text-slate-600 dark:text-slate-400">
                Serial between #{row.serialStart}-{row.serialEnd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
