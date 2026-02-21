/**
 * FeedAnalyticsDashboard.tsx — Unified feed analytics with two views:
 *   Tab 1: Command Center Grid — Dense, information-rich widget grid
 *   Tab 2: Storytelling Flow — Vertical scroll narrative
 */

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap,
} from "recharts";
import {
  TrendingUp, ShieldAlert, Target, Database, AlertCircle, Clock,
  CheckCircle, XCircle, Filter, Activity, Globe2, Layers, Zap,
  BarChart3, Signal, Radio, Shield, Hash,
} from "lucide-react";
import {
  useThreats, useAttackMetrics, useThreatNews,
  useIngestionJobsFreshness, useTorExitNodes, useFeedSchedules,
} from "@/hooks/use-threat-data";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

// ─── Colors ───
const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0 84% 60%)",
  high: "hsl(38 92% 50%)",
  medium: "hsl(217 91% 60%)",
  low: "hsl(160 84% 39%)",
  info: "hsl(215 16% 55%)",
};

const SOURCE_COLORS = [
  "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(217 91% 60%)",
  "hsl(0 84% 60%)", "hsl(280 60% 55%)", "hsl(215 16% 55%)",
  "hsl(340 75% 55%)", "hsl(50 90% 50%)",
];

const CHART_TOOLTIP = {
  contentStyle: { background: "hsl(217 33% 12%)", border: "1px solid hsl(217 25% 20%)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "hsl(213 31% 85%)" },
};

// ─── Shared data hooks ───
function useDashboardData() {
  const { data: threats, isLoading: threatsLoading } = useThreats();
  const { data: metrics } = useAttackMetrics();
  const { data: threatNews } = useThreatNews();
  const { data: feedJobs } = useIngestionJobsFreshness();
  const { data: torNodes } = useTorExitNodes();
  const { data: feedSchedules } = useFeedSchedules();

  const { data: socialIocs } = useQuery({
    queryKey: ["social_iocs_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("social_iocs").select("ioc_type, source, tags, confidence, created_at").limit(500);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: spamTraps } = useQuery({
    queryKey: ["spam_traps_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("spam_trap_hits").select("category, sender_domain, confidence, country, received_at").limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: atoEvents } = useQuery({
    queryKey: ["ato_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ato_events").select("event_type, risk_score, detected_at, resolved").limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: emailReports } = useQuery({
    queryKey: ["email_auth_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_auth_reports").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  return { threats, threatsLoading, metrics, threatNews, feedJobs, torNodes, feedSchedules, socialIocs, spamTraps, atoEvents, emailReports };
}

// ─── Computed analytics ───
function useAnalytics(data: ReturnType<typeof useDashboardData>) {
  const { threats, threatNews, socialIocs, spamTraps, atoEvents, torNodes, feedJobs, emailReports, metrics, feedSchedules } = data;

  // Platform-wide KPIs
  const kpis = useMemo(() => {
    const totalIOCs = (threats?.length || 0) + (socialIocs?.length || 0) + (torNodes?.length || 0);
    const totalCVEs = threatNews?.length || 0;
    const totalFeeds = feedJobs?.length || 0;
    const healthyFeeds = feedJobs?.filter((j: any) => j.status === "completed").length || 0;
    const failedFeeds = feedJobs?.filter((j: any) => j.status === "failed").length || 0;
    const rateLimited = feedJobs?.filter((j: any) => j.status === "rate_limited").length || 0;
    const totalATO = atoEvents?.length || 0;
    const unresolvedATO = atoEvents?.filter((a: any) => !a.resolved).length || 0;
    const criticalThreats = threats?.filter((t: any) => t.severity === "critical").length || 0;
    const highThreats = threats?.filter((t: any) => t.severity === "high").length || 0;
    return { totalIOCs, totalCVEs, totalFeeds, healthyFeeds, failedFeeds, rateLimited, totalATO, unresolvedATO, criticalThreats, highThreats };
  }, [threats, socialIocs, torNodes, threatNews, feedJobs, atoEvents]);

  // Feed health score (0-100)
  const feedHealthScore = useMemo(() => {
    if (!feedJobs || feedJobs.length === 0) return 0;
    const healthy = feedJobs.filter((j: any) => j.status === "completed").length;
    return Math.round((healthy / feedJobs.length) * 100);
  }, [feedJobs]);

  // IOC type distribution
  const iocTypeDistribution = useMemo(() => {
    const typeMap = new Map<string, number>();
    // From threats
    threats?.forEach((t: any) => {
      const type = t.attack_type || "unknown";
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    // From social IOCs
    socialIocs?.forEach((ioc: any) => {
      const type = ioc.ioc_type || "unknown";
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    return Array.from(typeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [threats, socialIocs]);

  // Severity distribution
  const severityData = useMemo(() => {
    if (!threats || threats.length === 0) return [];
    const sevMap = new Map<string, number>();
    threats.forEach((t: any) => {
      const sev = t.severity || "medium";
      sevMap.set(sev, (sevMap.get(sev) || 0) + 1);
    });
    const order = ["critical", "high", "medium", "low", "info"];
    return order
      .filter((s) => sevMap.has(s))
      .map((name) => ({ name, value: sevMap.get(name)!, fill: SEVERITY_COLORS[name] }));
  }, [threats]);

  // Feed volume by source
  const feedVolume = useMemo(() => {
    if (!threats) return [];
    const srcMap = new Map<string, number>();
    threats.forEach((t: any) => {
      const src = t.source || "unknown";
      srcMap.set(src, (srcMap.get(src) || 0) + 1);
    });
    return Array.from(srcMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [threats]);

  // Country distribution (geographic)
  const geoData = useMemo(() => {
    const countryMap = new Map<string, number>();
    threats?.forEach((t: any) => {
      if (t.country) countryMap.set(t.country, (countryMap.get(t.country) || 0) + 1);
    });
    spamTraps?.forEach((s: any) => {
      if (s.country) countryMap.set(s.country, (countryMap.get(s.country) || 0) + 1);
    });
    return Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [threats, spamTraps]);

  // Trend over time (threats by day)
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

  // Top brands
  const topBrands = useMemo(() => {
    const brandMap = new Map<string, { count: number; sources: Set<string> }>();
    const addBrand = (brand: string, source: string) => {
      if (!brand || brand.length < 2) return;
      const key = brand.toLowerCase().trim();
      const entry = brandMap.get(key) || { count: 0, sources: new Set<string>() };
      entry.count++;
      entry.sources.add(source);
      brandMap.set(key, entry);
    };
    threats?.forEach((t: any) => addBrand(t.brand, t.source || "threats"));
    threatNews?.forEach((n: any) => {
      if (n.vendor) addBrand(n.vendor, "cisa_kev");
      if (n.product) addBrand(n.product, "cisa_kev");
    });
    socialIocs?.forEach((ioc: any) => {
      if (ioc.tags?.[0]) addBrand(ioc.tags[0], ioc.source || "social");
    });
    return Array.from(brandMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([name, { count, sources }]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        sources: Array.from(sources),
      }));
  }, [threats, threatNews, socialIocs]);

  // Email auth stats
  const emailStats = useMemo(() => {
    if (!emailReports || emailReports.length === 0) return null;
    const total = emailReports.reduce((s: number, r: any) => s + (r.volume || 0), 0);
    const spfFail = emailReports.filter((r: any) => !r.spf_pass).reduce((s: number, r: any) => s + (r.volume || 0), 0);
    const dkimFail = emailReports.filter((r: any) => !r.dkim_pass).reduce((s: number, r: any) => s + (r.volume || 0), 0);
    const dmarcFail = emailReports.filter((r: any) => !r.dmarc_aligned).reduce((s: number, r: any) => s + (r.volume || 0), 0);
    return {
      spfFail: total > 0 ? Math.round((spfFail / total) * 100) : 0,
      dkimFail: total > 0 ? Math.round((dkimFail / total) * 100) : 0,
      dmarcFail: total > 0 ? Math.round((dmarcFail / total) * 100) : 0,
    };
  }, [emailReports]);

  return { kpis, feedHealthScore, iocTypeDistribution, severityData, feedVolume, geoData, trendData, topBrands, emailStats };
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function FeedAnalyticsDashboard() {
  const data = useDashboardData();
  const analytics = useAnalytics(data);

  if (data.threatsLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground font-mono">Loading feed analytics...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Tabs defaultValue="command-center" className="w-full">
        <TabsList className="bg-card border border-border mb-6 p-1">
          <TabsTrigger value="command-center" className="gap-2 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <BarChart3 className="w-3.5 h-3.5" />
            Command Center
          </TabsTrigger>
          <TabsTrigger value="storytelling" className="gap-2 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Layers className="w-3.5 h-3.5" />
            Intelligence Narrative
          </TabsTrigger>
        </TabsList>

        <TabsContent value="command-center" className="mt-0">
          <CommandCenterGrid data={data} analytics={analytics} />
        </TabsContent>

        <TabsContent value="storytelling" className="mt-0">
          <StorytellingFlow data={data} analytics={analytics} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 1: COMMAND CENTER GRID
// ═══════════════════════════════════════════════════════

function CommandCenterGrid({ data, analytics }: { data: ReturnType<typeof useDashboardData>; analytics: ReturnType<typeof useAnalytics> }) {
  const { kpis, feedHealthScore, severityData, feedVolume, geoData, trendData, iocTypeDistribution, topBrands } = analytics;
  const { feedJobs } = data;

  return (
    <div className="space-y-4">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total IOCs", value: kpis.totalIOCs.toLocaleString(), icon: Database, color: "text-primary", sub: "Across all feeds" },
          { label: "Active CVEs", value: kpis.totalCVEs, icon: Shield, color: "text-warning", sub: "Known exploited" },
          { label: "Critical", value: kpis.criticalThreats, icon: AlertCircle, color: "text-destructive", sub: `${kpis.highThreats} high` },
          { label: "Feed Health", value: `${feedHealthScore}%`, icon: Activity, color: feedHealthScore >= 80 ? "text-primary" : feedHealthScore >= 50 ? "text-warning" : "text-destructive", sub: `${kpis.healthyFeeds}/${kpis.totalFeeds} ok` },
          { label: "ATO Alerts", value: kpis.totalATO, icon: Zap, color: kpis.unresolvedATO > 0 ? "text-destructive" : "text-primary", sub: `${kpis.unresolvedATO} open` },
          { label: "Rate Limited", value: kpis.rateLimited, icon: Signal, color: kpis.rateLimited > 0 ? "text-warning" : "text-primary", sub: `${kpis.failedFeeds} failed` },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card p-3 rounded-xl border border-border shadow-lg group card-interactive overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-1 relative z-10">
              <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground truncate">{kpi.label}</p>
              <kpi.icon className="w-3.5 h-3.5 text-border group-hover:text-muted-foreground/30 transition-colors" />
            </div>
            <p className={`text-xl font-bold ${kpi.color} relative z-10`}>{kpi.value}</p>
            <p className="text-[9px] text-muted-foreground font-mono mt-0.5 relative z-10">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Row 2: Threat Trend + Severity Donut + IOC Types */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Threat Velocity */}
        <div className="lg:col-span-5 bg-card rounded-xl border border-border p-4 shadow-lg">
          <h3 className="font-bold text-foreground flex items-center text-xs mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-primary mr-2" />
            Threat Velocity
          </h3>
          <div className="h-44">
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="ccTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160 84% 39%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 25% 20%)" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(215 16% 55%)", fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(215 16% 55%)", fontSize: 10 }} axisLine={false} width={30} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Area type="monotone" dataKey="threats" stroke="hsl(160 84% 39%)" strokeWidth={2} fill="url(#ccTrendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Insufficient data points</div>
            )}
          </div>
        </div>

        {/* Severity */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border p-4 shadow-lg">
          <h3 className="font-bold text-foreground flex items-center text-xs mb-3">
            <ShieldAlert className="w-3.5 h-3.5 text-destructive mr-2" />
            Severity Mix
          </h3>
          <div className="h-44">
            {severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" innerRadius="35%" outerRadius="65%" paddingAngle={3} dataKey="value" nameKey="name">
                    {severityData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        {/* IOC Type Breakdown */}
        <div className="lg:col-span-4 bg-card rounded-xl border border-border p-4 shadow-lg">
          <h3 className="font-bold text-foreground flex items-center text-xs mb-3">
            <Hash className="w-3.5 h-3.5 text-info mr-2" />
            IOC Type Breakdown
          </h3>
          <div className="h-44">
            {iocTypeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={iocTypeDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 25% 20%)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(215 16% 55%)", fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(213 31% 85%)", fontSize: 9 }} width={70} axisLine={false} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {iocTypeDistribution.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Feed Sources + Geographic + Top Brands */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Feed Source Volume */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-lg">
          <h3 className="font-bold text-foreground flex items-center text-xs mb-3">
            <Radio className="w-3.5 h-3.5 text-primary mr-2" />
            Feed Source Volume
          </h3>
          <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-cyber">
            {feedVolume.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No feed data</p>
            ) : feedVolume.map((src, i) => (
              <div key={src.name} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-20 truncate uppercase">{src.name}</span>
                <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(src.value / feedVolume[0].value) * 100}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold text-foreground w-8 text-right">{src.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-lg">
          <h3 className="font-bold text-foreground flex items-center text-xs mb-3">
            <Globe2 className="w-3.5 h-3.5 text-warning mr-2" />
            Geographic Hotspots
          </h3>
          <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-cyber">
            {geoData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No geographic data</p>
            ) : geoData.map((country, i) => (
              <div key={country.name} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-8 shrink-0">#{i + 1}</span>
                <span className="text-xs font-bold text-foreground w-14 truncate uppercase">{country.name}</span>
                <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-warning/80"
                    style={{ width: `${(country.value / geoData[0].value) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold text-foreground w-8 text-right">{country.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Targeted Brands */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-lg">
          <h3 className="font-bold text-foreground flex items-center text-xs mb-3">
            <Target className="w-3.5 h-3.5 text-destructive mr-2" />
            Top Targeted Brands
          </h3>
          <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-cyber">
            {topBrands.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No brand data</p>
            ) : topBrands.map((brand, i) => (
              <div key={brand.name} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-foreground truncate block">{brand.name}</span>
                  <div className="flex gap-0.5 mt-0.5 flex-wrap">
                    {brand.sources.slice(0, 3).map((s) => (
                      <span key={s} className="text-[7px] font-mono uppercase px-1 py-0 rounded bg-accent/60 text-muted-foreground border border-border">{s}</span>
                    ))}
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-foreground">{brand.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Feed Freshness */}
      {feedJobs && feedJobs.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 shadow-lg">
          <h3 className="font-bold text-foreground flex items-center text-xs mb-3">
            <Clock className="w-3.5 h-3.5 text-primary mr-2" />
            Feed Data Freshness
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {feedJobs.map((job: any) => {
              const isHealthy = job.status === "completed";
              const isFailed = job.status === "failed";
              const isRateLimited = job.status === "rate_limited";
              const timeAgo = job.completed_at
                ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })
                : "never";
              return (
                <div
                  key={job.feed_source}
                  className={`rounded-lg border p-2 text-center transition-colors ${
                    isHealthy ? "border-primary/20 bg-primary/5" :
                    isFailed ? "border-destructive/30 bg-destructive/5" :
                    isRateLimited ? "border-warning/30 bg-warning/5" :
                    "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {isHealthy ? <CheckCircle className="w-2.5 h-2.5 text-primary" /> :
                     isFailed ? <XCircle className="w-2.5 h-2.5 text-destructive" /> :
                     isRateLimited ? <Signal className="w-2.5 h-2.5 text-warning" /> :
                     <Clock className="w-2.5 h-2.5 text-muted-foreground" />}
                    <span className="text-[8px] font-mono font-bold text-foreground uppercase truncate">{job.feed_source}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground truncate">{timeAgo}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">{job.records_processed || 0} rec</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 2: STORYTELLING FLOW
// ═══════════════════════════════════════════════════════

function StorytellingFlow({ data, analytics }: { data: ReturnType<typeof useDashboardData>; analytics: ReturnType<typeof useAnalytics> }) {
  const { kpis, feedHealthScore, severityData, feedVolume, geoData, trendData, iocTypeDistribution, topBrands, emailStats } = analytics;
  const { feedJobs, atoEvents } = data;

  const sections = [
    { id: "health", delay: 0 },
    { id: "volume", delay: 0.1 },
    { id: "landscape", delay: 0.2 },
    { id: "geo", delay: 0.3 },
    { id: "targets", delay: 0.4 },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Section 1: Platform Health */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Platform Health</h2>
            <p className="text-xs text-muted-foreground">How your intelligence feeds are performing right now</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
          {/* Health score */}
          <div className="flex items-center gap-6 mb-6">
            <div className="text-center">
              <div className={`text-4xl font-bold ${feedHealthScore >= 80 ? "text-primary" : feedHealthScore >= 50 ? "text-warning" : "text-destructive"}`}>
                {feedHealthScore}%
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">Overall Health</p>
            </div>
            <div className="flex-1">
              <Progress value={feedHealthScore} className="h-3 mb-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{kpis.healthyFeeds} healthy</span>
                <span>{kpis.failedFeeds} failed</span>
                <span>{kpis.rateLimited} rate-limited</span>
              </div>
            </div>
          </div>

          {/* Feed status grid */}
          {feedJobs && feedJobs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {feedJobs.map((job: any) => {
                const isHealthy = job.status === "completed";
                const isFailed = job.status === "failed";
                const isRateLimited = job.status === "rate_limited";
                const timeAgo = job.completed_at
                  ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })
                  : "never";
                return (
                  <div key={job.feed_source} className={`rounded-lg border p-3 ${
                    isHealthy ? "border-primary/20 bg-primary/5" :
                    isFailed ? "border-destructive/30 bg-destructive/5" :
                    isRateLimited ? "border-warning/30 bg-warning/5" :
                    "border-border bg-background"
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {isHealthy ? <CheckCircle className="w-3 h-3 text-primary" /> :
                       isFailed ? <XCircle className="w-3 h-3 text-destructive" /> :
                       isRateLimited ? <Signal className="w-3 h-3 text-warning" /> :
                       <Clock className="w-3 h-3 text-muted-foreground" />}
                      <span className="text-[10px] font-mono font-bold text-foreground uppercase truncate">{job.feed_source}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{timeAgo}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">{job.records_processed || 0} records</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.section>

      {/* Section 2: Feed Volume & Velocity */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-info" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Feed Volume & Velocity</h2>
            <p className="text-xs text-muted-foreground">Tracking {kpis.totalIOCs.toLocaleString()} indicators across {kpis.totalFeeds} active feeds</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Trend chart */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-lg">
            <h3 className="text-xs font-bold text-foreground mb-3">Ingestion Velocity</h3>
            <div className="h-52">
              {trendData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="storyTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 25% 20%)" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(215 16% 55%)", fontSize: 10 }} axisLine={false} />
                    <YAxis tick={{ fill: "hsl(215 16% 55%)", fontSize: 10 }} axisLine={false} width={30} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Area type="monotone" dataKey="threats" stroke="hsl(217 91% 60%)" strokeWidth={2} fill="url(#storyTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Collecting data points...</div>
              )}
            </div>
          </div>

          {/* Source volume bars */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-lg">
            <h3 className="text-xs font-bold text-foreground mb-3">Volume by Source</h3>
            <div className="h-52">
              {feedVolume.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feedVolume} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 25% 20%)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "hsl(215 16% 55%)", fontSize: 10 }} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "hsl(213 31% 85%)", fontSize: 9 }} width={80} axisLine={false} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {feedVolume.map((_, i) => (
                        <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No source data</div>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section 3: Threat Landscape */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Threat Landscape</h2>
            <p className="text-xs text-muted-foreground">{kpis.criticalThreats} critical and {kpis.highThreats} high severity indicators detected</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Severity */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-lg">
            <h3 className="text-xs font-bold text-foreground mb-3">Severity Distribution</h3>
            <div className="h-52">
              {severityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={severityData} cx="50%" cy="50%" innerRadius="30%" outerRadius="65%" paddingAngle={3} dataKey="value" nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {severityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
              )}
            </div>
          </div>

          {/* IOC types */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-lg">
            <h3 className="text-xs font-bold text-foreground mb-3">Attack Vectors</h3>
            <div className="space-y-2.5">
              {iocTypeDistribution.slice(0, 6).map((type, i) => (
                <div key={type.name}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-mono text-foreground uppercase">{type.name}</span>
                    <span className="font-mono text-muted-foreground">{type.value}</span>
                  </div>
                  <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(type.value / iocTypeDistribution[0].value) * 100}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Email Auth + ATO summary */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-lg space-y-4">
            <div>
              <h3 className="text-xs font-bold text-foreground mb-3">Email Authentication</h3>
              {emailStats ? (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "SPF Fail", value: `${emailStats.spfFail}%`, color: "text-destructive" },
                    { label: "DKIM Fail", value: `${emailStats.dkimFail}%`, color: "text-warning" },
                    { label: "DMARC Fail", value: `${emailStats.dmarcFail}%`, color: "text-warning" },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-accent/30 border border-border">
                      <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No email auth data</p>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <h3 className="text-xs font-bold text-foreground mb-2">Account Takeover</h3>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${kpis.unresolvedATO > 0 ? "text-destructive" : "text-primary"}`}>{kpis.unresolvedATO}</div>
                  <p className="text-[8px] uppercase text-muted-foreground">Open</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{kpis.totalATO}</div>
                  <p className="text-[8px] uppercase text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section 4: Geographic Distribution */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Globe2 className="w-4 h-4 text-warning" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Geographic Distribution</h2>
            <p className="text-xs text-muted-foreground">Where threats originate across all intelligence sources</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-lg">
          {geoData.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {geoData.map((country, i) => (
                <div key={country.name} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                  <span className="text-sm font-bold text-foreground w-16 uppercase">{country.name}</span>
                  <div className="flex-1 h-2.5 bg-accent rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-warning/60 to-warning"
                      initial={{ width: 0 }}
                      animate={{ width: `${(country.value / geoData[0].value) * 100}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-foreground w-10 text-right">{country.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No geographic data available</p>
          )}
        </div>
      </motion.section>

      {/* Section 5: Top Targets */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Top Targets</h2>
            <p className="text-xs text-muted-foreground">Most frequently targeted brands across all intelligence feeds</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-lg">
          {topBrands.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No brand data across feeds yet</p>
          ) : (
            <div className="divide-y divide-border">
              {topBrands.map((brand, i) => (
                <motion.div
                  key={brand.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-accent/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg font-bold text-muted-foreground/40 w-8">#{i + 1}</span>
                    <div className="min-w-0">
                      <span className="font-bold text-foreground text-sm block">{brand.name}</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {brand.sources.map((s) => (
                          <span key={s} className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/50 text-muted-foreground border border-border">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-20 h-2 bg-accent rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-destructive/60 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(brand.count / topBrands[0].count) * 100}%` }}
                        transition={{ delay: 0.5 + i * 0.05, duration: 0.4 }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold text-foreground">{brand.count}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
