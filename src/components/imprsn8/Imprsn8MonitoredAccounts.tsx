/**
 * Imprsn8MonitoredAccounts.tsx — CRUD interface for managing monitored social media accounts.
 * In "All Influencers" view: groups accounts by influencer with collapsible sections,
 * summary cards, risk scores, and category filters.
 * Uses Imprsn8Context for influencer scoping. Supports scan-now and profile-fetch triggers.
 */

import { useState, useMemo } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useImprsn8 } from "./Imprsn8Context";
import {
  Plus, Trash2, ExternalLink, CheckCircle2, Clock, AlertCircle,
  RefreshCw, Pencil, Zap, Loader2, Camera, History, Users,
  Eye, ShieldCheck, MapPin, Link, Calendar, Globe, AtSign,
  TrendingUp, FileText, BarChart3, ChevronRight, Compass,
  ChevronDown, ChevronUp, Shield, AlertTriangle, Gauge, Brain
} from "lucide-react";
import { Imprsn8DiscoveryQueue } from "./Imprsn8DiscoveryQueue";

const PLATFORMS = {
  twitter: { label: "Twitter / X", color: "bg-sky-500/10 text-sky-500 border-sky-500/20", urlPrefix: "https://x.com/" },
  instagram: { label: "Instagram", color: "bg-pink-500/10 text-pink-500 border-pink-500/20", urlPrefix: "https://instagram.com/" },
  tiktok: { label: "TikTok", color: "bg-foreground/10 text-foreground border-foreground/20", urlPrefix: "https://tiktok.com/@" },
  youtube: { label: "YouTube", color: "bg-red-500/10 text-red-500 border-red-500/20", urlPrefix: "https://youtube.com/@" },
  facebook: { label: "Facebook", color: "bg-blue-600/10 text-blue-600 border-blue-600/20", urlPrefix: "https://facebook.com/" },
  twitch: { label: "Twitch", color: "bg-purple-500/10 text-purple-500 border-purple-500/20", urlPrefix: "https://twitch.tv/" },
  linkedin: { label: "LinkedIn", color: "bg-blue-700/10 text-blue-700 border-blue-700/20", urlPrefix: "https://linkedin.com/in/" },
  threads: { label: "Threads", color: "bg-foreground/10 text-foreground border-foreground/20", urlPrefix: "https://threads.net/@" },
} as const;

type PlatformKey = keyof typeof PLATFORMS;

const statusIcons: Record<string, typeof CheckCircle2> = {
  active: CheckCircle2, pending: Clock, error: AlertCircle, scanning: RefreshCw,
};

const CATEGORY_FILTERS = [
  { value: "all", label: "All Accounts", icon: Users },
  { value: "legitimate", label: "Legitimate", icon: ShieldCheck },
  { value: "suspicious", label: "Suspicious", icon: AlertTriangle },
  { value: "likely_imposter", label: "Likely Imposter", icon: AlertCircle },
  { value: "unscored", label: "Unscored", icon: Clock },
] as const;

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  legitimate: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30" },
  low_risk: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-400/30" },
  suspicious: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30" },
  likely_imposter: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
  confirmed_imposter: { bg: "bg-red-600/10", text: "text-red-600", border: "border-red-600/30" },
  unscored: { bg: "bg-muted", text: "text-muted-foreground", border: "border-muted-foreground/30" },
};

function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function StatPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-accent/50 min-w-[80px] flex-1">
      <Icon className="w-4 h-4 text-imprsn8" />
      <span className="text-base font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

/** Risk score gauge badge */
function RiskBadge({ score, category }: { score: number | null; category: string }) {
  const colors = RISK_COLORS[category] || RISK_COLORS.unscored;
  if (score == null) {
    return (
      <Badge variant="outline" className={`text-[10px] ${colors.border} ${colors.text}`}>
        <Clock className="w-2.5 h-2.5 mr-1" /> Unscored
      </Badge>
    );
  }
  const label = category === "legitimate" ? "Legit" :
    category === "low_risk" ? "Low Risk" :
    category === "suspicious" ? "Suspicious" :
    category === "likely_imposter" ? "Likely Fake" :
    category === "confirmed_imposter" ? "Imposter" : "Unknown";

  return (
    <Badge variant="outline" className={`text-[10px] ${colors.border} ${colors.text} ${colors.bg}`}>
      <Gauge className="w-2.5 h-2.5 mr-1" /> {score} — {label}
    </Badge>
  );
}

