/**
 * ConvergedIntelligence.tsx — Converged Intelligence Engine UI.
 *
 * Bridges external threat monitoring with internal telemetry (DMARC/ATO)
 * and social IOC / dark web breach feeds to identify active weaponization.
 */

import { useState } from "react";
import { Zap, RefreshCw, Shield, AlertTriangle, Target, Eye, ArrowRight, CheckCircle, XCircle, Loader2, Activity, Radio, Globe, Hash, Wifi, Skull } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INTEL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/converged-intel`;

interface Campaign {
  name: string;
  stage: string;
  confidence: string;
  indicators: string[];
  recommended_actions: string[];
}

interface AutoAction {
  action: string;
  target: string;
  urgency: string;
  rationale: string;
}

interface IntelResult {
  correlations: {
    total_threats_7d: number;
    active_high_threats: number;
    dmarc_failures_7d: number;
    ato_events_7d: number;
    correlated_dmarc_threats: number;
    correlated_ato_threats: number;
    weaponized_domains: string[];
    targeted_brands: string[];
    kev_alerts: number;
    social_iocs_7d: number;
    social_domains: number;
    social_ips: number;
    social_hashes: number;
    correlated_social_threats: number;
    correlated_social_ips: number;
    trending_tags: [string, number][];
    breach_checks_7d: number;
    high_risk_breaches: number;
    correlated_breach_brands: number;
  };
  ai_analysis: {
    convergence_score: number;
    convergence_grade: string;
    active_campaigns: Campaign[];
    gap_analysis: { blind_spots: string[]; coverage_strengths: string[] };
    auto_actions: AutoAction[];
    executive_summary: string;
  } | null;
  generated_at: string;
}

const stageColors: Record<string, string> = {
  preparation: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  weaponization: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  delivery: "border-red-500/30 bg-red-500/10 text-red-500",
  exploitation: "border-red-700/30 bg-red-700/10 text-red-700",
};

const urgencyColors: Record<string, string> = {
  immediate: "border-red-500/30 bg-red-500/10 text-red-500",
  short_term: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  monitor: "border-blue-500/30 bg-blue-500/10 text-blue-500",
};

export function ConvergedIntelligence() {
  const [result, setResult] = useState<IntelResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(INTEL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const ai = result?.ai_analysis;
  const corr = result?.correlations;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Converged Intelligence Engine
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Correlates external threat feeds, social IOCs, dark web breach data, and internal DMARC/ATO telemetry to identify active weaponization.
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={runAnalysis} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isLoading ? "Analyzing..." : result ? "Refresh Analysis" : "Run Convergence Analysis"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm text-destructive flex items-center gap-2">
              <XCircle className="w-4 h-4" /> {error}
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          {/* Convergence Score + Core Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {ai && (
              <Card className="col-span-2 border-primary/20">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className={cn("w-16 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold",
                    ai.convergence_grade === "A" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" :
                    ai.convergence_grade === "B" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" :
                    ai.convergence_grade === "C" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                    ai.convergence_grade === "D" ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                    "border-red-500/30 bg-red-500/10 text-red-500"
                  )}>
                    {ai.convergence_grade}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Convergence Score</p>
                    <p className="text-2xl font-bold font-mono text-foreground">{ai.convergence_score}/100</p>
                  </div>
                </CardContent>
              </Card>
            )}
            <StatCard icon={AlertTriangle} label="Active High Threats" value={corr?.active_high_threats || 0} color="text-red-500" />
            <StatCard icon={Activity} label="DMARC Failures" value={corr?.dmarc_failures_7d || 0} color="text-orange-500" />
            <StatCard icon={Target} label="ATO Events" value={corr?.ato_events_7d || 0} color="text-yellow-500" />
            <StatCard icon={Radio} label="Correlated Threats" value={(corr?.correlated_dmarc_threats || 0) + (corr?.correlated_ato_threats || 0)} color="text-primary" />
          </div>

          {/* Social IOC + Breach Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard icon={Globe} label="Social IOCs (7d)" value={corr?.social_iocs_7d || 0} color="text-cyan-500" />
            <StatCard icon={Wifi} label="IOC IPs" value={corr?.social_ips || 0} color="text-blue-500" />
            <StatCard icon={Hash} label="IOC Hashes" value={corr?.social_hashes || 0} color="text-violet-500" />
            <StatCard icon={Radio} label="Social↔Threat Hits" value={(corr?.correlated_social_threats || 0) + (corr?.correlated_social_ips || 0)} color="text-cyan-400" />
            <StatCard icon={Skull} label="Breach Checks" value={corr?.breach_checks_7d || 0} color="text-rose-500" />
            <StatCard icon={AlertTriangle} label="High Risk Breaches" value={corr?.high_risk_breaches || 0} color="text-red-600" />
          </div>

          {/* Trending Social Tags */}
          {corr?.trending_tags && corr.trending_tags.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-500" />
                  Trending Threat Tags (Social IOCs)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {corr.trending_tags.map(([tag, count], i) => (
                    <span key={i} className={cn(
                      "text-xs px-2.5 py-1 rounded-full border font-mono",
                      i < 3 ? "border-red-500/30 bg-red-500/10 text-red-500" :
                      i < 6 ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                      "border-muted bg-muted/50 text-muted-foreground"
                    )}>
                      {tag} <span className="opacity-70">({count})</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Executive Summary */}
          {ai?.executive_summary && (
            <Card className="border-primary/20 bg-card">
              <CardContent className="py-4">
                <p className="text-sm text-foreground leading-relaxed">{ai.executive_summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Active Campaigns */}
          {ai?.active_campaigns && ai.active_campaigns.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-red-500" />
                  Active Campaigns Detected
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ai.active_campaigns.map((campaign, i) => (
                  <div key={i} className="bg-background rounded-lg p-4 border border-border space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-foreground">{campaign.name}</h4>
                      <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border", stageColors[campaign.stage] || stageColors.preparation)}>
                        {campaign.stage}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">Confidence: {campaign.confidence}</span>
                    </div>
                    {campaign.indicators.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Indicators</p>
                        <div className="flex flex-wrap gap-1.5">
                          {campaign.indicators.map((ind, j) => (
                            <span key={j} className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">{ind}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {campaign.recommended_actions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Actions</p>
                        {campaign.recommended_actions.map((action, j) => (
                          <p key={j} className="text-xs text-foreground flex items-start gap-1.5">
                            <ArrowRight className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {action}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Auto-Actions */}
          {ai?.auto_actions && ai.auto_actions.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Recommended Automated Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ai.auto_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 bg-background rounded-lg p-3 border border-border">
                    <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border shrink-0 mt-0.5", urgencyColors[action.urgency] || urgencyColors.monitor)}>
                      {action.urgency.replace("_", " ")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{action.action}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Target: {action.target}</p>
                      <p className="text-[10px] text-muted-foreground">{action.rationale}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Gap Analysis */}
          {ai?.gap_analysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-orange-500" />
                    Blind Spots
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {(ai.gap_analysis.blind_spots || []).map((spot, i) => (
                    <p key={i} className="text-xs text-foreground flex items-start gap-1.5">
                      <XCircle className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" /> {spot}
                    </p>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Coverage Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {(ai.gap_analysis.coverage_strengths || []).map((s, i) => (
                    <p key={i} className="text-xs text-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" /> {s}
                    </p>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center font-mono">
            Generated at {new Date(result.generated_at).toLocaleString()} · LRX Convergence Engine v2.0
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="py-3 text-center">
        <Icon className={cn("w-4 h-4 mx-auto mb-1", color)} />
        <p className="text-lg font-bold font-mono text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
