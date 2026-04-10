import { useEffect, useState } from "react";

import {
  fetchWalletDailyValue,
  getWalletValueHistory,
  type WalletDailyValueRecord,
} from "@/lib/walletDailyValue";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function WalletDailyValueChart() {
  const account = useActiveAccount();
  const walletAddress = account?.address ?? null;

  const [data, setData] = useState<WalletDailyValueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getResponsiveMargin = () => {
    if (windowWidth >= 1024) return 12; // Desktop
    if (windowWidth >= 768) return 8; // Tablet
    return 2; // Mobile
  };

  const chartMargin = getResponsiveMargin();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const allData = await fetchWalletDailyValue();

        if (walletAddress) {
          const filtered = getWalletValueHistory(allData, walletAddress);
          setData(filtered);
        } else {
          setData([]);
        }
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load wallet data",
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
          Log In to view your personal collection value over time.
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
          No data available for your wallet
        </p>
      </div>
    );
  }

  // Transform data for recharts - sort by date
  const mappedData = data
    .slice()
    .reverse()
    .map((record) => ({
      date: record.snapshot_date,
      totalMedianSalePrice: Number(record.total_median_sale_price) || 0,
      tokensCount: record.tokens_count,
    }));

  // Prepend origin point (0,0) to connect area chart to origin
  const chartData = [
    { date: "", totalMedianSalePrice: 0, tokensCount: 0 },
    ...mappedData,
  ];

  // Calculate nice max values for consistent axis scaling
  const maxMedianSalePrice = Math.max(
    ...chartData.map((d) => d.totalMedianSalePrice),
  );
  const maxTokensCount = Math.max(...chartData.map((d) => d.tokensCount));

  // Round up to nearest "nice" value for consistent gridlines
  const getNiceMax = (max: number): number => {
    if (max === 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const normalized = max / magnitude;
    const niceMultipliers = [1, 1.2, 1.25, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10];
    const multiplier = niceMultipliers.find((m) => m * magnitude > max) || 10;
    return multiplier * magnitude;
  };

  const niceMaxMedian = getNiceMax(maxMedianSalePrice);
  const niceMaxTokens = getNiceMax(maxTokensCount);

  return (
    <div
      className="w-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
      style={{
        padding: `18px ${chartMargin}px`,
      }}
    >
      <div
        className="mb-6 max-lg:px-2"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <h2
          className="text-lg font-semibold text-slate-800 dark:text-white"
          style={{ marginRight: "auto" }}
        >
          Collection Value Over Time
        </h2>
        <div
          className="text-sm text-slate-600 dark:text-slate-400 mt-1"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <p style={{ marginRight: "auto" }}>
            Rolling Median Value held against number of Relics held
          </p>
        </div>
      </div>

      <ResponsiveContainer width="105%" height={400}>
        <ComposedChart
          data={chartData}
          margin={{
            top: 10,
            right: chartMargin,
            left: chartMargin,
            bottom: 10,
          }}
          isAnimationActive={true}
        >
          <defs>
            <linearGradient
              id="rollingMedianGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#004FFF" stopOpacity={1} />
              <stop offset="100%" stopColor="#FF6300" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(0, 0, 0, 0.1)"
            className="dark:stroke-slate-700"
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            className="text-slate-600 dark:text-slate-400"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            className="text-slate-600 dark:text-slate-400"
            domain={[0, niceMaxMedian]}
            tickCount={6}
            type="number"
            tickFormatter={(value) => {
              const actualValue =
                typeof value === "number" ? value : Number(value);
              const formatted = Math.round(actualValue);
              return `$${formatted.toLocaleString()}`;
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, textAnchor: "end", dx: -6 }}
            className="text-slate-600 dark:text-slate-400"
            domain={[0, niceMaxTokens]}
            tickCount={6}
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
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
            cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
            allowEscapeViewBox={{ x: false, y: true }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
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
                      }}
                    >
                      {label}
                    </p>
                    {payload.map((entry: any, index: number) => {
                      const value =
                        entry.dataKey === "totalMedianSalePrice"
                          ? `$${(Math.round(entry.value * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : entry.value.toString();
                      const name = entry.name;
                      return (
                        <p
                          key={index}
                          style={{
                            margin: "2px 0",
                            color: "rgb(0, 0, 0)",
                            fontSize: "12px",
                          }}
                        >
                          {name}: {value}
                        </p>
                      );
                    })}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: "20px",
              fontSize: "12px",
            }}
            formatter={(value) => (
              <span style={{ color: "rgba(0, 0, 0, 1)" }}>{value}</span>
            )}
          />
          <Bar
            yAxisId="right"
            dataKey="tokensCount"
            fill="rgba(226, 232, 240, 1)"
            name="Relics Held"
            radius={[4, 4, 0, 0]}
            barSize={16}
            isAnimationActive={true}
            animationDuration={800}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="totalMedianSalePrice"
            fill="url(#rollingMedianGradient)"
            stroke="rgb(0, 79, 255)"
            strokeWidth={2}
            name="Rolling Median Value"
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
