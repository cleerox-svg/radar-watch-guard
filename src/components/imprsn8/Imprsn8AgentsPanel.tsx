/**
 * Imprsn8AgentsPanel.tsx — AI Agents monitoring tab.
 * Shows all 7 agents with health, last run, items processed/flagged, and manual trigger.
 * Visible to both influencers (their scope) and admins (all).
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useImprsn8 } from "./Imprsn8Context";
import {
  Bot, Play, CheckCircle2, AlertTriangle, Loader2, Clock,
  Search, Fingerprint, Link2, Gavel, Shield, Palette, HeartPulse,
  Eye, Users, Globe, RefreshCw, Zap, Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const AGENT_TYPES = [
  "imprsn8_scanner", "doppelganger_hunter", "deepfake_sentinel",
  "scam_link_detector", "takedown_orchestrator", "follower_shield",
  "brand_drift_monitor", "reputation_pulse", "cross_platform_discovery",
];

interface AgentDef {
  id: string;
  agentType: string;
  name: string;
  description: string;
  interval: string;
  icon: typeof Bot;
  category: "detect" | "respond" | "monitor" | "analyze";
  edgeFn: string;
  body?: Record<string, any>;
}

const AGENTS: AgentDef[] = [
  { id: "doppelganger", agentType: "doppelganger_hunter", name: "Doppelgänger Hunter", description: "Fuzzy username matching + visual profile comparison", interval: "6h", icon: Search, category: "detect", edgeFn: "agent-doppelganger-hunter" },
  { id: "deepfake", agentType: "deepfake_sentinel", name: "Deepfake Sentinel", description: "AI vision analysis for stolen/generated imagery", interval: "12h", icon: Fingerprint, category: "detect", edgeFn: "agent-deepfake-sentinel" },
  { id: "scam_link", agentType: "scam_link_detector", name: "Scam Link Detector", description: "Phishing, crypto scams & malicious link detection", interval: "4h", icon: Link2, category: "detect", edgeFn: "agent-scam-link-detector" },
  { id: "scanner_var", agentType: "imprsn8_scanner", name: "Username Scanner", description: "Core typosquat handle generator + Firecrawl verification", interval: "6h", icon: Eye, category: "detect", edgeFn: "agent-imprsn8-scanner", body: { scan_type: "variations_only" } },
  { id: "takedown", agentType: "takedown_orchestrator", name: "Takedown Orchestrator", description: "DMCA generation, SLA tracking, escalation with HITL", interval: "1h", icon: Gavel, category: "respond", edgeFn: "agent-takedown-orchestrator" },
  { id: "follower", agentType: "follower_shield", name: "Follower Shield", description: "At-risk victim exposure estimation via follower analysis", interval: "12h", icon: Shield, category: "monitor", edgeFn: "agent-follower-shield" },
  { id: "brand_drift", agentType: "brand_drift_monitor", name: "Brand Drift Monitor", description: "Unauthorized brand asset usage on web", interval: "24h", icon: Palette, category: "monitor", edgeFn: "agent-brand-drift-monitor" },
  { id: "reputation", agentType: "reputation_pulse", name: "Reputation Pulse", description: "Daily risk score aggregation per influencer", interval: "24h", icon: HeartPulse, category: "analyze", edgeFn: "agent-reputation-pulse" },
  { id: "cross_platform", agentType: "cross_platform_discovery", name: "Cross-Platform Discovery", description: "Finds same-person accounts across social platforms for monitoring", interval: "7d", icon: Globe, category: "detect", edgeFn: "agent-cross-platform-discovery" },
];

const catColors: Record<string, string> = {
  detect: "text-amber-500",
  respond: "text-blue-400",
  monitor: "text-emerald-400",
  analyze: "text-violet-400",
};

export function Imprsn8AgentsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdminView } = useImprsn8();
  const [running, setRunning] = useState<Set<string>>(new Set());

  const { data: agentRuns = [], refetch } = useQuery({
    queryKey: ["imprsn8-agent-runs"],
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

  const triggerAgent = async (agent: AgentDef) => {
    setRunning((prev) => new Set(prev).add(agent.id));
    try {
      const { data, error } = await supabase.functions.invoke(agent.edgeFn, {
        body: { ...agent.body, trigger_type: "manual" },
      });
      if (error) throw error;
      toast({ title: `${agent.name} complete`, description: data?.summary || `Processed ${data?.processed ?? 0}, flagged ${data?.flagged ?? 0}` });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: `${agent.name} failed`, description: msg, variant: "destructive" });
    } finally {
      setRunning((prev) => { const n = new Set(prev); n.delete(agent.id); return n; });
    }
  };

  const getLatestRun = (agent: AgentDef) => {
    return agentRuns.find((r: any) => {
      if (r.agent_type !== agent.agentType) return false;
      if (agent.agentType === "imprsn8_scanner" && agent.body?.scan_type) {
        return (r.input_params as any)?.scan_type === agent.body.scan_type;
      }
      return true;
    }) || null;
  };

  const totalCompleted = agentRuns.filter((r: any) => r.status === "completed").length;
  const totalFlagged = agentRuns.reduce((sum: number, r: any) => sum + (r.items_flagged ?? 0), 0);

  const runAll = async () => {
    for (const agent of AGENTS) {
      await triggerAgent(agent);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <Bot className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{AGENTS.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Active Agents</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Activity className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
          <p className="text-2xl font-bold">{totalCompleted}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Completed Runs</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{totalFlagged}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Items Flagged</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          {isAdminView && (
            <Button size="sm" variant="outline" onClick={runAll} disabled={running.size > 0}
              className="gap-1.5 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 w-full">
              <Zap className="w-3 h-3" /> Run All Agents
            </Button>
          )}
        </CardContent></Card>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {AGENTS.map((agent) => {
          const isRunning = running.has(agent.id);
          const latest = getLatestRun(agent);
          const lastTime = latest?.completed_at || latest?.started_at;

          return (
            <Card key={agent.id} className="hover:border-amber-500/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <agent.icon className={`w-4 h-4 ${catColors[agent.category]}`} />
                      <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                      <Badge variant="outline" className="text-[8px] uppercase">{agent.category}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{agent.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5" /> {agent.interval}
                      </span>
                      {latest && (
                        <>
                          <Badge variant="outline" className={`text-[8px] ${latest.status === "completed" ? "border-emerald-500/30 text-emerald-500" : latest.status === "failed" ? "border-red-500/30 text-red-500" : "border-amber-500/30 text-amber-500"}`}>
                            {latest.status}
                          </Badge>
                          {lastTime && (
                            <span>{formatDistanceToNow(new Date(lastTime), { addSuffix: true })}</span>
                          )}
                          {latest.items_processed > 0 && <span>{latest.items_processed} processed</span>}
                          {latest.items_flagged > 0 && <span className="text-amber-500">{latest.items_flagged} flagged</span>}
                        </>
                      )}
                      {!latest && <span className="text-muted-foreground/50">Never run</span>}
                    </div>
                    {latest?.error_message && (
                      <p className="text-[10px] text-destructive mt-1 truncate">{latest.error_message}</p>
                    )}
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    disabled={isRunning}
                    onClick={() => triggerAgent(agent)}
                    className="shrink-0 h-8 w-8 p-0"
                  >
                    {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> : <Play className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Runs Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Agent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {agentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No runs recorded yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {agentRuns.slice(0, 20).map((run: any) => (
                <div key={run.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/30 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={`text-[8px] ${run.status === "completed" ? "border-emerald-500/30 text-emerald-500" : run.status === "failed" ? "border-red-500/30 text-red-500" : ""}`}>
                      {run.status}
                    </Badge>
                    <span className="font-medium truncate">{run.agent_type.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{run.trigger_type}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                    {run.items_flagged > 0 && <span className="text-amber-500">{run.items_flagged}⚑</span>}
                    <span>{formatDistanceToNow(new Date(run.completed_at || run.created_at), { addSuffix: true })}</span>
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
