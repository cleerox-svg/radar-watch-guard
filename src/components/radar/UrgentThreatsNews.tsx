/**
 * UrgentThreatsNews.tsx — Dashboard widget showing top 5 actively exploited
 * vulnerabilities from the CISA Known Exploited Vulnerabilities catalog.
 *
 * Data source: public.threat_news table (populated by ingest-cisa-kev edge fn).
 * Displays CVE ID, vendor/product, severity badge, and link to NVD detail.
 * Includes a manual "Ingest Now" button to trigger the edge function on demand.
 *
 * Auto-refreshes every 60s via React Query.
 */

import { useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, Shield, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useThreatNews, triggerCisaKevIngestion, triggerOtxIngestion } from "@/hooks/use-threat-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Severity → Tailwind color map using design tokens */
const severityStyles: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/70 text-destructive-foreground",
  medium: "bg-warning/20 text-warning border border-warning/30",
  low: "bg-muted text-muted-foreground",
};

export function UrgentThreatsNews() {
  const { data: news, isLoading } = useThreatNews();
  const [ingesting, setIngesting] = useState(false);
  const [ingestingOtx, setIngestingOtx] = useState(false);

  /** Invoke the CISA KEV edge function to pull fresh data */
  const handleIngest = async () => {
    setIngesting(true);
    try {
      const result = await triggerCisaKevIngestion();
      toast.success(`CISA KEV ingested: ${result.upserted} vulnerabilities`);
    } catch (err: any) {
      toast.error("KEV ingestion failed", { description: err.message });
    } finally {
      setIngesting(false);
    }
  };

  /** Invoke the OTX pulse edge function */
  const handleOtxIngest = async () => {
    setIngestingOtx(true);
    try {
      const result = await triggerOtxIngestion();
      toast.success(`OTX pulses ingested: ${result.upserted} campaigns`);
    } catch (err: any) {
      toast.error("OTX ingestion failed", { description: err.message });
    } finally {
      setIngestingOtx(false);
    }
  };

  // Show top 5 most recent entries
  const topNews = (news || []).slice(0, 5);

  return (
    <Card className="border-destructive/30 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Urgent Threats
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleIngest}
              disabled={ingesting}
              className="text-xs h-7 px-2 gap-1"
            >
              <RefreshCw className={cn("w-3 h-3", ingesting && "animate-spin")} />
              {ingesting ? "…" : "KEV"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOtxIngest}
              disabled={ingestingOtx}
              className="text-xs h-7 px-2 gap-1"
            >
              <RefreshCw className={cn("w-3 h-3", ingestingOtx && "animate-spin")} />
              {ingestingOtx ? "…" : "OTX"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          CISA KEV exploits & AlienVault OTX threat campaigns
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-md bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : topNews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No urgent threats ingested yet.</p>
            <p className="text-xs mt-1">Click "Ingest" to pull the CISA KEV catalog.</p>
          </div>
        ) : (
          topNews.map((item) => {
            const meta = item.metadata as Record<string, any> | null;
            const daysUntilDue = meta?.days_until_due;
            const ransomware = meta?.ransomware_use === "Known";

            return (
              <div
                key={item.id}
                className="group rounded-lg border border-border bg-background/50 p-3 hover:border-destructive/40 transition-colors"
              >
                {/* Top row: CVE badge + severity + ransomware tag */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.cve_id && (
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                        {item.cve_id}
                      </Badge>
                    )}
                    <Badge className={cn("text-[10px] px-1.5 py-0", severityStyles[item.severity] || severityStyles.high)}>
                      {item.severity.toUpperCase()}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                      {item.source === 'otx' ? 'OTX' : 'KEV'}
                    </Badge>
                    {ransomware && (
                      <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0">
                        🔒 RANSOMWARE
                      </Badge>
                    )}
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Title — truncated to 2 lines */}
                <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                  {item.title}
                </p>

                {/* Meta row: vendor/product + due date */}
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                  {(item.vendor || item.product) && (
                    <span className="font-mono">
                      {item.vendor}{item.product ? ` · ${item.product}` : ""}
                    </span>
                  )}
                  {typeof daysUntilDue === "number" && (
                    <span className={cn(
                      "flex items-center gap-0.5",
                      daysUntilDue <= 7 ? "text-destructive" : daysUntilDue <= 30 ? "text-warning" : ""
                    )}>
                      <Clock className="w-3 h-3" />
                      {daysUntilDue <= 0 ? "OVERDUE" : `${daysUntilDue}d left`}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
