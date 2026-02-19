/**
 * InvestigationTracker.tsx — Unified investigation ticket manager.
 *
 * Creates LRX-XXXXX tickets linked to any feed item (threat, news, ATO, IOC, breach).
 * Analysts can track status, add notes, assign, and resolve investigations.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Ticket, Plus, Search, Filter, Clock, CheckCircle, AlertTriangle, XCircle,
  ArrowUpCircle, MessageSquare, Tag, User, Calendar, ChevronDown, ChevronUp,
  Loader2, FileText
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface TicketNote {
  text: string;
  author: string;
  timestamp: string;
}

interface InvestigationTicket {
  id: string;
  ticket_id: string;
  source_type: string;
  source_id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_by: string | null;
  notes: TicketNote[];
  tags: string[];
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  open: { icon: Clock, color: "bg-info/10 text-info border-info/20", label: "Open" },
  in_progress: { icon: ArrowUpCircle, color: "bg-warning/10 text-warning border-warning/20", label: "In Progress" },
  escalated: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive border-destructive/20", label: "Escalated" },
  resolved: { icon: CheckCircle, color: "bg-primary/10 text-primary border-primary/20", label: "Resolved" },
  closed: { icon: XCircle, color: "bg-muted text-muted-foreground border-border", label: "Closed" },
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: "bg-destructive text-destructive-foreground", label: "CRITICAL" },
  high: { color: "bg-warning text-warning-foreground", label: "HIGH" },
  medium: { color: "bg-accent text-accent-foreground", label: "MEDIUM" },
  low: { color: "bg-muted text-muted-foreground", label: "LOW" },
};

const sourceLabels: Record<string, string> = {
  threat: "Threat IOC",
  threat_news: "Vulnerability / KEV",
  ato_event: "Account Takeover",
  social_ioc: "Social IOC",
  breach_check: "Breach Check",
};

export function InvestigationTracker() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // New ticket form
  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    source_type: "threat",
    source_id: "",
    severity: "medium",
    priority: "medium",
    tags: "",
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["investigation_tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investigation_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InvestigationTicket[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (ticket: typeof newTicket) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("investigation_tickets").insert({
        title: ticket.title,
        description: ticket.description || null,
        source_type: ticket.source_type,
        source_id: ticket.source_id || crypto.randomUUID(),
        severity: ticket.severity,
        priority: ticket.priority,
        tags: ticket.tags ? ticket.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        created_by: userData.user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigation_tickets"] });
      toast.success("Investigation ticket created");
      setCreateOpen(false);
      setNewTicket({ title: "", description: "", source_type: "threat", source_id: "", severity: "medium", priority: "medium", tags: "" });
    },
    onError: (e: Error) => toast.error("Failed to create ticket", { description: e.message }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: string; resolution?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "resolved" || status === "closed") {
        updates.resolved_at = new Date().toISOString();
        if (resolution) updates.resolution = resolution;
      }
      const { error } = await supabase.from("investigation_tickets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigation_tickets"] });
      toast.success("Ticket status updated");
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note, existingNotes }: { id: string; note: string; existingNotes: TicketNote[] }) => {
      const newNotes = [
        ...existingNotes,
        { text: note, author: profile?.display_name || "Analyst", timestamp: new Date().toISOString() },
      ];
      const { error } = await supabase.from("investigation_tickets").update({ notes: newNotes as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigation_tickets"] });
      setNewNote("");
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error("Failed to add note", { description: e.message }),
  });

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.ticket_id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.source_type.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  const stats = useMemo(() => ({
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    escalated: tickets.filter((t) => t.status === "escalated").length,
    resolved: tickets.filter((t) => t.status === "resolved" || t.status === "closed").length,
    total: tickets.length,
  }), [tickets]);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Ticket, accent: "text-foreground" },
          { label: "Open", value: stats.open, icon: Clock, accent: "text-info" },
          { label: "In Progress", value: stats.in_progress, icon: ArrowUpCircle, accent: "text-warning" },
          { label: "Escalated", value: stats.escalated, icon: AlertTriangle, accent: "text-destructive" },
          { label: "Resolved", value: stats.resolved, icon: CheckCircle, accent: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
            <s.icon className={cn("w-5 h-5 shrink-0", s.accent)} />
            <div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets by ID, title, or tag…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-card">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-card">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-primary" /> Create Investigation Ticket
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                  <Input value={newTicket.title} onChange={(e) => setNewTicket((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Phishing campaign targeting Microsoft" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                  <Textarea value={newTicket.description} onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))} placeholder="Investigation details…" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Source Type</label>
                    <Select value={newTicket.source_type} onValueChange={(v) => setNewTicket((p) => ({ ...p, source_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(sourceLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                    <Select value={newTicket.priority} onValueChange={(v) => setNewTicket((p) => ({ ...p, priority: v }))}>
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
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Severity</label>
                    <Select value={newTicket.severity} onValueChange={(v) => setNewTicket((p) => ({ ...p, severity: v }))}>
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
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags (comma-separated)</label>
                    <Input value={newTicket.tags} onChange={(e) => setNewTicket((p) => ({ ...p, tags: e.target.value }))} placeholder="phishing, microsoft" />
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!newTicket.title || createMutation.isPending}
                  onClick={() => createMutation.mutate(newTicket)}
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Ticket
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Ticket className="w-10 h-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No investigation tickets yet</p>
          <p className="text-xs text-muted-foreground">Create a ticket to start tracking analyst investigations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => {
            const sc = statusConfig[ticket.status] || statusConfig.open;
            const pc = priorityConfig[ticket.priority] || priorityConfig.medium;
            const StatusIcon = sc.icon;
            const isExpanded = expandedTicket === ticket.id;

            return (
              <div key={ticket.id} className="bg-card rounded-lg border border-border overflow-hidden transition-all">
                {/* Ticket Header */}
                <button
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                  className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-accent/30 transition-colors"
                >
                  <StatusIcon className={cn("w-5 h-5 shrink-0", sc.color.split(" ")[1])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-primary font-bold">{ticket.ticket_id}</span>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", pc.color)}>{pc.label}</Badge>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", sc.color)}>{sc.label}</Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{sourceLabels[ticket.source_type] || ticket.source_type}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1 truncate">{ticket.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                      {ticket.tags?.length > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {ticket.tags.slice(0, 3).join(", ")}
                        </span>
                      )}
                      {(ticket.notes as TicketNote[])?.length > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {(ticket.notes as TicketNote[]).length}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4 bg-background/50">
                    {ticket.description && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                        <p className="text-sm text-foreground">{ticket.description}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground w-full mb-1">Update Status</p>
                      {["open", "in_progress", "escalated", "resolved", "closed"].map((s) => {
                        const cfg = statusConfig[s];
                        return (
                          <Button
                            key={s}
                            size="sm"
                            variant={ticket.status === s ? "default" : "outline"}
                            className="text-xs h-7"
                            disabled={updateStatusMutation.isPending}
                            onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: s })}
                          >
                            {cfg.label}
                          </Button>
                        );
                      })}
                    </div>

                    <Separator />

                    {/* Notes */}
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Investigation Notes ({(ticket.notes as TicketNote[])?.length || 0})
                      </p>
                      {(ticket.notes as TicketNote[])?.length > 0 && (
                        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                          {(ticket.notes as TicketNote[]).map((note, i) => (
                            <div key={i} className="rounded border border-border bg-card p-2">
                              <div className="flex items-center gap-2 mb-1">
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[10px] font-medium text-foreground">{note.author}</span>
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  {format(new Date(note.timestamp), "MMM d, HH:mm")}
                                </span>
                              </div>
                              <p className="text-xs text-foreground">{note.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a note…"
                          value={expandedTicket === ticket.id ? newNote : ""}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="text-xs bg-card"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newNote.trim()) {
                              addNoteMutation.mutate({ id: ticket.id, note: newNote, existingNotes: (ticket.notes as TicketNote[]) || [] });
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={!newNote.trim() || addNoteMutation.isPending}
                          onClick={() => addNoteMutation.mutate({ id: ticket.id, note: newNote, existingNotes: (ticket.notes as TicketNote[]) || [] })}
                        >
                          {addNoteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {ticket.resolution && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Resolution</p>
                          <p className="text-sm text-foreground">{ticket.resolution}</p>
                          {ticket.resolved_at && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Resolved {formatDistanceToNow(new Date(ticket.resolved_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Standalone hook to quickly create a ticket from any module.
 * Usage: const createTicket = useCreateInvestigationTicket();
 *        createTicket({ title: "...", source_type: "threat", source_id: "uuid" });
 */
export function useCreateInvestigationTicket() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (ticket: { title: string; source_type: string; source_id: string; severity?: string; priority?: string; description?: string; tags?: string[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("investigation_tickets").insert({
        title: ticket.title,
        source_type: ticket.source_type,
        source_id: ticket.source_id,
        severity: ticket.severity || "medium",
        priority: ticket.priority || "medium",
        description: ticket.description || null,
        tags: ticket.tags || [],
        created_by: userData.user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investigation_tickets"] });
      toast.success("Investigation ticket created");
    },
    onError: (e: Error) => toast.error("Failed to create ticket", { description: e.message }),
  });

  return mutation.mutate;
}
