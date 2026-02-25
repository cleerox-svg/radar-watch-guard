/**
 * AgentApprovalQueue.tsx — Human-in-the-loop approval queue with rich formatting.
 * Okta-ready: displays identity_provider context when available.
 */

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, Shield, AlertTriangle, Eye, ChevronDown, ChevronUp, Fingerprint, Gavel, Camera, Network, Inbox, TrendingDown, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const priorityConfig: Record<string, { color: string; label: string; ring: string }> = {
  critical: { color: "text-red-500 border-red-500/30 bg-red-500/10", label: "CRITICAL", ring: "ring-red-500/20" },
  high: { color: "text-orange-500 border-orange-500/30 bg-orange-500/10", label: "HIGH", ring: "ring-orange-500/20" },
  medium: { color: "text-amber-500 border-amber-500/30 bg-amber-500/10", label: "MEDIUM", ring: "ring-amber-500/20" },
  low: { color: "text-muted-foreground border-border bg-muted/30", label: "LOW", ring: "ring-border" },
};

const agentIcons: Record<string, typeof Shield> = {
  takedown: Gavel,
  impersonation: Fingerprint,
  evidence: Camera,
  campaign: Network,
  trust_monitor: TrendingDown,
  abuse_mailbox: Inbox,
  triage: Target,
};

const agentLabels: Record<string, string> = {
  takedown: "Takedown",
  impersonation: "Impersonation",
  evidence: "Evidence",
  campaign: "Campaign",
  trust_monitor: "Trust Monitor",
  abuse_mailbox: "Abuse Mailbox",
  triage: "Triage",
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Human Review</h3>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">{pendingCount} pending</Badge>
          )}
        </div>
        <div className="flex gap-0.5 bg-muted/30 rounded-lg p-0.5 border border-border/50">
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"} onClick={() => setFilter(f)} className="text-[10px] h-6 px-2 capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Clock className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-border rounded-xl">
          <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500/40 mb-1.5" />
          <p className="text-xs text-muted-foreground">No {filter === "all" ? "" : filter} items</p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map(approval => {
            const isExpanded = expandedId === approval.id;
            const isExpired = new Date(approval.expires_at) < new Date();
            const pConfig = priorityConfig[approval.priority] || priorityConfig.medium;
            const AgentIcon = agentIcons[approval.agent_type] || Shield;

            return (
              <Card key={approval.id} className={cn(
                "border transition-all overflow-hidden",
                approval.status === "pending" && !isExpired && "border-primary/20",
                approval.status === "approved" && "border-emerald-500/15 opacity-75",
                approval.status === "rejected" && "border-destructive/15 opacity-60",
                isExpired && approval.status === "pending" && "border-amber-500/20 opacity-65",
              )}>
                <button onClick={() => setExpandedId(isExpanded ? null : approval.id)} className="w-full text-left p-3">
                  <div className="flex items-start gap-3">
                    {/* Agent icon */}
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", pConfig.color)}>
                      <AgentIcon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{approval.title}</span>
                        {isExpired && approval.status === "pending" && (
                          <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30">EXPIRED</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn("text-[9px] h-4 px-1.5", pConfig.color)}>{pConfig.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{agentLabels[approval.agent_type] || approval.agent_type}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}
                        </span>
                        {approval.identity_provider && approval.identity_provider !== "internal" && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 h-4">
                            <Fingerprint className="w-2 h-2" />
                            {approval.identity_provider}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {approval.status === "approved" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {approval.status === "rejected" && <XCircle className="w-4 h-4 text-destructive" />}
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 px-3 pb-3 space-y-3 border-t border-border/30">
                    {approval.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed pt-3">{approval.description}</p>
                    )}

                    {/* Structured payload display */}
                    <PayloadView payload={approval.payload} actionType={approval.action_type} />

                    {/* Existing review notes */}
                    {approval.review_notes && (
                      <div className="bg-primary/5 rounded-lg p-3 border border-primary/15">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Review Notes</p>
                        <p className="text-xs text-foreground">{approval.review_notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {approval.status === "pending" && !isExpired && (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          placeholder="Add review notes (optional)..."
                          value={reviewNotes[approval.id] || ""}
                          onChange={e => setReviewNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                          className="text-xs min-h-[50px] bg-background"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAction(approval.id, "approved")}
                            disabled={processing === approval.id}
                            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(approval.id, "rejected")}
                            disabled={processing === approval.id}
                            className="flex-1 gap-1.5 h-8 text-xs"
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

/* ── Structured Payload Display ─────────────────── */

function PayloadView({ payload, actionType }: { payload: any; actionType: string }) {
  if (!payload) return null;

  // Takedown-specific view
  if (actionType === "takedown" && payload.domain) {
    return (
      <div className="bg-muted/20 rounded-lg p-3 border border-border/30 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Gavel className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Takedown Details</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Domain</p>
            <p className="font-mono text-foreground">{payload.domain}</p>
          </div>
          {payload.brand && (
            <div>
              <p className="text-[10px] text-muted-foreground">Brand</p>
              <p className="text-foreground">{payload.brand}</p>
            </div>
          )}
          {payload.confidence_score && (
            <div>
              <p className="text-[10px] text-muted-foreground">Confidence</p>
              <p className="text-foreground font-mono">{payload.confidence_score}%</p>
            </div>
          )}
        </div>
        {payload.recommended_recipients?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground mr-1">Recipients:</span>
            {payload.recommended_recipients.map((r: string, i: number) => (
              <Badge key={i} variant="outline" className="text-[9px]">{r}</Badge>
            ))}
          </div>
        )}
        {payload.abuse_notice && (
          <details className="text-[11px]">
            <summary className="cursor-pointer text-primary hover:text-primary/80 transition-colors font-medium">View abuse notice</summary>
            <pre className="mt-2 p-3 bg-card rounded-lg text-[10px] whitespace-pre-wrap max-h-36 overflow-y-auto border border-border/30 text-muted-foreground">{payload.abuse_notice}</pre>
          </details>
        )}
      </div>
    );
  }

  // Campaign tag view
  if (actionType === "campaign_tag") {
    return (
      <div className="bg-muted/20 rounded-lg p-3 border border-border/30 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Network className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Campaign Cluster</p>
        </div>
        {payload.campaign_name && <p className="text-xs font-semibold text-foreground">{payload.campaign_name}</p>}
        {payload.threat_count && <p className="text-[11px] text-muted-foreground">{payload.threat_count} related threats</p>}
        {payload.brands_targeted?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {payload.brands_targeted.map((b: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-[9px]">{b}</Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Generic fallback — structured key-value instead of raw JSON
  return (
    <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
      <div className="flex items-center gap-2 mb-2">
        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Details</p>
      </div>
      <div className="space-y-1">
        {Object.entries(payload).slice(0, 12).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="text-muted-foreground font-mono text-[10px] shrink-0 w-28 truncate">{key}</span>
            <span className="text-foreground break-all text-[11px]">
              {typeof value === "object" && value !== null
                ? Array.isArray(value) ? (value as any[]).join(", ") : JSON.stringify(value)
                : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
