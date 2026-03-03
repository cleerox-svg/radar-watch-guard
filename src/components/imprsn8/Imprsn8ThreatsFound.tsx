/**
 * Imprsn8ThreatsFound.tsx — Unified threats view showing all impersonation reports
 * from all 7 AI agents. Filterable by platform, severity, status, and source.
 * Supports "all" view for admins and single-influencer view.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useImprsn8 } from "./Imprsn8Context";
import { AlertTriangle, ExternalLink, CheckCircle2, XCircle, Filter, Shield, FileText, Clock, Bot, Gavel, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/30",
  high: "bg-imprsn8-gold-dim text-imprsn8 border-imprsn8/30",
  medium: "bg-imprsn8/10 text-imprsn8 border-imprsn8/20",
  low: "bg-muted text-muted-foreground border-border",
};

const statusColors: Record<string, string> = {
  new: "bg-sky-500/10 text-sky-500 border-sky-500/30",
  reviewing: "bg-imprsn8/10 text-imprsn8 border-imprsn8/30",
  confirmed: "bg-red-500/10 text-red-500 border-red-500/30",
  dismissed: "bg-muted text-muted-foreground border-border",
  takedown_sent: "bg-imprsn8-purple-accent/10 text-imprsn8-purple-accent border-imprsn8-purple-accent/30",
};

export function Imprsn8ThreatsFound() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedId, isAllView, getInfluencerFilter, allInfluencers } = useImprsn8();
  const filter = getInfluencerFilter();

  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  /** Cross-reference: find Trust Radar threats matching influencer brand domains */
  const { data: radarThreats = [] } = useQuery({
    queryKey: ["imprsn8-radar-xref", selectedId],
    queryFn: async () => {
      // Get brand names for cross-referencing
      const brands = isAllView
        ? allInfluencers.map(i => i.brand_name || i.display_name).filter(Boolean)
        : filter.influencer_id
          ? allInfluencers.filter(i => i.id === filter.influencer_id).map(i => i.brand_name || i.display_name).filter(Boolean)
          : [];
      if (brands.length === 0) return [];

      const { data, error } = await supabase
        .from("threats")
        .select("id, domain, brand, attack_type, severity, status, first_seen, confidence")
        .in("brand", brands)
        .order("first_seen", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: allInfluencers.length > 0,
  });

  /** Fetch reports with context-aware filtering + cross-ref monitored account risk scores */
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["imprsn8-threats", selectedId, statusFilter, severityFilter, platformFilter, sourceFilter],
    queryFn: async () => {
      let q = supabase
        .from("impersonation_reports")
        .select("*, influencer_profiles(display_name, brand_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (severityFilter !== "all") q = q.eq("severity", severityFilter);
      if (platformFilter !== "all") q = q.eq("platform", platformFilter);
      if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Cross-reference: get risk scores for impersonator usernames from monitored accounts */
  const { data: riskScoreMap = {} } = useQuery({
    queryKey: ["imprsn8-threat-risk-xref", reports.length],
    queryFn: async () => {
      if (reports.length === 0) return {};
      const usernames = [...new Set(reports.map((r: any) => r.impersonator_username).filter(Boolean))];
      if (usernames.length === 0) return {};
      const { data } = await supabase
        .from("monitored_accounts")
        .select("platform_username, risk_score, risk_category")
        .in("platform_username", usernames);
      const map: Record<string, { score: number; category: string }> = {};
      for (const a of data || []) {
        map[a.platform_username] = { score: a.risk_score, category: a.risk_category };
      }
      return map;
    },
    enabled: reports.length > 0,
  });

  /** Update report status */
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("impersonation_reports")
        .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["imprsn8-threats"] });
      toast({ title: "Report updated" });
    },
  });

  const statCounts = {
    total: reports.length,
    new: reports.filter((r: any) => r.status === "new").length,
    confirmed: reports.filter((r: any) => r.status === "confirmed").length,
    critical: reports.filter((r: any) => r.severity === "critical" || r.severity === "high").length,
  };

  return (
    <div className="space-y-6">
      {/* Trust Radar Intel Cross-Reference */}
      {radarThreats.length > 0 && (
        <Card className="border-imprsn8-purple-accent/20 bg-imprsn8-purple-accent/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-imprsn8-purple-accent" />
              <h4 className="text-sm font-bold text-foreground">Trust Radar Intel</h4>
              <Badge className="bg-imprsn8-purple-accent/10 text-imprsn8-purple-accent border-imprsn8-purple-accent/20 text-[10px]">
                {radarThreats.length} matching threats
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Phishing domains and malicious infrastructure targeting your brand detected by Trust Radar feeds.
            </p>
            <div className="space-y-1.5">
              {radarThreats.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={`${severityColors[t.severity] || ""} text-[9px]`}>{t.severity}</Badge>
                    <span className="text-xs font-mono truncate">{t.domain}</span>
                    <Badge variant="outline" className="text-[9px]">{t.attack_type}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{t.confidence}% conf</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Reports", value: statCounts.total, icon: FileText },
          { label: "New / Unreviewed", value: statCounts.new, icon: Clock },
          { label: "Confirmed Fakes", value: statCounts.confirmed, icon: AlertTriangle },
          { label: "High Severity", value: statCounts.critical, icon: Shield },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="w-3.5 h-3.5 text-imprsn8" />
                <span className="text-[10px] text-muted-foreground uppercase font-mono">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="takedown_sent">Takedown Sent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="twitter">Twitter/X</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="twitch">Twitch</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="threads">Threads</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="agent">AI Agent</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="widget">Widget</SelectItem>
            <SelectItem value="proactive_sweep">Proactive Sweep</SelectItem>
            <SelectItem value="cross_platform_discovery">Discovery</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Report list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}
        </div>
      ) : reports.length === 0 ? (
        <Card className="border-dashed border-imprsn8/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              No threats found matching your filters.<br />Reports appear here when AI agents detect impersonators.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report: any) => {
            const influencerName = report.influencer_profiles?.display_name;
            return (
              <Card key={report.id} className="hover:border-imprsn8/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant="outline" className={`${severityColors[report.severity]} text-[10px]`}>
                          {report.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className={`${statusColors[report.status]} text-[10px]`}>
                          {report.status.replace("_", " ").toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{report.platform}</Badge>
                        {report.source === "agent" && (
                          <Badge variant="outline" className="text-[10px] border-imprsn8-purple-accent/30 text-imprsn8-purple-accent">
                            <Bot className="w-2.5 h-2.5 mr-1" />AI
                          </Badge>
                        )}
                        {isAllView && influencerName && (
                          <Badge variant="outline" className="text-[10px] border-imprsn8/20 text-imprsn8">
                            {influencerName}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        @{report.impersonator_username}
                        {report.impersonator_display_name && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ({report.impersonator_display_name})
                          </span>
                        )}
                      </p>
                      {report.reporter_description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{report.reporter_description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
                        <span>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
                        {report.similarity_score > 0 && <span>Similarity: {report.similarity_score}%</span>}
                        {(() => {
                          const riskInfo = (riskScoreMap as Record<string, any>)[report.impersonator_username];
                          if (!riskInfo) return null;
                          const scoreColor = riskInfo.score >= 70 ? "text-emerald-500" : riskInfo.score >= 40 ? "text-amber-500" : "text-red-500";
                          return (
                            <span className={`font-mono ${scoreColor}`}>
                              Legitimacy: {riskInfo.score}/100
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {report.impersonator_url && (
                        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" asChild>
                          <a href={report.impersonator_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
                        </Button>
                      )}
                      {report.status === "new" && (
                        <>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-[10px] gap-1 border-red-500/20 text-red-500 hover:bg-red-500/10"
                            onClick={() => updateStatus.mutate({ id: report.id, status: "confirmed" })}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Confirm
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => updateStatus.mutate({ id: report.id, status: "dismissed" })}
                          >
                            <XCircle className="w-3 h-3" /> Dismiss
                          </Button>
                        </>
                      )}
                      {report.status === "confirmed" && (
                        <Button
                          variant="outline" size="sm"
                          className="h-7 text-[10px] gap-1 border-imprsn8-purple-accent/20 text-imprsn8-purple-accent hover:bg-imprsn8-purple-accent/10"
                          onClick={() => updateStatus.mutate({ id: report.id, status: "takedown_sent" })}
                        >
                          <Gavel className="w-3 h-3" /> Takedown
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
