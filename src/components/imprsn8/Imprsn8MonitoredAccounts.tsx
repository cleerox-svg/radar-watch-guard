/**
 * Imprsn8MonitoredAccounts.tsx — CRUD interface for managing monitored social media accounts.
 * Shows profile pictures, account details, and change history from profile snapshots.
 * Uses Imprsn8Context for influencer scoping. Supports scan-now and profile-fetch triggers.
 * Enhanced with mobile-friendly profile detail sheets showing latest pulled account data.
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useImprsn8 } from "./Imprsn8Context";
import {
  Plus, Trash2, ExternalLink, CheckCircle2, Clock, AlertCircle,
  RefreshCw, Pencil, Zap, Loader2, Camera, History, Users,
  Eye, ShieldCheck, MapPin, Link, Calendar, Globe, AtSign,
  TrendingUp, FileText, BarChart3, ChevronRight, Compass
} from "lucide-react";
import { Imprsn8DiscoveryQueue } from "./Imprsn8DiscoveryQueue";

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

/** Format large numbers compactly */
function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Stat pill for the profile detail view */
function StatPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-accent/50 min-w-[80px] flex-1">
      <Icon className="w-4 h-4 text-imprsn8" />
      <span className="text-base font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function Imprsn8MonitoredAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedId, isAllView, currentInfluencer, getInfluencerFilter } = useImprsn8();
  const filter = getInfluencerFilter();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [platform, setPlatform] = useState<PlatformKey>("twitter");
  const [username, setUsername] = useState("");
  const [url, setUrl] = useState("");
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [historySheet, setHistorySheet] = useState<{ open: boolean; accountId: string | null; accountName: string }>({
    open: false, accountId: null, accountName: "",
  });
  const [detailSheet, setDetailSheet] = useState<{ open: boolean; account: any | null }>({
    open: false, account: null,
  });
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  /** Discover cross-platform accounts from a monitored account */
  const discoverAccounts = async (acct: any) => {
    setDiscoveringId(acct.id);
    try {
      const { data, error } = await supabase.functions.invoke("agent-cross-platform-discovery", {
        body: { monitored_account_id: acct.id, influencer_id: acct.influencer_id, trigger_type: "manual" },
      });
      if (error) throw error;
      toast({ title: "Discovery complete", description: data?.summary || `Found ${data?.discovered ?? 0} potential accounts` });
      queryClient.invalidateQueries({ queryKey: ["account-discoveries"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Discovery failed";
      toast({ title: "Discovery failed", description: msg, variant: "destructive" });
    } finally {
      setDiscoveringId(null);
    }
  };

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

  /** Fetch latest snapshot for the detail sheet */
  const { data: latestSnapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ["latest-snapshot", detailSheet.account?.id],
    queryFn: async () => {
      if (!detailSheet.account?.id) return null;
      const { data, error } = await supabase
        .from("account_profile_snapshots")
        .select("*")
        .eq("monitored_account_id", detailSheet.account.id)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!detailSheet.account?.id,
  });

  /** Fetch snapshot history for a specific account */
  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ["profile-snapshots", historySheet.accountId],
    queryFn: async () => {
      if (!historySheet.accountId) return [];
      const { data, error } = await supabase
        .from("account_profile_snapshots")
        .select("*")
        .eq("monitored_account_id", historySheet.accountId)
        .order("captured_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!historySheet.accountId,
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

  /** Scan Now — triggers imprsn8 scanner */
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

  /** Fetch Profile — pulls current profile data + avatar */
  const fetchProfile = async (acct: any) => {
    setFetchingId(acct.id);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-profile-snapshot", {
        body: { monitored_account_id: acct.id },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      const changeCount = result?.changes?.length ?? 0;
      toast({
        title: "Profile fetched",
        description: changeCount > 0
          ? `${changeCount} change(s) detected: ${result.changes.join(", ")}`
          : "Profile snapshot captured — no changes detected.",
      });
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["latest-snapshot"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Profile fetch failed";
      toast({ title: "Fetch failed", description: msg, variant: "destructive" });
    } finally {
      setFetchingId(null);
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

  /** Render the profile detail sheet — mobile-first, rich view */
  const renderDetailSheet = () => {
    const acct = detailSheet.account;
    if (!acct) return null;
    const platMeta = PLATFORMS[acct.platform as PlatformKey] ?? PLATFORMS.twitter;
    const snap = latestSnapshot;
    const avatarUrl = snap?.avatar_url || acct.current_avatar_url;
    const displayName = snap?.display_name || acct.current_display_name || `@${acct.platform_username}`;
    const bio = snap?.bio || acct.current_bio;
    const followers = snap?.follower_count ?? acct.current_follower_count;
    const following = snap?.following_count ?? acct.current_following_count;
    const posts = snap?.post_count ?? acct.current_post_count;
    const verified = snap?.verified_on_platform ?? acct.current_verified;
    const location = snap?.location;
    const website = snap?.website_url;
    const accountCreated = snap?.account_created_at;
    const isFetching = fetchingId === acct.id;

    return (
      <Sheet open={detailSheet.open} onOpenChange={(open) => setDetailSheet(s => ({ ...s, open }))}>
        <SheetContent side="bottom" className="h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl p-0 border-t border-imprsn8/20">
          <ScrollArea className="h-full">
            <div className="flex flex-col">
              {/* Hero header with avatar */}
              <div className="relative px-6 pt-8 pb-6 bg-gradient-to-b from-imprsn8-purple/20 to-transparent">
                {/* Drag handle */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30" />
                
                <div className="flex flex-col items-center text-center gap-4">
                  {/* Large profile picture */}
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-imprsn8/30 shadow-lg">
                      <AvatarImage src={avatarUrl} className="object-cover" />
                      <AvatarFallback className="text-2xl font-bold bg-imprsn8-purple text-imprsn8">
                        {acct.platform_username?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    {verified && (
                      <div className="absolute -bottom-1 -right-1 bg-sky-500 rounded-full p-1.5 shadow-md">
                        <ShieldCheck className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Name and handle */}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <Badge variant="outline" className={platMeta.color + " text-xs font-mono"}>{platMeta.label}</Badge>
                      <span className="text-sm text-muted-foreground">@{acct.platform_username}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => fetchProfile(acct)} disabled={isFetching}>
                      {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      Fetch Latest
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                      <a href={acct.platform_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" /> View Profile
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                      onClick={() => { setDetailSheet({ open: false, account: null }); setHistorySheet({ open: true, accountId: acct.id, accountName: acct.platform_username }); }}>
                      <History className="w-3.5 h-3.5" /> History
                    </Button>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="px-4 py-4">
                <div className="flex gap-2">
                  <StatPill icon={Users} label="Followers" value={formatCount(followers)} />
                  <StatPill icon={Eye} label="Following" value={formatCount(following)} />
                  <StatPill icon={FileText} label="Posts" value={formatCount(posts)} />
                </div>
              </div>

              <Separator className="mx-6" />

              {/* Bio */}
              {bio && (
                <div className="px-6 py-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bio</h4>
                  <p className="text-sm text-foreground leading-relaxed">{bio}</p>
                </div>
              )}

              {/* Profile details */}
              <div className="px-6 py-4 space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Details</h4>
                
                {location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{location}</span>
                  </div>
                )}
                {website && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={website} target="_blank" rel="noopener noreferrer" className="text-imprsn8 hover:underline truncate">{website}</a>
                  </div>
                )}
                {accountCreated && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground">Joined {new Date(accountCreated).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <AtSign className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground font-mono text-xs">{acct.platform_url}</span>
                </div>
              </div>

              <Separator className="mx-6" />

              {/* Monitoring status */}
              <div className="px-6 py-4 space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monitoring Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-accent/30">
                    <p className="text-[10px] text-muted-foreground uppercase">Scan Status</p>
                    <p className="text-sm font-semibold text-foreground capitalize mt-0.5">{acct.scan_status ?? "pending"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/30">
                    <p className="text-[10px] text-muted-foreground uppercase">Profile Changes</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{acct.profile_changes_count ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/30">
                    <p className="text-[10px] text-muted-foreground uppercase">Last Scanned</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {acct.last_scanned_at ? new Date(acct.last_scanned_at).toLocaleDateString() : "Never"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/30">
                    <p className="text-[10px] text-muted-foreground uppercase">Last Fetched</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {acct.last_profile_fetch_at ? new Date(acct.last_profile_fetch_at).toLocaleDateString() : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Snapshot metadata */}
              {snap && (
                <>
                  <Separator className="mx-6" />
                  <div className="px-6 py-4 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Latest Snapshot</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Captured {new Date(snap.captured_at).toLocaleString()}
                    </p>
                    {snap.has_changes && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(snap.changes_detected as string[])?.map((c: string) => (
                          <Badge key={c} variant="outline" className="text-[10px] border-imprsn8/30 text-imprsn8 bg-imprsn8/5">
                            {c.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Bottom padding for safe area */}
              <div className="h-8" />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  };

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
              <Button disabled={!canAdd} className="gap-2 bg-imprsn8 hover:bg-imprsn8/90 text-imprsn8-foreground"><Plus className="w-4 h-4" /> Add Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Social Media Account</DialogTitle></DialogHeader>
              {renderFormFields()}
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => addAccount.mutate()} disabled={!username || addAccount.isPending} className="bg-imprsn8 hover:bg-imprsn8/90 text-imprsn8-foreground">
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
          <div className="h-full bg-imprsn8 transition-all rounded-full" style={{ width: `${(accounts.length / maxAccounts) * 100}%` }} />
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { resetForm(); setEditingAccount(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => updateAccount.mutate()} disabled={!username || updateAccount.isPending} className="bg-imprsn8 hover:bg-imprsn8/90 text-imprsn8-foreground">
              {updateAccount.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Snapshot History Sheet */}
      <Sheet open={historySheet.open} onOpenChange={(open) => setHistorySheet((s) => ({ ...s, open }))}>
        <SheetContent className="w-full sm:w-[420px] sm:max-w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="w-4 h-4" /> Profile History — @{historySheet.accountName}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-2">
            {snapshotsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading snapshots…
              </div>
            ) : snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No profile snapshots yet. Click the camera icon to fetch the first one.</p>
            ) : (
              <div className="space-y-4">
                {snapshots.map((snap: any) => (
                  <Card key={snap.id} className={snap.has_changes ? "border-imprsn8/30" : ""}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border border-border">
                          <AvatarImage src={snap.avatar_url} />
                          <AvatarFallback className="text-xs bg-muted">{snap.display_name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{snap.display_name ?? "Unknown"}</p>
                          <p className="text-[11px] text-muted-foreground">{new Date(snap.captured_at).toLocaleString()}</p>
                        </div>
                        {snap.has_changes && (
                          <Badge variant="outline" className="text-[9px] border-imprsn8/30 text-imprsn8 shrink-0">
                            {(snap.changes_detected as string[])?.length} changes
                          </Badge>
                        )}
                      </div>
                      {snap.bio && <p className="text-xs text-muted-foreground line-clamp-2">{snap.bio}</p>}
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {formatCount(snap.follower_count)}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatCount(snap.following_count)}</span>
                        <span>{formatCount(snap.post_count)} posts</span>
                        {snap.verified_on_platform && <ShieldCheck className="w-3 h-3 text-sky-500" />}
                      </div>
                      {snap.has_changes && (
                        <div className="flex flex-wrap gap-1">
                          {(snap.changes_detected as string[])?.map((c: string) => (
                            <Badge key={c} variant="outline" className="text-[9px] border-imprsn8/20 text-imprsn8">{c.replace(/_/g, " ")}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Profile Detail Sheet */}
      {renderDetailSheet()}

      {/* Cross-Platform Discovery Queue (HITL) */}
      <Imprsn8DiscoveryQueue />

      {/* Account cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-32" /></Card>)}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed border-imprsn8/20">
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
            const isFetching = fetchingId === acct.id;
            const hasProfile = !!(acct as any).current_avatar_url || !!(acct as any).current_display_name;
            return (
              <Card key={acct.id} className="group hover:border-imprsn8/30 transition-colors cursor-pointer active:scale-[0.99]"
                onClick={() => setDetailSheet({ open: true, account: acct })}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Profile avatar */}
                    <Avatar className="h-14 w-14 border-2 border-imprsn8/20 shrink-0 shadow-sm">
                      <AvatarImage src={(acct as any).current_avatar_url} className="object-cover" />
                      <AvatarFallback className="text-sm font-bold bg-imprsn8-purple text-imprsn8">
                        {acct.platform_username?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {(acct as any).current_display_name || `@${acct.platform_username}`}
                            </p>
                            {(acct as any).current_verified && <ShieldCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className={platMeta.color + " text-[10px] font-mono"}>{platMeta.label}</Badge>
                            <span className="text-[11px] text-muted-foreground truncate">@{acct.platform_username}</span>
                          </div>
                        </div>

                        {/* Action buttons - stop propagation so they don't open detail */}
                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-imprsn8 transition-all"
                            title="Fetch profile snapshot" onClick={() => fetchProfile(acct)} disabled={isFetching}>
                            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-imprsn8 transition-all"
                            onClick={() => scanNow(acct)} disabled={isScanning} title="Scan for impersonators">
                            {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-imprsn8 transition-all"
                            onClick={() => discoverAccounts(acct)} disabled={discoveringId === acct.id} title="Discover on other platforms">
                            {discoveringId === acct.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
                          </Button>
                          {!isAllView && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-imprsn8 transition-all" onClick={() => openEdit(acct)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all" onClick={() => removeAccount.mutate(acct.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Stats row */}
                      {hasProfile && (
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          {(acct as any).current_follower_count != null && (
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {formatCount((acct as any).current_follower_count)}</span>
                          )}
                          {(acct as any).current_following_count != null && (
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatCount((acct as any).current_following_count)}</span>
                          )}
                          {(acct as any).current_post_count != null && (
                            <span>{formatCount((acct as any).current_post_count)} posts</span>
                          )}
                          {(acct as any).profile_changes_count > 0 && (
                            <Badge variant="outline" className="text-[9px] border-imprsn8/20 text-imprsn8">
                              {(acct as any).profile_changes_count} changes
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Bio snippet */}
                      {(acct as any).current_bio && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{(acct as any).current_bio}</p>
                      )}

                      {/* Status footer */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <StatusIcon className="w-3 h-3" />
                          <span className="capitalize">{acct.scan_status ?? "pending"}</span>
                          {isAllView && acct.influencer_profiles && (
                            <Badge variant="outline" className="text-[9px] border-imprsn8/20 text-imprsn8">{acct.influencer_profiles.display_name}</Badge>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
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
