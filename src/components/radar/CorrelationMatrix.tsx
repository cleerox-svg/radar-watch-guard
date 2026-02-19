/**
 * CorrelationMatrix.tsx — Module B: Active Correlation Matrix (Core Engine)
 *
 * Replaces siloed Heatmap/DMARC dashboards with a unified entity-tracking timeline
 * that correlates signals across vectors into campaign alerts.
 *
 * Signal correlation flow:
 * 1. CertStream/Typosquat detection → new domain registered
 * 2. DMARC feed → domain failing authentication
 * 3. ATO feed → anomalous logins from correlated IPs
 * → Single "Campaign Alert" showing the full lifecycle
 */

import { useState, useMemo } from "react";
import { Zap, RefreshCw, AlertTriangle, Target, ArrowRight, Loader2, Activity, Globe, Hash, Wifi, Skull, Clock, ChevronRight, Shield, Eye, Radio, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useThreats, useEmailAuthReports, useAtoEvents } from "@/hooks/use-threat-data";
import { motion } from "framer-motion";

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

const stageConfig: Record<string, { color: string; label: string; order: number }> = {
  preparation: { color: "border-blue-500/30 bg-blue-500/10 text-blue-500", label: "Preparation", order: 1 },
  weaponization: { color: "border-orange-500/30 bg-orange-500/10 text-orange-500", label: "Weaponization", order: 2 },
  delivery: { color: "border-red-500/30 bg-red-500/10 text-red-500", label: "Delivery", order: 3 },
  exploitation: { color: "border-red-700/30 bg-red-700/10 text-red-700", label: "Exploitation", order: 4 },
};

const urgencyColors: Record<string, string> = {
  immediate: "border-red-500/30 bg-red-500/10 text-red-500",
  short_term: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  monitor: "border-blue-500/30 bg-blue-500/10 text-blue-500",
};

