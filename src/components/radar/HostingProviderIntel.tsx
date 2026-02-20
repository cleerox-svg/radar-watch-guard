/**
 * HostingProviderIntel.tsx — Hosting Provider Intelligence widget.
 *
 * Replaces the Attack Vectors panel in the Global Threat Map.
 * Shows top hosting providers correlated with threat activity,
 * trended into three categories:
 *   - "Worst Now" (most threats in last 7 days)
 *   - "Previously Bad" (high historical activity, now declining)
 *   - "Most Improved" (largest recent drop in activity)
 *
 * Each provider is expandable to show IPs, ASN, abuse contact,
 * registrar reporting instructions, and investigation ticket creation.
 */

import { useState, useMemo } from "react";
import { useThreats } from "@/hooks/use-threat-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Server, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  History, ExternalLink, Ticket, AlertTriangle, Shield, Copy, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProviderStats {
  org: string;
  totalThreats: number;
  recentThreats: number; // last 7 days
  olderThreats: number;  // 8-30 days ago
  ips: string[];
  asns: string[];
  isps: string[];
  abuseContacts: string[];
  domains: string[];
  severityCounts: Record<string, number>;
  attackTypes: string[];
  countries: string[];
}

type Category = "worst_now" | "previously_bad" | "most_improved";

const categoryConfig: Record<Category, { label: string; icon: typeof TrendingUp; color: string; description: string }> = {
  worst_now: { label: "Worst Now", icon: TrendingUp, color: "text-destructive", description: "Most threat activity in last 7 days" },
  previously_bad: { label: "Previously Bad", icon: History, color: "text-warning", description: "High historical activity" },
  most_improved: { label: "Most Improved", icon: TrendingDown, color: "text-primary", description: "Largest recent decline in activity" },
};

// Known registrar abuse reporting links
const abuseReportingInfo: Record<string, { url: string; instructions: string }> = {
  "cloudflare": { url: "https://abuse.cloudflare.com", instructions: "Submit abuse report via Cloudflare's Trust & Safety portal" },
  "amazon": { url: "https://aws.amazon.com/premiumsupport/knowledge-center/report-aws-abuse/", instructions: "Report via AWS abuse form with IP and evidence" },
  "digitalocean": { url: "https://www.digitalocean.com/company/contact#abuse", instructions: "Email abuse@digitalocean.com with incident details" },
  "ovh": { url: "https://www.ovh.com/abuse/", instructions: "Submit via OVH abuse portal with IP and timestamps" },
  "hetzner": { url: "https://abuse.hetzner.com", instructions: "Report via Hetzner abuse form" },
  "google": { url: "https://support.google.com/code-of-conduct/contact/cloud_platform_report", instructions: "Report via Google Cloud abuse form" },
  "microsoft": { url: "https://msrc.microsoft.com/report/abuse", instructions: "Report via Microsoft Security Response Center" },
  "linode": { url: "https://www.linode.com/legal-abuse/", instructions: "Email abuse@linode.com with details" },
  "vultr": { url: "https://www.vultr.com/docs/vultr-abuse-handling", instructions: "Email abuse@vultr.com with IPs and evidence" },
  "godaddy": { url: "https://supportcenter.godaddy.com/AbuseReport", instructions: "Report via GoDaddy abuse reporting form" },
};

function getAbuseInfo(orgName: string) {
  const lower = orgName.toLowerCase();
  for (const [key, info] of Object.entries(abuseReportingInfo)) {
    if (lower.includes(key)) return info;
  }
  return null;
}

