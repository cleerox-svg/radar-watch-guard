/**
 * Imprsn8MonitoredAccounts.tsx — CRUD interface for managing monitored social media accounts.
 * Supports Twitter/X, Instagram, TikTok, and YouTube with platform-specific cards.
 * Admins can manage accounts for any influencer. Influencers manage their own.
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
import { Plus, Trash2, ExternalLink, CheckCircle2, Clock, AlertCircle, RefreshCw, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/** Platform metadata for consistent rendering */
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
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  // Form fields
  const [platform, setPlatform] = useState<PlatformKey>("twitter");
  const [username, setUsername] = useState("");
  const [url, setUrl] = useState("");

  // Admin: selected influencer
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>("");

  /** Fetch all influencer profiles (admin only) */
  const { data: allInfluencers = [] } = useQuery({
    queryKey: ["all-influencer-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_profiles")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  /** Fetch the influencer profile for the current user (non-admin) */
  const { data: ownInfluencerProfile } = useQuery({
    queryKey: ["influencer-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !isAdmin,
  });

  // Determine active influencer ID
  const activeInfluencerId = isAdmin
    ? selectedInfluencerId || allInfluencers[0]?.id
    : ownInfluencerProfile?.id;

  const activeInfluencer = isAdmin
    ? allInfluencers.find((i: any) => i.id === activeInfluencerId)
    : ownInfluencerProfile;

  /** Fetch monitored accounts for active influencer */
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["monitored-accounts", activeInfluencerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitored_accounts")
        .select("*")
        .eq("influencer_id", activeInfluencerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeInfluencerId,
  });

  /** Add a new monitored account */
  const addAccount = useMutation({
    mutationFn: async () => {
      const platformUrl = url || `${PLATFORMS[platform].urlPrefix}${username}`;
      const { error } = await supabase.from("monitored_accounts").insert({
        influencer_id: activeInfluencerId!,
        platform,
        platform_username: username,
        platform_url: platformUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      toast({ title: "Account added", description: `@${username} on ${PLATFORMS[platform].label} is now being monitored.` });
      resetForm();
      setAddOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  /** Update an existing monitored account */
  const updateAccount = useMutation({
    mutationFn: async () => {
      if (!editingAccount) return;
      const platformUrl = url || `${PLATFORMS[platform].urlPrefix}${username}`;
      const { error } = await supabase
        .from("monitored_accounts")
        .update({
          platform,
          platform_username: username,
          platform_url: platformUrl,
        })
        .eq("id", editingAccount.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      toast({ title: "Account updated" });
      resetForm();
      setEditOpen(false);
      setEditingAccount(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  /** Remove a monitored account */
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

  const maxAccounts = activeInfluencer?.max_monitored_accounts ?? 3;
  const canAdd = accounts.length < maxAccounts;

  const resetForm = () => {
    setUsername("");
    setUrl("");
    setPlatform("twitter");
  };

  /** Auto-fill URL when username changes */
  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/^@/, "");
    setUsername(clean);
    setUrl(`${PLATFORMS[platform].urlPrefix}${clean}`);
  };

  /** Open edit dialog with pre-filled data */
  const openEdit = (acct: any) => {
    setEditingAccount(acct);
    setPlatform(acct.platform as PlatformKey);
    setUsername(acct.platform_username);
    setUrl(acct.platform_url);
    setEditOpen(true);
  };

  /** Shared form fields for add/edit */
  const renderFormFields = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Platform</Label>
        <Select value={platform} onValueChange={(v) => {
          setPlatform(v as PlatformKey);
          if (username) setUrl(`${PLATFORMS[v as PlatformKey].urlPrefix}${username}`);
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PLATFORMS).map(([key, p]) => (
              <SelectItem key={key} value={key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Username</Label>
        <Input
          placeholder="@username"
          value={username}
          onChange={(e) => handleUsernameChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Profile URL</Label>
        <Input
          placeholder={PLATFORMS[platform].urlPrefix + "username"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Admin: Influencer Selector */}
      {isAdmin && (
        <Card className="border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-muted-foreground">Managing accounts for</Label>
                <Select value={activeInfluencerId || ""} onValueChange={setSelectedInfluencerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an influencer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allInfluencers.map((inf: any) => (
                      <SelectItem key={inf.id} value={inf.id}>
                        {inf.display_name} {inf.brand_name ? `(${inf.brand_name})` : ""} — {inf.subscription_tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[10px] shrink-0">
                ADMIN MODE
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Monitored Accounts</h3>
          <p className="text-sm text-muted-foreground">
            {activeInfluencerId
              ? `${accounts.length} of ${maxAccounts} accounts monitored`
              : isAdmin ? "Select an influencer above" : "Loading..."}
          </p>
        </div>

        {/* Add Account Dialog */}
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button disabled={!canAdd || !activeInfluencerId} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
              <Plus className="w-4 h-4" /> Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Social Media Account</DialogTitle>
            </DialogHeader>
            {renderFormFields()}
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button
                onClick={() => addAccount.mutate()}
                disabled={!username || addAccount.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {addAccount.isPending ? "Adding..." : "Add Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Capacity indicator */}
      {activeInfluencerId && (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all rounded-full"
            style={{ width: `${(accounts.length / maxAccounts) * 100}%` }}
          />
        </div>
      )}

      {/* Edit Account Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { resetForm(); setEditingAccount(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={() => updateAccount.mutate()}
              disabled={!username || updateAccount.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {updateAccount.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account cards grid */}
      {!activeInfluencerId ? null : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed border-amber-500/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UsersIcon className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              No accounts being monitored yet.<br />Add social media profiles to start scanning for impersonators.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acct) => {
            const platMeta = PLATFORMS[acct.platform as PlatformKey] ?? PLATFORMS.twitter;
            const StatusIcon = statusIcons[acct.scan_status ?? "pending"] ?? Clock;
            return (
              <Card key={acct.id} className="group hover:border-amber-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="outline" className={platMeta.color + " text-[10px] font-mono"}>
                        {platMeta.label}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">@{acct.platform_username}</p>
                        <a
                          href={acct.platform_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-amber-500 flex items-center gap-1 truncate"
                        >
                          {acct.platform_url} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-amber-500 transition-all"
                        onClick={() => openEdit(acct)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                        onClick={() => removeAccount.mutate(acct.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
                    <StatusIcon className="w-3 h-3" />
                    <span className="capitalize">{acct.scan_status ?? "pending"}</span>
                    {acct.verified && (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-500">Verified</Badge>
                    )}
                    {acct.last_scanned_at && (
                      <span className="ml-auto">Last scan: {new Date(acct.last_scanned_at).toLocaleDateString()}</span>
                    )}
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

/** Reusable Users icon for empty state */
function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
