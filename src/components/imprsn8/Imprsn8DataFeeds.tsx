/**
 * Imprsn8DataFeeds.tsx — API & Data Feeds dashboard for imprsn8 admin panel.
 * Shows all 7 AI agents + scanner feeds with prescribed intervals and manual triggers.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Rss, Play, CheckCircle2, AlertTriangle, Loader2, Clock,
  RefreshCw, Zap, Eye, Globe, Users, ShieldAlert, Search, Bot,
  Activity, X, Link2, Fingerprint, Gavel, Shield, TrendingUp,
  Palette, HeartPulse,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── All imprsn8 agent/feed types tracked in agent_runs ───
const AGENT_TYPES = [
  "imprsn8_scanner", "doppelganger_hunter", "deepfake_sentinel",
  "scam_link_detector", "takedown_orchestrator", "follower_shield",
  "brand_drift_monitor", "reputation_pulse",
];

// ─── Feed definitions ───
interface Imprsn8Feed {
  id: string;
  agentType: string; // matches agent_runs.agent_type
  name: string;
  description: string;
  provider: string;
  intervalLabel: string;
  type: "auto" | "api";
  icon: typeof Rss;
  category: "detect" | "respond" | "monitor" | "analyze";
  edgeFn: string;
  body?: Record<string, any>;
}

const IMPRSN8_FEEDS: Imprsn8Feed[] = [
  // ── DETECT ──
  {
    id: "doppelganger_hunter",
    agentType: "doppelganger_hunter",
    name: "Doppelgänger Hunter",
    description: "AI-generated username variations + Firecrawl scraping to find look-alike accounts across platforms",
    provider: "Firecrawl + Lovable AI",
    intervalLabel: "Every 6 hours",
    type: "auto",
    icon: Search,
    category: "detect",
    edgeFn: "agent-doppelganger-hunter",
  },
  {
    id: "deepfake_sentinel",
    agentType: "deepfake_sentinel",
    name: "Deepfake Sentinel",
    description: "Analyzes suspect profiles for AI-generated or stolen imagery using vision AI + content fingerprinting",
    provider: "Firecrawl + Lovable AI",
    intervalLabel: "Every 12 hours",
    type: "auto",
    icon: Fingerprint,
    category: "detect",
    edgeFn: "agent-deepfake-sentinel",
  },
  {
    id: "scam_link_detector",
    agentType: "scam_link_detector",
    name: "Scam Link Detector",
    description: "Monitors impersonator profiles for phishing kits, fake merch stores, crypto scams & cross-refs threat DB",
    provider: "Firecrawl + Lovable AI + Radar Intel",
    intervalLabel: "Every 4 hours",
    type: "auto",
    icon: Link2,
    category: "detect",
    edgeFn: "agent-scam-link-detector",
  },
  {
    id: "imprsn8_scanner_variations",
    agentType: "imprsn8_scanner",
    name: "Username Variation Scanner",
    description: "Core scanner — AI generates typosquat handles, Firecrawl scrapes & verifies existence",
    provider: "Firecrawl + Lovable AI",
    intervalLabel: "Every 6 hours",
    type: "auto",
    icon: Eye,
    category: "detect",
    edgeFn: "agent-imprsn8-scanner",
    body: { scan_type: "variations_only" },
  },
  {
    id: "imprsn8_scanner_reports",
    agentType: "imprsn8_scanner",
    name: "Follower Report Processor",
    description: "Picks up pending crowd-sourced reports and runs AI similarity analysis",
    provider: "Lovable AI",
    intervalLabel: "Every 30 minutes",
    type: "auto",
    icon: Users,
    category: "detect",
    edgeFn: "agent-imprsn8-scanner",
    body: { scan_type: "reports_only" },
  },

  // ── RESPOND ──
  {
    id: "takedown_orchestrator",
    agentType: "takedown_orchestrator",
    name: "Takedown Orchestrator",
    description: "Auto-generates DMCA notices, tracks platform SLAs, escalates stalled takedowns with HITL approval",
    provider: "Lovable AI",
    intervalLabel: "Every 1 hour",
    type: "auto",
    icon: Gavel,
    category: "respond",
    edgeFn: "agent-takedown-orchestrator",
  },

  // ── MONITOR ──
  {
    id: "follower_shield",
    agentType: "follower_shield",
    name: "Follower Shield",
    description: "Monitors impersonator follower counts & engagement to estimate at-risk victim exposure",
    provider: "Firecrawl + Lovable AI",
    intervalLabel: "Every 12 hours",
    type: "auto",
    icon: Shield,
    category: "monitor",
    edgeFn: "agent-follower-shield",
  },
  {
    id: "brand_drift_monitor",
    agentType: "brand_drift_monitor",
    name: "Brand Drift Monitor",
    description: "Searches web for unauthorized brand asset usage — fake merch, counterfeit products, stolen identity",
    provider: "Firecrawl Search + Lovable AI",
    intervalLabel: "Every 24 hours",
    type: "auto",
    icon: Palette,
    category: "monitor",
    edgeFn: "agent-brand-drift-monitor",
  },
  {
    id: "imprsn8_scanner_sweep",
    agentType: "imprsn8_scanner",
    name: "Full Platform Sweep",
    description: "Complete scan of all monitored accounts across all platforms with all strategies",
    provider: "Firecrawl + Lovable AI",
    intervalLabel: "Every 24 hours",
    type: "auto",
    icon: Globe,
    category: "monitor",
    edgeFn: "agent-imprsn8-scanner",
    body: { scan_type: "full" },
  },

  // ── ANALYZE ──
  {
    id: "reputation_pulse",
    agentType: "reputation_pulse",
    name: "Reputation Pulse",
    description: "Daily risk score per influencer — aggregates threats, takedown SLAs, deepfakes, and coverage gaps",
    provider: "Lovable AI",
    intervalLabel: "Daily at 06:00 UTC",
    type: "auto",
    icon: HeartPulse,
    category: "analyze",
    edgeFn: "agent-reputation-pulse",
  },

  // ── API ENDPOINTS ──
  {
    id: "imprsn8_report_widget",
    agentType: "",
    name: "Public Report Endpoint",
    description: "Unauthenticated API for follower-submitted impersonation sightings via widget token",
    provider: "Internal API",
    intervalLabel: "Realtime (on-demand)",
    type: "api",
    icon: ShieldAlert,
    category: "detect",
    edgeFn: "report-impersonator",
  },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof Rss; color: string }> = {
  detect: { label: "Detect", icon: Search, color: "text-amber-500" },
  respond: { label: "Respond", icon: Gavel, color: "text-blue-400" },
  monitor: { label: "Monitor", icon: Eye, color: "text-emerald-400" },
  analyze: { label: "Analyze", icon: TrendingUp, color: "text-violet-400" },
};

export function Imprsn8DataFeeds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [runningFeeds, setRunningFeeds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Fetch recent agent runs for ALL imprsn8 agent types
  const { data: agentRuns = [], isLoading: loadingRuns, refetch: refetchRuns } = useQuery({
    queryKey: ["imprsn8-all-agent-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .in("agent_type", AGENT_TYPES)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  // Stats
  const { data: reportStats } = useQuery({
    queryKey: ["imprsn8-report-stats"],
    queryFn: async () => {
      const [totalRes, newRes, todayRes] = await Promise.all([
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true }),
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true }).in("status", ["new", "pending"]),
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true })
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      return { total: totalRes.count ?? 0, pending: newRes.count ?? 0, today: todayRes.count ?? 0 };
    },
    refetchInterval: 30000,
  });

  const { data: accountCount } = useQuery({
    queryKey: ["imprsn8-account-count"],
    queryFn: async () => {
      const { count } = await supabase.from("monitored_accounts").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const triggerFeed = async (feed: Imprsn8Feed) => {
    setRunningFeeds((prev) => new Set(prev).add(feed.id));
    setResults((prev) => ({ ...prev, [feed.id]: undefined as any }));
    try {
      const { data, error } = await supabase.functions.invoke(feed.edgeFn, {
        body: { ...feed.body, trigger_type: "manual" },
      });
      if (error) throw error;
      const msg = data?.summary || data?.message || `Processed ${data?.processed ?? 0}, flagged ${data?.flagged ?? 0}`;
      setResults((prev) => ({ ...prev, [feed.id]: { success: true, message: msg } }));
      toast({ title: `${feed.name} complete`, description: msg });
      refetchRuns();
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      setResults((prev) => ({ ...prev, [feed.id]: { success: false, message: msg } }));
      toast({ title: `${feed.name} failed`, description: msg, variant: "destructive" });
    } finally {
      setRunningFeeds((prev) => { const next = new Set(prev); next.delete(feed.id); return next; });
    }
  };

  const runAll = async () => {
    for (const feed of IMPRSN8_FEEDS.filter(f => f.type === "auto")) {
      await triggerFeed(feed);
    }
  };

  // Find latest run for a feed
  const getLatestRun = (feed: Imprsn8Feed) => {
    if (!feed.agentType) return null;
    return agentRuns.find((r: any) => {
      if (r.agent_type !== feed.agentType) return false;
      // For scanner sub-strategies, match input_params
      if (feed.agentType === "imprsn8_scanner" && feed.body?.scan_type) {
        return (r.input_params as any)?.scan_type === feed.body.scan_type;
      }
      return true;
    }) || null;
  };

  const completedRuns = agentRuns.filter((r: any) => r.status === "completed").length;
  const failedRuns = agentRuns.filter((r: any) => r.status === "failed").length;

  const renderFeedCard = (feed: Imprsn8Feed) => {
    const isRunning = runningFeeds.has(feed.id);
    const result = results[feed.id];
    const latestRun = getLatestRun(feed);
    const lastStatus = latestRun?.status;
    const lastTime = latestRun?.completed_at || latestRun?.started_at;
    const isSuccess = lastStatus === "completed";
    const isFailed = lastStatus === "failed";
    const isActive = lastStatus === "running";

    return (
      <div key={feed.id} className="flex items-center gap-3 bg-background rounded-lg border border-border px-3 py-3">
        <div className="shrink-0">
          {isActive ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> :
           isSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
           isFailed ? <X className="w-4 h-4 text-destructive" /> :
           lastStatus ? <Clock className="w-4 h-4 text-yellow-400" /> :
           <div className="w-4 h-4 rounded-full border-2 border-border" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <feed.icon className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-foreground">{feed.name}</p>
            <Badge variant="default" className="text-[8px] px-1.5 py-0 h-3.5 bg-amber-500/20 text-amber-500 border-amber-500/30">
              <RefreshCw className="w-2 h-2 mr-0.5" />{feed.intervalLabel}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{feed.description}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-muted-foreground/20 text-muted-foreground">
              {feed.provider}
            </Badge>
            {lastTime && (
              <p className="text-[9px] text-muted-foreground/60">
                Last run {formatDistanceToNow(new Date(lastTime), { addSuffix: true })}
              </p>
            )}
            {latestRun?.items_processed != null && latestRun.items_processed > 0 && (
              <p className="text-[9px] text-muted-foreground/60">· {latestRun.items_processed} processed</p>
            )}
            {latestRun?.items_flagged != null && latestRun.items_flagged > 0 && (
              <p className="text-[9px] text-amber-500">· {latestRun.items_flagged} flagged</p>
            )}
          </div>
          {latestRun?.error_message && (
            <p className="text-[9px] text-destructive mt-0.5 truncate">{latestRun.error_message}</p>
          )}
          {result && (
            <p className={`text-[10px] mt-0.5 ${result.success ? "text-emerald-400" : "text-destructive"}`}>
              {result.message}
            </p>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          disabled={isRunning || feed.type === "api"}
          onClick={() => triggerFeed(feed)}
          className="shrink-0 h-8 w-8 p-0"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> :
           result?.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
           result && !result.success ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> :
           <Play className="w-3.5 h-3.5 text-muted-foreground" />}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Bot className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{IMPRSN8_FEEDS.filter(f => f.type === "auto").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Active Agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">{completedRuns}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Completed Runs</p>
            {failedRuns > 0 && (
              <Badge className="mt-1 text-[8px] bg-destructive/20 text-destructive border-destructive/30">
                {failedRuns} failed
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{accountCount ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Monitored Accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ShieldAlert className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{reportStats?.total ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total Detections</p>
            {(reportStats?.pending ?? 0) > 0 && (
              <Badge className="mt-1 text-[8px] bg-amber-500/20 text-amber-500 border-amber-500/30">
                {reportStats?.pending} pending
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-violet-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">{reportStats?.today ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Feed Cards by Category */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Rss className="w-5 h-5 text-amber-500" />imprsn8 AI Agents & Data Feeds
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={runAll}
              disabled={runningFeeds.size > 0}
              className="gap-1.5 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
            >
              <Zap className="w-3 h-3" />Run All Agents
            </Button>
          </div>
          <CardDescription className="text-xs">
            {IMPRSN8_FEEDS.filter(f => f.type === "auto").length} autonomous agents with rate-limited intervals to respect provider limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(["detect", "respond", "monitor", "analyze"] as const).map(cat => {
            const feeds = IMPRSN8_FEEDS.filter(f => f.category === cat && f.type === "auto");
            if (feeds.length === 0) return null;
            const catInfo = CATEGORY_LABELS[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <catInfo.icon className={`w-3.5 h-3.5 ${catInfo.color}`} />
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    {catInfo.label} ({feeds.length})
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {feeds.map(renderFeedCard)}
                </div>
              </div>
            );
          })}

          {/* API endpoints */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                API Endpoints ({IMPRSN8_FEEDS.filter(f => f.type === "api").length})
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {IMPRSN8_FEEDS.filter(f => f.type === "api").map(renderFeedCard)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Runs Log */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />Recent Agent Runs
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => refetchRuns()} className="h-7 text-xs gap-1">
              <RefreshCw className="w-3 h-3" />Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRuns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : agentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No agent runs yet. Click "Run All Agents" to start the detection pipeline.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {agentRuns.slice(0, 30).map((run: any) => (
                <div key={run.id} className="flex items-center gap-3 bg-background rounded-lg border border-border px-3 py-2">
                  <div className="shrink-0">
                    {run.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
                     run.status === "failed" ? <X className="w-3.5 h-3.5 text-destructive" /> :
                     run.status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> :
                     <Clock className="w-3.5 h-3.5 text-yellow-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground">
                        {run.agent_type?.replace(/_/g, " ")}
                      </p>
                      <Badge variant="outline" className="text-[8px] capitalize">{run.status}</Badge>
                      <Badge variant="outline" className="text-[8px]">{run.trigger_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</span>
                      {run.items_processed != null && <span>{run.items_processed} processed</span>}
                      {run.items_flagged != null && run.items_flagged > 0 && (
                        <span className="text-amber-500">{run.items_flagged} flagged</span>
                      )}
                    </div>
                    {run.error_message && <p className="text-[9px] text-destructive truncate">{run.error_message}</p>}
                    {run.summary && <p className="text-[9px] text-muted-foreground truncate">{run.summary}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
