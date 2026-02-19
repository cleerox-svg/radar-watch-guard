/**
 * AccountTakeover.tsx — Dashboard view for the "Account Takeover" tab.
 *
 * Displays ATO detection events from the ato_events table:
 *   1. Summary cards: Unresolved count, total events, impossible-travel flags, avg risk score
 *   2. Timeline chart: Area chart grouping events by detection hour
 *   3. Event list: Scrollable list of individual ATO events with risk scores and resolution status
 *
 * Data source: useAtoEvents() hook → public.ato_events table
 *   - Each row represents a detected account-takeover signal (impossible travel,
 *     credential stuffing, session hijack, etc.)
 *   - Fields: user_email, event_type, detected_at, ip_from/to, location_from/to,
 *     risk_score (0-100), resolved (boolean)
 */

import { motion } from "framer-motion";
import { TrendingUp, UserX, Plane, Timer, AlertCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useAtoEvents } from "@/hooks/use-threat-data";
import { useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";

/** Formats a date string into a human-readable relative time (e.g., "3 hours ago") */
function timeAgo(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "unknown";
  }
}

export function AccountTakeover() {
  const { data: liveEvents, isLoading } = useAtoEvents();

  /**
   * Compute summary statistics from live ATO events.
   * Returns an array of 4 stat cards: unresolved, total, impossible-travel, avg risk.
   */
  const stats = useMemo(() => {
    if (!liveEvents || liveEvents.length === 0) return null;
    const total = liveEvents.length;
    const resolved = liveEvents.filter((e: any) => e.resolved).length;
    const unresolved = total - resolved;
    const impossibleTravel = liveEvents.filter((e: any) => e.event_type === "impossible_travel").length;
    const avgRisk = Math.round(liveEvents.reduce((sum: number, e: any) => sum + (e.risk_score || 0), 0) / total);
    return [
      { label: "Unresolved Events", value: String(unresolved), icon: UserX, color: "text-destructive" },
      { label: "Total ATO Events", value: String(total), icon: TrendingUp, color: "text-warning" },
      { label: "Impossible Travel", value: String(impossibleTravel), suffix: " Flags", icon: Plane, color: "text-foreground" },
      { label: "Avg Risk Score", value: String(avgRisk), icon: Timer, color: "text-primary" },
    ];
  }, [liveEvents]);

  /**
   * Build area chart data by grouping events into hourly buckets (HH:mm).
   * Each point = { time: "14:00", attempts: 3 }.
   * Sorted chronologically for the timeline visualization.
   */
  const chartData = useMemo(() => {
    if (!liveEvents || liveEvents.length === 0) return [];
    const hourMap = new Map<string, number>();
    liveEvents.forEach((e: any) => {
      try {
        const hour = format(new Date(e.detected_at), "HH:mm");
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      } catch {}
    });
    return Array.from(hourMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, attempts]) => ({ time, attempts }));
  }, [liveEvents]);

  /**
   * Transform raw ATO event rows into display-ready objects.
   * Adds relative timestamps and provides fallback values for missing fields.
   */
  const events = useMemo(() => {
    if (!liveEvents || liveEvents.length === 0) return [];
    return liveEvents.map((e: any) => ({
      id: e.id,
      user_email: e.user_email,
      detected_at: timeAgo(e.detected_at),
      location_from: e.location_from || "Unknown",
      location_to: e.location_to || "Unknown",
      risk_score: e.risk_score || 0,
      resolved: e.resolved,
      event_type: e.event_type,
    }));
  }, [liveEvents]);

  /** Empty state component shown when no ATO events exist in the database */
  const emptyState = (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">No ATO events detected yet</p>
      <p className="text-xs text-muted-foreground mt-1">Events will appear here as they're ingested</p>
    </div>
  );

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading ATO data...</p>
      </motion.div>
    );
  }

  if (!liveEvents || liveEvents.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {emptyState}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Summary stat cards — 4-column grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
        {stats?.map((s) => (
          <div key={s.label} className="bg-card p-3 lg:p-5 rounded-lg border border-border shadow-lg relative group overflow-hidden">
            <p className="text-muted-foreground text-[10px] lg:text-xs uppercase tracking-wider font-semibold truncate">{s.label}</p>
            <p className={`text-2xl lg:text-3xl font-bold mt-1 ${s.color}`}>
              {s.value}
              {s.suffix && <span className="text-xs lg:text-sm text-muted-foreground">{s.suffix}</span>}
            </p>
            <s.icon className="absolute top-3 right-3 lg:top-4 lg:right-4 w-6 h-6 lg:w-8 lg:h-8 text-border group-hover:text-muted-foreground/20 transition-colors" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
        {/* ATO Event Timeline — area chart of events grouped by hour */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4 lg:p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4 lg:mb-6">
            <h3 className="font-bold text-foreground flex items-center text-sm lg:text-base">
              <TrendingUp className="w-4 h-4 text-primary mr-2 shrink-0" />
              <span className="hidden sm:inline">ATO Event Timeline</span>
              <span className="sm:hidden">Event Timeline</span>
            </h3>
            <span className="text-[10px] lg:text-xs bg-accent px-2 py-1 rounded text-foreground font-mono">
              {liveEvents.length} EVENTS
            </span>
          </div>
          {chartData.length > 0 ? (
            <div className="h-48 lg:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 25% 20%)" />
                  <XAxis dataKey="time" tick={{ fill: "hsl(215 16% 55%)", fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(215 16% 55%)", fontSize: 11 }} axisLine={false} width={35} />
                  <Area type="monotone" dataKey="attempts" stroke="hsl(0 84% 60%)" strokeWidth={2} fill="url(#redGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 lg:h-64 flex items-center justify-center text-muted-foreground text-sm">
              Not enough data to chart
            </div>
          )}
        </div>

        {/* Impossible Travel Events — scrollable event list */}
        <div className="bg-card rounded-lg border border-border shadow-xl overflow-hidden flex flex-col">
          <div className="px-4 lg:px-5 py-3 lg:py-4 border-b border-border bg-surface-elevated flex justify-between items-center">
            <h3 className="font-bold text-foreground text-xs lg:text-sm uppercase">Impossible Travel</h3>
            <span className="animate-pulse h-2 w-2 bg-destructive rounded-full" />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-cyber max-h-[300px] lg:max-h-none">
            {events.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">No events</div>
            ) : (
              events.map((event: any) => (
                <div key={event.id} className="p-3 lg:p-4 border-b border-border hover:bg-accent/30 transition-colors">
                  <div className="flex justify-between items-start mb-1.5 lg:mb-2">
                    <span className="font-bold text-foreground text-xs lg:text-sm truncate mr-2">{event.user_email}</span>
                    <span className="text-[10px] lg:text-xs font-mono text-muted-foreground shrink-0">{event.detected_at}</span>
                  </div>
                  {/* Travel path: source location → destination location */}
                  <div className="flex items-center text-xs text-muted-foreground mb-1">
                    <span className="truncate">{event.location_from}</span>
                    <Plane className="w-3 h-3 text-primary mx-1.5 shrink-0" />
                    <span className="truncate">{event.location_to}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {/* Risk score badge — color-coded by severity threshold */}
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      event.risk_score >= 80 ? "bg-destructive/20 text-destructive" :
                      event.risk_score >= 50 ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"
                    }`}>Risk: {event.risk_score}</span>
                    <span className={`text-[10px] font-bold ${event.resolved ? "text-primary" : "text-destructive"}`}>
                      {event.resolved ? "RESOLVED" : "ACTIVE"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
