/**
 * ThreatHeatmap.tsx — Main dashboard view for the "Global Threat Map" tab.
 *
 * Composes:
 *   1. Top row: Interactive SVG world map (ThreatMapWidget) + side panel
 *      with Attack Vectors breakdown and Email Auth failure stats.
 *   2. Bottom: Tabbed threat intelligence lists organized by source type:
 *      - Active Threats (threats table)
 *      - Vulnerabilities (threat_news — CISA KEV, OTX, Ransomwatch)
 *      - IOC Feed (social_iocs — ThreatFox, TweetFeed, Mastodon)
 *      - Tor Nodes (tor_exit_nodes)
 */

import { motion } from "framer-motion";
import {
  Crosshair, Layers, Database, ChevronDown, ChevronUp,
  Search, Shield, Rss, Globe2, AlertTriangle, Copy, BarChart3,
} from "lucide-react";
import { ThreatMapWidget } from "./ThreatMapWidget";
import { ThreatDetailDialog } from "./ThreatDetailDialog";
import { HostingProviderIntel } from "./HostingProviderIntel";
import {
  useThreats, useThreatNews, useTorExitNodes,
  triggerIngestion,
} from "@/hooks/use-threat-data";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";

/** Hook: full social_iocs data for the IOC Feed tab */
function useSocialIocsFullList() {
  return useQuery({
    queryKey: ["social_iocs_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_iocs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });
}

export function ThreatHeatmap() {
  const { data: liveThreats, isLoading, refetch } = useThreats();
  
  const { data: threatNews, isLoading: newsLoading } = useThreatNews();
  const { data: torNodes, isLoading: torLoading } = useTorExitNodes();
  const { data: socialIocs, isLoading: iocsLoading } = useSocialIocsFullList();
  const [ingesting, setIngesting] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const { toast } = useToast();

  // ─── Threat Source Breakdown ───
  const sourceBreakdown = useMemo(() => {
    if (!liveThreats || liveThreats.length === 0) return [];
    const counts = new Map<string, number>();
    liveThreats.forEach((t: any) => {
      const src = t.source || "unknown";
      counts.set(src, (counts.get(src) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([source, count]) => ({ source, count, pct: Math.round((count / liveThreats.length) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [liveThreats]);

  // ─── Filtered Active Threats ───
  const filteredThreats = useMemo(() => {
    if (!liveThreats) return [];
    let list = [...liveThreats];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t: any) =>
        (t.brand || "").toLowerCase().includes(q) ||
        (t.domain || "").toLowerCase().includes(q) ||
        (t.attack_type || "").toLowerCase().includes(q) ||
        (t.source || "").toLowerCase().includes(q)
      );
    }
    if (severityFilter) {
      list = list.filter((t: any) => t.severity === severityFilter);
    }
    return list;
  }, [liveThreats, searchQuery, severityFilter]);

  // ─── Filtered Vulnerabilities (threat_news) ───
  const filteredNews = useMemo(() => {
    if (!threatNews) return [];
    let list = [...threatNews];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((n: any) =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.cve_id || "").toLowerCase().includes(q) ||
        (n.vendor || "").toLowerCase().includes(q) ||
        (n.product || "").toLowerCase().includes(q)
      );
    }
    if (severityFilter) {
      list = list.filter((n: any) => n.severity === severityFilter);
    }
    return list;
  }, [threatNews, searchQuery, severityFilter]);

  // ─── Filtered IOCs ───
  const filteredIocs = useMemo(() => {
    if (!socialIocs) return [];
    let list = [...socialIocs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((ioc: any) =>
        (ioc.ioc_value || "").toLowerCase().includes(q) ||
        (ioc.ioc_type || "").toLowerCase().includes(q) ||
        (ioc.source || "").toLowerCase().includes(q) ||
        (ioc.tags || []).some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [socialIocs, searchQuery]);

  // ─── Filtered Tor Nodes ───
  const filteredTor = useMemo(() => {
    if (!torNodes) return [];
    if (!searchQuery) return torNodes;
    const q = searchQuery.toLowerCase();
    return torNodes.filter((n: any) => (n.ip_address || "").includes(q));
  }, [torNodes, searchQuery]);


  const handleThreatClick = (t: any) => setSelectedThreat(t);

  const handleIngest = async (source: string) => {
    setIngesting(true);
    try {
      const result = await triggerIngestion(source);
      toast({ title: "Ingestion Complete", description: `Fetched ${result.fetched} records, ${result.new} new threats.` });
      refetch();
    } catch (e: any) {
      toast({ title: "Ingestion Failed", description: e.message, variant: "destructive" });
    } finally {
      setIngesting(false);
    }
  };

  const copyIoc = (value: string) => {
    navigator.clipboard.writeText(value);
    sonnerToast.success("Copied to clipboard");
  };

  const severityBadge = (sev: string) => {
    const cls =
      sev === "critical" ? "bg-destructive/20 text-destructive border-destructive/30" :
      sev === "high" ? "bg-warning/20 text-warning border-warning/30" :
      sev === "medium" ? "bg-warning/10 text-warning border-warning/20" :
      "bg-muted text-muted-foreground border-border";
    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border ${cls}`}>{sev}</span>;
  };

  // Tab counts
  const threatCount = liveThreats?.length || 0;
  const newsCount = threatNews?.length || 0;
  const iocCount = socialIocs?.length || 0;
  const torCount = torNodes?.length || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Top row: Map + Attack Vectors & Email Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="lg:col-span-7">
          <ThreatMapWidget />
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-6">
          {/* Hosting Provider Intelligence */}
          <HostingProviderIntel />

          {/* Threat Source Breakdown */}
          <div className="bg-card rounded-lg border border-border shadow-xl overflow-hidden flex flex-col">
            <div className="px-4 lg:px-5 py-3 border-b border-border bg-surface-elevated flex justify-between items-center">
              <h3 className="font-bold text-foreground uppercase text-xs lg:text-sm flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-primary shrink-0" />
                <span className="hidden sm:inline">Threat Source Breakdown</span>
                <span className="sm:hidden">Sources</span>
              </h3>
              <span className="text-[10px] lg:text-xs text-primary font-mono">
                {sourceBreakdown.length} FEEDS
              </span>
            </div>
            <div className="p-3 lg:p-4 bg-surface-overlay/50 space-y-2 max-h-[160px] overflow-y-auto">
              {sourceBreakdown.length > 0 ? (
                sourceBreakdown.map((s) => (
                  <div key={s.source} className="flex items-center gap-2">
                    <span className="text-[10px] lg:text-xs font-mono text-muted-foreground w-24 truncate uppercase">{s.source}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.max(s.pct, 2)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-foreground w-12 text-right">{s.count}</span>
                    <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">{s.pct}%</span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-xs text-muted-foreground text-center">No threat data yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabbed Intelligence Lists ─── */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xl">
        {/* Search + filter bar */}
        <div className="px-4 lg:px-5 py-3 border-b border-border bg-surface-elevated flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search across all feeds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background/50"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {["critical", "high", "medium", "low"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
                className={`text-[10px] px-2 py-1 rounded border font-mono uppercase transition-colors ${
                  severityFilter === sev
                    ? sev === "critical" ? "bg-destructive/20 text-destructive border-destructive/40" :
                      sev === "high" ? "bg-warning/20 text-warning border-warning/40" :
                      sev === "medium" ? "bg-warning/10 text-warning border-warning/30" :
                      "bg-muted text-muted-foreground border-border"
                    : "bg-background/60 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {sev}
              </button>
            ))}
            {(searchQuery || severityFilter) && (
              <button
                onClick={() => { setSearchQuery(""); setSeverityFilter(null); }}
                className="text-[10px] text-primary hover:text-primary/80 px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <Tabs defaultValue="threats" className="w-full">
          <div className="px-4 border-b border-border bg-surface-overlay/30">
            <TabsList className="bg-transparent h-auto p-0 gap-0">
              <TabsTrigger value="threats" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5 text-xs gap-1.5">
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Active Threats</span>
                <span className="sm:hidden">Threats</span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">{threatCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="vulns" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5 text-xs gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vulnerabilities</span>
                <span className="sm:hidden">CVEs</span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">{newsCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="iocs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5 text-xs gap-1.5">
                <Rss className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">IOC Feed</span>
                <span className="sm:hidden">IOCs</span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">{iocCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="tor" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5 text-xs gap-1.5">
                <Globe2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tor Nodes</span>
                <span className="sm:hidden">Tor</span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">{torCount}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Active Threats Tab ── */}
          <TabsContent value="threats" className="mt-0">
            <div className="px-4 py-2 border-b border-border bg-surface-overlay/20 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono">{filteredThreats.length} RESULTS</span>
              <div className="flex items-center gap-2 flex-wrap">
                {["urlhaus", "openphish", "phishtank"].map((src) => (
                  <button
                    key={src}
                    onClick={() => handleIngest(src)}
                    disabled={ingesting}
                    className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    <Database className="w-3 h-3" />
                    {ingesting ? "..." : src}
                  </button>
                ))}
              </div>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</div>
              ) : filteredThreats.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">No threats match your filters</div>
              ) : (
                filteredThreats.map((t: any) => (
                  <div key={t.id} className="p-3 hover:bg-accent/30 transition-colors cursor-pointer active:bg-accent/50" onClick={() => handleThreatClick(t)}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-foreground text-sm">{t.brand}</span>
                      <span className="text-primary font-mono text-xs">{t.confidence}%</span>
                    </div>
                    <p className="font-mono text-[11px] text-destructive mb-1 break-all">{t.domain}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-foreground border border-border">{t.attack_type}</span>
                      {t.severity && severityBadge(t.severity)}
                      {t.source && <span className="text-[9px] text-muted-foreground font-mono">{t.source}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-surface-overlay/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-2">Target Brand</th>
                    <th className="px-4 py-2">Domain</th>
                    <th className="px-4 py-2">Attack Type</th>
                    <th className="px-4 py-2">Severity</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center">Loading...</td></tr>
                  ) : filteredThreats.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center">No threats match your filters</td></tr>
                  ) : (
                    filteredThreats.map((t: any) => (
                      <tr key={t.id} className="hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => handleThreatClick(t)}>
                        <td className="px-4 py-3 font-bold text-foreground">{t.brand}</td>
                        <td className="px-4 py-3 font-mono text-xs text-destructive">{t.domain}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-accent text-foreground border border-border">{t.attack_type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">{t.severity && severityBadge(t.severity)}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{t.source || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-primary font-mono text-xs">{t.confidence}%</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Vulnerabilities Tab ── */}
          <TabsContent value="vulns" className="mt-0">
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {newsLoading ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</div>
              ) : filteredNews.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">No vulnerabilities match your filters</div>
              ) : (
                filteredNews.map((n: any) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => n.url && window.open(n.url, "_blank", "noopener")}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {n.cve_id && (
                            <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded">{n.cve_id}</span>
                          )}
                          {severityBadge(n.severity)}
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">{n.source}</span>
                        </div>
                        <p className="text-sm font-bold text-foreground leading-tight">{n.title}</p>
                        {n.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {n.vendor && <p className="text-[10px] text-muted-foreground">{n.vendor}</p>}
                        {n.metadata?.due_date && (
                          <p className={`text-[10px] font-mono mt-0.5 ${
                            (n.metadata.days_until_due || 0) <= 3 ? "text-destructive" : "text-muted-foreground"
                          }`}>
                            Due: {n.metadata.due_date}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── IOC Feed Tab ── */}
          <TabsContent value="iocs" className="mt-0">
            <div className="hidden sm:block overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-surface-overlay/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-2">IOC Value</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Confidence</th>
                    <th className="px-4 py-2">Tags</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {iocsLoading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center">Loading...</td></tr>
                  ) : filteredIocs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center">No IOCs match your filters</td></tr>
                  ) : (
                    filteredIocs.map((ioc: any) => (
                      <tr key={ioc.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-foreground max-w-[300px] truncate">{ioc.ioc_value}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-accent text-foreground border border-border">{ioc.ioc_type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">{ioc.source}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            ioc.confidence === "high" ? "bg-destructive/20 text-destructive" :
                            ioc.confidence === "medium" ? "bg-warning/20 text-warning" :
                            "bg-muted text-muted-foreground"
                          }`}>{ioc.confidence}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {(ioc.tags || []).slice(0, 3).map((tag: string) => (
                              <span key={tag} className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded">{tag}</span>
                            ))}
                            {(ioc.tags || []).length > 3 && (
                              <span className="text-[9px] text-muted-foreground">+{ioc.tags.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => copyIoc(ioc.ioc_value)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile IOC cards */}
            <div className="sm:hidden divide-y divide-border max-h-[500px] overflow-y-auto">
              {iocsLoading ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</div>
              ) : filteredIocs.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">No IOCs match your filters</div>
              ) : (
                filteredIocs.map((ioc: any) => (
                  <div key={ioc.id} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-foreground border border-border">{ioc.ioc_type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted-foreground">{ioc.source}</span>
                        <button onClick={() => copyIoc(ioc.ioc_value)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="font-mono text-[11px] text-foreground break-all">{ioc.ioc_value}</p>
                    {(ioc.tags || []).length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {ioc.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── Tor Nodes Tab ── */}
          <TabsContent value="tor" className="mt-0">
            <div className="hidden sm:block overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-surface-overlay/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-2">IP Address</th>
                    <th className="px-4 py-2">Last Seen</th>
                    <th className="px-4 py-2">First Seen</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {torLoading ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center">Loading...</td></tr>
                  ) : filteredTor.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center">No Tor nodes match your search</td></tr>
                  ) : (
                    filteredTor.map((n: any) => (
                      <tr key={n.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-foreground">{n.ip_address}</td>
                        <td className="px-4 py-3 text-xs font-mono">{new Date(n.last_seen).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-xs font-mono">{new Date(n.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => copyIoc(n.ip_address)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile Tor cards */}
            <div className="sm:hidden divide-y divide-border max-h-[500px] overflow-y-auto">
              {torLoading ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</div>
              ) : filteredTor.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">No Tor nodes match your search</div>
              ) : (
                filteredTor.map((n: any) => (
                  <div key={n.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-foreground">{n.ip_address}</p>
                      <p className="text-[10px] text-muted-foreground">Last seen: {new Date(n.last_seen).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => copyIoc(n.ip_address)} className="text-muted-foreground hover:text-foreground">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail dialog */}
      <ThreatDetailDialog
        threat={selectedThreat}
        open={!!selectedThreat}
        onOpenChange={(open) => { if (!open) setSelectedThreat(null); }}
      />
    </motion.div>
  );
}
