/**
 * ThreatDetailDialog.tsx — Modal dialog showing full IOC details + AI analysis.
 */

import { useState } from "react";
import { useCreateInvestigationTicket } from "@/components/radar/InvestigationTracker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Shield, Globe, Clock, AlertTriangle, Copy, ExternalLink, Ban, Flag, Server,
  Brain, Loader2, Lightbulb, Target, Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Shape of a threat record passed from the parent component */
interface ThreatDetail {
  id: string;
  brand: string;
  domain: string;
  attack_type: string;
  confidence: number;
  severity?: string;
  status?: string;
  source?: string;
  country?: string;
  ip_address?: string | null;
  first_seen?: string;
  last_seen?: string;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
}

interface ThreatDetailDialogProps {
  threat: ThreatDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Maps severity levels to display colors and labels */
const severityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: "bg-destructive text-destructive-foreground", label: "CRITICAL" },
  high: { color: "bg-warning text-warning-foreground", label: "HIGH" },
  medium: { color: "bg-warning/70 text-warning-foreground", label: "MEDIUM" },
  low: { color: "bg-info text-info-foreground", label: "LOW" },
  info: { color: "bg-muted text-muted-foreground", label: "INFO" },
};

/** Maps threat status to text color classes */
const statusConfig: Record<string, string> = {
  active: "text-destructive",
  investigating: "text-warning",
  mitigated: "text-info",
  resolved: "text-primary",
};

/** Reusable row component for displaying an icon + label + value */
function InfoRow({ icon: Icon, label, value, mono = false }: { icon: typeof Globe; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm text-foreground break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );
}

