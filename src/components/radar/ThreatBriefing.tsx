/**
 * ThreatBriefing.tsx — AI-powered threat intelligence briefing
 *
 * v2 features:
 *   - 12-hour cached briefings with history list
 *   - Finding drill-down detail view (data points, correlation logic)
 *   - Back navigation returns to current briefing
 *   - Generate new briefing on demand
 *   - Chronological history sidebar
 */

import { useState, useEffect, useCallback } from "react";
import {
  Brain, RefreshCw, Shield, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Target, Lightbulb, Clock, Zap, Eye, Activity,
  Database, Search, Send, ShieldBan, Bookmark, ExternalLink,
  FileText, Copy, CheckCircle2, Play, ChevronDown, ChevronUp,
  Download, ArrowLeft, History, Info, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ───

interface DataPoint {
  source: string;
  type: string;
  value: string;
  context: string;
}

interface Campaign {
  name: string;
  description: string;
  domains_count: number;
  brands_targeted: string[];
  severity: string;
  recommendation: string;
  sources_correlated?: string[];
  data_points?: DataPoint[];
  correlation_logic?: string;
}

interface Risk {
  title: string;
  detail: string;
  priority: "immediate" | "short_term" | "monitor";
  action: string;
  data_sources?: string[];
  data_points?: DataPoint[];
  correlation_logic?: string;
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
  data_summary: Record<string, number>;
  generated_at: string;
  briefing_id?: string;
  from_cache?: boolean;
  error?: string;
}

interface HistoryEntry {
  id: string;
  generated_at: string;
  briefing: Briefing;
  data_summary: Record<string, number>;
}

// ─── Style maps ───

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
  increasing: TrendingUp, decreasing: TrendingDown, stable: Minus,
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

// ─── Sub-components ───

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
          <Button key={i} variant="outline" size="sm"
            className={cn("h-6 text-[10px] gap-1 px-2", cat.color)}
            onClick={() => onExecute(action)}>
            <CatIcon className="w-3 h-3" />
            {action.title.length > 30 ? action.title.slice(0, 28) + "…" : action.title}
            {action.executable && <Play className="w-2.5 h-2.5 ml-0.5" />}
          </Button>
        );
      })}
    </div>
  );
}

