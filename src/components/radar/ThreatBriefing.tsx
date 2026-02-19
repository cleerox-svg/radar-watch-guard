/**
 * ThreatBriefing.tsx — AI-powered threat intelligence briefing widget.
 *
 * Calls the threat-briefing edge function which analyzes all ingested
 * threat data and returns a structured intelligence report with:
 *   - Executive summary
 *   - Identified campaigns
 *   - Top risks with priority levels
 *   - Trend observations
 *   - Actionable recommendations
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

interface Briefing {
  executive_summary: string;
  campaigns: Campaign[];
  top_risks: Risk[];
  trends: Trend[];
  recommendations: string[];
}

interface BriefingResponse {
  success: boolean;
  briefing: Briefing;
  data_summary: {
    threats_analyzed: number;
    news_analyzed: number;
    metrics_analyzed: number;
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

export function ThreatBriefing() {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(false);

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
            <Button
              onClick={generateBriefing}
              disabled={loading}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              {loading ? "Analyzing…" : briefing ? "Refresh" : "Generate Briefing"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            AI analyzes all ingested threats, vulnerabilities, and metrics to produce actionable intelligence.
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
              <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground font-mono">
                <span>{briefing.data_summary.threats_analyzed} threats</span>
                <span>{briefing.data_summary.news_analyzed} advisories</span>
                <span>{briefing.data_summary.metrics_analyzed} metrics</span>
                <span>Generated {new Date(briefing.generated_at).toLocaleTimeString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns */}
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
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top Risks */}
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
                        <span className="text-xs font-mono font-bold tracking-wider" style={{ color: `hsl(var(--${risk.priority === 'immediate' ? 'destructive' : risk.priority === 'short_term' ? 'warning' : 'muted-foreground'}))` }}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{risk.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{risk.detail}</p>
                      <div className="flex items-start gap-1.5 mt-2 text-[11px] text-primary">
                        <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{risk.action}</span>
                      </div>
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
        </>
      )}
    </div>
  );
}
