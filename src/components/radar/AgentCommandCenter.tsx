/**
 * AgentCommandCenter.tsx — Full-screen dashboard for all 5 AI agents
 * with real-time status, run history, manual triggers, and config.
 */

import { useState, useEffect, useCallback } from "react";
import { Bot, Play, Clock, CheckCircle2, XCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, Target, Search, Shield, BarChart3, MessageSquare, Zap, History, AlertTriangle, Gavel, Fingerprint, Camera, Network, TrendingDown, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import { AgentApprovalQueue } from "./AgentApprovalQueue";

type AgentType = "triage" | "hunt" | "response" | "intel" | "copilot" | "takedown" | "impersonation" | "evidence" | "campaign" | "trust_monitor" | "abuse_mailbox";

interface AgentRun {
  id: string;
  agent_type: string;
  status: string;
  trigger_type: string;
  summary: string | null;
  items_processed: number;
  items_flagged: number;
  results: any;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  icon: typeof Bot;
  accent: string;
  bgAccent: string;
  functionName: string;
}

const AGENTS: AgentConfig[] = [
  {
    type: "triage",
    name: "Triage Agent",
    description: "Auto-classifies, deduplicates, and prioritizes incoming threats from the last 24 hours.",
    icon: Target,
    accent: "text-cyan-500",
    bgAccent: "bg-cyan-500/10 border-cyan-500/20",
    functionName: "agent-triage",
  },
  {
    type: "hunt",
    name: "Threat Hunt Agent",
    description: "Proactively correlates across all feeds to find campaign clusters and infrastructure overlaps.",
    icon: Search,
    accent: "text-amber-500",
    bgAccent: "bg-amber-500/10 border-amber-500/20",
    functionName: "agent-hunt",
  },
  {
    type: "response",
    name: "Response Agent",
    description: "Auto-drafts takedown notices, suggests erasure actions, and recommends MITRE-aligned mitigations.",
    icon: Shield,
    accent: "text-rose-500",
    bgAccent: "bg-rose-500/10 border-rose-500/20",
    functionName: "agent-response",
  },
  {
    type: "intel",
    name: "Executive Intel Agent",
    description: "Generates C-suite briefings, brand risk scorecards, and threat trend forecasts.",
    icon: BarChart3,
    accent: "text-violet-500",
    bgAccent: "bg-violet-500/10 border-violet-500/20",
    functionName: "agent-intel",
  },
  {
    type: "copilot",
    name: "Chat Copilot",
    description: "Enhanced AI chat with tool-calling — queries DB, creates tickets, generates bulletins from conversation.",
    icon: MessageSquare,
    accent: "text-emerald-500",
    bgAccent: "bg-emerald-500/10 border-emerald-500/20",
    functionName: "agent-copilot",
  },
  {
    type: "takedown",
    name: "Takedown Orchestrator",
    description: "Detects impersonating domains, drafts abuse notices, and queues takedown actions for approval.",
    icon: Gavel,
    accent: "text-red-500",
    bgAccent: "bg-red-500/10 border-red-500/20",
    functionName: "agent-takedown",
  },
  {
    type: "impersonation",
    name: "Impersonation Detector",
    description: "Monitors CertStream + social feeds for lookalike domains and fake profiles. Flags for analyst confirmation.",
    icon: Fingerprint,
    accent: "text-fuchsia-500",
    bgAccent: "bg-fuchsia-500/10 border-fuchsia-500/20",
    functionName: "agent-impersonation",
  },
  {
    type: "evidence",
    name: "Evidence Preservation",
    description: "Auto-captures DNS, WHOIS, SSL, and HTTP data for high-confidence threats before sites go dark.",
    icon: Camera,
    accent: "text-sky-500",
    bgAccent: "bg-sky-500/10 border-sky-500/20",
    functionName: "agent-evidence",
  },
  {
    type: "campaign",
    name: "Campaign Correlator",
    description: "Clusters threats by shared infrastructure (IP, ASN, registrar) to identify coordinated fraud campaigns.",
    icon: Network,
    accent: "text-indigo-500",
    bgAccent: "bg-indigo-500/10 border-indigo-500/20",
    functionName: "agent-campaign",
  },
  {
    type: "trust_monitor",
    name: "Trust Score Monitor",
    description: "Continuously recalculates brand trust scores and alerts on significant drops (>10 points).",
    icon: TrendingDown,
    accent: "text-teal-500",
    bgAccent: "bg-teal-500/10 border-teal-500/20",
    functionName: "agent-trust-monitor",
  },
  {
    type: "abuse_mailbox",
    name: "Abuse Mailbox Triage",
    description: "Processes reported phishing emails, extracts IOCs, cross-references threat DB, classifies for analyst review.",
    icon: Inbox,
    accent: "text-orange-400",
    bgAccent: "bg-orange-400/10 border-orange-400/20",
    functionName: "agent-abuse-mailbox",
  },
];

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
  running: { icon: Loader2, color: "text-primary", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
};

export function AgentCommandCenter() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [triggeringAgent, setTriggeringAgent] = useState<AgentType | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRuns = useCallback(async () => {
    const { data } = await supabase
      .from("agent_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setRuns(data as AgentRun[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRuns();
    // Realtime subscription
    const channel = supabase
      .channel("agent-runs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, () => {
        loadRuns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRuns]);

  const triggerAgent = async (agent: AgentConfig) => {
    setTriggeringAgent(agent.type);
    try {
      // Create run record first
      const { data: run, error: insertErr } = await supabase
        .from("agent_runs")
        .insert({ agent_type: agent.type, trigger_type: "manual", status: "pending", created_by: (await supabase.auth.getUser()).data.user?.id })
        .select()
        .single();

      if (insertErr || !run) throw new Error(insertErr?.message || "Failed to create run");

      // Invoke the edge function
      const body: any = { run_id: run.id };
      // Copilot needs extra params for demo
      if (agent.type === "copilot") {
        body.action = "query_threats";
        body.params = { severity: "critical", limit: 10 };
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${agent.functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      toast.success(`${agent.name} triggered successfully`);
    } catch (e: any) {
      toast.error(`Failed to trigger ${agent.name}`, { description: e.message });
    } finally {
      setTriggeringAgent(null);
    }
  };

  const getAgentRuns = (type: AgentType) => runs.filter(r => r.agent_type === type);
  const getLastRun = (type: AgentType) => getAgentRuns(type)[0] || null;

  const getGlobalStats = () => {
    const last24h = runs.filter(r => new Date(r.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000));
    return {
      totalRuns: last24h.length,
      completed: last24h.filter(r => r.status === "completed").length,
      failed: last24h.filter(r => r.status === "failed").length,
      running: runs.filter(r => r.status === "running").length,
      totalFlagged: last24h.reduce((acc, r) => acc + (r.items_flagged || 0), 0),
    };
  };

  const stats = getGlobalStats();

  return (
    <div className="space-y-8">
      {/* Approval Queue — Human-in-the-Loop */}
      <AgentApprovalQueue />

      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Runs (24h)", value: stats.totalRuns, icon: Zap, color: "text-primary" },
          { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-destructive" },
          { label: "Running", value: stats.running, icon: Loader2, color: "text-amber-500" },
          { label: "Items Flagged", value: stats.totalFlagged, icon: AlertTriangle, color: "text-rose-500" },
        ].map((s, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={cn("w-5 h-5 shrink-0", s.color)} />
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Cards */}
      <div className="space-y-3">
        {AGENTS.map((agent) => {
          const lastRun = getLastRun(agent.type);
          const agentRuns = getAgentRuns(agent.type);
          const isExpanded = expandedAgent === agent.type;
          const isTriggering = triggeringAgent === agent.type;
          const isRunning = lastRun?.status === "running";
          const StatusIcon = lastRun ? statusConfig[lastRun.status]?.icon || Clock : Clock;

          return (
            <Card key={agent.type} className={cn("border transition-all", isExpanded ? agent.bgAccent : "border-border/50 hover:border-border")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border", agent.bgAccent)}>
                      <agent.icon className={cn("w-5 h-5", agent.accent)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm font-bold">{agent.name}</CardTitle>
                        {lastRun && (
                          <Badge variant="outline" className={cn("text-[10px] gap-1", statusConfig[lastRun.status]?.color)}>
                            <StatusIcon className={cn("w-3 h-3", lastRun.status === "running" && "animate-spin")} />
                            {statusConfig[lastRun.status]?.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                      {lastRun && (
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                          Last run: {formatDistanceToNow(new Date(lastRun.created_at), { addSuffix: true })}
                          {lastRun.items_processed > 0 && ` · ${lastRun.items_processed} processed`}
                          {lastRun.items_flagged > 0 && ` · ${lastRun.items_flagged} flagged`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isTriggering || isRunning}
                      onClick={() => triggerAgent(agent)}
                      className="gap-1.5 text-xs"
                    >
                      {isTriggering || isRunning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {isTriggering ? "Starting…" : isRunning ? "Running…" : "Run"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedAgent(isExpanded ? null : agent.type)}
                      className="px-2"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-3">
                  {/* Last run summary */}
                  {lastRun?.summary && (
                    <div className="bg-background/50 rounded-lg p-3 border border-border/50">
                      <p className="text-xs font-medium text-foreground mb-1">Latest Result</p>
                      <p className="text-xs text-muted-foreground">{lastRun.summary}</p>
                    </div>
                  )}

                  {/* Run History */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <History className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-foreground">Run History ({agentRuns.length})</p>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-cyber">
                      {agentRuns.length === 0 && (
                        <p className="text-xs text-muted-foreground italic py-2">No runs yet. Click "Run" to start.</p>
                      )}
                      {agentRuns.slice(0, 10).map((run) => {
                        const RunStatusIcon = statusConfig[run.status]?.icon || Clock;
                        const isRunExpanded = expandedRun === run.id;
                        return (
                          <div key={run.id} className="border border-border/30 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedRun(isRunExpanded ? null : run.id)}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/30 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <RunStatusIcon className={cn("w-3.5 h-3.5 shrink-0", statusConfig[run.status]?.color, run.status === "running" && "animate-spin")} />
                                <span className="text-xs text-foreground truncate">{run.summary || run.status}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-[10px]">{run.trigger_type}</Badge>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                                </span>
                                {isRunExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </div>
                            </button>
                            {isRunExpanded && run.results && (
                              <div className="px-3 pb-3 border-t border-border/20">
                                <div className="mt-2 bg-background rounded p-3 overflow-auto max-h-80">
                                  <RunResultsView agentType={agent.type} results={run.results} />
                                </div>
                                {run.error_message && (
                                  <p className="text-xs text-destructive mt-2">Error: {run.error_message}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** Renders agent-specific results nicely */
function RunResultsView({ agentType, results }: { agentType: string; results: any }) {
  if (!results || Object.keys(results).length === 0) {
    return <p className="text-xs text-muted-foreground italic">No detailed results.</p>;
  }

  if (agentType === "triage") {
    return (
      <div className="space-y-3">
        {results.stats && (
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(results.stats).map(([k, v]) => (
              <div key={k} className="text-center">
                <p className="text-lg font-bold text-foreground">{String(v)}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        )}
        {results.priority_queue?.slice(0, 10).map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs border-b border-border/20 pb-1.5">
            <Badge variant={item.action === 'escalate' ? 'destructive' : 'outline'} className="text-[10px]">{item.action}</Badge>
            <span className="font-mono text-foreground">{item.domain}</span>
            <span className="text-muted-foreground">→ {item.brand}</span>
            <Badge variant="outline" className="text-[10px] ml-auto">{item.recommended_severity}</Badge>
          </div>
        ))}
        {results.duplicates_found?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Duplicates Found: {results.duplicates_found.length}</p>
            {results.duplicates_found.slice(0, 5).map((d: any, i: number) => (
              <p key={i} className="text-[11px] text-muted-foreground">{d.group?.join(', ')} — {d.reason}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (agentType === "hunt") {
    return (
      <div className="space-y-3">
        {results.campaigns?.map((c: any, i: number) => (
          <div key={i} className="border border-border/30 rounded p-2">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px]">{c.confidence}</Badge>
              <span className="text-xs font-medium text-foreground">{c.name}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{c.infrastructure_pattern}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Brands: {c.brands_targeted?.join(', ')}</p>
            <p className="text-[11px] text-primary mt-1">→ {c.recommendation}</p>
          </div>
        ))}
        {results.emerging_patterns?.map((p: any, i: number) => (
          <div key={i} className="text-xs">
            <Badge variant={p.risk_level === 'critical' ? 'destructive' : 'outline'} className="text-[10px] mr-2">{p.risk_level}</Badge>
            <span className="text-foreground">{p.pattern}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">{p.evidence}</p>
          </div>
        ))}
      </div>
    );
  }

  if (agentType === "response") {
    return (
      <div className="space-y-3">
        {results.response_plans?.slice(0, 5).map((plan: any, i: number) => (
          <div key={i} className="border border-border/30 rounded p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-[10px]">{plan.severity}</Badge>
              <span className="text-xs font-mono text-foreground">{plan.domain}</span>
              <span className="text-xs text-muted-foreground">({plan.brand})</span>
            </div>
            {plan.suggested_erasure_actions?.map((a: any, j: number) => (
              <p key={j} className="text-[11px] text-muted-foreground">• {a.action} → {a.provider} ({a.priority})</p>
            ))}
            {plan.takedown_notice && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-primary">View takedown notice</summary>
                <pre className="mt-1 p-2 bg-muted/50 rounded text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto">{plan.takedown_notice}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (agentType === "intel") {
    return (
      <div className="space-y-3">
        {results.risk_score !== undefined && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className={cn("text-3xl font-bold", results.risk_score > 70 ? "text-destructive" : results.risk_score > 40 ? "text-amber-500" : "text-emerald-500")}>
                {results.risk_score}
              </p>
              <p className="text-[10px] text-muted-foreground">RISK SCORE</p>
            </div>
            {results.risk_trend && (
              <Badge variant="outline" className="text-[10px]">{results.risk_trend}</Badge>
            )}
          </div>
        )}
        {results.executive_summary && (
          <p className="text-xs text-foreground">{results.executive_summary}</p>
        )}
        {results.brand_scorecards?.slice(0, 5).map((b: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs border-b border-border/20 pb-1">
            <span className="font-medium">{b.brand}</span>
            <div className="flex items-center gap-2">
              <span className={cn("font-mono", b.risk_score > 70 ? "text-destructive" : "text-muted-foreground")}>{b.risk_score}/100</span>
              <Badge variant="outline" className="text-[10px]">{b.trend}</Badge>
            </div>
          </div>
        ))}
        {results.top_recommendations?.slice(0, 3).map((r: any, i: number) => (
          <div key={i} className="text-xs">
            <span className="font-medium text-primary">#{r.priority}</span> {r.action}
            <span className="text-muted-foreground ml-1">({r.effort} effort)</span>
          </div>
        ))}
        {results.talking_points?.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1">Board Talking Points:</p>
            {results.talking_points.map((tp: string, i: number) => (
              <p key={i} className="text-[11px] text-muted-foreground">• {tp}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (agentType === "copilot") {
    return (
      <div className="space-y-2">
        <Badge variant="outline" className="text-[10px]">{results.type}</Badge>
        {results.bulletin && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
            <ReactMarkdown>{results.bulletin}</ReactMarkdown>
          </div>
        )}
        {results.data && (
          <p className="text-xs text-muted-foreground">{results.count} results returned</p>
        )}
        {results.ticket && (
          <p className="text-xs text-emerald-500">Ticket created: {results.ticket.ticket_id}</p>
        )}
        {results.error && (
          <p className="text-xs text-destructive">{results.error}</p>
        )}
      </div>
    );
  }

  // Fallback: render raw JSON
  return <pre className="text-[10px] font-mono whitespace-pre-wrap text-muted-foreground">{JSON.stringify(results, null, 2)}</pre>;
}
