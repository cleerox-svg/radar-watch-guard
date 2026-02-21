/**
 * ErasureOrchestrator.tsx — Takedown & Response module.
 *
 * Tracks real erasure actions (domain blocks, takedowns, session revocations)
 * stored in the erasure_actions table. Analysts can log new actions and
 * update statuses as they progress through the mitigation lifecycle.
 *
 * Data source: public.erasure_actions table (live, replaces former mock data).
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Shield, Zap, Globe, Users, Lock, CheckCircle, Clock, AlertTriangle,
  Activity, Server, Key, ExternalLink, Plus, RefreshCw, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

/** Hook: fetch erasure actions from DB */
function useErasureActions() {
  return useQuery({
    queryKey: ["erasure_actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erasure_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

const typeConfig: Record<string, { icon: typeof Server; color: string; bg: string; label: string }> = {
  network: { icon: Server, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", label: "Network Level" },
  infrastructure: { icon: Globe, color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20", label: "Infrastructure Level" },
  identity: { icon: Key, color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20", label: "Identity Level" },
};

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  executing: { icon: RefreshCw, color: "text-blue-500", label: "In Progress" },
  completed: { icon: CheckCircle, color: "text-emerald-500", label: "Completed" },
  failed: { icon: AlertTriangle, color: "text-red-500", label: "Failed" },
};

export function ErasureOrchestrator() {
  const { data: actions, isLoading } = useErasureActions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New action form state
  const [newAction, setNewAction] = useState({
    type: "network",
    action: "",
    target: "",
    provider: "",
    details: "",
  });

  const createMutation = useMutation({
    mutationFn: async (action: typeof newAction) => {
      const { error } = await supabase.from("erasure_actions").insert({
        ...action,
        status: "pending",
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erasure_actions"] });
      toast.success("Erasure action logged");
      setDialogOpen(false);
      setNewAction({ type: "network", action: "", target: "", provider: "", details: "" });
    },
    onError: (err: any) => toast.error("Failed to create action", { description: err.message }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "completed") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("erasure_actions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erasure_actions"] });
      toast.success("Status updated");
    },
    onError: (err: any) => toast.error("Update failed", { description: err.message }),
  });

  const filteredActions = selectedType
    ? (actions || []).filter((e: any) => e.type === selectedType)
    : actions || [];

  const stats = {
    total: (actions || []).length,
    completed: (actions || []).filter((e: any) => e.status === "completed").length,
    executing: (actions || []).filter((e: any) => e.status === "executing").length,
    pending: (actions || []).filter((e: any) => e.status === "pending").length,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-500" />
                Takedown & Response
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Track domain blocks, takedown requests, and session revocations across your security stack.
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Log Action
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Erasure Action</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={newAction.type} onValueChange={(v) => setNewAction({ ...newAction, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="network">Network Level (SEG Block)</SelectItem>
                      <SelectItem value="infrastructure">Infrastructure (Takedown)</SelectItem>
                      <SelectItem value="identity">Identity (Session Revocation)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Action (e.g., Domain Blocked)"
                    value={newAction.action}
                    onChange={(e) => setNewAction({ ...newAction, action: e.target.value })}
                  />
                  <Input
                    placeholder="Target (e.g., phishing-site.com)"
                    value={newAction.target}
                    onChange={(e) => setNewAction({ ...newAction, target: e.target.value })}
                  />
                  <Input
                    placeholder="Provider (e.g., Proofpoint, Netcraft)"
                    value={newAction.provider}
                    onChange={(e) => setNewAction({ ...newAction, provider: e.target.value })}
                  />
                  <Textarea
                    placeholder="Details and evidence..."
                    value={newAction.details}
                    onChange={(e) => setNewAction({ ...newAction, details: e.target.value })}
                    rows={3}
                  />
                  <Button
                    onClick={() => createMutation.mutate(newAction)}
                    disabled={!newAction.action || !newAction.target || !newAction.provider || createMutation.isPending}
                    className="w-full"
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Log Action
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-foreground">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total Actions</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="py-4 text-center">
            <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-emerald-500">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-card">
          <CardContent className="py-4 text-center">
            <Activity className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-blue-500">{stats.executing}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20 bg-card">
          <CardContent className="py-4 text-center">
            <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-yellow-500">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Type Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={selectedType === null ? "default" : "outline"} size="sm" onClick={() => setSelectedType(null)} className="text-xs">
          All Levels
        </Button>
        {Object.entries(typeConfig).map(([key, config]) => (
          <Button key={key} variant={selectedType === key ? "default" : "outline"} size="sm" onClick={() => setSelectedType(key)} className="text-xs gap-1">
            <config.icon className="w-3 h-3" />
            {config.label}
          </Button>
        ))}
      </div>

      {/* Actions Timeline */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Erasure Actions
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">{filteredActions.length} ACTIONS</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-cyber">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading actions...</div>
          ) : filteredActions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No erasure actions logged yet</p>
              <p className="text-xs mt-1">Click "Log Action" to record a domain block, takedown, or session revocation.</p>
            </div>
          ) : (
            filteredActions.map((action: any) => {
              const tConfig = typeConfig[action.type] || typeConfig.network;
              const sConfig = statusConfig[action.status] || statusConfig.pending;
              return (
                <div key={action.id} className={cn("bg-background rounded-lg p-4 border", tConfig.bg)}>
                  <div className="flex items-start gap-3">
                    <tConfig.icon className={cn("w-5 h-5 shrink-0 mt-0.5", tConfig.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-semibold text-foreground">{action.action}</h4>
                        <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1",
                          action.status === "completed" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" :
                          action.status === "executing" ? "border-blue-500/30 bg-blue-500/10 text-blue-500" :
                          action.status === "pending" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                          "border-red-500/30 bg-red-500/10 text-red-500"
                        )}>
                          <sConfig.icon className="w-3 h-3" />
                          {sConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span className="font-mono text-foreground">{action.target}</span>
                        <span>via</span>
                        <span className="font-semibold">{action.provider}</span>
                      </div>
                      {action.details && (
                        <p className="text-xs text-muted-foreground">{action.details}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-[10px] text-muted-foreground font-mono flex-1">
                          {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                        </p>
                        {action.status !== "completed" && action.status !== "failed" && (
                          <div className="flex gap-1">
                            {action.status === "pending" && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-6 text-[10px] px-2 text-blue-500"
                                onClick={() => updateStatusMutation.mutate({ id: action.id, status: "executing" })}
                              >
                                Start
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="sm"
                              className="h-6 text-[10px] px-2 text-emerald-500"
                              onClick={() => updateStatusMutation.mutate({ id: action.id, status: "completed" })}
                            >
                              Complete
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-6 text-[10px] px-2 text-red-500"
                              onClick={() => updateStatusMutation.mutate({ id: action.id, status: "failed" })}
                            >
                              Failed
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
