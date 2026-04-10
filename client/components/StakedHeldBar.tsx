interface StakedHeldBarProps {
  rmv: number;
  stakedRmv: number;
  teamMaxRmv: number;
  teamStakedRmvValues: number[];
}

function getStakedRmvColor(
  stakedRmv: number,
  teamStakedRmvValues: number[],
): string {
  if (teamStakedRmvValues.length === 0) return "#FF6300"; // orange

  const minStaked = Math.min(...teamStakedRmvValues);
  const maxStaked = Math.max(...teamStakedRmvValues);

  if (minStaked === maxStaked) {
    return "#FF6300"; // orange if all values are the same
  }

  // Normalize stakedRmv to 0-1 range (0 = lowest, 1 = highest)
  const normalized = (stakedRmv - minStaked) / (maxStaked - minStaked);

  // Color interpolation from orange (#FF6300) to blue (#004FFF)
  const orangeR = 255;
  const orangeG = 99;
  const orangeB = 0;

  const blueR = 0;
  const blueG = 79;
  const blueB = 255;

  // Interpolate: 0 (orange) -> 1 (blue)
  const r = Math.round(orangeR + (blueR - orangeR) * normalized);
  const g = Math.round(orangeG + (blueG - orangeG) * normalized);
  const b = Math.round(orangeB + (blueB - orangeB) * normalized);

  return `rgb(${r}, ${g}, ${b})`;
}

export default function StakedHeldBar({
  rmv,
  stakedRmv,
  teamMaxRmv,
  teamStakedRmvValues,
}: StakedHeldBarProps) {
  const rmvPercent = teamMaxRmv > 0 ? (rmv / teamMaxRmv) * 100 : 0;
  const stakedRmvPercent = teamMaxRmv > 0 ? (stakedRmv / teamMaxRmv) * 100 : 0;
  const stakedColor = getStakedRmvColor(stakedRmv, teamStakedRmvValues);

  return (
    <div className="w-full">
      <div className="relative h-6 bg-gray-300 rounded-sm overflow-hidden">
        {/* Grey background bar for rmv */}
        <div
          className="absolute inset-y-0 left-0 bg-gray-300"
          style={{ width: `${rmvPercent}%` }}
        />

        {/* Thinner blue-to-orange bar for staked_rmv (50% height) */}
        {stakedRmvPercent > 0 && (
          <div
            className="absolute left-0 rounded-sm transition-all"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: "50%",
              width: `${stakedRmvPercent}%`,
              backgroundColor: stakedColor,
            }}
          />
        )}

        {/* Overlay text with rmv value centered on bar */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            pointerEvents: "none",
          }}
        >
          <span
            className="text-xs text-slate-700 dark:text-slate-300 font-medium"
            style={{
              textShadow: "0 1px 2px rgba(255, 255, 255, 0.5)",
              whiteSpace: "nowrap",
            }}
          >
            <span className="font-bold max-lg:font-semibold">
              {rmv.toFixed(0)}
            </span>
            <span className="max-lg:font-normal"> Held</span>
          </span>
        </div>
      </div>
    </div>
  );
}
