/**
 * ThreatBriefing.tsx — AI-powered threat intelligence briefing with actionable outcomes.
 *
 * Features:
 *   - Inline action buttons on campaigns and risks
 *   - Consolidated Action Playbook panel
 *   - Executable actions: create tickets, erasure requests, blocklist entries
 *   - Advisory actions: templates for law enforcement, abuse reports, ISAC sharing
 */

import { useState } from "react";
import {
  Brain,
  RefreshCw,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Target,
  Lightbulb,
  Clock,
  Zap,
  Eye,
  Activity,
  Database,
  Search,
  Send,
  ShieldBan,
  Bookmark,
  ExternalLink,
  FileText,
  Copy,
  CheckCircle2,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Campaign {
  name: string;
  description: string;
  domains_count: number;
  brands_targeted: string[];
  severity: string;
  recommendation: string;
}

interface Risk {
  title: string;
  detail: string;
  priority: "immediate" | "short_term" | "monitor";
  action: string;
}

interface Trend {
  observation: string;
  direction: "increasing" | "decreasing" | "stable";
  significance: string;
}

interface FeedHealth {
  healthy_feeds: number;
  stale_feeds: string[];
  recommendations: string[];
}

interface PlaybookAction {
  finding_ref: string;
  category: "investigate" | "escalate" | "defend" | "track";
  title: string;
  description: string;
  executable: boolean;
  action_type: string;
  action_data: {
    target: string;
    severity: string;
    template?: string;
  };
  urgency: "immediate" | "short_term" | "ongoing";
}

interface Briefing {
  executive_summary: string;
  campaigns: Campaign[];
  top_risks: Risk[];
  trends: Trend[];
  feed_health?: FeedHealth;
  recommendations: string[];
  action_playbook?: PlaybookAction[];
}

interface BriefingResponse {
  success: boolean;
  briefing: Briefing;
  data_summary: {
    threats_analyzed: number;
    news_analyzed: number;
    metrics_analyzed: number;
    social_iocs_analyzed?: number;
    ato_events_analyzed?: number;
    breach_checks_analyzed?: number;
    tor_nodes_tracked?: number;
    erasure_actions_analyzed?: number;
  };
  generated_at: string;
  error?: string;
}

const severityStyles: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/70 text-destructive-foreground",
  medium: "bg-warning/20 text-warning border border-warning/30",
  low: "bg-muted text-muted-foreground",
};

const priorityConfig: Record<string, { icon: typeof Zap; label: string; className: string }> = {
  immediate: { icon: Zap, label: "IMMEDIATE", className: "text-destructive" },
  short_term: { icon: Clock, label: "SHORT TERM", className: "text-warning" },
  monitor: { icon: Eye, label: "MONITOR", className: "text-muted-foreground" },
};

const trendIcons: Record<string, typeof TrendingUp> = {
  increasing: TrendingUp,
  decreasing: TrendingDown,
  stable: Minus,
};

const categoryConfig: Record<string, { icon: typeof Search; label: string; color: string }> = {
  investigate: { icon: Search, label: "Investigate", color: "text-primary" },
  escalate: { icon: Send, label: "Escalate", color: "text-destructive" },
  defend: { icon: ShieldBan, label: "Defend", color: "text-warning" },
  track: { icon: Bookmark, label: "Track", color: "text-muted-foreground" },
};

const urgencyStyles: Record<string, string> = {
  immediate: "border-destructive/30 bg-destructive/5",
  short_term: "border-warning/30 bg-warning/5",
  ongoing: "border-border bg-background/50",
};

// --- Inline Action Buttons for campaigns/risks ---
function InlineActions({ findingName, actions, onExecute }: {
  findingName: string;
  actions: PlaybookAction[];
  onExecute: (action: PlaybookAction) => void;
}) {
  const related = actions.filter(a =>
    a.finding_ref?.toLowerCase().includes(findingName?.toLowerCase()?.slice(0, 20))
  );
  if (related.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
      {related.slice(0, 4).map((action, i) => {
        const cat = categoryConfig[action.category] || categoryConfig.investigate;
        const CatIcon = cat.icon;
        return (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className={cn("h-6 text-[10px] gap-1 px-2", cat.color)}
            onClick={() => onExecute(action)}
          >
            <CatIcon className="w-3 h-3" />
            {action.title.length > 30 ? action.title.slice(0, 28) + "…" : action.title}
            {action.executable && <Play className="w-2.5 h-2.5 ml-0.5" />}
          </Button>
        );
      })}
    </div>
  );
}

