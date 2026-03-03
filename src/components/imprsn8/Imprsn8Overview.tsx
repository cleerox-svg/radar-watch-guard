/**
 * Imprsn8Overview.tsx — Data-driven dashboard with live stats from DB.
 * Shows protection score, risk scoring breakdown, threat counts, recent alerts, and account status.
 * Integrates aggregate legitimacy scores across all monitored accounts.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, AlertTriangle, FileText, Bot, Eye, TrendingUp, Clock, ChevronRight, Brain, Gauge, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useImprsn8 } from "./Imprsn8Context";
import { formatDistanceToNow } from "date-fns";

export function Imprsn8Overview({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { selectedId, isAllView, getInfluencerFilter, currentInfluencer } = useImprsn8();
  const filter = getInfluencerFilter();

  /** Monitored accounts with risk scores */
  const { data: accountStats } = useQuery({
    queryKey: ["imprsn8-dash-accounts", selectedId],
    queryFn: async () => {
      let q = supabase.from("monitored_accounts").select("id, scan_status, current_avatar_url, risk_score, risk_category", { count: "exact" });
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data, count } = await q;
      const accounts = data ?? [];
      const active = accounts.filter((a) => a.scan_status === "active").length;
      const pending = accounts.filter((a) => a.scan_status === "pending").length;
      const firstAvatar = accounts.find((a) => a.current_avatar_url)?.current_avatar_url ?? null;

      // Risk scoring aggregates
      const scored = accounts.filter((a) => a.risk_score != null);
      const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, a) => s + (a.risk_score ?? 0), 0) / scored.length) : null;
      const legitimate = accounts.filter((a) => a.risk_category === "legitimate" || a.risk_category === "low_risk").length;
      const suspicious = accounts.filter((a) => ["suspicious", "likely_imposter", "confirmed_imposter"].includes(a.risk_category ?? "")).length;
      const unscored = accounts.filter((a) => !a.risk_score && a.risk_score !== 0).length;

      return { total: count ?? 0, active, pending, firstAvatar, avgScore, legitimate, suspicious, unscored };
    },
  });

  /** Impersonation reports */
  const { data: reportStats } = useQuery({
    queryKey: ["imprsn8-dash-reports", selectedId],
    queryFn: async () => {
      let q = supabase.from("impersonation_reports").select("id, status, severity, created_at");
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data } = await q;
      const reports = data ?? [];
      return {
        total: reports.length,
        new: reports.filter((r) => r.status === "new").length,
        confirmed: reports.filter((r) => r.status === "confirmed").length,
        critical: reports.filter((r) => r.severity === "critical" || r.severity === "high").length,
      };
    },
  });

  /** Takedown requests */
  const { data: takedownStats } = useQuery({
    queryKey: ["imprsn8-dash-takedowns", selectedId],
    queryFn: async () => {
      let q = supabase.from("takedown_requests").select("id, status");
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data } = await q;
      const tds = data ?? [];
      return {
        total: tds.length,
        active: tds.filter((t) => ["draft", "submitted", "acknowledged"].includes(t.status)).length,
        resolved: tds.filter((t) => t.status === "resolved").length,
      };
    },
  });

  /** Recent agent runs — including risk_scorer */
  const { data: recentRuns = [] } = useQuery({
    queryKey: ["imprsn8-dash-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .in("agent_type", [
          "imprsn8_scanner", "doppelganger_hunter", "deepfake_sentinel",
          "scam_link_detector", "takedown_orchestrator", "follower_shield",
          "brand_drift_monitor", "reputation_pulse", "risk_scorer",
        ])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  /** Recent threats */
  const { data: recentThreats = [] } = useQuery({
    queryKey: ["imprsn8-dash-recent-threats", selectedId],
    queryFn: async () => {
      let q = supabase.from("impersonation_reports")
        .select("id, impersonator_username, platform, severity, status, created_at, source")
        .order("created_at", { ascending: false })
        .limit(8);
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const sevColors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-500 border-red-500/30",
    high: "bg-imprsn8-gold-dim text-imprsn8 border-imprsn8/30",
    medium: "bg-imprsn8/10 text-imprsn8 border-imprsn8/30",
    low: "bg-muted text-muted-foreground border-border",
  };

  const protectionScore = accountStats && reportStats
    ? Math.max(0, 100 - (reportStats.new * 10) - (reportStats.critical * 5))
    : null;

  const avgScoreColor = (accountStats?.avgScore ?? 50) >= 70 ? "text-emerald-500" :
    (accountStats?.avgScore ?? 50) >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-6">
      {/* Welcome / Context */}
      <Card className="border-imprsn8/20 bg-gradient-to-r from-imprsn8/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                {!isAllView && currentInfluencer && (
                  <Avatar className="h-10 w-10 border-2 border-imprsn8/30">
                    <AvatarImage src={currentInfluencer.avatar_url || accountStats?.firstAvatar || undefined} className="object-cover" />
                    <AvatarFallback className="bg-imprsn8/10 text-imprsn8 font-bold text-sm">
                      {currentInfluencer.display_name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                )}
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Shield className="w-5 h-5 text-imprsn8" />
                  {isAllView ? "imprsn8 — All Influencers" : currentInfluencer?.display_name ?? "imprsn8 Dashboard"}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isAllView
                  ? "Aggregated view across all monitored influencers"
                  : currentInfluencer?.brand_name
                    ? `Brand: ${currentInfluencer.brand_name}`
                    : "Your social media protection dashboard"
                }
              </p>
            </div>
            {protectionScore !== null && (
              <div className="text-center">
                <p className={`text-3xl font-black ${protectionScore >= 80 ? "text-emerald-500" : protectionScore >= 50 ? "text-imprsn8" : "text-red-500"}`}>
                  {protectionScore}
                </p>
                <p className="text-[9px] text-muted-foreground uppercase font-mono">Protection</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Monitored Accounts", value: accountStats?.total ?? 0, sub: `${accountStats?.active ?? 0} active`, icon: Eye, tab: "accounts" },
          { label: "Threats Found", value: reportStats?.total ?? 0, sub: `${reportStats?.new ?? 0} new`, icon: AlertTriangle, tab: "threats" },
          { label: "Active Takedowns", value: takedownStats?.active ?? 0, sub: `${takedownStats?.resolved ?? 0} resolved`, icon: FileText, tab: "takedowns" },
          { label: "High Severity", value: reportStats?.critical ?? 0, sub: "critical + high", icon: Shield, tab: "threats" },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="cursor-pointer hover:border-imprsn8/40 transition-colors"
            onClick={() => onNavigate?.(stat.tab)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className="w-4 h-4 text-imprsn8" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              <p className="text-[10px] text-muted-foreground/60">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk Score Overview Card */}
      <Card className="border-imprsn8/20">
        <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 rounded-t-lg transition-colors" onClick={() => onNavigate?.("accounts")}>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-imprsn8" /> AI Legitimacy Scoring
            <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-accent/40 text-center">
              <Gauge className="w-4 h-4 mx-auto mb-1 text-imprsn8" />
              <p className={`text-2xl font-bold ${avgScoreColor}`}>{accountStats?.avgScore ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Avg Score</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/5 text-center">
              <ShieldCheck className="w-4 h-4 mx-auto mb-1 text-emerald-500" />
              <p className="text-2xl font-bold text-emerald-500">{accountStats?.legitimate ?? 0}</p>
              <p className="text-[10px] text-emerald-500/70 uppercase">Legitimate</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 text-center">
              <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-amber-500" />
              <p className="text-2xl font-bold text-amber-500">{accountStats?.suspicious ?? 0}</p>
              <p className="text-[10px] text-amber-500/70 uppercase">Suspicious</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold text-muted-foreground">{accountStats?.unscored ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Unscored</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Threats */}
        <Card>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 rounded-t-lg transition-colors" onClick={() => onNavigate?.("threats")}>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-imprsn8" /> Recent Threats
              <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentThreats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No threats detected yet.</p>
            ) : (
              <div className="space-y-2">
                {recentThreats.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`${sevColors[t.severity]} text-[9px]`}>
                        {t.severity}
                      </Badge>
                      <span className="text-xs font-medium truncate">@{t.impersonator_username}</span>
                      <Badge variant="outline" className="text-[9px]">{t.platform}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Agent Activity */}
        <Card>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 rounded-t-lg transition-colors" onClick={() => onNavigate?.("agents")}>
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-imprsn8-purple-accent" /> Agent Activity
              <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No agent runs yet.</p>
            ) : (
              <div className="space-y-2">
                {recentRuns.map((run: any) => (
                  <div key={run.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-[9px] ${run.status === "completed" ? "border-emerald-500/30 text-emerald-500" : run.status === "failed" ? "border-red-500/30 text-red-500" : "border-imprsn8/30 text-imprsn8"}`}>
                        {run.status}
                      </Badge>
                      <span className="text-xs font-medium truncate">{run.agent_type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {run.items_flagged > 0 && (
                        <Badge variant="outline" className="text-[9px] border-imprsn8/30 text-imprsn8">
                          {run.items_flagged} flagged
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(run.completed_at || run.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
