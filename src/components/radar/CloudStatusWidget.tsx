/**
 * CloudStatusWidget.tsx — Real-time Cloud & SaaS Provider Status Panel.
 *
 * Displays live incident data from cloud_incidents table, organized by:
 *   - Active outages and degradation events
 *   - DDoS attack trends from Cloudflare Radar
 *   - BGP routing anomalies for major cloud ASNs
 *   - Incident timeline with resolution tracking
 *
 * Also provides correlation overlay data to ThreatHeatmap and ThreatStatistics.
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Cloud, AlertTriangle, Shield, Globe2, Activity, Wifi,
  WifiOff, RefreshCw, ChevronDown, ChevronUp, Clock, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

/** Hook: fetch cloud incidents from DB */
export function useCloudIncidents() {
  return useQuery({
    queryKey: ["cloud_incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cloud_incidents")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

/** Trigger cloud status ingestion functions */
async function triggerCloudStatusIngestion() {
  const results = await Promise.allSettled([
    supabase.functions.invoke("ingest-cloud-status"),
    supabase.functions.invoke("ingest-cloudflare-radar"),
    supabase.functions.invoke("ingest-bgpstream"),
  ]);
  return results;
}

const PROVIDER_ICONS: Record<string, string> = {
  aws: "🔶",
  azure: "🔷",
  gcp: "🟢",
  cloudflare: "🟠",
  github: "⚫",
  datadog: "🟣",
  internet: "🌐",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  info: "bg-muted text-muted-foreground",
};

export function CloudStatusWidget() {
  const { data: incidents, isLoading, refetch } = useCloudIncidents();
  const [ingesting, setIngesting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeIncidents = useMemo(
    () => (incidents || []).filter((i: any) => i.status !== "resolved"),
    [incidents]
  );

  const resolvedRecent = useMemo(
    () => (incidents || []).filter((i: any) => i.status === "resolved").slice(0, 10),
    [incidents]
  );

  const providerHealth = useMemo(() => {
    const providers = ["aws", "azure", "gcp", "cloudflare", "github", "datadog"];
    return providers.map((p) => {
      const active = activeIncidents.filter((i: any) => i.provider === p);
      const worstSeverity = active.reduce((worst: string, i: any) => {
        const order = ["info", "low", "medium", "high", "critical"];
        return order.indexOf(i.severity) > order.indexOf(worst) ? i.severity : worst;
      }, "info");
      return {
        provider: p,
        icon: PROVIDER_ICONS[p] || "☁️",
        activeCount: active.length,
        worstSeverity: active.length > 0 ? worstSeverity : "ok",
        label: p.charAt(0).toUpperCase() + p.slice(1),
      };
    });
  }, [activeIncidents]);

  const bgpAlerts = useMemo(
    () => (incidents || []).filter((i: any) => i.source === "bgpstream" && i.status !== "resolved"),
    [incidents]
  );

  const attackTrends = useMemo(
    () => (incidents || []).filter((i: any) => i.source === "cloudflare_radar"),
    [incidents]
  );

  const handleIngest = async () => {
    setIngesting(true);
    try {
      await triggerCloudStatusIngestion();
      toast.success("Cloud status feeds refreshed");
      refetch();
    } catch {
      toast.error("Failed to refresh cloud status");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Provider Health Overview */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              Cloud & SaaS Status
            </CardTitle>
            <button
              onClick={handleIngest}
              disabled={ingesting}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${ingesting ? "animate-spin" : ""}`} />
              {ingesting ? "Fetching…" : "Refresh All"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            {providerHealth.map((p) => (
              <div
                key={p.provider}
                className={`flex flex-col items-center p-2 rounded-lg border transition-colors ${
                  p.activeCount === 0
                    ? "border-green-500/30 bg-green-500/5"
                    : p.worstSeverity === "critical"
                    ? "border-destructive/50 bg-destructive/10"
                    : "border-yellow-500/30 bg-yellow-500/5"
                }`}
              >
                <span className="text-xl">{p.icon}</span>
                <span className="text-[10px] font-medium text-muted-foreground mt-1">{p.label}</span>
                {p.activeCount === 0 ? (
                  <Wifi className="h-3 w-3 text-green-500 mt-1" />
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <WifiOff className="h-3 w-3 text-destructive" />
                    <span className="text-[10px] text-destructive font-bold">{p.activeCount}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-foreground">{activeIncidents.length}</div>
              <div className="text-[10px] text-muted-foreground">Active</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-foreground">{bgpAlerts.length}</div>
              <div className="text-[10px] text-muted-foreground">BGP Alerts</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-foreground">{attackTrends.length}</div>
              <div className="text-[10px] text-muted-foreground">DDoS Trends</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-foreground">{resolvedRecent.length}</div>
              <div className="text-[10px] text-muted-foreground">Resolved</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incident Tabs */}
      <Card className="border-border/50 bg-card">
        <CardContent className="pt-4">
          <Tabs defaultValue="active">
            <TabsList className="grid grid-cols-4 w-full mb-3">
              <TabsTrigger value="active" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" /> Active ({activeIncidents.length})
              </TabsTrigger>
              <TabsTrigger value="bgp" className="text-xs">
                <Globe2 className="h-3 w-3 mr-1" /> BGP ({bgpAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="ddos" className="text-xs">
                <Zap className="h-3 w-3 mr-1" /> DDoS ({attackTrends.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">
                <Shield className="h-3 w-3 mr-1" /> Resolved
              </TabsTrigger>
            </TabsList>

            {/* Active Incidents */}
            <TabsContent value="active" className="max-h-80 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
              ) : activeIncidents.length === 0 ? (
                <div className="text-center py-8">
                  <Wifi className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All systems operational</p>
                </div>
              ) : (
                activeIncidents.map((inc: any) => (
                  <IncidentRow
                    key={inc.id}
                    incident={inc}
                    expanded={expanded === inc.id}
                    onToggle={() => setExpanded(expanded === inc.id ? null : inc.id)}
                  />
                ))
              )}
            </TabsContent>

            {/* BGP Alerts */}
            <TabsContent value="bgp" className="max-h-80 overflow-y-auto space-y-2">
              {bgpAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No BGP anomalies detected</div>
              ) : (
                bgpAlerts.map((inc: any) => (
                  <IncidentRow
                    key={inc.id}
                    incident={inc}
                    expanded={expanded === inc.id}
                    onToggle={() => setExpanded(expanded === inc.id ? null : inc.id)}
                  />
                ))
              )}
            </TabsContent>

            {/* DDoS Trends */}
            <TabsContent value="ddos" className="max-h-80 overflow-y-auto space-y-2">
              {attackTrends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No DDoS data yet — refresh to fetch</div>
              ) : (
                attackTrends.map((inc: any) => (
                  <IncidentRow
                    key={inc.id}
                    incident={inc}
                    expanded={expanded === inc.id}
                    onToggle={() => setExpanded(expanded === inc.id ? null : inc.id)}
                  />
                ))
              )}
            </TabsContent>

            {/* Resolved */}
            <TabsContent value="resolved" className="max-h-80 overflow-y-auto space-y-2">
              {resolvedRecent.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No recent resolutions</div>
              ) : (
                resolvedRecent.map((inc: any) => (
                  <IncidentRow
                    key={inc.id}
                    incident={inc}
                    expanded={expanded === inc.id}
                    onToggle={() => setExpanded(expanded === inc.id ? null : inc.id)}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Single incident row with expand/collapse */
function IncidentRow({
  incident,
  expanded,
  onToggle,
}: {
  incident: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  const icon = PROVIDER_ICONS[incident.provider] || "☁️";

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-base">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground truncate">{incident.title}</span>
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${SEVERITY_COLORS[incident.severity] || ""}`}>
              {incident.severity}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              {incident.service || incident.provider}
            </span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatDistanceToNow(new Date(incident.started_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-muted-foreground border-t border-border/30 pt-2 space-y-1">
          {incident.description && <p>{incident.description}</p>}
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="text-[10px]">Source: <span className="text-foreground">{incident.source}</span></span>
            {incident.region && <span className="text-[10px]">Region: <span className="text-foreground">{incident.region}</span></span>}
            {incident.asn && <span className="text-[10px]">ASN: <span className="text-foreground">{incident.asn}</span></span>}
            {incident.impact_score && (
              <span className="text-[10px]">
                Impact: <span className={`font-bold ${incident.impact_score > 70 ? "text-destructive" : "text-foreground"}`}>{incident.impact_score}/100</span>
              </span>
            )}
          </div>
          {incident.source_url && (
            <a href={incident.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-[10px]">
              View source →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
