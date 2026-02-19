/**
 * EmailAuth.tsx — Dashboard view for the "Email Auth Center" tab.
 *
 * Displays DMARC/SPF/DKIM email authentication data from email_auth_reports:
 *   1. Authentication Funnel: Progressive bar chart showing pass rates
 *      Total Traffic → SPF Verified → DKIM Signed → DMARC Aligned
 *   2. Policy Enforcement: Shows the dominant DMARC policy (reject/quarantine/none)
 *   3. Shadow IT Sources: Table of sending sources with pass/fail status
 *
 * Data source: useEmailAuthReports() hook → public.email_auth_reports table
 *   - Each row = one sending source's aggregate stats for a report_date
 *   - Fields: source_name, volume, spf_pass, dkim_pass, dmarc_aligned, policy
 */

import { motion } from "framer-motion";
import { Ghost, ShieldCheck, AlertCircle } from "lucide-react";
import { useEmailAuthReports } from "@/hooks/use-threat-data";
import { useMemo } from "react";

export function EmailAuth() {
  const { data: reports, isLoading } = useEmailAuthReports();

  /**
   * Compute the email authentication funnel from aggregate report data.
   * Sums total volume, then calculates how much passed SPF, DKIM, and DMARC.
   * Returns raw counts and percentages for the funnel bar visualization.
   */
  const funnel = useMemo(() => {
    if (!reports || reports.length === 0) return null;
    const totalVolume = reports.reduce((sum: number, r: any) => sum + (r.volume || 0), 0);
    const spfPass = reports.filter((r: any) => r.spf_pass).reduce((sum: number, r: any) => sum + (r.volume || 0), 0);
    const dkimPass = reports.filter((r: any) => r.dkim_pass).reduce((sum: number, r: any) => sum + (r.volume || 0), 0);
    const dmarcAligned = reports.filter((r: any) => r.dmarc_aligned).reduce((sum: number, r: any) => sum + (r.volume || 0), 0);
    const spfPct = totalVolume > 0 ? Math.round((spfPass / totalVolume) * 100) : 0;
    const dkimPct = totalVolume > 0 ? Math.round((dkimPass / totalVolume) * 100) : 0;
    const dmarcPct = totalVolume > 0 ? Math.round((dmarcAligned / totalVolume) * 100) : 0;
    const failPct = 100 - dmarcPct;
    return { totalVolume, spfPass, dkimPass, dmarcAligned, spfPct, dkimPct, dmarcPct, failPct };
  }, [reports]);

  /**
   * Determine the dominant DMARC policy across all reports.
   * Counts volume-weighted occurrences of each policy (reject, quarantine, none)
   * and returns the one with the highest total volume.
   */
  const dominantPolicy = useMemo(() => {
    if (!reports || reports.length === 0) return "none";
    const policyCounts = new Map<string, number>();
    reports.forEach((r: any) => {
      const p = r.policy || "none";
      policyCounts.set(p, (policyCounts.get(p) || 0) + (r.volume || 1));
    });
    let best = "none";
    let bestCount = 0;
    policyCounts.forEach((count, policy) => {
      if (count > bestCount) { best = policy; bestCount = count; }
    });
    return best;
  }, [reports]);

  /**
   * Aggregate sending sources for the Shadow IT detection table.
   * Groups by source_name, sums volume, and tracks whether SPF/DKIM
   * consistently passed. Sources that fail auth checks are flagged
   * as potential unauthorized senders (shadow IT).
   */
  const sources = useMemo(() => {
    if (!reports || reports.length === 0) return [];
    const sourceMap = new Map<string, { volume: number; spfPass: boolean; dkimPass: boolean }>();
    reports.forEach((r: any) => {
      const name = r.source_name || "Unknown";
      const existing = sourceMap.get(name) || { volume: 0, spfPass: true, dkimPass: true };
      existing.volume += r.volume || 0;
      if (!r.spf_pass) existing.spfPass = false;
      if (!r.dkim_pass) existing.dkimPass = false;
      sourceMap.set(name, existing);
    });
    return Array.from(sourceMap.entries())
      .map(([name, data]) => ({
        name,
        volume: data.volume,
        pass: data.spfPass && data.dkimPass,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [reports]);

  // Loading state
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading email auth data...</p>
      </motion.div>
    );
  }

  // Empty state — no DMARC reports ingested yet
  if (!reports || reports.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No email auth reports yet</p>
          <p className="text-xs text-muted-foreground mt-1">Reports will appear as they're ingested from DMARC feeds</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 mb-6 lg:mb-8">
        {/* Authentication Funnel — progressive bar chart showing email auth pass rates */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4 lg:p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4 lg:mb-6">
            <h3 className="font-bold text-foreground text-sm lg:text-base">Authentication Funnel</h3>
            <span className="text-[10px] lg:text-xs font-mono text-muted-foreground">
              {reports.length} reports
            </span>
          </div>
          {funnel && (
            <div className="space-y-4 lg:space-y-6">
              <FunnelBar label="Total Traffic" value={funnel.totalVolume.toLocaleString()} percent={100} color="bg-muted-foreground" />
              <FunnelBar label="SPF Verified" value={`${funnel.spfPass.toLocaleString()} (${funnel.spfPct}%)`} percent={funnel.spfPct} color="bg-info" indent />
              <FunnelBar label="DKIM Signed" value={`${funnel.dkimPass.toLocaleString()} (${funnel.dkimPct}%)`} percent={funnel.dkimPct} color="bg-purple-500" indent />
              <FunnelBar label="DMARC Aligned" value={`${funnel.dmarcAligned.toLocaleString()} (${funnel.dmarcPct}%)`} percent={funnel.dmarcPct} color="bg-primary" bold indent failPercent={funnel.failPct} />
            </div>
          )}
        </div>

        {/* Policy Enforcement — shows dominant DMARC policy and protection status */}
        <div className="bg-card rounded-lg border border-border p-4 lg:p-6 shadow-xl flex flex-col justify-between gap-4">
          <div>
            <h3 className="font-bold text-foreground mb-2 text-sm lg:text-base">Policy Enforcement</h3>
            <div className="flex items-center justify-between mb-4 p-3 rounded bg-background border border-alert-dim/50">
              <div>
                <span className={`text-sm font-bold ${dominantPolicy === "reject" ? "text-primary" : dominantPolicy === "quarantine" ? "text-warning" : "text-destructive"}`}>
                  p={dominantPolicy}
                </span>
                <p className="text-[10px] text-muted-foreground">
                  {dominantPolicy === "reject" ? "Block unauthorized mail" : dominantPolicy === "quarantine" ? "Quarantine suspicious mail" : "Monitor only — no enforcement"}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-background p-3 rounded text-center border border-border">
            <p className="text-[10px] text-muted-foreground uppercase">Status</p>
            <p className={`text-lg font-bold flex items-center justify-center gap-2 ${dominantPolicy === "reject" ? "text-primary" : "text-warning"}`}>
              <ShieldCheck className="w-5 h-5" />
              {dominantPolicy === "reject" ? "PROTECTED" : dominantPolicy === "quarantine" ? "PARTIAL" : "MONITORING"}
            </p>
          </div>
        </div>
      </div>

      {/* Shadow IT Sources — table of sending sources with auth pass/fail indicators */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xl">
        <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-surface-elevated flex justify-between items-center">
          <h3 className="font-bold text-foreground flex items-center text-sm lg:text-base">
            <Ghost className="w-4 h-4 mr-2 text-purple-400" />Shadow IT Sources
          </h3>
          <span className="text-[10px] font-mono text-muted-foreground">{sources.length} SOURCES</span>
        </div>

        {sources.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No sources detected</div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden divide-y divide-border">
              {sources.map((s) => (
                <div key={s.name} className="p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-foreground text-sm">{s.name}</span>
                    <span className={`font-bold text-xs ${s.pass ? "text-primary" : "text-destructive"}`}>{s.pass ? "PASS" : "FAIL"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Vol: {s.volume.toLocaleString()}</span>
                    <button className={`text-xs underline ${s.pass ? "text-primary" : "text-destructive"}`}>
                      {s.pass ? "Authorize" : "Block"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-surface-overlay/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 lg:px-6 py-3">Source Name</th>
                    <th className="px-4 lg:px-6 py-3">Volume</th>
                    <th className="px-4 lg:px-6 py-3">SPF/DKIM</th>
                    <th className="px-4 lg:px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sources.map((s) => (
                    <tr key={s.name} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 lg:px-6 py-4 font-bold text-foreground">{s.name}</td>
                      <td className="px-4 lg:px-6 py-4 font-mono">{s.volume.toLocaleString()}</td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className={`font-bold ${s.pass ? "text-primary" : "text-destructive"}`}>{s.pass ? "PASS" : "FAIL"}</span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right">
                        <button className={`text-xs underline ${s.pass ? "text-primary" : "text-destructive"}`}>
                          {s.pass ? "Authorize" : "Block"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/**
 * FunnelBar — Reusable progress bar component for the authentication funnel.
 * Shows a label, value, and colored bar with optional fail overlay.
 *
 * @param label       - Display name (e.g., "SPF Verified")
 * @param value       - Formatted value string (e.g., "12,345 (92%)")
 * @param percent     - Bar fill percentage (0-100)
 * @param color       - Tailwind bg class for the bar fill
 * @param bold        - Whether to bold the label text
 * @param indent      - Whether to indent with a left border (funnel nesting)
 * @param failPercent - Optional red overlay showing failure percentage
 */
function FunnelBar({ label, value, percent, color, bold, indent, failPercent }: {
  label: string; value: string; percent: number; color: string; bold?: boolean; indent?: boolean; failPercent?: number;
}) {
  return (
    <div className={indent ? "pl-2 lg:pl-4" : ""}>
      <div className={indent ? "border-l-2 border-border pl-2 lg:pl-4" : ""}>
        <div className="flex justify-between text-xs lg:text-sm mb-1">
          <span className={bold ? "text-foreground font-bold" : "text-foreground"}>{label}</span>
          <span className="font-mono text-primary text-xs">{value}</span>
        </div>
        <div className="h-3 lg:h-4 bg-accent rounded-full w-full overflow-hidden relative">
          <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
          {failPercent && (
            <div className="absolute top-0 right-0 h-full bg-destructive" style={{ width: `${failPercent}%` }} />
          )}
        </div>
      </div>
    </div>
  );
}
