/**
 * SigentAdminPanel.tsx — Admin-only panel for managing all influencer accounts,
 * viewing platform-wide stats, and adding new influencers/feeds.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, AlertTriangle, FileText, Plus, Search, Eye, RefreshCw, UserPlus, BarChart3 } from "lucide-react";

export function SigentAdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [addInfluencerOpen, setAddInfluencerOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newTier, setNewTier] = useState("free");

  /** Fetch all influencer profiles (admin only) */
  const { data: influencers = [], isLoading: loadingInfluencers } = useQuery({
    queryKey: ["admin-influencers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  /** Fetch all monitored accounts (admin only) */
  const { data: allAccounts = [] } = useQuery({
    queryKey: ["admin-all-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitored_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  /** Fetch all reports (admin only) */
  const { data: allReports = [] } = useQuery({
    queryKey: ["admin-all-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("impersonation_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  /** Fetch all takedowns (admin only) */
  const { data: allTakedowns = [] } = useQuery({
    queryKey: ["admin-all-takedowns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("takedown_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  /** Update influencer tier */
  const updateTier = useMutation({
    mutationFn: async ({ id, tier }: { id: string; tier: string }) => {
      const maxAccounts = tier === "free" ? 3 : tier === "pro" ? 10 : 50;
      const { error } = await supabase
        .from("influencer_profiles")
        .update({ subscription_tier: tier, max_monitored_accounts: maxAccounts })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-influencers"] });
      toast({ title: "Tier updated" });
    },
  });

  /** Filter influencers by search */
  const filtered = influencers.filter((inf) =>
    !searchQuery ||
    inf.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inf.brand_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** Platform distribution stats */
  const platformCounts = allAccounts.reduce((acc, a) => {
    acc[a.platform] = (acc[a.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="influencers">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="influencers" className="text-xs gap-1.5">
            <Users className="w-3.5 h-3.5" /> Influencers
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> All Reports
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-xs gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Platform Stats
          </TabsTrigger>
        </TabsList>

        {/* ───── Influencers Tab ───── */}
        <TabsContent value="influencers" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search influencers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Dialog open={addInfluencerOpen} onOpenChange={setAddInfluencerOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white h-9 text-xs">
                  <UserPlus className="w-3.5 h-3.5" /> Add Influencer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Influencer</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Display Name</Label>
                    <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Creator name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Brand Name</Label>
                    <Input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Brand or alias" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Subscription Tier</Label>
                    <Select value={newTier} onValueChange={setNewTier}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free (3 accounts)</SelectItem>
                        <SelectItem value="pro">Pro (10 accounts)</SelectItem>
                        <SelectItem value="enterprise">Enterprise (50 accounts)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button className="bg-amber-500 hover:bg-amber-600 text-white" disabled>
                    Send Invite (Coming Soon)
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loadingInfluencers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">No influencers found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((inf) => {
                const acctCount = allAccounts.filter((a) => a.influencer_id === inf.id).length;
                const reportCount = allReports.filter((r) => r.influencer_id === inf.id).length;
                const openReports = allReports.filter((r) => r.influencer_id === inf.id && r.status === "new").length;
                return (
                  <Card key={inf.id} className="hover:border-amber-500/20 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground">{inf.display_name}</p>
                            {inf.brand_name && (
                              <span className="text-xs text-muted-foreground">({inf.brand_name})</span>
                            )}
                            <Badge variant="outline" className="text-[9px] uppercase">{inf.subscription_tier}</Badge>
                            {!inf.onboarding_completed && (
                              <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500">Onboarding</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-1">
                            <span>{acctCount}/{inf.max_monitored_accounts} accounts</span>
                            <span>{reportCount} reports ({openReports} new)</span>
                            <span>Joined {new Date(inf.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Select
                          value={inf.subscription_tier}
                          onValueChange={(tier) => updateTier.mutate({ id: inf.id, tier })}
                        >
                          <SelectTrigger className="w-28 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ───── All Reports Tab ───── */}
        <TabsContent value="reports" className="space-y-4 mt-4">
          {allReports.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">No reports across any influencers.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {allReports.slice(0, 50).map((report) => (
                <Card key={report.id} className="hover:border-amber-500/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{report.severity.toUpperCase()}</Badge>
                      <Badge variant="outline" className="text-[10px]">{report.status.toUpperCase()}</Badge>
                      <Badge variant="outline" className="text-[10px]">{report.platform}</Badge>
                    </div>
                    <p className="text-sm font-semibold">@{report.impersonator_username}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(report.created_at).toLocaleDateString()} · Source: {report.source}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ───── Platform Stats Tab ───── */}
        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{influencers.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Total Influencers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Eye className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{allAccounts.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Monitored Accounts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{allReports.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Impersonation Reports</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileText className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{allTakedowns.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Takedown Requests</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Platform Distribution</CardTitle>
              <CardDescription className="text-xs">Monitored accounts by platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(platformCounts).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No accounts yet.</p>
                ) : (
                  Object.entries(platformCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([platform, count]) => (
                      <div key={platform} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground capitalize w-20">{platform}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${(count / allAccounts.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
