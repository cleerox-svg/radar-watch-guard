/**
 * Imprsn8Takedowns.tsx — Takedown requests with context-aware filtering.
 * Shows pipeline view + list. Uses Imprsn8Context for influencer scoping.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useImprsn8 } from "./Imprsn8Context";
import { FileText, Send, CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";

const statusPipeline = ["draft", "submitted", "acknowledged", "resolved", "rejected"] as const;

const statusMeta: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  draft: { icon: FileText, color: "text-muted-foreground", label: "Draft" },
  submitted: { icon: Send, color: "text-sky-500", label: "Submitted" },
  acknowledged: { icon: Clock, color: "text-imprsn8", label: "Acknowledged" },
  resolved: { icon: CheckCircle2, color: "text-emerald-500", label: "Resolved" },
  rejected: { icon: XCircle, color: "text-red-500", label: "Rejected" },
};

export function Imprsn8Takedowns() {
  const { selectedId, isAllView, getInfluencerFilter } = useImprsn8();
  const filter = getInfluencerFilter();

  const { data: takedowns = [], isLoading } = useQuery({
    queryKey: ["takedown-requests", selectedId],
    queryFn: async () => {
      let q = supabase
        .from("takedown_requests")
        .select("*, impersonation_reports(impersonator_username, platform, severity), influencer_profiles(display_name)")
        .order("created_at", { ascending: false });
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const counts = statusPipeline.reduce((acc, s) => {
    acc[s] = takedowns.filter((t: any) => t.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Pipeline overview */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {statusPipeline.map((s, i) => {
          const meta = statusMeta[s];
          const Icon = meta.icon;
          return (
            <div key={s} className="flex items-center gap-1">
              <Card className="min-w-[120px]">
                <CardContent className="p-3 text-center">
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${meta.color}`} />
                  <p className="text-lg font-bold text-foreground">{counts[s]}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono">{meta.label}</p>
                </CardContent>
              </Card>
              {i < statusPipeline.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Takedown list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}</div>
      ) : takedowns.length === 0 ? (
        <Card className="border-dashed border-imprsn8/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">No takedown requests yet.<br />Confirm an impersonation report to initiate a takedown.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {takedowns.map((td: any) => {
            const meta = statusMeta[td.status] ?? statusMeta.draft;
            const Icon = meta.icon;
            const report = td.impersonation_reports;
            const influencerName = td.influencer_profiles?.display_name;
            return (
              <Card key={td.id} className="hover:border-imprsn8/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{td.platform}</Badge>
                        <Badge variant="outline" className="text-[10px] uppercase">{td.request_type}</Badge>
                        {isAllView && influencerName && (
                          <Badge variant="outline" className="text-[10px] border-imprsn8/20 text-imprsn8">{influencerName}</Badge>
                        )}
                      </div>
                      {report && <p className="text-sm font-semibold text-foreground">vs @{report.impersonator_username}</p>}
                      {td.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{td.notes}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span>Created: {new Date(td.created_at).toLocaleDateString()}</span>
                        {td.submitted_at && <span>Submitted: {new Date(td.submitted_at).toLocaleDateString()}</span>}
                        {td.platform_case_id && <span>Case: {td.platform_case_id}</span>}
                      </div>
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