export function ThreatDetailDialog({ threat, open, onOpenChange }: ThreatDetailDialogProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const createTicket = useCreateInvestigationTicket();

  if (!threat) return null;

  const sev = severityConfig[threat.severity || "medium"] || severityConfig.medium;
  const statusClass = statusConfig[threat.status || "active"] || "text-foreground";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-threat", {
        body: { threat },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      toast.success("AI analysis complete");
    } catch (err: any) {
      toast.error("Analysis failed", { description: err.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const timelineEvents = [
    { label: "First Seen", time: threat.first_seen },
    { label: "Last Seen", time: threat.last_seen },
    { label: "Ingested", time: threat.created_at },
  ].filter((e) => e.time);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setAnalysis(null); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={sev.color}>{sev.label}</Badge>
            <Badge variant="outline" className={statusClass}>
              {(threat.status || "active").toUpperCase()}
            </Badge>
            <span className="text-primary font-mono text-sm ml-auto">{threat.confidence}%</span>
          </div>
          <DialogTitle className="text-lg mt-2">{threat.brand}</DialogTitle>
        </DialogHeader>

        <Separator />

        {/* IOC details */}
        <div className="space-y-0">
          <InfoRow icon={Globe} label="Impersonation Domain" value={
            <span className="flex items-center gap-2">
              <span className="text-destructive">{threat.domain}</span>
              <button onClick={() => copyToClipboard(threat.domain, "Domain")} className="text-muted-foreground hover:text-foreground">
                <Copy className="w-3 h-3" />
              </button>
            </span>
          } mono />
          <InfoRow icon={AlertTriangle} label="Attack Type" value={threat.attack_type} />
          <InfoRow icon={Shield} label="Source Feed" value={(threat.source || "manual").toUpperCase()} />
          <InfoRow icon={Flag} label="Origin Country" value={threat.country || "Unknown"} />
          <InfoRow icon={Server} label="IP Address" value={
            threat.ip_address ? (
              <span className="flex items-center gap-2">
                {threat.ip_address}
                <button onClick={() => copyToClipboard(threat.ip_address!, "IP")} className="text-muted-foreground hover:text-foreground">
                  <Copy className="w-3 h-3" />
                </button>
              </span>
            ) : "Not resolved"
          } mono />
        </div>

        <Separator />

        {/* Timeline */}
        <div>
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Timeline
          </h4>
          <div className="relative pl-4 border-l-2 border-border space-y-3">
            {timelineEvents.map((event) => (
              <div key={event.label} className="relative">
                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{event.label}</p>
                <p className="text-sm text-foreground font-mono">{format(new Date(event.time!), "yyyy-MM-dd HH:mm:ss")}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(event.time!), { addSuffix: true })}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* AI Analysis section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-primary" /> AI Deep Analysis
            </h4>
            <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={analyzing} className="text-xs h-7 gap-1">
              {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze"}
            </Button>
          </div>

          {!analysis && !analyzing && (
            <p className="text-xs text-muted-foreground text-center py-4">Click "Analyze" for AI-powered MITRE ATT&CK mapping, campaign attribution, and mitigations</p>
          )}

          {analyzing && (
            <div className="text-center py-6">
              <Brain className="w-8 h-8 mx-auto mb-2 text-primary animate-pulse" />
              <p className="text-xs text-muted-foreground">Analyzing threat intelligence…</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              {/* Risk Summary */}
              {analysis.risk_summary && (
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn("text-[10px]", severityConfig[analysis.risk_level]?.color || severityConfig.high.color)}>
                      {(analysis.risk_level || 'high').toUpperCase()} RISK
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{analysis.risk_summary}</p>
                </div>
              )}

              {/* MITRE ATT&CK */}
              {analysis.mitre_techniques?.length > 0 && (
                <div>
                  <h5 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                    <Target className="w-3 h-3" /> MITRE ATT&CK
                  </h5>
                  <div className="space-y-1.5">
                    {analysis.mitre_techniques.map((t: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 shrink-0">{t.id}</Badge>
                        <div>
                          <span className="font-medium text-foreground">{t.name}</span>
                          {t.relevance && <p className="text-muted-foreground text-[11px] mt-0.5">{t.relevance}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Campaign Analysis */}
              {analysis.campaign_analysis?.likely_campaign && (
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <h5 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Campaign Attribution</h5>
                  <p className="text-xs text-foreground font-medium">{analysis.campaign_analysis.likely_campaign}</p>
                  {analysis.campaign_analysis.actor_profile && analysis.campaign_analysis.actor_profile !== 'Unattributed' && (
                    <p className="text-[11px] text-muted-foreground mt-1">Actor: {analysis.campaign_analysis.actor_profile}</p>
                  )}
                  {analysis.campaign_analysis.infrastructure_notes && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{analysis.campaign_analysis.infrastructure_notes}</p>
                  )}
                </div>
              )}

              {/* Mitigations */}
              {analysis.mitigations?.length > 0 && (
                <div>
                  <h5 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-primary" /> Mitigations
                  </h5>
                  <div className="space-y-2">
                    {analysis.mitigations.map((m: any, i: number) => (
                      <div key={i} className="rounded border border-border bg-background/50 p-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{(m.priority || 'ongoing').toUpperCase()}</Badge>
                          <span className="text-xs font-medium text-foreground">{m.action}</span>
                        </div>
                        {m.detail && <p className="text-[11px] text-muted-foreground">{m.detail}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Takedown action buttons */}
        <div>
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Takedown Actions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="destructive" size="sm" className="w-full" onClick={() => toast.info("Takedown request submitted for review")}>
              <Ban className="w-4 h-4 mr-2" /> Request Takedown
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => toast.info("Threat flagged for analyst review")}>
              <Flag className="w-4 h-4 mr-2" /> Flag for Review
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(`https://www.virustotal.com/gui/domain/${threat.domain}`, "_blank", "noopener")}>
              <ExternalLink className="w-4 h-4 mr-2" /> VirusTotal Lookup
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => copyToClipboard(JSON.stringify(threat, null, 2), "Threat JSON")}>
              <Copy className="w-4 h-4 mr-2" /> Copy IOC JSON
            </Button>
            <Button variant="secondary" size="sm" className="w-full sm:col-span-2" onClick={() => createTicket({
              title: `${threat.brand} — ${threat.domain}`,
              source_type: "threat",
              source_id: threat.id,
              severity: threat.severity || "medium",
              priority: threat.severity === "critical" ? "critical" : threat.severity === "high" ? "high" : "medium",
              description: `${threat.attack_type} attack targeting ${threat.brand} via ${threat.domain}`,
              tags: [threat.attack_type, threat.brand, threat.source || "manual"].filter(Boolean),
            })}>
              <Ticket className="w-4 h-4 mr-2" /> Create Investigation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
