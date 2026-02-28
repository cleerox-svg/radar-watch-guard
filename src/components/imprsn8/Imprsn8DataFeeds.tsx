/**
 * Imprsn8DataFeeds.tsx — API & Data Feeds dashboard for imprsn8 admin panel.
 * Shows all scanner feeds, their pull intervals, last run status, and manual triggers.
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
  Activity, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Feed definitions for imprsn8 ───
interface Imprsn8Feed {
  id: string;
  name: string;
  description: string;
  provider: string;
  interval: string;
  intervalLabel: string;
  type: "auto" | "api" | "manual";
  icon: typeof Rss;
  triggerFn: (params?: any) => Promise<any>;
}

const IMPRSN8_FEEDS: Imprsn8Feed[] = [
  {
    id: "imprsn8_scanner_variations",
    name: "Username Variation Scanner",
    description: "AI generates typosquat handles, Firecrawl scrapes & verifies existence across platforms",
    provider: "Firecrawl + Lovable AI",
    interval: "0 */6 * * *",
    intervalLabel: "Every 6 hours",
    type: "auto",
    icon: Search,
    triggerFn: () => supabase.functions.invoke("agent-imprsn8-scanner", {
      body: { strategy: "username_variations" },
    }).then(r => { if (r.error) throw r.error; return r.data; }),
  },
  {
    id: "imprsn8_scanner_bio",
    name: "Bio & Content Matcher",
    description: "Scrapes verified profiles for baseline signatures, compares suspect profiles for similarity",
    provider: "Firecrawl + Lovable AI",
    interval: "0 */12 * * *",
    intervalLabel: "Every 12 hours",
    type: "auto",
    icon: Eye,
    triggerFn: () => supabase.functions.invoke("agent-imprsn8-scanner", {
      body: { strategy: "bio_matching" },
    }).then(r => { if (r.error) throw r.error; return r.data; }),
  },
  {
    id: "imprsn8_scanner_reports",
    name: "Follower Report Processor",
    description: "Picks up pending crowd-sourced reports and runs AI similarity analysis",
    provider: "Lovable AI",
    interval: "*/30 * * * *",
    intervalLabel: "Every 30 minutes",
    type: "auto",
    icon: Users,
    triggerFn: () => supabase.functions.invoke("agent-imprsn8-scanner", {
      body: { strategy: "follower_reports" },
    }).then(r => { if (r.error) throw r.error; return r.data; }),
  },
  {
    id: "imprsn8_scanner_sweep",
    name: "Full Platform Sweep",
    description: "Complete scan of all monitored accounts across all platforms with all strategies",
    provider: "Firecrawl + Lovable AI",
    interval: "0 0 */1 * *",
    intervalLabel: "Every 24 hours",
    type: "auto",
    icon: Globe,
    triggerFn: () => supabase.functions.invoke("agent-imprsn8-scanner", {
      body: { strategy: "full_sweep" },
    }).then(r => { if (r.error) throw r.error; return r.data; }),
  },
  {
    id: "imprsn8_report_widget",
    name: "Public Report Endpoint",
    description: "Unauthenticated API endpoint for follower-submitted impersonation sightings",
    provider: "Internal API",
    interval: "realtime",
    intervalLabel: "Realtime (on-demand)",
    type: "api",
    icon: ShieldAlert,
    triggerFn: () => Promise.resolve({ success: true, message: "Endpoint is always-on" }),
  },
];

export function Imprsn8DataFeeds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [runningFeeds, setRunningFeeds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Fetch recent scanner agent runs
  const { data: agentRuns = [], isLoading: loadingRuns, refetch: refetchRuns } = useQuery({
    queryKey: ["imprsn8-agent-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("agent_type", "imprsn8_scanner")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  // Fetch impersonation report counts for stats
  const { data: reportStats } = useQuery({
    queryKey: ["imprsn8-report-stats"],
    queryFn: async () => {
      const [totalRes, newRes, todayRes] = await Promise.all([
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true }),
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true })
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      return {
        total: totalRes.count ?? 0,
        pending: newRes.count ?? 0,
        today: todayRes.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch monitored account count
  const { data: accountCount } = useQuery({
    queryKey: ["imprsn8-account-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("monitored_accounts")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const runFeed = async (feed: Imprsn8Feed) => {
    setRunningFeeds((prev) => new Set(prev).add(feed.id));
    setResults((prev) => ({ ...prev, [feed.id]: undefined as any }));
    try {
      const data = await feed.triggerFn();
      const msg = data?.suspects_found != null
        ? `Found ${data.suspects_found} suspects across ${data.accounts_scanned ?? 0} accounts`
        : data?.reports_processed != null
        ? `Processed ${data.reports_processed} reports`
        : data?.message || "Completed successfully";
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
      await runFeed(feed);
    }
  };

  // Find the latest agent run matching a feed strategy
  const getLatestRun = (feedId: string) => {
    const strategyMap: Record<string, string> = {
      imprsn8_scanner_variations: "username_variations",
      imprsn8_scanner_bio: "bio_matching",
      imprsn8_scanner_reports: "follower_reports",
      imprsn8_scanner_sweep: "full_sweep",
    };
    const strategy = strategyMap[feedId];
    if (!strategy) return null;
    return agentRuns.find((r: any) => {
      const params = r.input_params as any;
      return params?.strategy === strategy;
    }) || (feedId === "imprsn8_scanner_sweep"
      ? agentRuns.find((r: any) => !(r.input_params as any)?.strategy)
      : null);
  };

  const renderFeedCard = (feed: Imprsn8Feed) => {
    const isRunning = runningFeeds.has(feed.id);
    const result = results[feed.id];
    const latestRun = getLatestRun(feed.id);
    const lastStatus = latestRun?.status;
    const lastTime = latestRun?.completed_at || latestRun?.started_at;
    const isSuccess = lastStatus === "completed";
    const isFailed = lastStatus === "failed";
    const isActive = lastStatus === "running";

    return (
      <div key={feed.id} className="flex items-center gap-3 bg-background rounded-lg border border-border px-3 py-3">
        {/* Status indicator */}
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
          onClick={() => runFeed(feed)}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Bot className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{agentRuns.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Scanner Runs</p>
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
                {reportStats?.pending} pending review
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{reportStats?.today ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Detections Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Feed Cards */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Rss className="w-5 h-5 text-amber-500" />imprsn8 Data Feeds & APIs
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={runAll}
              disabled={runningFeeds.size > 0}
              className="gap-1.5 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
            >
              <Zap className="w-3 h-3" />Run All Scanners
            </Button>
          </div>
          <CardDescription className="text-xs">
            Automated detection pipeline — Firecrawl scraping + AI analysis running on scheduled intervals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto feeds */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Automated Scanners ({IMPRSN8_FEEDS.filter(f => f.type === "auto").length})
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {IMPRSN8_FEEDS.filter(f => f.type === "auto").map(renderFeedCard)}
            </div>
          </div>

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
              <Clock className="w-4 h-4 text-amber-500" />Recent Scanner Runs
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
              No scanner runs yet. Click "Run All Scanners" to start.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {agentRuns.slice(0, 20).map((run: any) => (
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
                        {(run.input_params as any)?.strategy?.replace(/_/g, " ") || "Full scan"}
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
                    {run.error_message && (
                      <p className="text-[9px] text-destructive truncate">{run.error_message}</p>
                    )}
                    {run.summary && (
                      <p className="text-[9px] text-muted-foreground truncate">{run.summary}</p>
                    )}
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
