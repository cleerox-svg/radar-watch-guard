/**
 * Imprsn8AdminConsole.tsx — Admin-only console for system management.
 * Tabs: Users & Groups, Data Feeds, Access Control.
 * Separated from influencer-facing views.
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Imprsn8DataFeeds } from "./Imprsn8DataFeeds";
import { Users, Shield, Rss, UserPlus, Settings, Search, Mail, Loader2, Trash2, Key } from "lucide-react";

/** imprsn8-specific module keys for access control */
const IMPRSN8_MODULES = [
  { key: "imprsn8_dashboard", label: "Dashboard" },
  { key: "imprsn8_accounts", label: "My Accounts" },
  { key: "imprsn8_threats", label: "Threats Found" },
  { key: "imprsn8_takedowns", label: "Takedowns" },
  { key: "imprsn8_agents", label: "AI Agents" },
  { key: "imprsn8_settings", label: "Settings" },
  { key: "imprsn8_all_influencers", label: "All Influencers" },
  { key: "imprsn8_admin", label: "Admin Console" },
];

export function Imprsn8AdminConsole() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="feeds">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="feeds" className="text-xs gap-1.5"><Rss className="w-3.5 h-3.5" /> Data Feeds & APIs</TabsTrigger>
          <TabsTrigger value="users" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" /> Users & Teams</TabsTrigger>
          <TabsTrigger value="access" className="text-xs gap-1.5"><Key className="w-3.5 h-3.5" /> Access Control</TabsTrigger>
        </TabsList>

        {/* Data Feeds */}
        <TabsContent value="feeds" className="mt-4">
          <Imprsn8DataFeeds />
        </TabsContent>

        {/* Users & Teams */}
        <TabsContent value="users" className="mt-4">
          <UsersAndTeams />
        </TabsContent>

        {/* Access Control */}
        <TabsContent value="access" className="mt-4">
          <AccessControlPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Users & Teams sub-panel — invite analysts, manage team */
function UsersAndTeams() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("analyst");
  const [searchQ, setSearchQ] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-all-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const inviteUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-analyst", {
        body: { email, display_name: name, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-profiles"] });
      toast({ title: "User invited", description: `Invite sent to ${email}` });
      setEmail(""); setName(""); setRole("analyst"); setInviteOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    },
  });

  const filtered = profiles.filter((p: any) =>
    !searchQ || p.display_name?.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-imprsn8 hover:bg-imprsn8/90 text-imprsn8-foreground h-9 text-xs"><UserPlus className="w-3.5 h-3.5" /> Invite User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label className="text-xs">Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-xs">Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2">
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="admin">Admin</SelectItem><SelectItem value="analyst">Analyst</SelectItem><SelectItem value="influencer">Influencer</SelectItem>
                </SelectContent></Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button className="bg-imprsn8 hover:bg-imprsn8/90 text-imprsn8-foreground" disabled={!email || !name || inviteUser.isPending} onClick={() => inviteUser.mutate()}>
                {inviteUser.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Mail className="w-3.5 h-3.5 mr-2" />}
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {filtered.map((p: any) => {
          const roles = userRoles.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role);
          return (
            <Card key={p.id} className="hover:border-imprsn8/20 transition-colors">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.display_name || "Unnamed"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {roles.map((r: string) => (
                        <Badge key={r} variant="outline" className="text-[9px] uppercase">{r}</Badge>
                      ))}
                      <span className="text-[10px] text-muted-foreground">{p.team || "—"}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** Access Control sub-panel — manage groups and module permissions */
function AccessControlPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ["access-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("access_groups").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ["group-module-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_module_permissions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const togglePermission = useMutation({
    mutationFn: async ({ groupId, moduleKey, currentAccess }: { groupId: string; moduleKey: string; currentAccess: boolean }) => {
      const existing = permissions.find((p: any) => p.group_id === groupId && p.module_key === moduleKey);
      if (existing) {
        const { error } = await supabase.from("group_module_permissions").update({ has_access: !currentAccess }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("group_module_permissions").insert({ group_id: groupId, module_key: moduleKey, has_access: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-module-permissions"] });
      toast({ title: "Permission updated" });
    },
  });

  const hasAccess = (groupId: string, moduleKey: string) => {
    const perm = permissions.find((p: any) => p.group_id === groupId && p.module_key === moduleKey);
    return perm?.has_access ?? false;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-imprsn8" /> imprsn8 Module Permissions
          </CardTitle>
          <CardDescription className="text-xs">Toggle access to imprsn8 modules per access group</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Module</th>
                  {groups.map((g: any) => (
                    <th key={g.id} className="text-center py-2 px-2 font-medium text-muted-foreground">{g.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {IMPRSN8_MODULES.map((mod) => (
                  <tr key={mod.key} className="border-b border-border/50 hover:bg-accent/20">
                    <td className="py-2 px-2 font-medium">{mod.label}</td>
                    {groups.map((g: any) => {
                      const access = hasAccess(g.id, mod.key);
                      return (
                        <td key={g.id} className="text-center py-2 px-2">
                          <Switch
                            checked={access}
                            onCheckedChange={() => togglePermission.mutate({ groupId: g.id, moduleKey: mod.key, currentAccess: access })}
                            className="data-[state=checked]:bg-imprsn8"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