// --- Template Viewer for advisory actions ---
function TemplateViewer({ template, title }: { template: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(template);
    setCopied(true);
    toast.success("Template copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <FileText className="w-3 h-3" /> {title}
        </span>
        <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1.5" onClick={handleCopy}>
          {copied ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">
        {template}
      </pre>
    </div>
  );
}

export function ThreatBriefing() {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set());
  const [executingAction, setExecutingAction] = useState<number | null>(null);
  const [playbookFilter, setPlaybookFilter] = useState<string>("all");

  const generateBriefing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("threat-briefing");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBriefing(data);
      toast.success("Intelligence briefing generated");
    } catch (err: any) {
      toast.error("Briefing generation failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (action: PlaybookAction, index: number) => {
    if (!action.executable) {
      // Advisory action — just toggle the template
      setExpandedActions(prev => {
        const next = new Set(prev);
        next.has(index) ? next.delete(index) : next.add(index);
        return next;
      });
      return;
    }

    setExecutingAction(index);
    try {
      switch (action.action_type) {
        case "open_ticket": {
          const { error } = await supabase.from("investigation_tickets").insert({
            title: action.title,
            description: `${action.description}\n\nTarget: ${action.action_data.target}`,
            severity: action.action_data.severity || "medium",
            priority: action.urgency === "immediate" ? "critical" : action.urgency === "short_term" ? "high" : "medium",
            source_type: "briefing",
            source_id: "00000000-0000-0000-0000-000000000000",
            ticket_id: "",
            tags: [action.category, "ai-briefing"],
          });
          if (error) throw error;
          toast.success("Investigation ticket created", { description: action.title });
          break;
        }
        case "create_erasure": {
          const { error } = await supabase.from("erasure_actions").insert({
            action: "takedown_request",
            provider: "AI Briefing",
            target: action.action_data.target,
            type: "domain",
            details: action.description,
          });
          if (error) throw error;
          toast.success("Erasure action created", { description: `Target: ${action.action_data.target}` });
          break;
        }
        case "block_domain":
        case "add_watchlist": {
          const { error } = await supabase.from("investigation_tickets").insert({
            title: `[${action.action_type === "block_domain" ? "BLOCK" : "WATCH"}] ${action.action_data.target}`,
            description: action.description,
            severity: action.action_data.severity || "high",
            priority: "high",
            source_type: "briefing",
            source_id: "00000000-0000-0000-0000-000000000000",
            ticket_id: "",
            tags: [action.action_type, action.category, "ai-briefing"],
          });
          if (error) throw error;
          toast.success(`${action.action_type === "block_domain" ? "Block" : "Watchlist"} ticket created`);
          break;
        }
        default:
          toast.info("Action noted", { description: action.title });
      }
    } catch (err: any) {
      toast.error("Action failed", { description: err.message });
    } finally {
      setExecutingAction(null);
    }
  };

  const allActions = briefing?.briefing?.action_playbook || [];
  const filteredActions = playbookFilter === "all" ? allActions : allActions.filter(a => a.category === playbookFilter);

  return (
    <div className="space-y-6">
      {/* Header card with generate button */}
      <Card className="border-primary/30 bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI Threat Intelligence Briefing
            </CardTitle>
            <Button onClick={generateBriefing} disabled={loading} size="sm" className="gap-2">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              {loading ? "Analyzing…" : briefing ? "Refresh" : "Generate Briefing"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            AI analyzes all ingested threats, vulnerabilities, and metrics to produce actionable intelligence with executable response actions.
          </p>
        </CardHeader>

        {!briefing && !loading && (
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No briefing generated yet</p>
              <p className="text-xs mt-1">Click "Generate Briefing" to analyze current threat data</p>
            </div>
          </CardContent>
        )}

        {loading && (
          <CardContent>
            <div className="text-center py-12">
              <Brain className="w-12 h-12 mx-auto mb-3 text-primary animate-pulse" />
              <p className="text-sm font-medium text-foreground">Analyzing threat landscape…</p>
              <p className="text-xs text-muted-foreground mt-1">Processing threats, vulnerabilities, and patterns</p>
            </div>
          </CardContent>
        )}
      </Card>

      {briefing?.success && (
        <>
          {/* Executive Summary */}
          <Card className="border-primary/20 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed">
                {briefing.briefing.executive_summary}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground font-mono">
                <span>{briefing.data_summary.threats_analyzed} threats</span>
                <span>{briefing.data_summary.news_analyzed} advisories</span>
                <span>{briefing.data_summary.social_iocs_analyzed || 0} IOCs</span>
                <span>{briefing.data_summary.ato_events_analyzed || 0} ATO events</span>
                <span>{briefing.data_summary.breach_checks_analyzed || 0} breaches</span>
                <span>{briefing.data_summary.tor_nodes_tracked || 0} Tor nodes</span>
                <span>{briefing.data_summary.metrics_analyzed} metrics</span>
                <span>Generated {new Date(briefing.generated_at).toLocaleTimeString()}</span>
              </div>
              {allActions.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    {allActions.filter(a => a.executable).length} executable actions
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                    {allActions.filter(a => !a.executable).length} advisory actions
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaigns with inline actions */}
          {briefing.briefing.campaigns?.length > 0 && (
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-destructive" />
                  Identified Campaigns ({briefing.briefing.campaigns.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.briefing.campaigns.map((campaign, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background/50 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{campaign.name}</span>
                      <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", severityStyles[campaign.severity] || severityStyles.high)}>
                        {campaign.severity?.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{campaign.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {campaign.brands_targeted?.map((brand, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">{brand}</Badge>
                      ))}
                      {campaign.domains_count > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                          {campaign.domains_count} domains
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-start gap-1.5 text-[11px] text-primary">
                      <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{campaign.recommendation}</span>
                    </div>
                    <InlineActions
                      findingName={campaign.name}
                      actions={allActions}
                      onExecute={(a) => executeAction(a, allActions.indexOf(a))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top Risks with inline actions */}
          {briefing.briefing.top_risks?.length > 0 && (
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Priority Risks ({briefing.briefing.top_risks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.briefing.top_risks.map((risk, i) => {
                  const config = priorityConfig[risk.priority] || priorityConfig.monitor;
                  const PriorityIcon = config.icon;
                  return (
                    <div key={i} className="rounded-lg border border-border bg-background/50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <PriorityIcon className={cn("w-3.5 h-3.5", config.className)} />
                        <span className={cn("text-xs font-mono font-bold tracking-wider", config.className)}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{risk.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{risk.detail}</p>
                      <div className="flex items-start gap-1.5 mt-2 text-[11px] text-primary">
                        <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{risk.action}</span>
                      </div>
                      <InlineActions
                        findingName={risk.title}
                        actions={allActions}
                        onExecute={(a) => executeAction(a, allActions.indexOf(a))}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Trends */}
          {briefing.briefing.trends?.length > 0 && (
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Trend Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {briefing.briefing.trends.map((trend, i) => {
                  const TrendIcon = trendIcons[trend.direction] || Minus;
                  return (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3">
                      <TrendIcon className={cn(
                        "w-4 h-4 mt-0.5 shrink-0",
                        trend.direction === "increasing" ? "text-destructive" :
                        trend.direction === "decreasing" ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div>
                        <p className="text-sm text-foreground">{trend.observation}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{trend.significance}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Feed Health */}
          {briefing.briefing.feed_health && (
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Feed Health Status
                  {briefing.briefing.feed_health.healthy_feeds > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-2 bg-primary/10 text-primary border-primary/20">
                      {briefing.briefing.feed_health.healthy_feeds} healthy
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {briefing.briefing.feed_health.stale_feeds?.length > 0 && (
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <p className="text-xs font-medium text-warning flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="w-3 h-3" /> Stale Feeds
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {briefing.briefing.feed_health.stale_feeds.map((feed, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">{feed}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {briefing.briefing.feed_health.recommendations?.map((rec, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Database className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                    {rec}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {briefing.briefing.recommendations?.length > 0 && (
            <Card className="bg-card border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  Actionable Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {briefing.briefing.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="font-mono text-xs text-primary font-bold mt-0.5 shrink-0">{i + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* ═══ ACTION PLAYBOOK ═══ */}
          {allActions.length > 0 && (
            <Card className="bg-card border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Action Playbook ({allActions.length} actions)
                </CardTitle>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["all", "investigate", "escalate", "defend", "track"].map((cat) => {
                    const count = cat === "all" ? allActions.length : allActions.filter(a => a.category === cat).length;
                    if (count === 0 && cat !== "all") return null;
                    const catConf = cat !== "all" ? categoryConfig[cat] : null;
                    return (
                      <Button
                        key={cat}
                        variant={playbookFilter === cat ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-[10px] gap-1 px-2"
                        onClick={() => setPlaybookFilter(cat)}
                      >
                        {catConf && (() => { const I = catConf.icon; return <I className="w-3 h-3" />; })()}
                        {cat === "all" ? "All" : catConf?.label} ({count})
                      </Button>
                    );
                  })}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredActions.map((action, i) => {
                  const globalIdx = allActions.indexOf(action);
                  const cat = categoryConfig[action.category] || categoryConfig.investigate;
                  const CatIcon = cat.icon;
                  const isExpanded = expandedActions.has(globalIdx);
                  const isExecuting = executingAction === globalIdx;

                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        urgencyStyles[action.urgency] || urgencyStyles.ongoing
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <CatIcon className={cn("w-4 h-4 mt-0.5 shrink-0", cat.color)} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{action.title}</span>
                              <Badge variant="outline" className={cn("text-[9px] px-1 py-0", cat.color)}>
                                {cat.label}
                              </Badge>
                              {action.executable ? (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
                                  Executable
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted text-muted-foreground">
                                  Advisory
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                            {action.action_data?.target && (
                              <p className="text-[11px] font-mono text-foreground/60 mt-1">
                                Target: {action.action_data.target}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {action.executable ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-[11px] gap-1 px-2"
                              disabled={isExecuting}
                              onClick={() => executeAction(action, globalIdx)}
                            >
                              {isExecuting ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                              Execute
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1 px-2"
                              onClick={() => executeAction(action, globalIdx)}
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {action.action_type === "law_enforcement" ? "View LE Template" :
                               action.action_type === "abuse_report" ? "View Report" :
                               action.action_type === "isac_share" ? "View Format" :
                               "View Guidance"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Advisory template expansion */}
                      {isExpanded && !action.executable && action.action_data?.template && (
                        <TemplateViewer
                          template={action.action_data.template}
                          title={
                            action.action_type === "law_enforcement" ? "Law Enforcement Referral Template" :
                            action.action_type === "abuse_report" ? "Abuse Report Template" :
                            action.action_type === "isac_share" ? "ISAC Sharing Format" :
                            "OSINT Guidance"
                          }
                        />
                      )}

                      {/* OSINT guidance without template */}
                      {isExpanded && !action.executable && action.action_type === "osint_lookup" && !action.action_data?.template && (
                        <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
                          <p className="text-[11px] text-muted-foreground">
                            Recommended tools: WHOIS lookup, Shodan, VirusTotal, URLScan.io, SecurityTrails
                          </p>
                          <div className="flex gap-2 mt-2">
                            {action.action_data?.target && (
                              <>
                                <Button variant="outline" size="sm" className="h-5 text-[10px] gap-1 px-1.5" asChild>
                                  <a href={`https://www.virustotal.com/gui/search/${encodeURIComponent(action.action_data.target)}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-2.5 h-2.5" /> VirusTotal
                                  </a>
                                </Button>
                                <Button variant="outline" size="sm" className="h-5 text-[10px] gap-1 px-1.5" asChild>
                                  <a href={`https://urlscan.io/search/#${encodeURIComponent(action.action_data.target)}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-2.5 h-2.5" /> URLScan
                                  </a>
                                </Button>
                                <Button variant="outline" size="sm" className="h-5 text-[10px] gap-1 px-1.5" asChild>
                                  <a href={`https://www.shodan.io/search?query=${encodeURIComponent(action.action_data.target)}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-2.5 h-2.5" /> Shodan
                                  </a>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
