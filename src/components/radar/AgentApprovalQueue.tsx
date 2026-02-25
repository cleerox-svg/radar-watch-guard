/**
 * AgentApprovalQueue.tsx — Human-in-the-loop approval queue for all agentic actions.
 * Okta-ready: displays identity_provider context when available.
 */

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, Shield, AlertTriangle, Eye, ChevronDown, ChevronUp, Filter, Fingerprint } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Approval {
  id: string;
  agent_run_id: string | null;
  agent_type: string;
  action_type: string;
  title: string;
  description: string | null;
  payload: any;
  status: string;
  priority: string;
  review_notes: string | null;
  identity_provider: string | null;
  identity_context: any;
  mfa_verified: boolean | null;
  created_at: string;
  expires_at: string;
}

const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: "text-red-500 border-red-500/30 bg-red-500/10", label: "CRITICAL" },
  high: { color: "text-orange-500 border-orange-500/30 bg-orange-500/10", label: "HIGH" },
  medium: { color: "text-amber-500 border-amber-500/30 bg-amber-500/10", label: "MEDIUM" },
  low: { color: "text-muted-foreground border-border bg-muted/30", label: "LOW" },
};

const agentTypeLabels: Record<string, string> = {
  takedown: "Takedown Orchestrator",
  impersonation: "Impersonation Detector",
  evidence: "Evidence Preservation",
  campaign: "Campaign Correlator",
  trust_monitor: "Trust Monitor",
  abuse_mailbox: "Abuse Mailbox",
};

export function AgentApprovalQueue() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const load = useCallback(async () => {
    let query = supabase.from("agent_approvals").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    if (data) setApprovals(data as Approval[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("approvals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_approvals" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    setProcessing(id);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from("agent_approvals").update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes[id] || null,
      }).eq("id", id);

      if (error) throw error;

      // If approved takedown, create the erasure action
      const approval = approvals.find(a => a.id === id);
      if (action === "approved" && approval?.action_type === "takedown" && approval.payload) {
        await supabase.from("erasure_actions").insert({
          action: "Abuse takedown notice",
          provider: approval.payload.recommended_recipients?.[0] || "Registrar",
          target: approval.payload.domain,
          type: "network",
          details: approval.payload.abuse_notice?.slice(0, 500),
          created_by: user?.id,
        });
      }

      // If approved campaign, confirm the cluster
      if (action === "approved" && approval?.action_type === "campaign_tag" && approval.payload?.cluster_id) {
        await supabase.from("campaign_clusters").update({
          status: "confirmed",
          confirmed_by: user?.id,
          confirmed_at: new Date().toISOString(),
        }).eq("id", approval.payload.cluster_id);
      }

      toast.success(`Action ${action}`, { description: approval?.title });
    } catch (e: any) {
      toast.error("Failed to process", { description: e.message });
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = approvals.filter(a => a.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Approval Queue</h3>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-xs">{pendingCount} pending</Badge>
          )}
        </div>
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              onClick={() => setFilter(f)}
              className="text-xs capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Clock className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : approvals.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
            <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : filter} approvals</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {approvals.map(approval => {
            const isExpanded = expandedId === approval.id;
            const isExpired = new Date(approval.expires_at) < new Date();
            const pConfig = priorityConfig[approval.priority] || priorityConfig.medium;

            return (
              <Card key={approval.id} className={cn(
                "border transition-all",
                approval.status === "pending" && !isExpired && "border-primary/30",
                approval.status === "approved" && "border-emerald-500/20 opacity-80",
                approval.status === "rejected" && "border-destructive/20 opacity-60",
                isExpired && approval.status === "pending" && "border-amber-500/30 opacity-70",
              )}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                  className="w-full text-left"
                >
                  <CardHeader className="pb-2 px-4 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Badge className={cn("text-[10px] shrink-0", pConfig.color)}>{pConfig.label}</Badge>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm font-medium truncate">{approval.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{agentTypeLabels[approval.agent_type] || approval.agent_type}</Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}
                            </span>
                            {approval.identity_provider !== "internal" && (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <Fingerprint className="w-2.5 h-2.5" />
                                {approval.identity_provider}
                              </Badge>
                            )}
                            {isExpired && approval.status === "pending" && (
                              <Badge variant="outline" className="text-[10px] text-amber-500">EXPIRED</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {approval.status === "approved" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {approval.status === "rejected" && <XCircle className="w-4 h-4 text-destructive" />}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4 space-y-3">
                    {approval.description && (
                      <p className="text-xs text-muted-foreground">{approval.description}</p>
                    )}

                    {/* Payload details */}
                    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-xs font-medium">Details</p>
                      </div>
                      <pre className="text-[10px] font-mono whitespace-pre-wrap text-muted-foreground max-h-48 overflow-y-auto">
                        {JSON.stringify(approval.payload, null, 2)}
                      </pre>
                    </div>

                    {/* Review notes */}
                    {approval.review_notes && (
                      <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <p className="text-xs font-medium text-foreground mb-1">Review Notes</p>
                        <p className="text-xs text-muted-foreground">{approval.review_notes}</p>
                      </div>
                    )}

                    {/* Action buttons for pending items */}
                    {approval.status === "pending" && !isExpired && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Add review notes (optional)..."
                          value={reviewNotes[approval.id] || ""}
                          onChange={e => setReviewNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                          className="text-xs min-h-[60px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAction(approval.id, "approved")}
                            disabled={processing === approval.id}
                            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve & Execute
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(approval.id, "rejected")}
                            disabled={processing === approval.id}
                            className="flex-1 gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
