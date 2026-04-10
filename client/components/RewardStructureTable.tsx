export function RewardStructureTable() {
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
          {[
            { rank: 1, displayRank: "1-10", serial: "1-10" },
            { rank: 2, displayRank: "11-20", serial: "11-20" },
            { rank: 3, displayRank: "21-30", serial: "21-30" },
            { rank: 4, displayRank: "31-40", serial: "31-40" },
            { rank: 5, displayRank: "41-50", serial: "41-50" },
          ].map((row) => (
            <tr key={row.rank} className="hover:bg-slate-50 dark:hover:bg-slate-800">
              <td className="px-4 py-0 text-slate-700 dark:text-slate-300 font-medium">
                <p>{row.displayRank}</p>
              </td>
              <td className="px-4 py-0 text-slate-600 dark:text-slate-400">
                Serial between #{row.serial}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