export function HostingProviderIntel() {
  const { data: threats } = useThreats();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderStats | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: "", description: "", severity: "medium", priority: "medium" });

  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  // Build provider stats from threats data
  const providerMap = useMemo(() => {
    if (!threats) return new Map<string, ProviderStats>();
    const map = new Map<string, ProviderStats>();

    threats.forEach((t: any) => {
      const org = t.org_name || t.isp || "Unknown Provider";
      if (org === "Unknown Provider") return;

      if (!map.has(org)) {
        map.set(org, {
          org, totalThreats: 0, recentThreats: 0, olderThreats: 0,
          ips: [], asns: [], isps: [], abuseContacts: [], domains: [],
          severityCounts: {}, attackTypes: [], countries: [],
        });
      }
      const stats = map.get(org)!;
      stats.totalThreats++;

      const lastSeen = new Date(t.last_seen).getTime();
      if (now - lastSeen <= SEVEN_DAYS) stats.recentThreats++;
      else if (now - lastSeen <= THIRTY_DAYS) stats.olderThreats++;

      if (t.ip_address && !stats.ips.includes(t.ip_address)) stats.ips.push(t.ip_address);
      if (t.asn && !stats.asns.includes(t.asn)) stats.asns.push(t.asn);
      if (t.isp && !stats.isps.includes(t.isp)) stats.isps.push(t.isp);
      if (t.abuse_contact && !stats.abuseContacts.includes(t.abuse_contact)) stats.abuseContacts.push(t.abuse_contact);
      if (t.domain && !stats.domains.includes(t.domain)) stats.domains.push(t.domain);
      if (t.country && !stats.countries.includes(t.country)) stats.countries.push(t.country);

      const sev = t.severity || "medium";
      stats.severityCounts[sev] = (stats.severityCounts[sev] || 0) + 1;

      if (t.attack_type && !stats.attackTypes.includes(t.attack_type)) stats.attackTypes.push(t.attack_type);
    });

    return map;
  }, [threats, now]);

  // Categorize providers
  const { worstNow, previouslyBad, mostImproved } = useMemo(() => {
    const providers = Array.from(providerMap.values());

    // Worst Now: most recent threats
    const worstNow = [...providers]
      .filter((p) => p.recentThreats > 0)
      .sort((a, b) => b.recentThreats - a.recentThreats);

    // Previously Bad: had significant older threats but few recent
    const previouslyBad = [...providers]
      .filter((p) => p.olderThreats > 0 && p.recentThreats <= 1)
      .sort((a, b) => b.olderThreats - a.olderThreats);

    // Most Improved: had older threats, recent count dropped significantly
    const mostImproved = [...providers]
      .filter((p) => p.olderThreats > 2 && p.recentThreats < p.olderThreats)
      .sort((a, b) => {
        const dropA = a.olderThreats - a.recentThreats;
        const dropB = b.olderThreats - b.recentThreats;
        return dropB - dropA;
      });

    return { worstNow, previouslyBad, mostImproved };
  }, [providerMap]);

  const categoryData: Record<Category, ProviderStats[]> = {
    worst_now: worstNow,
    previously_bad: previouslyBad,
    most_improved: mostImproved,
  };

  const handleCreateTicket = async () => {
    if (!selectedProvider || !ticketForm.title) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("investigation_tickets").insert({
        title: ticketForm.title,
        description: ticketForm.description || `Investigation into hosting provider: ${selectedProvider.org}\nIPs: ${selectedProvider.ips.slice(0, 10).join(", ")}\nASNs: ${selectedProvider.asns.join(", ")}`,
        source_type: "threat",
        source_id: crypto.randomUUID(),
        severity: ticketForm.severity,
        priority: ticketForm.priority,
        tags: ["hosting-provider", selectedProvider.org.toLowerCase().replace(/\s+/g, "-")],
        created_by: userData.user?.id || null,
      } as any);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["investigation_tickets"] });
      toast.success("Investigation ticket created");
      setTicketOpen(false);
      setTicketForm({ title: "", description: "", severity: "medium", priority: "medium" });
    } catch (e: any) {
      toast.error("Failed to create ticket", { description: e.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const hasData = worstNow.length > 0 || previouslyBad.length > 0 || mostImproved.length > 0;

  return (
    <>
      <div className="bg-card rounded-lg border border-border shadow-xl overflow-hidden flex-1 flex flex-col">
        <div className="px-4 lg:px-5 py-3 border-b border-border bg-surface-elevated flex justify-between items-center">
          <h3 className="font-bold text-foreground uppercase text-xs lg:text-sm flex items-center">
            <Server className="w-4 h-4 mr-2 text-primary shrink-0" />Hosting Provider Intel
          </h3>
          <span className="text-[10px] font-mono text-muted-foreground">{providerMap.size} PROVIDERS</span>
        </div>

        <div className="flex-1 overflow-auto bg-surface-overlay/50">
          {!hasData ? (
            <div className="p-4 text-center space-y-2">
              <Server className="w-8 h-8 mx-auto text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No provider data yet — ingest threats with GeoIP enrichment to populate</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(Object.entries(categoryConfig) as [Category, typeof categoryConfig[Category]][]).map(([key, config]) => {
                const items = categoryData[key];
                const isExpanded = expandedCategory === key;
                const displayItems = isExpanded ? items : items.slice(0, 3);
                const CatIcon = config.icon;

                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : key)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CatIcon className={cn("w-3.5 h-3.5", config.color)} />
                        <span className="text-xs font-bold text-foreground">{config.label}</span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{items.length}</Badge>
                      </div>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>

                    {items.length === 0 ? (
                      <p className="px-4 pb-3 text-[10px] text-muted-foreground italic">No providers in this category</p>
                    ) : (
                      <div className="px-3 pb-3 space-y-1.5">
                        {displayItems.map((provider, i) => (
                          <button
                            key={provider.org}
                            onClick={() => setSelectedProvider(provider)}
                            className="w-full text-left p-2.5 rounded-md bg-background/60 border border-border hover:border-primary/30 hover:bg-accent/20 transition-all group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn(
                                  "text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                                  key === "worst_now" ? "bg-destructive/20 text-destructive" :
                                  key === "previously_bad" ? "bg-warning/20 text-warning" :
                                  "bg-primary/20 text-primary"
                                )}>
                                  {i + 1}
                                </span>
                                <span className="text-xs font-bold text-foreground truncate">{provider.org}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-mono text-muted-foreground">{provider.ips.length} IPs</span>
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                  key === "worst_now" ? "bg-destructive/10 text-destructive" :
                                  key === "previously_bad" ? "bg-warning/10 text-warning" :
                                  "bg-primary/10 text-primary"
                                )}>
                                  {key === "worst_now" ? `${provider.recentThreats} recent` :
                                   key === "previously_bad" ? `${provider.olderThreats} historical` :
                                   `↓${provider.olderThreats - provider.recentThreats}`}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {provider.attackTypes.slice(0, 3).map((at) => (
                                <span key={at} className="text-[9px] px-1 py-0.5 rounded bg-accent text-muted-foreground">{at}</span>
                              ))}
                              {provider.countries.slice(0, 2).map((c) => (
                                <span key={c} className="text-[9px] px-1 py-0.5 rounded bg-accent text-muted-foreground">{c}</span>
                              ))}
                            </div>
                          </button>
                        ))}
                        {!isExpanded && items.length > 3 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedCategory(key); }}
                            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors w-full justify-center pt-1"
                          >
                            <ChevronDown className="w-3 h-3" />
                            Show All {items.length} Providers
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Provider Detail Dialog */}
      <Dialog open={!!selectedProvider && !ticketOpen} onOpenChange={(open) => { if (!open) setSelectedProvider(null); }}>
        <DialogContent className="max-w-lg bg-card max-h-[85vh] overflow-y-auto">
          {selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Server className="w-5 h-5 text-primary" />
                  {selectedProvider.org}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Total Threats", value: selectedProvider.totalThreats, color: "text-foreground" },
                    { label: "Last 7 Days", value: selectedProvider.recentThreats, color: "text-destructive" },
                    { label: "Unique IPs", value: selectedProvider.ips.length, color: "text-primary" },
                  ].map((s) => (
                    <div key={s.label} className="bg-background rounded-md border border-border p-2 text-center">
                      <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* ASN / ISP Info */}
                {selectedProvider.asns.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">ASN / Network</p>
                    <div className="space-y-1">
                      {selectedProvider.asns.map((asn) => (
                        <div key={asn} className="flex items-center justify-between bg-background rounded border border-border px-2.5 py-1.5">
                          <span className="text-xs font-mono text-foreground">{asn}</span>
                          <button onClick={() => copyToClipboard(asn)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* IP Addresses */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                    IP Addresses ({selectedProvider.ips.length})
                  </p>
                  <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                    {selectedProvider.ips.slice(0, 20).map((ip) => (
                      <div key={ip} className="flex items-center justify-between bg-background rounded border border-border px-2 py-1">
                        <span className="text-[11px] font-mono text-foreground">{ip}</span>
                        <button onClick={() => copyToClipboard(ip)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {selectedProvider.ips.length > 20 && (
                      <p className="text-[10px] text-muted-foreground col-span-2 text-center pt-1">
                        +{selectedProvider.ips.length - 20} more
                      </p>
                    )}
                  </div>
                </div>

                {/* Domains */}
                {selectedProvider.domains.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                      Malicious Domains ({selectedProvider.domains.length})
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {selectedProvider.domains.slice(0, 10).map((d) => (
                        <div key={d} className="flex items-center justify-between bg-background rounded border border-border px-2 py-1">
                          <span className="text-[11px] font-mono text-destructive truncate">{d}</span>
                          <button onClick={() => copyToClipboard(d)} className="text-muted-foreground hover:text-foreground shrink-0 ml-2">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {selectedProvider.domains.length > 10 && (
                        <p className="text-[10px] text-muted-foreground text-center">+{selectedProvider.domains.length - 10} more</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Severity Breakdown */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Severity Breakdown</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(selectedProvider.severityCounts).map(([sev, count]) => (
                      <span key={sev} className={cn(
                        "text-[10px] px-2 py-1 rounded border font-bold uppercase",
                        sev === "critical" ? "bg-destructive/20 text-destructive border-destructive/30" :
                        sev === "high" ? "bg-warning/20 text-warning border-warning/30" :
                        sev === "medium" ? "bg-warning/10 text-warning border-warning/20" :
                        "bg-muted text-muted-foreground border-border"
                      )}>
                        {sev}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Abuse Reporting */}
                <div className="border border-border rounded-md p-3 bg-background/50">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Report to Registrar / Hosting Provider
                  </p>
                  {(() => {
                    const abuseInfo = getAbuseInfo(selectedProvider.org);
                    if (abuseInfo) {
                      return (
                        <div className="space-y-2">
                          <p className="text-xs text-foreground">{abuseInfo.instructions}</p>
                          <a
                            href={abuseInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Open Abuse Report Portal
                          </a>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          No known abuse portal for this provider. Try searching for their abuse contact:
                        </p>
                        <a
                          href={`https://www.abuseipdb.com/whois/${selectedProvider.ips[0] || ""}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Look up WHOIS on AbuseIPDB
                        </a>
                        {selectedProvider.abuseContacts.length > 0 && (
                          <div className="mt-1">
                            <p className="text-[10px] text-muted-foreground">Known abuse contacts:</p>
                            {selectedProvider.abuseContacts.map((c) => (
                              <button key={c} onClick={() => copyToClipboard(c)} className="text-xs text-primary font-mono hover:underline block">
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      setTicketForm({
                        title: `Investigate hosting provider: ${selectedProvider.org}`,
                        description: `Provider ${selectedProvider.org} has ${selectedProvider.totalThreats} associated threats (${selectedProvider.recentThreats} in last 7 days).\n\nIPs: ${selectedProvider.ips.slice(0, 5).join(", ")}${selectedProvider.ips.length > 5 ? ` (+${selectedProvider.ips.length - 5} more)` : ""}\nASNs: ${selectedProvider.asns.join(", ")}\nAttack Types: ${selectedProvider.attackTypes.join(", ")}`,
                        severity: selectedProvider.recentThreats > 5 ? "high" : "medium",
                        priority: selectedProvider.recentThreats > 10 ? "critical" : selectedProvider.recentThreats > 5 ? "high" : "medium",
                      });
                      setTicketOpen(true);
                    }}
                  >
                    <Ticket className="w-3.5 h-3.5" /> Open Investigation
                  </Button>
                  {selectedProvider.ips[0] && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://www.abuseipdb.com/check/${selectedProvider.ips[0]}`, "_blank", "noopener")}
                    >
                      <Info className="w-3.5 h-3.5 mr-1" /> WHOIS
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Investigation Ticket Dialog */}
      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" /> Log Investigation Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
              <Input value={ticketForm.title} onChange={(e) => setTicketForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Textarea value={ticketForm.description} onChange={(e) => setTicketForm((p) => ({ ...p, description: e.target.value }))} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Severity</label>
                <Select value={ticketForm.severity} onValueChange={(v) => setTicketForm((p) => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" disabled={!ticketForm.title} onClick={handleCreateTicket}>
              <Ticket className="w-4 h-4 mr-2" /> Create Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
