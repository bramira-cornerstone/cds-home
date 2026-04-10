import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  Recycle,
  Gift,
} from "lucide-react";
import { getTeamCrest } from "@/lib/teams";

interface DropWeekWindow {
  drop_week: string;
  votes_close: string | null;
  redemptions_close: string | null;
  airdrops_close: string | null;
  dropgates_close: string | null;
  team_airdrop?: string;
}

interface DayEvent {
  type: "votes" | "redemptions" | "airdrops" | "dropgates";
  label: string;
  teamAirdrop?: string;
}

const BoxesIcon = (props: { size?: number; className?: string }) => (
  <svg
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    aria-hidden="true"
  >
    <rect x="5" y="10" width="14" height="8" rx="2" />
    <rect x="4" y="7" width="16" height="3" rx="1" />
  </svg>
);

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

export default function DropWeekCalendar() {
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null);

  const [events, setEvents] = useState<Map<string, DayEvent[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [availableWeeks, setAvailableWeeks] = useState<Date[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const baseUrl = import.meta.env.SUPABASE_URL;
        const anonKey = import.meta.env.SUPABASE_ANON_KEY;

        if (!baseUrl) throw new Error("Supabase URL not configured");
        if (!anonKey) throw new Error("Supabase anon key not configured");

        const root = baseUrl.replace(/\/$/, "");
        const url = `${root}/rest/v1/drop_week_windows?select=*`;

        console.log("[DropWeekCalendar] Fetching from:", url);
        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });
        if (!response.ok) {
          console.error(
            "[DropWeekCalendar] Fetch failed with status:",
            response.status,
          );
          throw new Error(
            `Failed to fetch drop week windows: ${response.status}`,
          );
        }

        const data: DropWeekWindow[] = await response.json();
        console.log("[DropWeekCalendar] Fetched data count:", data.length);
        console.log("[DropWeekCalendar] Fetched data:", data);

        // Process events into a map by date
        const eventMap = new Map<string, DayEvent[]>();
        const weeksWithEvents = new Set<string>();

        data.forEach((window) => {
          // Process votes_close
          if (window.votes_close) {
            const dateStr = new Date(window.votes_close)
              .toISOString()
              .split("T")[0];
            const weekKey = getWeekKey(new Date(window.votes_close));
            weeksWithEvents.add(weekKey);
            const existing = eventMap.get(dateStr) || [];
            eventMap.set(dateStr, [
              ...existing,
              { type: "votes", label: "Voting Closes" },
            ]);
            console.log(
              "[DropWeekCalendar] Added votes_close event on",
              dateStr,
            );
          }

          // Process redemptions_close
          if (window.redemptions_close) {
            const dateStr = new Date(window.redemptions_close)
              .toISOString()
              .split("T")[0];
            const weekKey = getWeekKey(new Date(window.redemptions_close));
            weeksWithEvents.add(weekKey);
            const existing = eventMap.get(dateStr) || [];
            eventMap.set(dateStr, [
              ...existing,
              { type: "redemptions", label: "Redeem Snapshot" },
            ]);
            console.log(
              "[DropWeekCalendar] Added redemptions_close event on",
              dateStr,
            );
          }

          // Process airdrops_close
          if (window.airdrops_close) {
            const dateStr = new Date(window.airdrops_close)
              .toISOString()
              .split("T")[0];
            const weekKey = getWeekKey(new Date(window.airdrops_close));
            weeksWithEvents.add(weekKey);
            const existing = eventMap.get(dateStr) || [];
            eventMap.set(dateStr, [
              ...existing,
              {
                type: "airdrops",
                label: "Reward Snapshot",
                teamAirdrop: window.team_airdrop,
              },
            ]);
            console.log(
              "[DropWeekCalendar] Added airdrops_close event on",
              dateStr,
              "for team",
              window.team_airdrop,
            );
          }

          // Process dropgates_close
          if (window.dropgates_close) {
            const dateStr = new Date(window.dropgates_close)
              .toISOString()
              .split("T")[0];
            const weekKey = getWeekKey(new Date(window.dropgates_close));
            weeksWithEvents.add(weekKey);
            const existing = eventMap.get(dateStr) || [];
            eventMap.set(dateStr, [
              ...existing,
              { type: "dropgates", label: "Drop Gates Close" },
            ]);
            console.log(
              "[DropWeekCalendar] Added dropgates_close event on",
              dateStr,
            );
          }
        });

        console.log("[DropWeekCalendar] Event map before setting:", eventMap);
        setEvents(eventMap);

        // Build list of available weeks (current and future)
        const now = new Date();
        const weeks: Date[] = [];

        weeksWithEvents.forEach((weekKey) => {
          const [year, month, day] = weekKey.split("-").map(Number);
          const weekDate = new Date(year, month - 1, day);
          const currentWeek = getWeekStart(now);
          if (weekDate >= currentWeek) {
            weeks.push(weekDate);
          }
        });

        // Ensure current week is included
        const currentWeek = getWeekStart(now);
        if (!weeks.some((w) => w.getTime() === currentWeek.getTime())) {
          weeks.push(currentWeek);
        }

        weeks.sort((a, b) => a.getTime() - b.getTime());
        console.log("[DropWeekCalendar] Available weeks:", weeks);
        setAvailableWeeks(weeks);

        // Find the earliest event date >= today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let nearestEventDate: Date | null = null;

        // Find earliest future event from the data
        data.forEach((window) => {
          const datesToCheck = [
            window.votes_close,
            window.redemptions_close,
            window.airdrops_close,
            window.dropgates_close,
          ].filter(Boolean) as string[];

          datesToCheck.forEach((dateStr) => {
            const eventDate = new Date(dateStr);
            eventDate.setHours(0, 0, 0, 0);

            if (eventDate >= today) {
              if (!nearestEventDate || eventDate < nearestEventDate) {
                nearestEventDate = eventDate;
              }
            }
          });
        });

        // Set to week containing nearest future event, or current week if no future events
        if (nearestEventDate) {
          setWeekStartDate(getWeekStart(nearestEventDate));
        } else if (weeks.length > 0) {
          setWeekStartDate(weeks[0]);
        } else {
          setWeekStartDate(getWeekStart(now));
        }
      } catch (err) {
        console.error("Error fetching drop week windows:", err);
        setWeekStartDate(getWeekStart(new Date()));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getWeekKey = (date: Date): string => {
    const weekStart = getWeekStart(date);
    return weekStart.toISOString().split("T")[0];
  };

  const handlePrevWeek = () => {
    const prev = new Date(weekStartDate);
    prev.setDate(prev.getDate() - 7);
    const minWeek = availableWeeks[0];
    if (prev >= minWeek) {
      setWeekStartDate(prev);
    }
  };

  const handleNextWeek = () => {
    const next = new Date(weekStartDate);
    next.setDate(next.getDate() + 7);
    const maxWeek = availableWeeks[availableWeeks.length - 1];
    if (next <= maxWeek) {
      setWeekStartDate(next);
    }
  };

  const canGoPrev =
    availableWeeks.length > 0 && weekStartDate > availableWeeks[0];
  const canGoNext =
    availableWeeks.length > 0 &&
    weekStartDate < availableWeeks[availableWeeks.length - 1];

  const isToday = (dateStr: string): boolean => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate.getTime() === today.getTime();
  };

  const renderEventIcon = (event: DayEvent, large: boolean = false) => {
    const iconProps = large
      ? { size: 24, className: "flex-shrink-0 text-black" }
      : { size: 12, className: "flex-shrink-0 text-black" };

    switch (event.type) {
      case "votes":
        return <ThumbsUp {...iconProps} />;
      case "redemptions":
        return <Recycle {...iconProps} />;
      case "dropgates":
        return <BoxesIcon {...iconProps} />;
      case "airdrops": {
        if (event.teamAirdrop) {
          const crestUrl = getTeamCrest(event.teamAirdrop);
          return crestUrl ? (
            <img
              src={crestUrl}
              alt={`${event.teamAirdrop} crest`}
              className={`object-contain flex-shrink-0 ${large ? "h-6 w-6" : "h-3 w-3"}`}
            />
          ) : null;
        }
        return <Gift {...iconProps} />;
      }
      default:
        return null;
    }
  };

  if (loading || !weekStartDate) {
    return (
      <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="h-32 flex items-center justify-center">
          <span className="text-slate-600 dark:text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (availableWeeks.length === 0) {
    return (
      <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="h-32 flex items-center justify-center">
          <span className="text-slate-600 dark:text-slate-400">
            No events scheduled
          </span>
        </div>
      </div>
    );
  }

  // Get the 7 days of the current week
  const weekDays: { date: Date; dateStr: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    weekDays.push({ date, dateStr });
  }

  const weekLabel = `${weekDays[0].date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${weekDays[6].date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          {weekLabel}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrevWeek}
            disabled={!canGoPrev}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            aria-label="Previous week"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={handleNextWeek}
            disabled={!canGoNext}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            aria-label="Next week"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Weekly calendar */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(({ date, dateStr }, idx) => {
          const dayEvents = events.get(dateStr) || [];
          const isTodayDate = isToday(dateStr);
          const dayOfWeek = date.toLocaleDateString("en-US", {
            weekday: "short",
          });
          const dayOfMonth = date.getDate();

          const dayStyle: React.CSSProperties = isTodayDate
            ? {
                background:
                  "linear-gradient(135deg, rgba(0, 79, 255, 0.3) 0%, rgba(0, 79, 255, 0.2) 5%, rgb(255, 255, 255) 15%, rgb(255, 255, 255) 85%, rgba(255, 99, 0, 0.2) 95%, rgb(255, 99, 0) 100%)",
                borderColor: "rgb(226, 232, 240)",
              }
            : {
                backgroundColor: "rgb(255, 255, 255)",
                borderColor: "rgb(226, 232, 240)",
              };

          return (
            <div key={idx} className="flex flex-col gap-1">
              {/* Day header */}
              <div className="text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                <div>{dayOfWeek}</div>
                <div className="text-black dark:text-white">{dayOfMonth}</div>
              </div>

              {/* Day cell */}
              <div
                className="aspect-[1/2] p-1 rounded border text-xs relative"
                style={dayStyle}
                title={dayEvents.map((e) => e.label).join(", ")}
              >
                {dayEvents.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      {dayEvents.map((event, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center justify-center"
                          title={event.label}
                        >
                          {renderEventIcon(event, true)}
                          <span className="text-[10px] font-light text-black text-center leading-tight max-w-[70px] break-words">
                            {event.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