/** Summary card for an influencer group */
function InfluencerSummaryCard({ name, accounts }: { name: string; accounts: any[] }) {
  const total = accounts.length;
  const legitimate = accounts.filter(a => a.risk_category === "legitimate" || a.risk_category === "low_risk").length;
  const suspicious = accounts.filter(a => a.risk_category === "suspicious" || a.risk_category === "likely_imposter" || a.risk_category === "confirmed_imposter").length;
  const unscored = accounts.filter(a => !a.risk_score && a.risk_score !== 0).length;
  const avgScore = accounts.filter(a => a.risk_score != null).length > 0
    ? Math.round(accounts.filter(a => a.risk_score != null).reduce((s, a) => s + (a.risk_score ?? 0), 0) / accounts.filter(a => a.risk_score != null).length)
    : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      <div className="p-2.5 rounded-lg bg-accent/40 text-center">
        <p className="text-lg font-bold text-foreground">{total}</p>
        <p className="text-[10px] text-muted-foreground uppercase">Monitored</p>
      </div>
      <div className="p-2.5 rounded-lg bg-emerald-500/5 text-center">
        <p className="text-lg font-bold text-emerald-500">{legitimate}</p>
        <p className="text-[10px] text-emerald-500/70 uppercase">Legitimate</p>
      </div>
      <div className="p-2.5 rounded-lg bg-amber-500/5 text-center">
        <p className="text-lg font-bold text-amber-500">{suspicious}</p>
        <p className="text-[10px] text-amber-500/70 uppercase">Suspicious</p>
      </div>
      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
        <p className="text-lg font-bold text-muted-foreground">{avgScore ?? "—"}</p>
        <p className="text-[10px] text-muted-foreground uppercase">Avg Score</p>
      </div>
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
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedInfluencers, setExpandedInfluencers] = useState<Set<string>>(new Set(["__all__"]));
  const [historySheet, setHistorySheet] = useState<{ open: boolean; accountId: string | null; accountName: string }>({
    open: false, accountId: null, accountName: "",
  });
  const [detailSheet, setDetailSheet] = useState<{ open: boolean; account: any | null }>({
    open: false, account: null,
  });

  const toggleInfluencer = (id: string) => {
    setExpandedInfluencers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /** Fetch monitored accounts — scoped by context */
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["monitored-accounts", selectedId],
    queryFn: async () => {
      let q = supabase.from("monitored_accounts").select("*, influencer_profiles(display_name, avatar_url)").order("created_at", { ascending: false });
      if (filter.influencer_id) q = q.eq("influencer_id", filter.influencer_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  /** Filter accounts by category */
  const filteredAccounts = useMemo(() => {
    if (categoryFilter === "all") return accounts;
    if (categoryFilter === "suspicious") {
      return accounts.filter((a: any) => ["suspicious", "likely_imposter", "confirmed_imposter"].includes(a.risk_category));
    }
    return accounts.filter((a: any) => a.risk_category === categoryFilter);
  }, [accounts, categoryFilter]);

  /** Group accounts by influencer — always group, even for single influencer */
  const groupedByInfluencer = useMemo(() => {
    const groups: Record<string, { name: string; avatarUrl: string | null; accounts: any[] }> = {};
    for (const acct of filteredAccounts) {
      const infId = acct.influencer_id;
      if (!groups[infId]) {
        groups[infId] = {
          name: (acct as any).influencer_profiles?.display_name || "Unknown",
          avatarUrl: (acct as any).influencer_profiles?.avatar_url || null,
          accounts: [],
        };
      }
      groups[infId].accounts.push(acct);
    }
    return Object.entries(groups).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [filteredAccounts]);

  /** Fetch latest snapshot for detail sheet */
  const { data: latestSnapshot } = useQuery({
    queryKey: ["latest-snapshot", detailSheet.account?.id],
    queryFn: async () => {
      if (!detailSheet.account?.id) return null;
      const { data, error } = await supabase
        .from("account_profile_snapshots").select("*")
        .eq("monitored_account_id", detailSheet.account.id)
        .order("captured_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!detailSheet.account?.id,
  });

  /** Fetch snapshot history */
  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ["profile-snapshots", historySheet.accountId],
    queryFn: async () => {
      if (!historySheet.accountId) return [];
      const { data, error } = await supabase
        .from("account_profile_snapshots").select("*")
        .eq("monitored_account_id", historySheet.accountId)
        .order("captured_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!historySheet.accountId,
  });

  // Mutations
  const addAccount = useMutation({
    mutationFn: async () => {
      if (!filter.influencer_id) throw new Error("No influencer selected");
      const platformUrl = url || `${PLATFORMS[platform].urlPrefix}${username}`;
      const { error } = await supabase.from("monitored_accounts").insert({
        influencer_id: filter.influencer_id, platform, platform_username: username, platform_url: platformUrl,
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
      await supabase.from("account_profile_snapshots").delete().eq("monitored_account_id", id);
      await supabase.from("account_discoveries").delete().eq("source_account_id", id);
      const { error } = await supabase.from("monitored_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["imprsn8-dash-accounts"] });
      toast({ title: "Account removed" });
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

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
      toast({ title: "Scan failed", description: err instanceof Error ? err.message : "Scan failed", variant: "destructive" });
    } finally { setScanningId(null); }
  };

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
        description: changeCount > 0 ? `${changeCount} change(s) detected` : "No changes detected.",
      });
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
    } catch (err: unknown) {
      toast({ title: "Fetch failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setFetchingId(null); }
  };

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
      toast({ title: "Discovery failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setDiscoveringId(null); }
  };

  /** Score a single account with AI */
  const scoreAccount = async (acct: any) => {
    setScoringId(acct.id);
    try {
      const { data, error } = await supabase.functions.invoke("agent-risk-scorer", {
        body: { account_id: acct.id, influencer_id: acct.influencer_id },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      toast({
        title: "Risk scored",
        description: result ? `@${result.username}: ${result.risk_score}/100 (${result.risk_category})` : "Scoring complete",
      });
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
    } catch (err: unknown) {
      toast({ title: "Scoring failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setScoringId(null); }
  };

  /** Score all accounts for an influencer */
  const scoreAllForInfluencer = async (influencerId: string) => {
    const scoringKey = influencerId || "__all__";
    setScoringId(scoringKey);
    try {
      const body: Record<string, string> = {};
      if (influencerId) body.influencer_id = influencerId;
      const { data, error } = await supabase.functions.invoke("agent-risk-scorer", {
        body,
      });
      if (error) throw error;
      toast({ title: "Bulk scoring complete", description: `Scored ${data?.scored ?? 0} accounts` });
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
    } catch (err: unknown) {
      toast({ title: "Scoring failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setTimeout(() => setScoringId(null), 500); }
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

  /** Render a single account card */
  const renderAccountCard = (acct: any, showInfluencer = false) => {
    const platMeta = PLATFORMS[acct.platform as PlatformKey] ?? PLATFORMS.twitter;
    const StatusIcon = statusIcons[acct.scan_status ?? "pending"] ?? Clock;
    const isScanning = scanningId === acct.id;
    const isFetching = fetchingId === acct.id;
    const isScoring = scoringId === acct.id;
    const hasProfile = !!(acct as any).current_avatar_url || !!(acct as any).current_display_name;

    return (
      <Card key={acct.id} className="group hover:border-imprsn8/30 transition-colors cursor-pointer active:scale-[0.99]"
        onClick={() => setDetailSheet({ open: true, account: acct })}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 border-2 border-imprsn8/20 shrink-0 shadow-sm">
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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className={platMeta.color + " text-[10px] font-mono"}>{platMeta.label}</Badge>
                    <span className="text-[11px] text-muted-foreground truncate">@{acct.platform_username}</span>
                    <RiskBadge score={acct.risk_score} category={acct.risk_category || "unscored"} />
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-imprsn8"
                    title="AI Risk Score" onClick={() => scoreAccount(acct)} disabled={isScoring}>
                    {isScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-imprsn8"
                    title="Fetch profile" onClick={() => fetchProfile(acct)} disabled={isFetching}>
                    {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-imprsn8"
                    onClick={() => scanNow(acct)} disabled={isScanning} title="Scan for impersonators">
                    {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-imprsn8"
                    onClick={() => discoverAccounts(acct)} disabled={discoveringId === acct.id} title="Discover on other platforms">
                    {discoveringId === acct.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-imprsn8" onClick={() => openEdit(acct)} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeAccount.mutate(acct.id)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

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

              {(acct as any).current_bio && (
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{(acct as any).current_bio}</p>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <StatusIcon className="w-3 h-3" />
                  <span className="capitalize">{acct.scan_status ?? "pending"}</span>
                  {showInfluencer && acct.influencer_profiles && (
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
  };

  /** Detail sheet */
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
    const isScoring = scoringId === acct.id;
    const riskFactors = acct.risk_factors && typeof acct.risk_factors === "object" ? acct.risk_factors : {};

    return (
      <Sheet open={detailSheet.open} onOpenChange={(open) => setDetailSheet(s => ({ ...s, open }))}>
        <SheetContent side="bottom" className="h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl p-0 border-t border-imprsn8/20">
          <ScrollArea className="h-full">
            <div className="flex flex-col">
              <div className="relative px-6 pt-8 pb-6 bg-gradient-to-b from-imprsn8-purple/20 to-transparent">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30" />
                <div className="flex flex-col items-center text-center gap-4">
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
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
                    <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={platMeta.color + " text-xs font-mono"}>{platMeta.label}</Badge>
                      <span className="text-sm text-muted-foreground">@{acct.platform_username}</span>
                    </div>
                    <div className="mt-2">
                      <RiskBadge score={acct.risk_score} category={acct.risk_category || "unscored"} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => scoreAccount(acct)} disabled={isScoring}>
                      {isScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                      Score Risk
                    </Button>
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

              <div className="px-4 py-4">
                <div className="flex gap-2">
                  <StatPill icon={Users} label="Followers" value={formatCount(followers)} />
                  <StatPill icon={Eye} label="Following" value={formatCount(following)} />
                  <StatPill icon={FileText} label="Posts" value={formatCount(posts)} />
                </div>
              </div>

              <Separator className="mx-6" />

              {/* Risk Factors */}
              {Object.keys(riskFactors).length > 0 && (
                <>
                  <div className="px-6 py-4 space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Gauge className="w-3.5 h-3.5" /> Risk Factors
                    </h4>
                    <div className="space-y-1.5">
                      {Object.entries(riskFactors).map(([key, val]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                          <span className={`font-mono ${val?.impact > 0 ? "text-red-500" : val?.impact < 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                            {val?.impact > 0 ? "+" : ""}{val?.impact}
                          </span>
                        </div>
                      ))}
                    </div>
                    {acct.last_risk_scored_at && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Last scored: {new Date(acct.last_risk_scored_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Separator className="mx-6" />
                </>
              )}

              {bio && (
                <div className="px-6 py-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bio</h4>
                  <p className="text-sm text-foreground leading-relaxed">{bio}</p>
                </div>
              )}

              <div className="px-6 py-4 space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Details</h4>
                {location && <div className="flex items-center gap-3 text-sm"><MapPin className="w-4 h-4 text-muted-foreground shrink-0" /><span className="text-foreground">{location}</span></div>}
                {website && <div className="flex items-center gap-3 text-sm"><Globe className="w-4 h-4 text-muted-foreground shrink-0" /><a href={website} target="_blank" rel="noopener noreferrer" className="text-imprsn8 hover:underline truncate">{website}</a></div>}
                {accountCreated && <div className="flex items-center gap-3 text-sm"><Calendar className="w-4 h-4 text-muted-foreground shrink-0" /><span className="text-foreground">Joined {new Date(accountCreated).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span></div>}
                <div className="flex items-center gap-3 text-sm"><AtSign className="w-4 h-4 text-muted-foreground shrink-0" /><span className="text-foreground font-mono text-xs">{acct.platform_url}</span></div>
              </div>

              <Separator className="mx-6" />

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
                    <p className="text-sm font-semibold text-foreground mt-0.5">{acct.last_scanned_at ? new Date(acct.last_scanned_at).toLocaleDateString() : "Never"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/30">
                    <p className="text-[10px] text-muted-foreground uppercase">Last Fetched</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{acct.last_profile_fetch_at ? new Date(acct.last_profile_fetch_at).toLocaleDateString() : "Never"}</p>
                  </div>
                </div>
              </div>

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">Monitored Accounts</h3>
          <p className="text-sm text-muted-foreground">
            {isAllView ? `${accounts.length} accounts across all influencers` : `${accounts.length} of ${maxAccounts} accounts monitored`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={() => scoreAllForInfluencer(filter.influencer_id || "")} disabled={!!scoringId}>
            {scoringId === "__all__" || scoringId === (filter.influencer_id || "__all__") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {scoringId === "__all__" || scoringId === (filter.influencer_id || "__all__") ? "Scoring..." : "Score All"}
          </Button>
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
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORY_FILTERS.map(({ value, label, icon: Icon }) => {
          const count = value === "all" ? accounts.length :
            value === "suspicious" ? accounts.filter((a: any) => ["suspicious", "likely_imposter", "confirmed_imposter"].includes(a.risk_category)).length :
            accounts.filter((a: any) => a.risk_category === value).length;
          return (
            <Button key={value} size="sm" variant={categoryFilter === value ? "default" : "outline"}
              className={`gap-1.5 text-xs h-8 ${categoryFilter === value ? "bg-imprsn8 text-imprsn8-foreground hover:bg-imprsn8/90" : ""}`}
              onClick={() => setCategoryFilter(value)}>
              <Icon className="w-3 h-3" /> {label} <span className="text-[10px] opacity-70">({count})</span>
            </Button>
          );
        })}
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

      {/* Snapshot History Sheet */}
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
              <p className="text-sm text-muted-foreground text-center py-12">No profile snapshots yet.</p>
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

      {/* Detail Sheet */}
      {renderDetailSheet()}

      {/* Cross-Platform Discovery Queue */}
      <Imprsn8DiscoveryQueue />

      {/* Account list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-32" /></Card>)}
        </div>
      ) : filteredAccounts.length === 0 ? (
        <Card className="border-dashed border-imprsn8/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground text-center">
              {categoryFilter !== "all" ? "No accounts match this filter." : "No accounts being monitored yet."}
            </p>
          </CardContent>
        </Card>
      ) : groupedByInfluencer.length > 0 ? (
        /* Always grouped by influencer view */
        <div className="space-y-4">
          {groupedByInfluencer.map(([infId, group]) => {
            const isOpen = expandedInfluencers.has(infId) || expandedInfluencers.has("__all__");
            return (
              <Collapsible key={infId} open={isOpen} onOpenChange={() => toggleInfluencer(infId)}>
                <Card className="border-imprsn8/10">
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-4 flex items-center justify-between hover:bg-accent/30 transition-colors rounded-t-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-imprsn8/20">
                          <AvatarImage src={group.avatarUrl || undefined} />
                          <AvatarFallback className="text-sm font-bold bg-imprsn8-purple text-imprsn8">
                            {group.name[0]?.toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="text-sm font-bold text-foreground">{group.name}</p>
                          <p className="text-[11px] text-muted-foreground">{group.accounts.length} accounts monitored</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 text-xs">
                          {group.accounts.filter(a => ["suspicious", "likely_imposter", "confirmed_imposter"].includes(a.risk_category)).length > 0 && (
                            <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[10px]">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                              {group.accounts.filter(a => ["suspicious", "likely_imposter", "confirmed_imposter"].includes(a.risk_category)).length} suspicious
                            </Badge>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={(e) => {
                          e.stopPropagation();
                          scoreAllForInfluencer(infId);
                        }} disabled={scoringId === infId} title="Score all accounts">
                          {scoringId === infId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        </Button>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <InfluencerSummaryCard name={group.name} accounts={group.accounts} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.accounts.map((acct: any) => renderAccountCard(acct, false))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        /* Fallback flat view */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAccounts.map((acct: any) => renderAccountCard(acct, false))}
        </div>
      )}
    </div>
  );
}
