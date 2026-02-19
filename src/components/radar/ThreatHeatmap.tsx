/**
 * ThreatHeatmap.tsx — Main dashboard view for the "Global Threat Map" tab.
 *
 * Composes three sections:
 *   1. Top row: Interactive SVG world map (ThreatMapWidget) + side panel
 *      with Attack Vectors breakdown and Email Auth failure stats.
 *   2. Bottom: Live threat target table (desktop) / card list (mobile)
 *      with feed ingestion trigger buttons.
 *
 * Data sources (all from Lovable Cloud DB via React Query hooks):
 *   - useThreats()          → threats table    → target list, attack vectors
 *   - useEmailAuthReports() → email_auth_reports → SPF/DKIM/DMARC failure %
 *   - triggerIngestion()    → ingest-threats edge function → pull fresh feed data
 */

import { motion } from "framer-motion";
import { Crosshair, Layers, MailCheck, Database, ChevronDown, ChevronUp } from "lucide-react";
import { ThreatMapWidget } from "./ThreatMapWidget";
import { ThreatDetailDialog } from "./ThreatDetailDialog";
import { useThreats, useEmailAuthReports, triggerIngestion } from "@/hooks/use-threat-data";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

export function ThreatHeatmap() {
  const { data: liveThreats, isLoading, refetch } = useThreats();
  const { data: emailReports } = useEmailAuthReports();
  const [ingesting, setIngesting] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);
  const [showAllVectors, setShowAllVectors] = useState(false);
  const { toast } = useToast();

  /**
   * Compute email authentication failure percentages from DMARC reports.
   * Aggregates total volume across all reports, then calculates what
   * percentage of that volume failed SPF, DKIM, or DMARC alignment.
   * Used by the "Email Auth Stats" widget in the sidebar.
   */
  const emailStats = useMemo(() => {
    if (!emailReports || emailReports.length === 0) return null;
    const total = emailReports.reduce((sum: number, r: any) => sum + (r.volume || 0), 0);
    const spfFail = emailReports.filter((r: any) => !r.spf_pass).reduce((s: number, r: any) => s + (r.volume || 0), 0);
    const dkimFail = emailReports.filter((r: any) => !r.dkim_pass).reduce((s: number, r: any) => s + (r.volume || 0), 0);
    const dmarcFail = emailReports.filter((r: any) => !r.dmarc_aligned).reduce((s: number, r: any) => s + (r.volume || 0), 0);
    return {
      spfFail: total > 0 ? Math.round((spfFail / total) * 100) : 0,
      dkimFail: total > 0 ? Math.round((dkimFail / total) * 100) : 0,
      dmarcFail: total > 0 ? Math.round((dmarcFail / total) * 100) : 0,
      totalRejects: spfFail + dkimFail,
    };
  }, [emailReports]);

  /**
   * Build the live targets list sorted by most-impacted brand.
   * Groups threats by brand name, sorts brands by threat count descending,
   * then within each brand sorts by confidence score descending.
   * This ensures the most-attacked brands with highest-confidence IOCs appear first.
   */
  const targets = useMemo(() => {
    if (!liveThreats || liveThreats.length === 0) return [];
    const brandMap = new Map<string, { count: number; threats: any[] }>();
    liveThreats.forEach((t: any) => {
      const brand = t.brand || "Unknown";
      const entry = brandMap.get(brand) || { count: 0, threats: [] };
      entry.count++;
      entry.threats.push(t);
      brandMap.set(brand, entry);
    });
    return Array.from(brandMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .flatMap(([, { threats }]) =>
        threats.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
      );
  }, [liveThreats]);

  /**
   * Compute attack vector categories from live threat data.
   * Groups by attack_type, counts occurrences, calculates percentage of total.
   * Sorted descending by count. The full list is computed; the UI shows top 5
   * by default with an expand button to reveal all.
   */
  const allCategories = useMemo(() => {
    if (!liveThreats || liveThreats.length === 0) return [];
    const typeMap = new Map<string, number>();
    liveThreats.forEach((t: any) => {
      const type = t.attack_type || "Unknown";
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    const total = liveThreats.length;
    return Array.from(typeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / total) * 100),
      }));
  }, [liveThreats]);

  /** Visible categories: top 5 or all, controlled by showAllVectors toggle */
  const categories = showAllVectors ? allCategories : allCategories.slice(0, 5);

  /** Color cycle for attack vector progress bars (repeats for lists > 5) */
  const barColors = ["bg-destructive", "bg-warning", "bg-warning", "bg-info", "bg-muted-foreground"];

  /** Opens the ThreatDetailDialog with full IOC details for a clicked threat */
  const handleThreatClick = (t: any) => {
    setSelectedThreat(t);
  };

  /**
   * Triggers a feed ingestion via the ingest-threats edge function.
   * Shows a toast on success/failure and refetches the threats query
   * to immediately reflect new data in the UI.
   */
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Top row: Map (7 cols) + Attack Vectors & Email Stats (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="lg:col-span-7">
          <ThreatMapWidget />
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-6">
          {/* Attack Vectors — top 5 with expand toggle */}
          <div className="bg-card rounded-lg border border-border shadow-xl overflow-hidden flex-1 flex flex-col">
            <div className="px-4 lg:px-5 py-3 border-b border-border bg-surface-elevated flex justify-between items-center">
              <h3 className="font-bold text-foreground uppercase text-xs lg:text-sm flex items-center">
                <Layers className="w-4 h-4 mr-2 text-primary shrink-0" />Attack Vectors
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground">{allCategories.length} TYPES</span>
            </div>
            <div className="flex-1 p-3 lg:p-4 overflow-auto bg-surface-overlay/50 space-y-3 lg:space-y-4">
              {categories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No live data — pull a feed to populate</p>
              ) : (
                <>
                  {categories.map((cat, i) => (
                    <div key={cat.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground font-bold">{cat.name}</span>
                        <span className="text-muted-foreground">{cat.count.toLocaleString()} ({cat.percent}%)</span>
                      </div>
                      <div className="h-1.5 bg-accent rounded-full overflow-hidden mb-1">
                        <div className={`h-full rounded-full ${barColors[i % barColors.length]}`} style={{ width: `${cat.percent}%` }} />
                      </div>
                    </div>
                  ))}
                  {/* Show expand/collapse only when there are more than 5 vector types */}
                  {allCategories.length > 5 && (
                    <button
                      onClick={() => setShowAllVectors(!showAllVectors)}
                      className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors w-full justify-center pt-1"
                    >
                      {showAllVectors ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showAllVectors ? "Show Top 5" : `Show All ${allCategories.length} Vectors`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Email Auth Stats — SPF/DKIM/DMARC failure rates from email_auth_reports */}
          <div className="bg-card rounded-lg border border-border shadow-xl overflow-hidden flex flex-col">
            <div className="px-4 lg:px-5 py-3 border-b border-border bg-surface-elevated flex justify-between items-center">
              <h3 className="font-bold text-foreground uppercase text-xs lg:text-sm flex items-center">
                <MailCheck className="w-4 h-4 mr-2 text-warning shrink-0" />
                <span className="hidden sm:inline">Email Auth Stats</span>
                <span className="sm:hidden">Auth Stats</span>
              </h3>
              <span className="text-[10px] lg:text-xs text-warning font-mono">
                {emailStats ? `${emailStats.totalRejects.toLocaleString()} REJECTS` : "NO DATA"}
              </span>
            </div>
            <div className="p-3 lg:p-4 grid grid-cols-3 gap-2 lg:gap-4 text-center bg-surface-overlay/50 items-center">
              {emailStats ? (
                [
                  { label: "SPF Fail", value: `${emailStats.spfFail}%`, color: "text-destructive" },
                  { label: "DKIM Fail", value: `${emailStats.dkimFail}%`, color: "text-warning" },
                  { label: "DMARC Fail", value: `${emailStats.dmarcFail}%`, color: "text-warning" },
                ].map((stat) => (
                  <div key={stat.label} className="p-2 rounded bg-card border border-border">
                    <div className={`text-lg lg:text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-[9px] lg:text-[10px] text-muted-foreground uppercase tracking-widest">{stat.label}</div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-3 text-xs text-muted-foreground">No email auth data yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* High-Value Targets — live threat table with feed ingestion buttons */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xl">
        <div className="px-4 lg:px-5 py-3 border-b border-border bg-surface-elevated flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h3 className="font-bold text-foreground uppercase text-xs lg:text-sm flex items-center">
            <Crosshair className="w-4 h-4 mr-2 text-primary shrink-0" />
            <span className="hidden sm:inline">High-Value Targets (Live Feed)</span>
            <span className="sm:hidden">Live Targets</span>
          </h3>
          {/* Feed ingestion trigger buttons — each invokes the edge function with a different source */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleIngest('urlhaus')}
              disabled={ingesting}
              className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary border border-primary/30 px-2 py-1 rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Database className="w-3 h-3" />
              {ingesting ? "..." : "URLhaus"}
            </button>
            <button
              onClick={() => handleIngest('openphish')}
              disabled={ingesting}
              className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary border border-primary/30 px-2 py-1 rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Database className="w-3 h-3" />
              {ingesting ? "..." : "OpenPhish"}
            </button>
            <button
              onClick={() => handleIngest('phishtank')}
              disabled={ingesting}
              className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary border border-primary/30 px-2 py-1 rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Database className="w-3 h-3" />
              {ingesting ? "..." : "PhishTank"}
            </button>
            <span className="text-[10px] bg-alert-dim/50 text-destructive border border-alert-dim px-2 py-0.5 rounded animate-pulse">
              {liveThreats && liveThreats.length > 0 ? `${liveThreats.length} THREATS` : "LIVE"}
            </span>
          </div>
        </div>

        {/* Mobile card view — responsive layout for small screens */}
        <div className="sm:hidden divide-y divide-border">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : targets.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No live threats — pull a feed above to populate</div>
          ) : (
            targets.map((t: any) => (
              <div key={t.id} className="p-3 hover:bg-accent/30 transition-colors cursor-pointer active:bg-accent/50" onClick={() => handleThreatClick(t)}>
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-foreground text-sm">{t.brand}</span>
                  <span className="text-primary font-mono text-xs">{t.confidence}%</span>
                </div>
                <p className="font-mono text-[11px] text-destructive mb-1 break-all">{t.domain}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-foreground border border-border">{t.attack_type}</span>
                  {t.severity && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      t.severity === "critical" ? "bg-destructive/20 text-destructive" :
                      t.severity === "high" ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"
                    }`}>{t.severity}</span>
                  )}
                  {t.source && t.source !== "manual" && (
                    <span className="text-[9px] text-muted-foreground font-mono">{t.source}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table view — full-width sortable threat list */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-surface-overlay/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-2">Target Brand</th>
                <th className="px-4 py-2">Impersonation Domain</th>
                <th className="px-4 py-2">Attack Type</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading threat data...</td></tr>
              ) : targets.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No live threats — pull a feed above to populate</td></tr>
              ) : (
                targets.map((t: any) => (
                  <tr key={t.id} className="hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => handleThreatClick(t)}>
                    <td className="px-4 py-3 font-bold text-foreground">{t.brand}</td>
                    <td className="px-4 py-3 font-mono text-xs text-destructive">{t.domain}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-accent text-foreground border border-border">{t.attack_type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {t.severity && (
                        <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                          t.severity === "critical" ? "bg-destructive/20 text-destructive" :
                          t.severity === "high" ? "bg-warning/20 text-warning" :
                          t.severity === "medium" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                        }`}>{t.severity}</span>
                      )}
                    </td>
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
      </div>

      {/* Detail dialog — shown when a threat row/card is clicked */}
      <ThreatDetailDialog
        threat={selectedThreat}
        open={!!selectedThreat}
        onOpenChange={(open) => { if (!open) setSelectedThreat(null); }}
      />
    </motion.div>
  );
}