function TemplateViewer({ template, title }: { template: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(template);
    setCopied(true);
    toast.success("Template copied");
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

/** Detail drill-down for a campaign or risk finding */
function FindingDetail({ finding, type, onBack, allActions, onExecute }: {
  finding: Campaign | Risk;
  type: "campaign" | "risk";
  onBack: () => void;
  allActions: PlaybookAction[];
  onExecute: (action: PlaybookAction, idx: number) => void;
}) {
  const name = type === "campaign" ? (finding as Campaign).name : (finding as Risk).title;
  const dataPoints = finding.data_points || [];
  const correlationLogic = finding.correlation_logic || "No correlation logic available for this finding.";
  const sources = type === "campaign"
    ? (finding as Campaign).sources_correlated || []
    : (finding as Risk).data_sources || [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to Briefing
      </Button>

      <Card className="border-primary/30 bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              {type === "campaign" ? <Target className="w-5 h-5 text-destructive" /> : <AlertTriangle className="w-5 h-5 text-warning" />}
              {name}
            </CardTitle>
            <Badge className={cn("text-[10px] px-2 py-0.5 shrink-0",
              severityStyles[type === "campaign" ? (finding as Campaign).severity : "high"])}>
              {type === "campaign" ? (finding as Campaign).severity?.toUpperCase() : (finding as Risk).priority?.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            {type === "campaign" ? (finding as Campaign).description : (finding as Risk).detail}
          </p>

          {/* Recommendation / Action */}
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              {type === "campaign" ? (finding as Campaign).recommendation : (finding as Risk).action}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Correlation Logic */}
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Correlation Logic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/90 leading-relaxed">{correlationLogic}</p>
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {sources.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Points / Evidence */}
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Evidence &amp; Data Points ({dataPoints.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dataPoints.length === 0 ? (
            <p className="text-xs text-muted-foreground">No granular data points returned by AI for this finding.</p>
          ) : (
            <div className="space-y-2">
              {dataPoints.map((dp, i) => (
                <div key={i} className="rounded-lg border border-border bg-background/50 p-3 flex items-start gap-3">
                  <div className="shrink-0 w-16">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">{dp.source}</Badge>
                    <p className="text-[9px] text-muted-foreground mt-0.5 capitalize">{dp.type}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-foreground break-all">{dp.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dp.context}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Related playbook actions */}
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Related Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {allActions.filter(a =>
            a.finding_ref?.toLowerCase().includes(name?.toLowerCase()?.slice(0, 20))
          ).map((action, i) => {
            const cat = categoryConfig[action.category] || categoryConfig.investigate;
            const CatIcon = cat.icon;
            return (
              <div key={i} className={cn("rounded-lg border p-3", urgencyStyles[action.urgency] || urgencyStyles.ongoing)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <CatIcon className={cn("w-4 h-4 mt-0.5 shrink-0", cat.color)} />
                    <div>
                      <span className="text-sm font-medium text-foreground">{action.title}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      {action.action_data?.target && (
                        <p className="text-[11px] font-mono text-foreground/60 mt-1">Target: {action.action_data.target}</p>
                      )}
                    </div>
                  </div>
                  <Button variant={action.executable ? "default" : "outline"} size="sm"
                    className="h-7 text-[11px] gap-1 px-2 shrink-0"
                    onClick={() => onExecute(action, allActions.indexOf(action))}>
                    {action.executable ? <Play className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                    {action.executable ? "Execute" : "View"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───

export function ThreatBriefing() {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set());
  const [executingAction, setExecutingAction] = useState<number | null>(null);
  const [playbookFilter, setPlaybookFilter] = useState<string>("all");

  // Drill-down state
  const [drillDown, setDrillDown] = useState<{ type: "campaign" | "risk"; index: number } | null>(null);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load cached briefing on mount
  useEffect(() => {
    loadCached();
    loadHistory();
  }, []);

  const loadCached = async () => {
    try {
      const resp = await supabase.functions.invoke("threat-briefing", {
        body: null,
        method: "GET",
      });
      // Use query param approach via direct fetch
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/threat-briefing?cached=true`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.from_cache) {
          setBriefing(data);
        }
      }
    } catch {
      // No cached briefing, that's fine
    }
  };

  const loadHistory = async () => {
    try {
      const { data } = await supabase
        .from('threat_briefings')
        .select('id, generated_at, briefing, data_summary')
        .order('generated_at', { ascending: false })
        .limit(20);
      if (data) setHistory(data as unknown as HistoryEntry[]);
    } catch {
      // ignore
    }
  };

  const generateBriefing = async () => {
    setLoading(true);
    setDrillDown(null);
    try {
      const { data, error } = await supabase.functions.invoke("threat-briefing");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBriefing(data);
      toast.success(data.from_cache ? "Loaded cached briefing" : "New briefing generated");
      loadHistory(); // refresh history
    } catch (err: any) {
      toast.error("Briefing generation failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setBriefing({
      success: true,
      briefing: entry.briefing,
      data_summary: entry.data_summary,
      generated_at: entry.generated_at,
      briefing_id: entry.id,
      from_cache: true,
    });
    setDrillDown(null);
    setShowHistory(false);
    toast.info("Loaded historical briefing");
  };

  const executeAction = async (action: PlaybookAction, index: number) => {
    if (!action.executable) {
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

  /** Export briefing as print-friendly PDF */
  const exportAsPdf = () => {
    if (!briefing?.success) return;
    const b = briefing.briefing;
    const ds = briefing.data_summary;
    const now = new Date(briefing.generated_at).toLocaleString();

    const sevBadge = (s: string) => {
      const colors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280' };
      return `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:${colors[s] || colors.medium}">${(s || '').toUpperCase()}</span>`;
    };
    const urgBorder: Record<string, string> = { immediate: '#ef4444', short_term: '#eab308', ongoing: '#d1d5db' };
    const catEmoji: Record<string, string> = { investigate: '🔍', escalate: '📤', defend: '🛡️', track: '📌' };

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Threat Briefing — ${now}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;padding:40px;font-size:13px;line-height:1.5}h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;margin:24px 0 8px;padding-bottom:4px;border-bottom:2px solid #10b981;color:#0f172a}h3{font-size:13px;margin:12px 0 4px}.subtitle{font-size:11px;color:#64748b;margin-bottom:20px}.stats{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.stat{background:#f1f5f9;border-radius:6px;padding:4px 10px;font-size:11px;font-family:monospace}.card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:8px 0;page-break-inside:avoid}.card-title{font-weight:600;font-size:13px}.card-desc{font-size:12px;color:#475569;margin-top:4px}.rec{font-size:12px;color:#10b981;margin-top:6px}.brand-tag{display:inline-block;background:#e2e8f0;border-radius:4px;padding:1px 6px;font-size:10px;margin:2px 2px 2px 0}.action-card{border-left:3px solid;border-radius:6px;padding:10px 12px;margin:6px 0;background:#fafafa;page-break-inside:avoid}.action-title{font-weight:600;font-size:12px}.action-meta{font-size:10px;color:#64748b;margin-top:2px}.action-desc{font-size:11px;color:#334155;margin-top:4px}.template-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px;margin-top:6px;font-family:monospace;font-size:10px;white-space:pre-wrap}ol{padding-left:20px}ol li{margin:4px 0;font-size:12px}.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}@media print{body{padding:20px}.action-card{break-inside:avoid}}</style></head><body>
<h1>🛡️ Threat Intelligence Briefing</h1>
<div class="subtitle">Generated: ${now} | LRX Radar</div>
<h2>Executive Summary</h2><p>${b.executive_summary || 'N/A'}</p>
<div class="stats">${Object.entries(ds).map(([k,v]) => `<span class="stat">${v} ${k.replace(/_/g,' ')}</span>`).join('')}</div>
${b.campaigns?.length ? `<h2>Campaigns (${b.campaigns.length})</h2>${b.campaigns.map(c => `<div class="card"><div style="display:flex;justify-content:space-between"><span class="card-title">${c.name}</span>${sevBadge(c.severity)}</div><div class="card-desc">${c.description}</div>${(c.brands_targeted||[]).map(br=>`<span class="brand-tag">${br}</span>`).join('')}<div class="rec">💡 ${c.recommendation}</div></div>`).join('')}` : ''}
${b.top_risks?.length ? `<h2>Risks (${b.top_risks.length})</h2>${b.top_risks.map(r => `<div class="card"><h3>${r.title}</h3><div class="card-desc">${r.detail}</div><div class="rec">💡 ${r.action}</div></div>`).join('')}` : ''}
${b.recommendations?.length ? `<h2>Recommendations</h2><ol>${b.recommendations.map(r=>`<li>${r}</li>`).join('')}</ol>` : ''}
${allActions.length ? `<h2>Action Playbook (${allActions.length})</h2>${allActions.map(a=>`<div class="action-card" style="border-color:${urgBorder[a.urgency]||'#d1d5db'}"><div class="action-title">${catEmoji[a.category]||'📌'} ${a.title}</div><div class="action-meta">${(a.category||'').toUpperCase()} · ${(a.urgency||'').replace('_',' ').toUpperCase()} · ${a.executable?'🟢 Executable':'📋 Advisory'} · Target: ${a.action_data?.target||'N/A'}</div><div class="action-desc">${a.description}</div>${!a.executable&&a.action_data?.template?`<div class="template-box">${a.action_data.template}</div>`:''}</div>`).join('')}` : ''}
<div class="footer">LRX Radar — Classified: INTERNAL · ${now}</div></body></html>`;

    const w = window.open('', '_blank');
    if (!w) { toast.error("Pop-up blocked"); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  };

  // ─── Drill-down view ───
  if (drillDown && briefing?.success) {
    const finding = drillDown.type === "campaign"
      ? briefing.briefing.campaigns[drillDown.index]
      : briefing.briefing.top_risks[drillDown.index];

    if (finding) {
      return (
        <FindingDetail
          finding={finding}
          type={drillDown.type}
          onBack={() => setDrillDown(null)}
          allActions={allActions}
          onExecute={executeAction}
        />
      );
    }
  }

  // ─── Main view ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/30 bg-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI Threat Intelligence Briefing
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowHistory(!showHistory)}>
                <History className="w-4 h-4" />
                History ({history.length})
              </Button>
              {briefing?.success && (
                <Button onClick={exportAsPdf} variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export PDF
                </Button>
              )}
              <Button onClick={generateBriefing} disabled={loading} size="sm" className="gap-2">
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                {loading ? "Analyzing…" : "Generate New Briefing"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {briefing?.from_cache
              ? `Cached briefing from ${new Date(briefing.generated_at).toLocaleString()} · Valid for 12 hours`
              : "AI analyzes all feeds to produce actionable intelligence. Click any finding for full detail."}
          </p>
        </CardHeader>

        {!briefing && !loading && (
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No briefing generated yet</p>
              <p className="text-xs mt-1">Click "Generate New Briefing" to analyze current threat data</p>
            </div>
          </CardContent>
        )}

        {loading && (
          <CardContent>
            <div className="text-center py-12">
              <Brain className="w-12 h-12 mx-auto mb-3 text-primary animate-pulse" />
              <p className="text-sm font-medium text-foreground">Analyzing threat landscape…</p>
              <p className="text-xs text-muted-foreground mt-1">Processing feeds with fast AI model</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* History panel */}
      {showHistory && (
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Briefing History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No previous briefings found.</p>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="space-y-1.5">
                  {history.map((entry) => {
                    const isActive = briefing?.briefing_id === entry.id;
                    return (
                      <button key={entry.id}
                        onClick={() => loadFromHistory(entry)}
                        className={cn(
                          "w-full text-left rounded-lg border p-2.5 transition-colors hover:bg-accent/50",
                          isActive ? "border-primary/40 bg-primary/5" : "border-border"
                        )}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">
                            {new Date(entry.generated_at).toLocaleDateString()} {new Date(entry.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isActive && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary">Current</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                          {(entry.briefing as any)?.executive_summary?.slice(0, 100) || "Briefing"}…
                        </p>
                        <div className="flex gap-2 mt-1 text-[9px] font-mono text-muted-foreground">
                          <span>{(entry.data_summary as any)?.threats_analyzed || 0} threats</span>
                          <span>{(entry.data_summary as any)?.news_analyzed || 0} news</span>
                          <span>{(entry.data_summary as any)?.social_iocs_analyzed || 0} IOCs</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

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
              <p className="text-sm text-foreground leading-relaxed">{briefing.briefing.executive_summary}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground font-mono">
                {Object.entries(briefing.data_summary).map(([k, v]) => (
                  <span key={k}>{v} {k.replace(/_/g, ' ').replace('analyzed', '').trim()}</span>
                ))}
                <span>Generated {new Date(briefing.generated_at).toLocaleTimeString()}</span>
                {briefing.from_cache && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted">cached</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Campaigns — clickable for drill-down */}
          {briefing.briefing.campaigns?.length > 0 && (
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-destructive" />
                  Identified Campaigns ({briefing.briefing.campaigns.length})
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">Click for details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.briefing.campaigns.map((campaign, i) => (
                  <div key={i}
                    className="rounded-lg border border-border bg-background/50 p-3 cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => setDrillDown({ type: "campaign", index: i })}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{campaign.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={cn("text-[10px] px-1.5 py-0", severityStyles[campaign.severity] || severityStyles.high)}>
                          {campaign.severity?.toUpperCase()}
                        </Badge>
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{campaign.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {campaign.brands_targeted?.map((brand, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">{brand}</Badge>
                      ))}
                      {campaign.domains_count > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{campaign.domains_count} domains</Badge>
                      )}
                      {campaign.data_points?.length ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-primary/5 text-primary border-primary/20">
                          {campaign.data_points.length} evidence points
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-start gap-1.5 text-[11px] text-primary">
                      <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{campaign.recommendation}</span>
                    </div>
                    <InlineActions findingName={campaign.name} actions={allActions}
                      onExecute={(a) => { executeAction(a, allActions.indexOf(a)); }} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top Risks — clickable for drill-down */}
          {briefing.briefing.top_risks?.length > 0 && (
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Priority Risks ({briefing.briefing.top_risks.length})
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">Click for details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.briefing.top_risks.map((risk, i) => {
                  const config = priorityConfig[risk.priority] || priorityConfig.monitor;
                  const PriorityIcon = config.icon;
                  return (
                    <div key={i}
                      className="rounded-lg border border-border bg-background/50 p-3 cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => setDrillDown({ type: "risk", index: i })}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <PriorityIcon className={cn("w-3.5 h-3.5", config.className)} />
                          <span className={cn("text-xs font-mono font-bold tracking-wider", config.className)}>{config.label}</span>
                        </div>
                        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{risk.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{risk.detail}</p>
                      {risk.data_points?.length ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-primary/5 text-primary border-primary/20 mt-1.5">
                          {risk.data_points.length} evidence points
                        </Badge>
                      ) : null}
                      <div className="flex items-start gap-1.5 mt-2 text-[11px] text-primary">
                        <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{risk.action}</span>
                      </div>
                      <InlineActions findingName={risk.title} actions={allActions}
                        onExecute={(a) => { executeAction(a, allActions.indexOf(a)); }} />
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
                      <TrendIcon className={cn("w-4 h-4 mt-0.5 shrink-0",
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
                  <Activity className="w-4 h-4 text-primary" /> Feed Health
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
                      {briefing.briefing.feed_health.stale_feeds.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {briefing.briefing.feed_health.recommendations?.map((rec, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Database className="w-3 h-3 text-primary mt-0.5 shrink-0" />{rec}
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

          {/* Action Playbook */}
          {allActions.length > 0 && (
            <Card className="bg-card border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Action Playbook ({allActions.length})
                </CardTitle>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["all", "investigate", "escalate", "defend", "track"].map((cat) => {
                    const count = cat === "all" ? allActions.length : allActions.filter(a => a.category === cat).length;
                    if (count === 0 && cat !== "all") return null;
                    const catConf = cat !== "all" ? categoryConfig[cat] : null;
                    return (
                      <Button key={cat} variant={playbookFilter === cat ? "default" : "outline"}
                        size="sm" className="h-6 text-[10px] gap-1 px-2"
                        onClick={() => setPlaybookFilter(cat)}>
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
                    <div key={i} className={cn("rounded-lg border p-3 transition-colors", urgencyStyles[action.urgency] || urgencyStyles.ongoing)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <CatIcon className={cn("w-4 h-4 mt-0.5 shrink-0", cat.color)} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{action.title}</span>
                              <Badge variant="outline" className={cn("text-[9px] px-1 py-0", cat.color)}>{cat.label}</Badge>
                              <Badge variant="outline" className={cn("text-[9px] px-1 py-0",
                                action.executable ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground")}>
                                {action.executable ? "Executable" : "Advisory"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                            {action.action_data?.target && (
                              <p className="text-[11px] font-mono text-foreground/60 mt-1">Target: {action.action_data.target}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {action.executable ? (
                            <Button variant="default" size="sm" className="h-7 text-[11px] gap-1 px-2"
                              disabled={isExecuting} onClick={(e) => { e.stopPropagation(); executeAction(action, globalIdx); }}>
                              {isExecuting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                              Execute
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2"
                              onClick={(e) => { e.stopPropagation(); executeAction(action, globalIdx); }}>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {action.action_type === "law_enforcement" ? "View LE Template" :
                               action.action_type === "abuse_report" ? "View Report" :
                               action.action_type === "isac_share" ? "View Format" : "View Guidance"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {isExpanded && !action.executable && action.action_data?.template && (
                        <TemplateViewer template={action.action_data.template}
                          title={action.action_type === "law_enforcement" ? "Law Enforcement Referral Template" :
                            action.action_type === "abuse_report" ? "Abuse Report Template" :
                            action.action_type === "isac_share" ? "ISAC Sharing Format" : "OSINT Guidance"} />
                      )}

                      {isExpanded && !action.executable && action.action_type === "osint_lookup" && !action.action_data?.template && (
                        <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
                          <p className="text-[11px] text-muted-foreground">Recommended: WHOIS, Shodan, VirusTotal, URLScan.io</p>
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
