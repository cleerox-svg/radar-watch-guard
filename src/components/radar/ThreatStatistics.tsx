/**
 * ThreatStatistics.tsx — Analytics dashboard for the "Threat Statistics" tab.
 *
 * Renders four visualizations from the threats table (via useThreats hook):
 *   1. Summary cards: Total threats, active count, unique brands, feed sources
 *   2. Threat trend: Area chart grouping threats by first_seen date
 *   3. Severity distribution: Donut chart of critical/high/medium/low/info
 *   4. Source breakdown: Horizontal bar chart of threats per feed source
 *   5. Top targeted brands: Ranked list with relative bar + avg confidence
 *
 * All data is computed client-side from the threats query (up to 200 rows).
 * Charts use Recharts with the app's dark theme color tokens.
 */

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend,
} from "recharts";
import { TrendingUp, ShieldAlert, Target, Database, AlertCircle, Clock, CheckCircle, XCircle, Filter } from "lucide-react";
import { useThreats, useAttackMetrics, useThreatNews, useIngestionJobsFreshness } from "@/hooks/use-threat-data";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";

/** HSL colors mapped to each threat severity level for chart fills */
const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0 84% 60%)",
  high: "hsl(38 92% 50%)",
  medium: "hsl(217 91% 60%)",
  low: "hsl(160 84% 39%)",
  info: "hsl(215 16% 55%)",
};

/** Rotating color palette for feed source bars */
const SOURCE_COLORS = [
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(217 91% 60%)",
  "hsl(0 84% 60%)",
  "hsl(280 60% 55%)",
  "hsl(215 16% 55%)",
];

