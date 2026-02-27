/**
 * SigentMonitoredAccounts.tsx — CRUD interface for managing monitored social media accounts.
 * Supports Twitter/X, Instagram, TikTok, and YouTube with platform-specific cards.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ExternalLink, CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react";
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

export function SigentMonitoredAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformKey>("twitter");
  const [username, setUsername] = useState("");
  const [url, setUrl] = useState("");

  /** Fetch the influencer profile for the current user */
  const { data: influencerProfile } = useQuery({
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
    enabled: !!user,
  });

  /** Fetch monitored accounts for this influencer */
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["monitored-accounts", influencerProfile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitored_accounts")
        .select("*")
        .eq("influencer_id", influencerProfile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!influencerProfile,
  });

  /** Add a new monitored account */
  const addAccount = useMutation({
    mutationFn: async () => {
      const platformUrl = url || `${PLATFORMS[platform].urlPrefix}${username}`;
      const { error } = await supabase.from("monitored_accounts").insert({
        influencer_id: influencerProfile!.id,
        platform,
        platform_username: username,
        platform_url: platformUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitored-accounts"] });
      toast({ title: "Account added", description: `@${username} on ${PLATFORMS[platform].label} is now being monitored.` });
      setAddOpen(false);
      setUsername("");
      setUrl("");
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

  const maxAccounts = influencerProfile?.max_monitored_accounts ?? 3;
  const canAdd = accounts.length < maxAccounts;

  /** Auto-fill URL when username changes */
  const handleUsernameChange = (val: string) => {
    setUsername(val.replace(/^@/, ""));
    setUrl(`${PLATFORMS[platform].urlPrefix}${val.replace(/^@/, "")}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Monitored Accounts</h3>
          <p className="text-sm text-muted-foreground">
            {accounts.length} of {maxAccounts} accounts monitored
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canAdd} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
              <Plus className="w-4 h-4" /> Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Social Media Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformKey)}>
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
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all rounded-full"
          style={{ width: `${(accounts.length / maxAccounts) * 100}%` }}
        />
      </div>

      {/* Account cards grid */}
      {isLoading ? (
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
            <Users className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              No accounts being monitored yet.<br />Add your social media profiles to start scanning for impersonators.
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      onClick={() => removeAccount.mutate(acct.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
function Users(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
