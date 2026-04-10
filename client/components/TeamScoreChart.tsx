interface ChartDataPoint {
  weekStart: string;
  weekNumber: number;
  sundayDate: string;
  minted: number;
  rank: number;
  edition_id: number;
  gameDate: string;
  playerName: string;
  fullData?: {
    thumb?: string;
    setName?: string;
    badge?: string;
    badge2?: string;
    badge3?: string;
    createDate?: string;
    tier?: string;
    team?: string;
    seriesName?: string;
    tierValue?: string;
  };
}

interface TeamScoreData {
  team: string;
  score: number;
  count: number;
}

interface TeamScoreChartProps {
  enrichedChartData: ChartDataPoint[];
  selectedTeam: string | null;
}

export function TeamScoreChart({
  enrichedChartData,
  selectedTeam,
}: TeamScoreChartProps) {
  // Calculate weighted scores for each team
  const teamScores: Map<string, { score: number; count: number }> = new Map();

  enrichedChartData.forEach((item) => {
    const team = item.fullData?.team || "Unknown";
    const tierValue = item.fullData?.tierValue || "Gold";

    // Map tier to points: Diamond=4, Platinum=2, Gold=1
    let points = 1;
    if (tierValue === "Diamond") {
      points = 4;
    } else if (tierValue === "Platinum") {
      points = 2;
    }

    if (!teamScores.has(team)) {
      teamScores.set(team, { score: 0, count: 0 });
    }

    const current = teamScores.get(team)!;
    current.score += points;
    current.count += 1;
  });

  // Convert to array and sort by score (highest first)
  const sortedTeams: TeamScoreData[] = Array.from(teamScores.entries())
    .map(([team, data]) => ({
      team,
      score: data.score,
      count: data.count,
    }))
    .sort((a, b) => b.score - a.score);

  if (sortedTeams.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-600 dark:text-slate-400">
        No data available
      </div>
    );
  }

  // Calculate max score for normalization
  const maxScore = Math.max(...sortedTeams.map((t) => t.score));

  // Calculate bar height to fit all teams within a reasonable container
  const containerHeight = 350; // pixels - adjusted to fit within 400px max-height with padding
  const barHeight = Math.max(16, Math.min(28, containerHeight / sortedTeams.length));

  return (
    <div className="w-full flex flex-col gap-0" style={{ maxHeight: `${containerHeight}px`, overflowY: "auto", flex: 1 }}>
      {sortedTeams.map((teamData) => {
        const normalizedScore = teamData.score / maxScore;
        // Grey gradient: light grey (180,180,180) for lowest to dark grey (64,64,64) for highest
        const greyValue = Math.round(180 - normalizedScore * 116); // 180-64
        const bgColor =
          selectedTeam === teamData.team
            ? "rgb(29, 78, 216)" // royal blue
            : `rgb(${greyValue}, ${greyValue}, ${greyValue})`; // grey scale

        return (
          <div
            key={teamData.team}
            className="flex items-center gap-3 px-2 py-1 transition-all duration-200 minted-chart-bar-row"
            style={{ height: `${barHeight}px` }}
          >
            <div
              className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-shrink-0"
              style={{ minWidth: "90px", maxWidth: "90px" }}
              title={teamData.team}
            >
              {teamData.team.length > 10 ? teamData.team.slice(0, 8) + ".." : teamData.team}
            </div>
            <div
              className="h-full rounded transition-colors duration-200 flex items-center px-2"
              style={{
                width: `${Math.max(5, (normalizedScore * 100) - 5)}%`,
                backgroundColor: bgColor,
                minWidth: "40px",
              }}
            />
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex-shrink-0" style={{ minWidth: "40px" }}>
              {teamData.score}
            </div>
          </div>
        );
      })}
    </div>
  );
}
