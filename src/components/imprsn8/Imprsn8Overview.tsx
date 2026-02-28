/**
 * Imprsn8Overview.tsx — Data-driven dashboard with live stats from DB.
 * Shows protection score, threat counts, recent alerts, and account status.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, AlertTriangle, FileText, Bot, Eye, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useImprsn8 } from "./Imprsn8Context";
import { formatDistanceToNow } from "date-fns";

export function Imprsn8Overview() {
  const { selectedId, isAllView, getInfluencerFilter, currentInfluencer } = useImprsn8();
  const filter = getInfluencerFilter();

  /** Monitored accounts count */
  const { data: accountStats } = useQuery({
    queryKey: ["imprsn8-dash-accounts", selectedId],
    queryFn: async () => {
      let q = supabase.from("monitored_accounts").select("id, scan_status", { count: "exact" });
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data, count } = await q;
      const active = data?.filter((a) => a.scan_status === "active").length ?? 0;
      const pending = data?.filter((a) => a.scan_status === "pending").length ?? 0;
      return { total: count ?? 0, active, pending };
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

  /** Recent agent runs */
  const { data: recentRuns = [] } = useQuery({
    queryKey: ["imprsn8-dash-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .in("agent_type", [
          "imprsn8_scanner", "doppelganger_hunter", "deepfake_sentinel",
          "scam_link_detector", "takedown_orchestrator", "follower_shield",
          "brand_drift_monitor", "reputation_pulse",
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
    high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    medium: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    low: "bg-muted text-muted-foreground border-border",
  };

  const protectionScore = accountStats && reportStats
    ? Math.max(0, 100 - (reportStats.new * 10) - (reportStats.critical * 5))
    : null;

  return (
    <div className="space-y-6">
      {/* Welcome / Context */}
      <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                {isAllView ? "imprsn8 — All Influencers" : currentInfluencer?.display_name ?? "imprsn8 Dashboard"}
              </h3>
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
                <p className={`text-3xl font-black ${protectionScore >= 80 ? "text-emerald-500" : protectionScore >= 50 ? "text-amber-500" : "text-red-500"}`}>
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
          { label: "Monitored Accounts", value: accountStats?.total ?? 0, sub: `${accountStats?.active ?? 0} active`, icon: Eye },
          { label: "Threats Found", value: reportStats?.total ?? 0, sub: `${reportStats?.new ?? 0} new`, icon: AlertTriangle },
          { label: "Active Takedowns", value: takedownStats?.active ?? 0, sub: `${takedownStats?.resolved ?? 0} resolved`, icon: FileText },
          { label: "High Severity", value: reportStats?.critical ?? 0, sub: "critical + high", icon: Shield },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              <p className="text-[10px] text-muted-foreground/60">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Threats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Recent Threats
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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-amber-500" /> Agent Activity
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
                      <Badge variant="outline" className={`text-[9px] ${run.status === "completed" ? "border-emerald-500/30 text-emerald-500" : run.status === "failed" ? "border-red-500/30 text-red-500" : "border-amber-500/30 text-amber-500"}`}>
                        {run.status}
                      </Badge>
                      <span className="text-xs font-medium truncate">{run.agent_type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {run.items_flagged > 0 && (
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500">
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
