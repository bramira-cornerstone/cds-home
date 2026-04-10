import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import {
  getOwnedTokensForChart,
  type OwnedTokenWithValue,
} from "@/lib/walletProfitLoss";
import { teamsMap } from "@/lib/teams";
import { FilterStyleButton as FilterButton } from "@/components/ui/filter-style-button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

export function WalletProfitLossChart() {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const walletAddress = account?.address ?? null;

  const [data, setData] = useState<OwnedTokenWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  const [sortMode, setSortMode] = useState<"value" | "profit_loss">("value");
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getResponsiveMargin = () => {
    if (windowWidth >= 1024) return 12;
    if (windowWidth >= 768) return 8;
    return 2;
  };

  const chartMargin = getResponsiveMargin();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (walletAddress) {
          const tokensData = await getOwnedTokensForChart(walletAddress);
          setData(tokensData);
        } else {
          setData([]);
        }
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load token data",
        );
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [walletAddress]);

  if (!walletAddress) {
    return (
      <div className="w-full h-[100px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-400 text-center px-1.5">
          Log In above to view personal collection gains and losses.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-400">Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-400">
          No owned tokens found
        </p>
      </div>
    );
  }

  // Sort data based on selected mode
  const sortedData = [...data].sort((a, b) => {
    if (sortMode === "value") {
      return b.value - a.value;
    } else {
      return b.profit_loss - a.profit_loss;
    }
  });

  // Calculate nice max/min for consistent axis scaling (use all sorted data for consistent scale across pages)
  const profitLossValues = sortedData.map((d) => d.profit_loss);
  const maxProfitLoss = Math.max(...profitLossValues, 0);
  const minProfitLoss = Math.min(...profitLossValues, 0);

  const getNiceMax = (max: number): number => {
    if (max === 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(max))));
    const normalized = max / magnitude;
    const niceMultipliers = [1, 1.2, 1.25, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10];
    const multiplier = niceMultipliers.find((m) => m * magnitude > max) || 10;
    return multiplier * magnitude;
  };

  const getNiceMin = (min: number): number => {
    if (min === 0) return -10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(min))));
    const niceMultipliers = [
      -1, -1.2, -1.25, -1.6, -2, -2.5, -3, -4, -5, -6, -8, -10,
    ];
    const multiplier = niceMultipliers.find((m) => m * magnitude < min) || -10;
    return multiplier * magnitude;
  };

  const niceMaxValue = getNiceMax(maxProfitLoss);
  const niceMinValue = getNiceMin(minProfitLoss);

  // Function to interpolate color: negative=orange, zero=neutral gray, positive=blue
  const getBarColor = (value: number): string => {
    // Neutral gray at zero
    const neutralR = 170;
    const neutralG = 170;
    const neutralB = 170;

    // Orange (#FF6300) for negative
    const orangeR = 255;
    const orangeG = 99;
    const orangeB = 0;

    // Blue (#004FFF) for positive
    const blueR = 0;
    const blueG = 79;
    const blueB = 255;

    let r, g, b;

    if (value < 0) {
      // Interpolate from neutral to orange for negative values
      const negativeRange = Math.abs(niceMinValue);
      const normalizedNegative = Math.abs(value) / negativeRange;
      const t = Math.max(0, Math.min(1, normalizedNegative));
      r = Math.round(neutralR + (orangeR - neutralR) * t);
      g = Math.round(neutralG + (orangeG - neutralG) * t);
      b = Math.round(neutralB + (orangeB - neutralB) * t);
    } else if (value > 0) {
      // Interpolate from neutral to blue for positive values
      const positiveRange = niceMaxValue;
      const normalizedPositive = value / positiveRange;
      const t = Math.max(0, Math.min(1, normalizedPositive));
      r = Math.round(neutralR + (blueR - neutralR) * t);
      g = Math.round(neutralG + (blueG - neutralG) * t);
      b = Math.round(neutralB + (blueB - neutralB) * t);
    } else {
      // Zero value: neutral gray
      r = neutralR;
      g = neutralG;
      b = neutralB;
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedData = sortedData.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  );

  // Pad paginatedData to always have ITEMS_PER_PAGE items so bars maintain consistent height
  const paddedData = [
    ...paginatedData,
    ...Array(Math.max(0, ITEMS_PER_PAGE - paginatedData.length)).fill({
      displayLabel: "",
      profit_loss: 0,
      value: 0,
    } as OwnedTokenWithValue),
  ];

  // Fixed chart height based on ITEMS_PER_PAGE, not current page's item count
  const chartHeight = Math.max(400, ITEMS_PER_PAGE * 40);
  const rowHeight = chartHeight / ITEMS_PER_PAGE;
  const valueBarSize = rowHeight * 0.4;

  // Calculate dynamic range for current value axis (use all sorted data for consistent scale across pages)
  const values = sortedData.map((d) => d.value);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);

  const getNiceMaxValue = (max: number): number => {
    if (max === 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(max))));
    const normalized = max / magnitude;
    const niceMultipliers = [1, 1.2, 1.25, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10];
    const multiplier = niceMultipliers.find((m) => m * magnitude > max) || 10;
    return multiplier * magnitude;
  };

  const niceMaxValueAxis = getNiceMaxValue(maxValue);

  // Custom shape for centered value bars
  const CenteredValueBar = (props: any) => {
    const {
      x = 0,
      y = 0,
      width = 0,
      height = 0,
      fill = "rgb(200, 200, 200)",
    } = props;

    // Calculate centered bar position and height
    const verticalOffset = (height - valueBarSize) / 2;
    const centeredY = y + verticalOffset;

    return (
      <rect
        x={x}
        y={centeredY}
        width={width}
        height={valueBarSize}
        fill={fill}
        rx="2"
        ry="2"
      />
    );
  };

  return (
    <div
      className="w-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 max-lg:pb-2"
      style={{
        padding: `18px ${chartMargin}px`,
      }}
    >
      <div
        className="mb-6 max-lg:px-2"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h2
            className="text-lg font-semibold text-slate-800 dark:text-white"
            style={{ margin: "0" }}
          >
            Your Owned Relics
          </h2>
          <div
            className="text-sm text-slate-600 dark:text-slate-400 mt-1"
            style={{ display: "flex", flexDirection: "column" }}
          >
            <p>Profit/Loss against Current Value</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSortMode(sortMode === "value" ? "profit_loss" : "value");
            setCurrentPage(0);
          }}
          className="relative overflow-hidden px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)] bg-white text-slate-800 dark:bg-slate-700 dark:text-white before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]"
          title={`Sort by ${sortMode === "value" ? "P&L" : "Value"}`}
        >
          <span className="relative z-[1]">
            Sort: {sortMode === "value" ? "Value" : "P&L"}
          </span>
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0px",
          alignItems: "flex-start",
          height: "440px",
        }}
      >
        {/* Left column: Labels (180px fixed) */}
        <div
          style={{
            width: "180px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            height: `${chartHeight}px`,
            paddingTop: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              flexGrow: 1,
              width: "auto",
              alignSelf: "center",
            }}
          >
            {paginatedData.map((item, index) => {
              const itemHeight = 40;
              const fontSize =
                item.displayLabel.length > 30
                  ? 9
                  : item.displayLabel.length > 25
                    ? 10
                    : item.displayLabel.length > 20
                      ? 11
                      : 12;

              const teamCrest = item.team ? teamsMap.get(item.team) : null;

              return (
                <div
                  key={index}
                  onClick={() =>
                    navigate(
                      `/edition/${item.edition_id}/serial/${item.serial}`,
                    )
                  }
                  style={{
                    height: `${itemHeight}px`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: "1px",
                    width: "175px",
                    gap: "8px",
                    fontSize: `${fontSize}px`,
                    lineHeight: "1.2",
                    color: "rgb(71, 85, 105)",
                    fontFamily:
                      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(0, 0, 0, 0.02)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  title={item.displayLabel}
                >
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {item.displayLabel}
                  </span>
                  {teamCrest && (
                    <img
                      src={teamCrest.crest_image}
                      alt={teamCrest.team_name}
                      style={{
                        width: "24px",
                        height: "24px",
                        flexShrink: 0,
                        objectFit: "contain",
                      }}
                    />
                  )}
                </div>
              );
            })}
            {/* Spacer to match chart's bottom axis label height */}
            <div style={{ height: "50px" }} />
          </div>
        </div>

        {/* Right column: Chart (flex: 1) */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: `${chartHeight + 30}px`,
            overflow: "hidden",
          }}
        >
          <ResponsiveContainer width="100%" height={chartHeight + 30}>
            <BarChart
              data={paddedData}
              layout="vertical"
              margin={{
                top: 10,
                right: chartMargin,
                left: 10,
                bottom: 10,
              }}
              isAnimationActive={true}
              barGap="-100%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0, 0, 0, 0.1)"
                className="dark:stroke-slate-700"
              />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                className="text-slate-600 dark:text-slate-400"
                domain={[niceMinValue, niceMaxValue]}
                tickFormatter={(value) => {
                  const formatted = Math.round(value);
                  return `$${formatted.toLocaleString()}`;
                }}
                axisLine={false}
                tickLine={false}
              />
              <XAxis
                xAxisId="1"
                type="number"
                tick={false}
                className="text-slate-600 dark:text-slate-400"
                domain={[0, niceMaxValueAxis]}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine
                x={0}
                stroke="rgba(0, 0, 0, 0.3)"
                strokeDasharray="5 5"
                className="dark:stroke-slate-600"
              />
              <YAxis
                dataKey="displayLabel"
                type="category"
                tick={false}
                className="text-slate-600 dark:text-slate-400"
                axisLine={false}
                tickLine={false}
                width={0}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  borderRadius: "8px",
                  color: "rgb(0, 0, 0)",
                  maxWidth: "90vw",
                  overflow: "hidden",
                }}
                labelStyle={{ color: "rgb(0, 0, 0)" }}
                wrapperStyle={{
                  color: "rgb(0, 0, 0)",
                  pointerEvents: "auto",
                  maxWidth: "90vw",
                }}
                cursor={{ fill: "rgba(0, 0, 0, 0.5)" }}
                allowEscapeViewBox={{ x: false, y: true }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as OwnedTokenWithValue;
                    // Skip tooltip for padding rows (empty items)
                    if (
                      !item.PlayerName ||
                      item.profit_loss === undefined ||
                      item.value === undefined
                    ) {
                      return null;
                    }
                    const formattedDate = item.emitted_at
                      ? new Date(item.emitted_at).toLocaleDateString()
                      : "Unknown";
                    return (
                      <div
                        style={{
                          padding: "8px",
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          borderRadius: "4px",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 4px 0",
                            color: "rgb(0, 0, 0)",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          {item.PlayerName} Serial {item.serial} of{" "}
                          {item.Minted}
                        </p>
                        <p
                          style={{
                            margin: "2px 0",
                            color: "rgb(0, 0, 0)",
                            fontSize: "12px",
                          }}
                        >
                          {item.SetName}
                        </p>
                        <p
                          style={{
                            margin: "4px 0 2px 0",
                            color: "rgb(0, 0, 0)",
                            fontSize: "12px",
                          }}
                        >
                          Purchased {formattedDate}
                        </p>
                        <p
                          style={{
                            margin: "2px 0",
                            color: "rgb(0, 0, 0)",
                            fontSize: "12px",
                          }}
                        >
                          Price Paid: ${item.price_paid.toFixed(2)}
                        </p>
                        <p
                          style={{
                            margin: "2px 0",
                            color: "rgb(0, 0, 0)",
                            fontSize: "12px",
                          }}
                        >
                          Current Value: ${item.value.toFixed(2)}
                        </p>
                        <p
                          style={{
                            margin: "2px 0",
                            color:
                              item.profit_loss === 0
                                ? "rgb(0, 0, 0)"
                                : item.profit_loss > 0
                                  ? "#004FFF"
                                  : "#FF6300",
                            fontSize: "12px",
                          }}
                        >
                          Profit/Loss: {item.profit_loss >= 0 ? "+" : ""}$
                          {item.profit_loss.toFixed(2)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="profit_loss"
                name="Profit/Loss"
                radius={[4, 4, 0, 0]}
                isAnimationActive={true}
                animationDuration={800}
                stackId={null}
              >
                {paddedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(entry.profit_loss)}
                  />
                ))}
              </Bar>
              <Bar
                xAxisId="1"
                dataKey="value"
                name="Current Value"
                barSize={rowHeight}
                shape={CenteredValueBar}
                isAnimationActive={true}
                animationDuration={800}
                stackId={null}
              >
                {paddedData.map((entry, index) => (
                  <Cell
                    key={`value-cell-${index}`}
                    fill="rgba(200, 200, 200, 0.5)"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            marginTop: "32px",
          }}
        >
          <FilterButton
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 text-sm"
          >
            Previous Page
          </FilterButton>
          <span
            style={{
              fontSize: "14px",
              color: "rgb(71, 85, 105)",
              minWidth: "100px",
              textAlign: "center",
            }}
            className="dark:text-slate-400"
          >
            Page {currentPage + 1} of {totalPages}
          </span>
          <FilterButton
            onClick={() =>
              setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
            }
            disabled={currentPage === totalPages - 1}
            className="px-4 py-2 text-sm"
          >
            Next Page
          </FilterButton>
        </div>
      )}
    </div>
  );
}
