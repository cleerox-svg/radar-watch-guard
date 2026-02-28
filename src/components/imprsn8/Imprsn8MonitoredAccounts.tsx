/**
 * Imprsn8MonitoredAccounts.tsx — CRUD interface for managing monitored social media accounts.
 * Now uses Imprsn8Context for influencer scoping. Supports scan-now trigger.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useImprsn8 } from "./Imprsn8Context";
import { Plus, Trash2, ExternalLink, CheckCircle2, Clock, AlertCircle, RefreshCw, Pencil, Zap, Loader2 } from "lucide-react";

const PLATFORMS = {
  twitter: { label: "Twitter / X", color: "bg-sky-500/10 text-sky-500 border-sky-500/20", urlPrefix: "https://x.com/" },
  instagram: { label: "Instagram", color: "bg-pink-500/10 text-pink-500 border-pink-500/20", urlPrefix: "https://instagram.com/" },
  tiktok: { label: "TikTok", color: "bg-foreground/10 text-foreground border-foreground/20", urlPrefix: "https://tiktok.com/@" },
  youtube: { label: "YouTube", color: "bg-red-500/10 text-red-500 border-red-500/20", urlPrefix: "https://youtube.com/@" },
} as const;

type PlatformKey = keyof typeof PLATFORMS;

const statusIcons: Record<string, typeof CheckCircle2> = {
  active: CheckCircle2,
  pending: Clock,
  error: AlertCircle,
  scanning: RefreshCw,
};

export function Imprsn8MonitoredAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedId, isAllView, currentInfluencer, getInfluencerFilter, isAdminView } = useImprsn8();
  const filter = getInfluencerFilter();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [platform, setPlatform] = useState<PlatformKey>("twitter");
  const [username, setUsername] = useState("");
  const [url, setUrl] = useState("");
  const [scanningId, setScanningId] = useState<string | null>(null);

  /** Fetch monitored accounts — scoped by context */
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["monitored-accounts", selectedId],
    queryFn: async () => {
      let q = supabase.from("monitored_accounts").select("*, influencer_profiles(display_name)").order("created_at", { ascending: false });
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const addAccount = useMutation({
    mutationFn: async () => {
      if (!filter.influencer_id) throw new Error("No influencer selected");
      const platformUrl = url || `${PLATFORMS[platform].urlPrefix}${username}`;
      const { error } = await supabase.from("monitored_accounts").insert({
        influencer_id: filter.influencer_id,
        platform, platform_username: username, platform_url: platformUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      toast({ title: "Account added", description: `@${username} is now being monitored.` });
      resetForm(); setAddOpen(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateAccount = useMutation({
    mutationFn: async () => {
      if (!editingAccount) return;
      const platformUrl = url || `${PLATFORMS[platform].urlPrefix}${username}`;
      const { error } = await supabase.from("monitored_accounts").update({ platform, platform_username: username, platform_url: platformUrl }).eq("id", editingAccount.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      toast({ title: "Account updated" }); resetForm(); setEditOpen(false); setEditingAccount(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monitored_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      toast({ title: "Account removed" });
    },
  });

  /** Scan Now — triggers imprsn8 scanner for a specific account's influencer */
  const scanNow = async (acct: any) => {
    setScanningId(acct.id);
    try {
      const { data, error } = await supabase.functions.invoke("agent-imprsn8-scanner", {
        body: { influencer_id: acct.influencer_id, trigger_type: "manual" },
      });
      if (error) throw error;
      toast({ title: "Scan complete", description: data?.summary || `Processed ${data?.processed ?? 0} accounts` });
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      toast({ title: "Scan failed", description: msg, variant: "destructive" });
    } finally {
      setScanningId(null);
    }
  };

  const maxAccounts = currentInfluencer?.max_monitored_accounts ?? 3;
  const canAdd = !isAllView && accounts.length < maxAccounts;

  const resetForm = () => { setUsername(""); setUrl(""); setPlatform("twitter"); };
  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/^@/, "");
    setUsername(clean);
    setUrl(`${PLATFORMS[platform].urlPrefix}${clean}`);
  };
  const openEdit = (acct: any) => {
    setEditingAccount(acct);
    setPlatform(acct.platform as PlatformKey);
    setUsername(acct.platform_username);
    setUrl(acct.platform_url);
    setEditOpen(true);
  };

  const renderFormFields = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Platform</Label>
        <Select value={platform} onValueChange={(v) => { setPlatform(v as PlatformKey); if (username) setUrl(`${PLATFORMS[v as PlatformKey].urlPrefix}${username}`); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PLATFORMS).map(([key, p]) => <SelectItem key={key} value={key}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Username</Label><Input placeholder="@username" value={username} onChange={(e) => handleUsernameChange(e.target.value)} /></div>
      <div className="space-y-2"><Label>Profile URL</Label><Input placeholder={PLATFORMS[platform].urlPrefix + "username"} value={url} onChange={(e) => setUrl(e.target.value)} /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Monitored Accounts</h3>
          <p className="text-sm text-muted-foreground">
            {isAllView ? `${accounts.length} accounts across all influencers` : `${accounts.length} of ${maxAccounts} accounts monitored`}
          </p>
        </div>
        {!isAllView && (
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button disabled={!canAdd} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4" /> Add Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Social Media Account</DialogTitle></DialogHeader>
              {renderFormFields()}
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => addAccount.mutate()} disabled={!username || addAccount.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
                  {addAccount.isPending ? "Adding..." : "Add Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Capacity bar (single influencer only) */}
      {!isAllView && (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 transition-all rounded-full" style={{ width: `${(accounts.length / maxAccounts) * 100}%` }} />
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { resetForm(); setEditingAccount(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => updateAccount.mutate()} disabled={!username || updateAccount.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
              {updateAccount.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-24" /></Card>)}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed border-amber-500/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground text-center">No accounts being monitored yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acct: any) => {
            const platMeta = PLATFORMS[acct.platform as PlatformKey] ?? PLATFORMS.twitter;
            const StatusIcon = statusIcons[acct.scan_status ?? "pending"] ?? Clock;
            const isScanning = scanningId === acct.id;
            return (
              <Card key={acct.id} className="group hover:border-amber-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="outline" className={platMeta.color + " text-[10px] font-mono"}>{platMeta.label}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">@{acct.platform_username}</p>
                        <a href={acct.platform_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-amber-500 flex items-center gap-1 truncate">
                          {acct.platform_url} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-amber-500 transition-all" onClick={() => scanNow(acct)} disabled={isScanning}>
                        {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      </Button>
                      {!isAllView && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-amber-500 transition-all" onClick={() => openEdit(acct)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all" onClick={() => removeAccount.mutate(acct.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
                    <StatusIcon className="w-3 h-3" />
                    <span className="capitalize">{acct.scan_status ?? "pending"}</span>
                    {acct.verified && <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-500">Verified</Badge>}
                    {isAllView && acct.influencer_profiles && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/20 text-amber-500">{acct.influencer_profiles.display_name}</Badge>
                    )}
                    {acct.last_scanned_at && <span className="ml-auto">Last scan: {new Date(acct.last_scanned_at).toLocaleDateString()}</span>}
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
