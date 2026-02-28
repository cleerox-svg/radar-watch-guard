/**
 * Imprsn8AllInfluencers.tsx — Admin-only master roster of all influencers.
 * Sortable table with account counts, threat counts, risk tiers, and inline actions.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useImprsn8 } from "./Imprsn8Context";
import { Users, UserPlus, Search, Mail, Loader2, Eye, AlertTriangle, FileText, ArrowRight } from "lucide-react";

export function Imprsn8AllInfluencers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setSelectedId } = useImprsn8();
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newTier, setNewTier] = useState("free");

  const { data: influencers = [], isLoading } = useQuery({
    queryKey: ["admin-influencers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("influencer_profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allAccounts = [] } = useQuery({
    queryKey: ["admin-all-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("monitored_accounts").select("id, influencer_id, scan_status");
      if (error) throw error;
      return data;
    },
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ["admin-all-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("impersonation_reports").select("id, influencer_id, status, severity");
      if (error) throw error;
      return data;
    },
  });

  const { data: allTakedowns = [] } = useQuery({
    queryKey: ["admin-all-takedowns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("takedown_requests").select("id, influencer_id, status");
      if (error) throw error;
      return data;
    },
  });

  const updateTier = useMutation({
    mutationFn: async ({ id, tier }: { id: string; tier: string }) => {
      const maxAccounts = tier === "free" ? 3 : tier === "pro" ? 10 : 50;
      const { error } = await supabase.from("influencer_profiles").update({ subscription_tier: tier, max_monitored_accounts: maxAccounts }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-influencers"] });
      toast({ title: "Tier updated" });
    },
  });

  const inviteInfluencer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-influencer", {
        body: { email: newEmail, display_name: newDisplayName, brand_name: newBrandName || undefined, subscription_tier: newTier },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-influencers"] });
      toast({ title: "Influencer invited", description: `Invite sent to ${newEmail}` });
      setNewEmail(""); setNewDisplayName(""); setNewBrandName(""); setNewTier("free"); setAddOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    },
  });

  const filtered = influencers.filter((inf: any) =>
    !searchQuery || inf.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || inf.brand_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewInfluencer = (id: string) => {
    setSelectedId(id);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><Users className="w-5 h-5 text-amber-500 mx-auto mb-2" /><p className="text-2xl font-bold">{influencers.length}</p><p className="text-[10px] text-muted-foreground uppercase">Total Influencers</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><Eye className="w-5 h-5 text-amber-500 mx-auto mb-2" /><p className="text-2xl font-bold">{allAccounts.length}</p><p className="text-[10px] text-muted-foreground uppercase">Monitored Accounts</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" /><p className="text-2xl font-bold">{allReports.length}</p><p className="text-[10px] text-muted-foreground uppercase">Total Reports</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><FileText className="w-5 h-5 text-amber-500 mx-auto mb-2" /><p className="text-2xl font-bold">{allTakedowns.length}</p><p className="text-[10px] text-muted-foreground uppercase">Takedowns</p></CardContent></Card>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search influencers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white h-9 text-xs">
              <UserPlus className="w-3.5 h-3.5" /> Add Influencer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Influencer</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label className="text-xs">Display Name *</Label><Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Creator name" /></div>
              <div className="space-y-2"><Label className="text-xs">Brand Name</Label><Input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Brand or alias" /></div>
              <div className="space-y-2"><Label className="text-xs">Email *</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="influencer@example.com" /></div>
              <div className="space-y-2">
                <Label className="text-xs">Subscription Tier</Label>
                <Select value={newTier} onValueChange={setNewTier}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free">Free (3)</SelectItem><SelectItem value="pro">Pro (10)</SelectItem><SelectItem value="enterprise">Enterprise (50)</SelectItem></SelectContent></Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2" disabled={!newEmail || !newDisplayName || inviteInfluencer.isPending} onClick={() => inviteInfluencer.mutate()}>
                {inviteInfluencer.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                {inviteInfluencer.isPending ? "Creating..." : "Create & Invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Influencer List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex items-center justify-center py-12"><p className="text-sm text-muted-foreground">No influencers found.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((inf: any) => {
            const acctCount = allAccounts.filter((a: any) => a.influencer_id === inf.id).length;
            const reportCount = allReports.filter((r: any) => r.influencer_id === inf.id).length;
            const openThreats = allReports.filter((r: any) => r.influencer_id === inf.id && r.status === "new").length;
            const activeTakedowns = allTakedowns.filter((t: any) => t.influencer_id === inf.id && ["draft", "submitted", "acknowledged"].includes(t.status)).length;
            return (
              <Card key={inf.id} className="hover:border-amber-500/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{inf.display_name}</p>
                        {inf.brand_name && <span className="text-xs text-muted-foreground">({inf.brand_name})</span>}
                        <Badge variant="outline" className="text-[9px] uppercase">{inf.subscription_tier}</Badge>
                        {!inf.onboarding_completed && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500">Onboarding</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-1 flex-wrap">
                        <span>{acctCount}/{inf.max_monitored_accounts} accounts</span>
                        <span>{reportCount} reports {openThreats > 0 && <span className="text-amber-500">({openThreats} new)</span>}</span>
                        <span>{activeTakedowns} active takedowns</span>
                        <span>Since {new Date(inf.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={inf.subscription_tier} onValueChange={(tier) => updateTier.mutate({ id: inf.id, tier })}>
                        <SelectTrigger className="w-24 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 border-amber-500/20 text-amber-500" onClick={() => handleViewInfluencer(inf.id)}>
                        <ArrowRight className="w-3 h-3" /> View
                      </Button>
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
