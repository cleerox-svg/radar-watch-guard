/**
 * AgentCommandCenter.tsx — Redesigned agent hub with categorized agents,
 * rich result rendering, and integrated approval queue.
 */

import { useState, useEffect, useCallback } from "react";
import { Bot, Play, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Target, Search, Shield, BarChart3, MessageSquare, Zap, AlertTriangle, Gavel, Fingerprint, Camera, Network, TrendingDown, Inbox, Activity, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  shortName: string;
  description: string;
  icon: typeof Bot;
  accent: string;
  bgAccent: string;
  functionName: string;
  category: "detect" | "respond" | "monitor" | "analyze";
}

const AGENTS: AgentConfig[] = [
  // Detect
  { type: "triage", name: "Triage Agent", shortName: "Triage", description: "Auto-classifies and prioritizes incoming threats", icon: Target, accent: "text-cyan-500", bgAccent: "bg-cyan-500/10 border-cyan-500/20", functionName: "agent-triage", category: "detect" },
  { type: "impersonation", name: "Impersonation Detector", shortName: "Impersonation", description: "Monitors for lookalike domains and fake profiles", icon: Fingerprint, accent: "text-fuchsia-500", bgAccent: "bg-fuchsia-500/10 border-fuchsia-500/20", functionName: "agent-impersonation", category: "detect" },
  { type: "hunt", name: "Threat Hunter", shortName: "Hunt", description: "Correlates across feeds to find campaign clusters", icon: Search, accent: "text-amber-500", bgAccent: "bg-amber-500/10 border-amber-500/20", functionName: "agent-hunt", category: "detect" },
  // Respond
  { type: "takedown", name: "Takedown Orchestrator", shortName: "Takedown", description: "Drafts abuse notices and queues takedowns", icon: Gavel, accent: "text-red-500", bgAccent: "bg-red-500/10 border-red-500/20", functionName: "agent-takedown", category: "respond" },
  { type: "response", name: "Response Planner", shortName: "Response", description: "Auto-drafts mitigations and erasure actions", icon: Shield, accent: "text-rose-500", bgAccent: "bg-rose-500/10 border-rose-500/20", functionName: "agent-response", category: "respond" },
  { type: "evidence", name: "Evidence Preservation", shortName: "Evidence", description: "Captures DNS, WHOIS, SSL before sites go dark", icon: Camera, accent: "text-sky-500", bgAccent: "bg-sky-500/10 border-sky-500/20", functionName: "agent-evidence", category: "respond" },
  // Monitor
  { type: "trust_monitor", name: "Trust Monitor", shortName: "Trust", description: "Tracks brand trust scores and alerts on drops", icon: TrendingDown, accent: "text-teal-500", bgAccent: "bg-teal-500/10 border-teal-500/20", functionName: "agent-trust-monitor", category: "monitor" },
  { type: "abuse_mailbox", name: "Abuse Mailbox", shortName: "Mailbox", description: "Triages phishing reports and extracts IOCs", icon: Inbox, accent: "text-orange-400", bgAccent: "bg-orange-400/10 border-orange-400/20", functionName: "agent-abuse-mailbox", category: "monitor" },
  { type: "campaign", name: "Campaign Correlator", shortName: "Campaigns", description: "Clusters threats by shared infrastructure", icon: Network, accent: "text-indigo-500", bgAccent: "bg-indigo-500/10 border-indigo-500/20", functionName: "agent-campaign", category: "monitor" },
  // Analyze
  { type: "intel", name: "Executive Intel", shortName: "Intel", description: "C-suite briefings and brand risk scorecards", icon: BarChart3, accent: "text-violet-500", bgAccent: "bg-violet-500/10 border-violet-500/20", functionName: "agent-intel", category: "analyze" },
  { type: "copilot", name: "TrustBot", shortName: "TrustBot", description: "Chat-driven DB queries and ticket creation", icon: MessageSquare, accent: "text-emerald-500", bgAccent: "bg-emerald-500/10 border-emerald-500/20", functionName: "agent-copilot", category: "analyze" },
];

