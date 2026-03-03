/**
 * Imprsn8DiscoveryQueue.tsx — Inline HITL review queue for cross-platform account discoveries.
 * Shows pending discoveries with accept/decline/safe/impersonation actions.
 * Rendered inside the Monitored Accounts tab.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useImprsn8 } from "./Imprsn8Context";
import {
  CheckCircle2, XCircle, ShieldCheck, AlertTriangle, Loader2,
  Globe, Users, ExternalLink, Sparkles, Eye, ChevronDown, ChevronUp,
} from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "X / Twitter", instagram: "Instagram", tiktok: "TikTok",
  youtube: "YouTube", facebook: "Facebook", threads: "Threads",
  twitch: "Twitch", linkedin: "LinkedIn",
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  tiktok: "bg-foreground/10 text-foreground border-foreground/20",
  youtube: "bg-red-500/10 text-red-500 border-red-500/20",
  facebook: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  threads: "bg-foreground/10 text-foreground border-foreground/20",
  twitch: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  linkedin: "bg-blue-600/10 text-blue-600 border-blue-600/20",
};

type DiscoveryStatus = "pending_review" | "confirmed" | "verified_safe" | "impersonation" | "dismissed";

interface DiscoveryAction {
  status: DiscoveryStatus;
  label: string;
  icon: typeof CheckCircle2;
  variant: "default" | "destructive" | "outline" | "secondary";
  description: string;
}

const ACTIONS: DiscoveryAction[] = [
  { status: "confirmed", label: "Monitor", icon: CheckCircle2, variant: "default", description: "Keep watching — platform will continuously review this account" },
  { status: "verified_safe", label: "Safe", icon: ShieldCheck, variant: "secondary", description: "Verified as the real person's account — marked legitimate" },
  { status: "impersonation", label: "Impersonate", icon: AlertTriangle, variant: "destructive", description: "Flag as impersonation — creates report for takedown" },
  { status: "dismissed", label: "Dismiss", icon: XCircle, variant: "outline", description: "Not relevant, ignore this discovery" },
];

export function Imprsn8DiscoveryQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getInfluencerFilter, isAllView } = useImprsn8();
  const filter = getInfluencerFilter();
  const [expanded, setExpanded] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: discoveries = [], isLoading } = useQuery({
    queryKey: ["account-discoveries", filter.influencer_id, "pending"],
    queryFn: async () => {
      let q = supabase
        .from("account_discoveries")
        .select("*")
        .eq("status", "pending_review")
        .order("similarity_score", { ascending: false });
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, discovery }: { id: string; status: DiscoveryStatus; discovery: any }) => {
      setProcessingId(id);

      // Update discovery status
      const { error: updateErr } = await supabase
        .from("account_discoveries")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (updateErr) throw updateErr;

      // If confirmed → add to monitored_accounts
      if (status === "confirmed") {
        const { error: insertErr } = await supabase.from("monitored_accounts").insert({
          influencer_id: discovery.influencer_id,
          platform: discovery.discovered_platform,
          platform_username: discovery.discovered_username,
          platform_url: discovery.discovered_url,
          current_display_name: discovery.discovered_display_name,
          current_bio: discovery.discovered_bio,
          current_avatar_url: discovery.discovered_avatar_url,
          current_follower_count: discovery.discovered_follower_count,
        });
        if (insertErr) throw insertErr;
      }

      // If verified_safe → also add to monitored_accounts as a known safe account
      if (status === "verified_safe") {
        const { error: insertErr } = await supabase.from("monitored_accounts").insert({
          influencer_id: discovery.influencer_id,
          platform: discovery.discovered_platform,
          platform_username: discovery.discovered_username,
          platform_url: discovery.discovered_url,
          current_display_name: discovery.discovered_display_name,
          current_bio: discovery.discovered_bio,
          current_avatar_url: discovery.discovered_avatar_url,
          current_follower_count: discovery.discovered_follower_count,
          verified: true,
          scan_status: "active",
        });
        if (insertErr) throw insertErr;
      }

      // If impersonation → create impersonation report
      if (status === "impersonation") {
        const { error: reportErr } = await supabase.from("impersonation_reports").insert({
          influencer_id: discovery.influencer_id,
          platform: discovery.discovered_platform,
          impersonator_username: discovery.discovered_username,
          impersonator_display_name: discovery.discovered_display_name,
          impersonator_url: discovery.discovered_url,
          similarity_score: discovery.similarity_score,
          severity: discovery.similarity_score >= 80 ? "critical" : discovery.similarity_score >= 60 ? "high" : "medium",
          source: "cross_platform_discovery",
          status: "pending",
          ai_analysis: discovery.ai_analysis,
        });
        if (reportErr) throw reportErr;
      }
    },
    onSuccess: (_, vars) => {
      const actionLabel = ACTIONS.find(a => a.status === vars.status)?.label || vars.status;
      toast({ title: `Marked as ${actionLabel}`, description: `@${vars.discovery.discovered_username} on ${PLATFORM_LABELS[vars.discovery.discovered_platform] || vars.discovery.discovered_platform}` });
      queryClient.invalidateQueries({ queryKey: ["account-discoveries"] });
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["imprsn8-threats"] });
      setProcessingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
      setProcessingId(null);
    },
  });

  if (discoveries.length === 0 && !isLoading) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-imprsn8" />
          <h4 className="text-sm font-bold text-foreground">Cross-Platform Discoveries</h4>
          <Badge className="bg-imprsn8/10 text-imprsn8 border-imprsn8/20 text-[10px]">
            {discoveries.length} pending review
          </Badge>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {isLoading ? (
            <Card><CardContent className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-imprsn8 mr-2" /> Loading discoveries…
            </CardContent></Card>
          ) : (
            discoveries.map((d: any) => {
              const isProcessing = processingId === d.id;
              const signals = (d.ai_analysis as any)?.match_signals || [];
              const isSamePerson = (d.ai_analysis as any)?.is_same_person;
              const platColor = PLATFORM_COLORS[d.discovered_platform] || "bg-muted text-foreground border-border";

              return (
                <Card key={d.id} className="border-imprsn8/10 hover:border-imprsn8/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <Avatar className="h-12 w-12 border-2 border-imprsn8/20 shrink-0">
                        <AvatarImage src={d.discovered_avatar_url} className="object-cover" />
                        <AvatarFallback className="text-sm font-bold bg-imprsn8-purple text-imprsn8">
                          {d.discovered_username?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        {/* Name + platform */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {d.discovered_display_name || `@${d.discovered_username}`}
                          </span>
                          <Badge variant="outline" className={`${platColor} text-[10px]`}>
                            {PLATFORM_LABELS[d.discovered_platform] || d.discovered_platform}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${
                            d.similarity_score >= 80 ? "border-emerald-500/30 text-emerald-500" :
                            d.similarity_score >= 60 ? "border-imprsn8/30 text-imprsn8" :
                            "border-muted-foreground/30 text-muted-foreground"
                          }`}>
                            {d.similarity_score}% match
                          </Badge>
                          {isSamePerson && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">
                              Likely same person
                            </Badge>
                          )}
                        </div>

                        {/* Source */}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Found from @{d.source_username} on {d.source_platform}
                        </p>

                        {/* Bio */}
                        {d.discovered_bio && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{d.discovered_bio}</p>
                        )}

                        {/* Match signals */}
                        {signals.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {signals.slice(0, 4).map((s: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[9px] border-imprsn8/15 text-muted-foreground">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Stats + link */}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          {d.discovered_follower_count != null && (
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {d.discovered_follower_count.toLocaleString()}</span>
                          )}
                          <a href={d.discovered_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-imprsn8 hover:underline">
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
                        </div>

                        <Separator className="my-3" />

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-1.5">
                          {ACTIONS.map((action) => (
                            <Button
                              key={action.status}
                              size="sm"
                              variant={action.variant}
                              disabled={isProcessing}
                              onClick={() => reviewMutation.mutate({ id: d.id, status: action.status, discovery: d })}
                              className={`text-xs gap-1 h-7 ${
                                action.status === "confirmed" ? "bg-imprsn8 hover:bg-imprsn8/90 text-imprsn8-foreground" : ""
                              }`}
                            >
                              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <action.icon className="w-3 h-3" />}
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