export function ThreatStatistics() {
  const { data: threats, isLoading } = useThreats();
  const { data: metrics } = useAttackMetrics();
  const { data: threatNews } = useThreatNews();
  const { data: feedJobs } = useIngestionJobsFreshness();
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const { data: socialIocs } = useQuery({
    queryKey: ["social_iocs_brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_iocs")
        .select("tags, source")
        .limit(500);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });
  const { data: breachChecks } = useQuery({
    queryKey: ["breach_checks_brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breach_checks")
        .select("check_value, check_type")
        .limit(500);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  /**
   * Group threats by day (first_seen) to build the trend line chart.
   * Each point = { date: "MMM dd", threats: count }.
   * Sorted chronologically so the area chart reads left-to-right.
   */
  const trendData = useMemo(() => {
    if (!threats || threats.length === 0) return [];
    const dayMap = new Map<string, number>();
    threats.forEach((t: any) => {
      try {
        const day = format(new Date(t.first_seen), "MMM dd");
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      } catch {}
    });
    return Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, threats: count }));
  }, [threats]);

  /**
   * Count threats per severity level for the donut chart.
   * Ordered: critical → high → medium → low → info (most to least urgent).
   */
  const severityData = useMemo(() => {
    if (!threats || threats.length === 0) return [];
    const sevMap = new Map<string, number>();
    threats.forEach((t: any) => {
      const sev = t.severity || "medium";
      sevMap.set(sev, (sevMap.get(sev) || 0) + 1);
    });
    return Array.from(sevMap.entries())
      .sort((a, b) => {
        const order = ["critical", "high", "medium", "low", "info"];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      })
      .map(([name, value]) => ({ name, value, fill: SEVERITY_COLORS[name] || SEVERITY_COLORS.info }));
  }, [threats]);

  /**
   * Count threats per feed source (urlhaus, openphish, phishtank, manual)
   * for the horizontal bar chart. Sorted by count descending.
   */
  const sourceData = useMemo(() => {
    if (!threats || threats.length === 0) return [];
    const srcMap = new Map<string, number>();
    threats.forEach((t: any) => {
      const src = t.source || "unknown";
      srcMap.set(src, (srcMap.get(src) || 0) + 1);
    });
    return Array.from(srcMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [threats]);

  /**
   * Identify the top 8 most-targeted brands by aggregating across ALL feeds:
   *   - threats table: brand field + confidence score
   *   - threat_news table: vendor field (CISA KEV, OTX)
   *   - social_iocs table: first tag as brand indicator
   *   - breach_checks table: domain extracted from check_value
   * Each source contributes to the count; confidence is averaged from threats data.
   */
  const topBrands = useMemo(() => {
    const brandMap = new Map<string, { count: number; totalConf: number; confCount: number; sources: Set<string> }>();

    const addBrand = (brand: string, source: string, confidence?: number) => {
      if (!brand || brand.length < 2) return;
      const key = brand.toLowerCase().trim();
      const entry = brandMap.get(key) || { count: 0, totalConf: 0, confCount: 0, sources: new Set<string>() };
      entry.count++;
      entry.sources.add(source);
      if (confidence !== undefined && confidence > 0) {
        entry.totalConf += confidence;
        entry.confCount++;
      }
      brandMap.set(key, entry);
    };

    // From threats table
    threats?.forEach((t: any) => {
      addBrand(t.brand, t.source || "threats", t.confidence);
    });

    // From threat_news (vendor = brand/company targeted by CVE)
    threatNews?.forEach((n: any) => {
      if (n.vendor) addBrand(n.vendor, n.source || "cisa_kev");
      if (n.product) addBrand(n.product, n.source || "cisa_kev");
    });

    // From social_iocs (first tag often indicates targeted brand/malware family)
    socialIocs?.forEach((ioc: any) => {
      if (ioc.tags && ioc.tags.length > 0) {
        addBrand(ioc.tags[0], ioc.source || "social");
      }
    });

    // From breach_checks (extract domain as brand indicator)
    breachChecks?.forEach((bc: any) => {
      if (bc.check_type === "domain" && bc.check_value) {
        const domain = bc.check_value.replace(/^www\./, "").split(".")[0];
        addBrand(domain, "breach_check");
      }
    });

    if (brandMap.size === 0) return [];

    return Array.from(brandMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, { count, totalConf, confCount, sources }]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        avgConf: confCount > 0 ? Math.round(totalConf / confCount) : 0,
        sources: Array.from(sources),
      }));
  }, [threats, threatNews, socialIocs, breachChecks]);

  /**
   * Count threats per status (active, investigating, mitigated, resolved).
   * Powers the summary cards at the top of the dashboard.
   */
  const statusData = useMemo(() => {
    if (!threats || threats.length === 0) return { active: 0, investigating: 0, mitigated: 0, resolved: 0, total: 0 };
    const counts = { active: 0, investigating: 0, mitigated: 0, resolved: 0, total: threats.length };
    threats.forEach((t: any) => {
      const s = t.status || "active";
      if (s in counts) (counts as any)[s]++;
    });
    return counts;
  }, [threats]);

  // Loading state
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading statistics...</p>
      </motion.div>
    );
  }

  // Empty state — no threat data ingested yet
  if (!threats || threats.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No threat data available</p>
          <p className="text-xs text-muted-foreground mt-1">Pull feeds from the Threat Heatmap tab to populate statistics</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* KPI summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
        {[
          { label: "Total Threats", value: statusData.total, icon: Database, color: "text-primary" },
          { label: "Active Threats", value: statusData.active, icon: ShieldAlert, color: "text-destructive" },
          { label: "Unique Brands", value: topBrands.length, icon: Target, color: "text-warning" },
          { label: "Feed Sources", value: sourceData.length, icon: TrendingUp, color: "text-info" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="bg-card p-3 lg:p-5 rounded-xl border border-border shadow-lg relative group overflow-hidden card-interactive"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <p className="text-muted-foreground text-[10px] lg:text-xs uppercase tracking-wider font-semibold truncate relative z-10">{s.label}</p>
            <p className={`text-2xl lg:text-3xl font-bold mt-1 relative z-10 ${s.color}`}>{s.value}</p>
            <s.icon className="absolute top-3 right-3 lg:top-4 lg:right-4 w-6 h-6 lg:w-8 lg:h-8 text-border group-hover:text-muted-foreground/20 transition-colors duration-300" />
          </motion.div>
        ))}
      </div>

      {/* Data Freshness Indicators */}
      {feedJobs && feedJobs.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 lg:p-6 shadow-lg mb-6">
          <h3 className="font-bold text-foreground flex items-center text-sm lg:text-base mb-3">
            <Clock className="w-4 h-4 text-primary mr-2 shrink-0" />
            Feed Data Freshness
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {feedJobs.map((job: any) => {
              const isHealthy = job.status === 'completed';
              const isFailed = job.status === 'failed';
              const timeAgo = job.completed_at
                ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })
                : 'never';
              return (
                <div
                  key={job.feed_source}
                  className={`rounded-lg border p-2.5 text-center cursor-pointer transition-colors ${
                    sourceFilter === job.feed_source
                      ? 'border-primary bg-primary/10'
                      : isHealthy
                      ? 'border-border bg-background hover:border-primary/30'
                      : isFailed
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-warning/30 bg-warning/5'
                  }`}
                  onClick={() => setSourceFilter(sourceFilter === job.feed_source ? null : job.feed_source)}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {isHealthy ? (
                      <CheckCircle className="w-3 h-3 text-primary" />
                    ) : isFailed ? (
                      <XCircle className="w-3 h-3 text-destructive" />
                    ) : (
                      <Clock className="w-3 h-3 text-warning" />
                    )}
                    <span className="text-[10px] font-mono font-bold text-foreground uppercase truncate">
                      {job.feed_source}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">{timeAgo}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">{job.records_processed || 0} rec</p>
                </div>
              );
            })}
          </div>
          {sourceFilter && (
            <div className="mt-2 flex items-center gap-2">
              <Filter className="w-3 h-3 text-primary" />
              <span className="text-xs text-primary font-mono">Filtering by: {sourceFilter}</span>
              <button onClick={() => setSourceFilter(null)} className="text-xs text-muted-foreground hover:text-foreground ml-2">Clear</button>
            </div>
          )}
        </div>
      )}

      {/* Row 1: Threat trend area chart + Severity donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
        {/* Threat Trend — area chart showing threats per day */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4 lg:p-6 shadow-lg card-interactive">
          <h3 className="font-bold text-foreground flex items-center text-sm lg:text-base mb-4">
            <TrendingUp className="w-4 h-4 text-primary mr-2 shrink-0" />
            Threat Trend Over Time
          </h3>
          {trendData.length > 1 ? (
            <div className="h-52 lg:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160 84% 39%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 25% 20%)" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(215 16% 55%)", fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(215 16% 55%)", fontSize: 11 }} axisLine={false} width={35} />
                  <Tooltip
                    contentStyle={{ background: "hsl(217 33% 12%)", border: "1px solid hsl(217 25% 20%)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(213 31% 85%)" }}
                    itemStyle={{ color: "hsl(160 84% 39%)" }}
                  />
                  <Area type="monotone" dataKey="threats" stroke="hsl(160 84% 39%)" strokeWidth={2} fill="url(#trendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 lg:h-64 flex items-center justify-center text-muted-foreground text-sm">
              Need more data points to show trend
            </div>
          )}
        </div>

        {/* Severity Distribution — donut/pie chart */}
        <div className="bg-card rounded-lg border border-border p-4 lg:p-6 shadow-xl">
          <h3 className="font-bold text-foreground flex items-center text-sm lg:text-base mb-4">
            <ShieldAlert className="w-4 h-4 text-destructive mr-2 shrink-0" />
            Severity Distribution
          </h3>
          <div className="h-52 lg:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius="40%"
                  outerRadius="70%"
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(217 33% 12%)", border: "1px solid hsl(217 25% 20%)", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Feed source bar chart + Top brands ranked list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Source Breakdown — horizontal bar chart of threats per feed */}
        <div className="bg-card rounded-lg border border-border p-4 lg:p-6 shadow-xl">
          <h3 className="font-bold text-foreground flex items-center text-sm lg:text-base mb-4">
            <Database className="w-4 h-4 text-info mr-2 shrink-0" />
            Feed Source Breakdown
          </h3>
          <div className="h-52 lg:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 25% 20%)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(215 16% 55%)", fontSize: 11 }} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "hsl(213 31% 85%)", fontSize: 11 }} width={80} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(217 33% 12%)", border: "1px solid hsl(217 25% 20%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(213 31% 85%)" }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Targeted Brands — ranked list with relative bars and confidence scores */}
        <div className="bg-card rounded-lg border border-border shadow-xl overflow-hidden">
          <div className="px-4 lg:px-6 py-3 border-b border-border bg-surface-elevated flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center text-sm lg:text-base">
              <Target className="w-4 h-4 text-warning mr-2 shrink-0" />
              Top Targeted Brands
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground">{topBrands.length} BRANDS</span>
          </div>
          <div className="divide-y divide-border">
            {topBrands.length === 0 ? (
              <div className="px-4 lg:px-6 py-8 text-center text-sm text-muted-foreground">
                No brand data across feeds yet
              </div>
            ) : topBrands.map((brand, i) => (
              <div key={brand.name} className="px-4 lg:px-6 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <span className="font-bold text-foreground text-sm truncate block">{brand.name}</span>
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {brand.sources.map((s) => (
                        <span key={s} className="text-[8px] font-mono uppercase px-1 py-0.5 rounded bg-accent/50 text-muted-foreground border border-border">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-mono text-muted-foreground">{brand.count} hits</span>
                  </div>
                  {/* Relative bar — width proportional to the #1 brand's count */}
                  <div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full bg-warning rounded-full"
                      style={{ width: `${(brand.count / topBrands[0].count) * 100}%` }}
                    />
                  </div>
                  {brand.avgConf > 0 && (
                    <span className="text-xs font-mono text-primary">{brand.avgConf}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