const categoryConfig = {
  detect: { label: "Detect", color: "text-cyan-500", bg: "bg-cyan-500/5" },
  respond: { label: "Respond", color: "text-rose-500", bg: "bg-rose-500/5" },
  monitor: { label: "Monitor", color: "text-teal-500", bg: "bg-teal-500/5" },
  analyze: { label: "Analyze", color: "text-violet-500", bg: "bg-violet-500/5" },
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
  running: { icon: Loader2, color: "text-primary", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Done" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
};

export function AgentCommandCenter() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>(null);
  const [triggeringAgent, setTriggeringAgent] = useState<AgentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("approvals");

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
    const channel = supabase
      .channel("agent-runs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, () => loadRuns())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRuns]);

  const triggerAgent = async (agent: AgentConfig) => {
    setTriggeringAgent(agent.type);
    try {
      const { data: run, error: insertErr } = await supabase
        .from("agent_runs")
        .insert({ agent_type: agent.type, trigger_type: "manual", status: "pending", created_by: (await supabase.auth.getUser()).data.user?.id })
        .select()
        .single();
      if (insertErr || !run) throw new Error(insertErr?.message || "Failed to create run");

      const body: any = { run_id: run.id };
      if (agent.type === "copilot") { body.action = "query_threats"; body.params = { severity: "critical", limit: 10 }; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${agent.functionName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `HTTP ${resp.status}`); }
      toast.success(`${agent.name} triggered`);
    } catch (e: any) {
      toast.error(`Failed: ${agent.name}`, { description: e.message });
    } finally {
      setTriggeringAgent(null);
    }
  };

  const getAgentRuns = (type: AgentType) => runs.filter(r => r.agent_type === type);
  const getLastRun = (type: AgentType) => getAgentRuns(type)[0] || null;

  const stats = (() => {
    const last24h = runs.filter(r => new Date(r.created_at) > new Date(Date.now() - 86400000));
    return {
      totalRuns: last24h.length,
      completed: last24h.filter(r => r.status === "completed").length,
      failed: last24h.filter(r => r.status === "failed").length,
      running: runs.filter(r => r.status === "running").length,
      flagged: last24h.reduce((a, r) => a + (r.items_flagged || 0), 0),
    };
  })();

  const categories = ["detect", "respond", "monitor", "analyze"] as const;

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Runs 24h", value: stats.totalRuns, color: "text-primary" },
          { label: "Completed", value: stats.completed, color: "text-emerald-500" },
          { label: "Failed", value: stats.failed, color: "text-destructive" },
          { label: "Active", value: stats.running, color: "text-amber-500" },
          { label: "Flagged", value: stats.flagged, color: "text-rose-500" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-mono uppercase mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab layout: Approvals vs Agents */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start bg-muted/30 border border-border/50">
          <TabsTrigger value="approvals" className="gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5" />
            Approval Queue
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5 text-xs">
            <Bot className="w-3.5 h-3.5" />
            All Agents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-4">
          <AgentApprovalQueue />
        </TabsContent>

        <TabsContent value="agents" className="mt-4 space-y-6">
          {categories.map(cat => {
            const catAgents = AGENTS.filter(a => a.category === cat);
            const cfg = categoryConfig[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("w-1.5 h-5 rounded-full", cfg.bg, "border", cfg.color.replace("text-", "border-"))} />
                  <h3 className={cn("text-xs font-bold uppercase tracking-wider", cfg.color)}>{cfg.label}</h3>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {catAgents.map(agent => (
                    <AgentCard
                      key={agent.type}
                      agent={agent}
                      lastRun={getLastRun(agent.type)}
                      allRuns={getAgentRuns(agent.type)}
                      isExpanded={expandedAgent === agent.type}
                      isTriggering={triggeringAgent === agent.type}
                      onToggle={() => setExpandedAgent(expandedAgent === agent.type ? null : agent.type)}
                      onTrigger={() => triggerAgent(agent)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Individual Agent Card ─────────────────────────── */

function AgentCard({
  agent, lastRun, allRuns, isExpanded, isTriggering, onToggle, onTrigger
}: {
  agent: AgentConfig;
  lastRun: AgentRun | null;
  allRuns: AgentRun[];
  isExpanded: boolean;
  isTriggering: boolean;
  onToggle: () => void;
  onTrigger: () => void;
}) {
  const isRunning = lastRun?.status === "running";
  const StatusIcon = lastRun ? statusConfig[lastRun.status]?.icon || Clock : Clock;

  return (
    <Card className={cn(
      "border transition-all overflow-hidden",
      isExpanded ? agent.bgAccent : "border-border/50 hover:border-border",
      isExpanded && "col-span-1 lg:col-span-2 xl:col-span-3"
    )}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border", agent.bgAccent)}>
            <agent.icon className={cn("w-4 h-4", agent.accent)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-sm font-bold text-foreground truncate">{agent.name}</h4>
              {lastRun && (
                <Badge variant="outline" className={cn("text-[9px] gap-0.5 px-1.5", statusConfig[lastRun.status]?.color)}>
                  <StatusIcon className={cn("w-2.5 h-2.5", lastRun.status === "running" && "animate-spin")} />
                  {statusConfig[lastRun.status]?.label}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{agent.description}</p>
            {lastRun && (
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-mono">
                <span>{formatDistanceToNow(new Date(lastRun.created_at), { addSuffix: true })}</span>
                {lastRun.items_processed > 0 && (
                  <span className="flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5" />
                    {lastRun.items_processed} processed
                  </span>
                )}
                {lastRun.items_flagged > 0 && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {lastRun.items_flagged} flagged
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="default"
              disabled={isTriggering || isRunning}
              onClick={onTrigger}
              className="h-8 px-3 text-xs gap-1"
            >
              {isTriggering || isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run
            </Button>
            <Button size="sm" variant="ghost" onClick={onToggle} className="h-8 w-8 p-0">
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/30 p-4 space-y-4 bg-muted/10">
          {/* Latest result */}
          {lastRun?.summary && (
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Latest Result</p>
              <p className="text-xs text-foreground leading-relaxed">{lastRun.summary}</p>
            </div>
          )}

          {/* Structured results */}
          {lastRun?.results && Object.keys(lastRun.results).length > 0 && (
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Details</p>
              <RunResultsView agentType={agent.type} results={lastRun.results} />
            </div>
          )}

          {/* Run history */}
          {allRuns.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">History ({allRuns.length})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-cyber">
                {allRuns.slice(0, 8).map(run => {
                  const RunIcon = statusConfig[run.status]?.icon || Clock;
                  return (
                    <div key={run.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/30 transition-colors text-xs">
                      <RunIcon className={cn("w-3 h-3 shrink-0", statusConfig[run.status]?.color, run.status === "running" && "animate-spin")} />
                      <span className="flex-1 truncate text-foreground">{run.summary || run.status}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">{run.trigger_type}</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {lastRun?.error_message && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs text-destructive">{lastRun.error_message}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Structured Results Renderer ─────────────────────── */

function RunResultsView({ agentType, results }: { agentType: string; results: any }) {
  if (!results || Object.keys(results).length === 0) {
    return <p className="text-xs text-muted-foreground italic">No detailed results.</p>;
  }

  // Triage
  if (agentType === "triage") {
    return (
      <div className="space-y-3">
        {results.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(results.stats).map(([k, v]) => (
              <div key={k} className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-foreground tabular-nums">{String(v)}</p>
                <p className="text-[9px] text-muted-foreground capitalize font-mono">{k.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        )}
        {results.priority_queue?.slice(0, 8).map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/20 last:border-0">
            <Badge variant={item.action === 'escalate' ? 'destructive' : 'outline'} className="text-[9px] w-16 justify-center">{item.action}</Badge>
            <span className="font-mono text-foreground flex-1 truncate">{item.domain}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">{item.brand}</span>
            <Badge variant="outline" className="text-[9px]">{item.recommended_severity}</Badge>
          </div>
        ))}
      </div>
    );
  }

  // Hunt
  if (agentType === "hunt") {
    return (
      <div className="space-y-3">
        {results.campaigns?.map((c: any, i: number) => (
          <div key={i} className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className={cn("text-[9px]", c.confidence === "high" ? "text-emerald-500 border-emerald-500/30" : "")}>{c.confidence}</Badge>
              <span className="text-xs font-semibold text-foreground">{c.name}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{c.infrastructure_pattern}</p>
            {c.brands_targeted?.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {c.brands_targeted.map((b: string, j: number) => (
                  <Badge key={j} variant="secondary" className="text-[9px]">{b}</Badge>
                ))}
              </div>
            )}
            {c.recommendation && (
              <p className="text-[11px] text-primary mt-2 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> {c.recommendation}
              </p>
            )}
          </div>
        ))}
        {results.emerging_patterns?.map((p: any, i: number) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <Badge variant={p.risk_level === 'critical' ? 'destructive' : 'outline'} className="text-[9px] shrink-0 mt-0.5">{p.risk_level}</Badge>
            <div>
              <p className="text-foreground font-medium">{p.pattern}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{p.evidence}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Response
  if (agentType === "response") {
    return (
      <div className="space-y-3">
        {results.response_plans?.slice(0, 5).map((plan: any, i: number) => (
          <div key={i} className="bg-muted/20 rounded-lg p-3 border border-border/30 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-[9px]">{plan.severity}</Badge>
              <span className="text-xs font-mono text-foreground">{plan.domain}</span>
              <span className="text-[11px] text-muted-foreground">({plan.brand})</span>
            </div>
            {plan.suggested_erasure_actions?.map((a: any, j: number) => (
              <div key={j} className="flex items-center gap-2 text-[11px] text-muted-foreground ml-2">
                <ArrowRight className="w-2.5 h-2.5 text-primary shrink-0" />
                <span>{a.action}</span>
                <span className="text-muted-foreground/60">→ {a.provider}</span>
                <Badge variant="outline" className="text-[8px] ml-auto">{a.priority}</Badge>
              </div>
            ))}
            {plan.takedown_notice && (
              <details className="text-[11px] mt-1">
                <summary className="cursor-pointer text-primary hover:text-primary/80 transition-colors font-medium">View takedown notice</summary>
                <pre className="mt-2 p-3 bg-card rounded-lg text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto border border-border/30 text-muted-foreground">{plan.takedown_notice}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Intel
  if (agentType === "intel") {
    return (
      <div className="space-y-3">
        {results.risk_score !== undefined && (
          <div className="flex items-center gap-4 bg-muted/20 rounded-lg p-3">
            <div className="text-center">
              <p className={cn("text-3xl font-bold tabular-nums", results.risk_score > 70 ? "text-destructive" : results.risk_score > 40 ? "text-amber-500" : "text-emerald-500")}>
                {results.risk_score}
              </p>
              <p className="text-[9px] text-muted-foreground font-mono uppercase">Risk Score</p>
            </div>
            {results.risk_trend && <Badge variant="outline" className="text-[10px]">{results.risk_trend}</Badge>}
          </div>
        )}
        {results.executive_summary && (
          <p className="text-xs text-foreground leading-relaxed">{results.executive_summary}</p>
        )}
        {results.brand_scorecards?.slice(0, 5).map((b: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0">
            <span className="font-medium">{b.brand}</span>
            <div className="flex items-center gap-2">
              <span className={cn("font-mono tabular-nums", b.risk_score > 70 ? "text-destructive" : "text-muted-foreground")}>{b.risk_score}/100</span>
              <Badge variant="outline" className="text-[9px]">{b.trend}</Badge>
            </div>
          </div>
        ))}
        {results.top_recommendations?.slice(0, 3).map((r: any, i: number) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="text-primary font-bold shrink-0">#{r.priority}</span>
            <span className="text-foreground">{r.action}</span>
            <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{r.effort}</Badge>
          </div>
        ))}
        {results.talking_points?.length > 0 && (
          <div className="bg-muted/20 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Board Talking Points</p>
            {results.talking_points.map((tp: string, i: number) => (
              <p key={i} className="text-[11px] text-foreground leading-relaxed">• {tp}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Copilot
  if (agentType === "copilot") {
    return (
      <div className="space-y-2">
        <Badge variant="outline" className="text-[9px]">{results.type}</Badge>
        {results.bulletin && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
            <ReactMarkdown>{results.bulletin}</ReactMarkdown>
          </div>
        )}
        {results.data && <p className="text-xs text-muted-foreground">{results.count} results returned</p>}
        {results.ticket && <p className="text-xs text-emerald-500">Ticket created: {results.ticket.ticket_id}</p>}
        {results.error && <p className="text-xs text-destructive">{results.error}</p>}
      </div>
    );
  }

  // Fallback: render structured key-value pairs instead of raw JSON
  return (
    <div className="space-y-1.5">
      {Object.entries(results).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 text-xs">
          <span className="text-muted-foreground font-mono text-[10px] shrink-0 w-28 truncate">{key}</span>
          <span className="text-foreground break-all">
            {typeof value === "object" ? JSON.stringify(value, null, 1) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}