export function CorrelationMatrix() {
  const [result, setResult] = useState<IntelResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<number | null>(null);

  const { data: threats } = useThreats();
  const { data: emailReports } = useEmailAuthReports();
  const { data: atoEvents } = useAtoEvents();

  // Build local correlation signals for the timeline
  const localSignals = useMemo(() => {
    const signals: { time: string; type: string; severity: string; detail: string; source: string }[] = [];
    
    // Recent active high threats
    threats?.filter((t: any) => t.status === "active" && (t.severity === "critical" || t.severity === "high"))
      .slice(0, 10)
      .forEach((t: any) => {
        signals.push({
          time: t.last_seen || t.created_at,
          type: "threat",
          severity: t.severity,
          detail: `${t.brand} — ${t.domain} (${t.attack_type})`,
          source: t.source,
        });
      });

    // DMARC failures
    emailReports?.filter((r: any) => !r.dmarc_aligned)
      .slice(0, 5)
      .forEach((r: any) => {
        signals.push({
          time: r.created_at,
          type: "dmarc_failure",
          severity: "high",
          detail: `DMARC failure: ${r.source_name} — SPF:${r.spf_pass ? "✓" : "✗"} DKIM:${r.dkim_pass ? "✓" : "✗"} Vol:${r.volume}`,
          source: "DMARC",
        });
      });

    // ATO events
    atoEvents?.slice(0, 5).forEach((a: any) => {
      signals.push({
        time: a.detected_at,
        type: "ato",
        severity: (a.risk_score || 0) >= 70 ? "critical" : "high",
        detail: `${a.event_type}: ${a.user_email} — ${a.location_from || "?"} → ${a.location_to || "?"}`,
        source: "ATO",
      });
    });

    return signals.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);
  }, [threats, emailReports, atoEvents]);

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header + Run */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Active Correlation Matrix
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Unified cross-signal campaign detection — tracks entities across the attack lifecycle, not individual events.
              </p>
            </div>
            <Button onClick={runAnalysis} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isLoading ? "Correlating..." : result ? "Refresh" : "Run Correlation Analysis"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm text-destructive flex items-center gap-2"><XCircle className="w-4 h-4" /> {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Kill Chain Stage Pipeline */}
      {ai && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(stageConfig).map(([stage, config]) => {
            const count = ai.active_campaigns?.filter(c => c.stage === stage).length || 0;
            return (
              <Card key={stage} className={cn("border", count > 0 ? config.color.split(" ").slice(0, 1).join(" ") : "border-border")}>
                <CardContent className="py-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{config.label}</p>
                  <p className={cn("text-2xl font-bold font-mono", count > 0 ? config.color.split(" ").slice(2).join(" ") : "text-muted-foreground")}>{count}</p>
                  <p className="text-[10px] text-muted-foreground">campaigns</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Results */}
      {result && (
        <div className="space-y-4">
          {/* Score + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {ai && (
              <Card className="border-primary/20 bg-card">
                <CardContent className="py-5 flex items-center gap-4">
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
            {ai?.executive_summary && (
              <Card className="border-border bg-card lg:col-span-2">
                <CardContent className="py-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Executive Summary</p>
                  <p className="text-sm text-foreground leading-relaxed">{ai.executive_summary}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Correlation Stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <StatCard icon={AlertTriangle} label="Active High" value={corr?.active_high_threats || 0} color="text-red-500" />
            <StatCard icon={Activity} label="DMARC↔Threat" value={corr?.correlated_dmarc_threats || 0} color="text-orange-500" />
            <StatCard icon={Target} label="ATO↔Threat" value={corr?.correlated_ato_threats || 0} color="text-yellow-500" />
            <StatCard icon={Radio} label="Social↔Threat" value={(corr?.correlated_social_threats || 0) + (corr?.correlated_social_ips || 0)} color="text-cyan-500" />
            <StatCard icon={Skull} label="High-Risk Breaches" value={corr?.high_risk_breaches || 0} color="text-rose-500" />
            <StatCard icon={Globe} label="KEV Alerts" value={corr?.kev_alerts || 0} color="text-blue-500" />
          </div>

          {/* Campaign Alerts */}
          {ai?.active_campaigns && ai.active_campaigns.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-red-500" />
                  Correlated Campaign Alerts
                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 font-mono">
                    {ai.active_campaigns.length} ACTIVE
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ai.active_campaigns.map((campaign, i) => (
                  <div key={i} className="bg-background rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setExpandedCampaign(expandedCampaign === i ? null : i)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors"
                    >
                      <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", expandedCampaign === i && "rotate-90")} />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">{campaign.name}</h4>
                      </div>
                      <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border", stageConfig[campaign.stage]?.color || stageConfig.preparation.color)}>
                        {campaign.stage}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Conf: {campaign.confidence}</span>
                    </button>
                    {expandedCampaign === i && (
                      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border">
                        {campaign.indicators.length > 0 && (
                          <div className="space-y-1 pt-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Correlated Indicators</p>
                            <div className="flex flex-wrap gap-1.5">
                              {campaign.indicators.map((ind, j) => (
                                <span key={j} className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono">{ind}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {campaign.recommended_actions.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recommended Actions</p>
                            {campaign.recommended_actions.map((action, j) => (
                              <p key={j} className="text-xs text-foreground flex items-start gap-1.5">
                                <ArrowRight className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {action}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Automated Actions */}
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
                    <Eye className="w-4 h-4 text-orange-500" /> Blind Spots
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
                    <Shield className="w-4 h-4 text-emerald-500" /> Coverage
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
        </div>
      )}

      {/* Live Signal Timeline */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Cross-Signal Timeline
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">{localSignals.length} SIGNALS</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {localSignals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No signals detected. Ingest feed data to populate.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-cyber">
              {localSignals.map((signal, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                    signal.severity === "critical" ? "bg-red-500" :
                    signal.severity === "high" ? "bg-orange-500" : "bg-yellow-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{signal.detail}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(signal.time).toLocaleString()}
                      </span>
                      <span className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground">{signal.source}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <p className="text-[10px] text-muted-foreground text-center font-mono">
          Generated at {new Date(result.generated_at).toLocaleString()} · LRX Correlation Matrix v3.0
        </p>
      )}
    </motion.div>
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
