import { useState, useEffect, useCallback } from "react";
import {
  UserPlus, Shield, Trash2, Loader2, Users, Copy, Database, Activity,
  TrendingUp, BarChart3, Rss, Play, CheckCircle2, AlertTriangle,
  Settings, Plus, Save, X, ChevronDown, ChevronUp, Pencil,
  Link2, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  triggerIngestion, triggerCisaKevIngestion, triggerOtxIngestion,
  triggerThreatFoxIngestion, triggerSansIscIngestion, triggerRansomwatchIngestion,
  triggerTorExitIngestion, triggerMastodonIngestion,
} from "@/hooks/use-threat-data";
import { AdminIntegrations } from "@/components/radar/AdminIntegrations";
import { AdminAutomations } from "@/components/radar/AdminAutomations";

// ─── Module definitions ───
const ALL_MODULES = [
  { key: "exposure", label: "Brand Exposure", group: "Detect & Respond" },
  { key: "correlation", label: "Signal Correlation", group: "Detect & Respond" },
  { key: "erasure", label: "Takedown & Response", group: "Detect & Respond" },
  { key: "investigations", label: "Investigations", group: "Detect & Respond" },
  { key: "briefing", label: "Daily Briefing", group: "AI Insights" },
  { key: "chat", label: "Ask the AI", group: "AI Insights" },
  { key: "heatmap", label: "Global Threat Map", group: "Live Monitoring" },
  { key: "social-monitor", label: "Social Feed", group: "Live Monitoring" },
  { key: "dark-web", label: "Dark Web Alerts", group: "Live Monitoring" },
  { key: "ato", label: "Account Takeovers", group: "Live Monitoring" },
  { key: "email", label: "Email Security", group: "Live Monitoring" },
  { key: "stats", label: "Analytics", group: "Live Monitoring" },
  { key: "urgent", label: "Critical Alerts", group: "Live Monitoring" },
  { key: "knowledge", label: "Knowledge Base", group: "Help & Docs" },
  { key: "spam-traps", label: "Spam Traps", group: "Platform Settings" },
  { key: "admin", label: "Admin Console", group: "Platform Settings" },
];

const MODULE_GROUPS = [...new Set(ALL_MODULES.map((m) => m.group))];

// ─── Types ───
interface AccessGroup {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  permissions: Record<string, boolean>;
}

interface TeamUser {
  user_id: string;
  display_name: string | null;
  title: string | null;
  team: string | null;
  roles: string[];
  groups: { id: string; name: string }[];
  email?: string;
}

interface TableStats { name: string; total: number; today: number; }

// ─── DatabaseStatus (unchanged) ───
function DatabaseStatus() {
  const [dbOnline, setDbOnline] = useState<boolean | null>(null);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    const tables = [
      { name: "Threats", table: "threats" as const },
      { name: "Threat News", table: "threat_news" as const },
      { name: "Social IOCs", table: "social_iocs" as const },
      { name: "Breach Checks", table: "breach_checks" as const },
      { name: "ATO Events", table: "ato_events" as const },
      { name: "Attack Metrics", table: "attack_metrics" as const },
      { name: "Email Auth Reports", table: "email_auth_reports" as const },
      { name: "Feed Ingestions", table: "feed_ingestions" as const },
      { name: "Tor Exit Nodes", table: "tor_exit_nodes" as const },
    ];
    try {
      const results = await Promise.all(
        tables.map(async (t) => {
          const [totalRes, todayRes] = await Promise.all([
            supabase.from(t.table).select("id", { count: "exact", head: true }),
            supabase.from(t.table).select("id", { count: "exact", head: true }).gte("created_at", todayISO),
          ]);
          return { name: t.name, total: totalRes.count ?? 0, today: todayRes.count ?? 0 };
        })
      );
      setTableStats(results);
      setDbOnline(true);
    } catch { setDbOnline(false); }
    finally { setLoading(false); }
  };

  const totalRecords = tableStats.reduce((sum, t) => sum + t.total, 0);
  const totalToday = tableStats.reduce((sum, t) => sum + t.today, 0);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />Database Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background rounded-lg border border-border p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Status</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${dbOnline ? "text-emerald-400" : "text-destructive"}`}>
                  <span className={`w-2 h-2 rounded-full ${dbOnline ? "bg-emerald-400 animate-pulse" : "bg-destructive"}`} />
                  {dbOnline ? "Online" : "Offline"}
                </span>
              </div>
              <div className="bg-background rounded-lg border border-border p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Total</span>
                </div>
                <span className="text-sm font-bold text-foreground">{totalRecords.toLocaleString()}</span>
              </div>
              <div className="bg-background rounded-lg border border-border p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Today</span>
                </div>
                <span className="text-sm font-bold text-primary">{totalToday.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2">Records by Source</p>
              {tableStats.map((t) => (
                <div key={t.name} className="flex items-center justify-between bg-background rounded-lg border border-border px-3 py-2">
                  <span className="text-xs font-medium text-foreground">{t.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">{t.total.toLocaleString()}</span>
                    {t.today > 0 ? (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">+{t.today}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50 px-1.5 py-0.5">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── FeedManager (unchanged) ───
const FEEDS = [
  { id: "urlhaus", name: "URLhaus", desc: "Malware URLs (Abuse.ch)", trigger: () => triggerIngestion("urlhaus") },
  { id: "openphish", name: "OpenPhish", desc: "Phishing URLs", trigger: () => triggerIngestion("openphish") },
  { id: "phishtank", name: "PhishTank", desc: "Verified phishing DB", trigger: () => triggerIngestion("phishtank") },
  { id: "cisa_kev", name: "CISA KEV", desc: "Known Exploited Vulns", trigger: triggerCisaKevIngestion },
  { id: "otx", name: "AlienVault OTX", desc: "Community threat pulses", trigger: triggerOtxIngestion },
  { id: "threatfox", name: "ThreatFox", desc: "C2 servers & botnet IOCs", trigger: triggerThreatFoxIngestion },
  { id: "sans_isc", name: "SANS ISC", desc: "Global port scanning trends", trigger: triggerSansIscIngestion },
  { id: "ransomwatch", name: "Ransomwatch", desc: "Ransomware leak site victims", trigger: triggerRansomwatchIngestion },
  { id: "tor_exits", name: "Tor Exit Nodes", desc: "Live Tor exit IP list", trigger: triggerTorExitIngestion },
  { id: "mastodon", name: "Mastodon OSINT", desc: "infosec.exchange #ThreatIntel", trigger: triggerMastodonIngestion },
  { id: "tweetfeed", name: "TweetFeed", desc: "IOCs from X/Twitter", trigger: () => supabase.functions.invoke("ingest-tweetfeed").then(r => { if (r.error) throw r.error; return r.data; }) },
  { id: "spam_trap", name: "Spam Trap Demo", desc: "Generate synthetic honeypot data", trigger: () => supabase.functions.invoke("generate-spam-trap-demo").then(r => { if (r.error) throw r.error; return r.data; }) },
];

function FeedManager() {
  const [runningFeeds, setRunningFeeds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const runFeed = async (feed: typeof FEEDS[0]) => {
    setRunningFeeds((prev) => new Set(prev).add(feed.id));
    setResults((prev) => ({ ...prev, [feed.id]: undefined as any }));
    try {
      const data = await feed.trigger();
      const msg = data?.fetched != null ? `Fetched ${data.fetched}, new: ${data.new ?? data.upserted ?? "—"}` : "Completed";
      setResults((prev) => ({ ...prev, [feed.id]: { success: true, message: msg } }));
      toast.success(`${feed.name} complete`, { description: msg });
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      setResults((prev) => ({ ...prev, [feed.id]: { success: false, message: msg } }));
      toast.error(`${feed.name} failed`, { description: msg });
    } finally {
      setRunningFeeds((prev) => { const next = new Set(prev); next.delete(feed.id); return next; });
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Rss className="w-5 h-5 text-primary" />Data Feeds</CardTitle>
          <Button size="sm" variant="outline" onClick={() => FEEDS.forEach(runFeed)} className="gap-1.5 text-xs"><Play className="w-3 h-3" />Run All</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FEEDS.map((feed) => {
            const isRunning = runningFeeds.has(feed.id);
            const result = results[feed.id];
            return (
              <div key={feed.id} className="flex items-center gap-3 bg-background rounded-lg border border-border px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{feed.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{feed.desc}</p>
                  {result && <p className={`text-[10px] mt-0.5 ${result.success ? "text-emerald-400" : "text-destructive"}`}>{result.message}</p>}
                </div>
                <Button size="sm" variant="ghost" disabled={isRunning} onClick={() => runFeed(feed)} className="shrink-0 h-7 w-7 p-0">
                  {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> :
                   result?.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
                   result && !result.success ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> :
                   <Play className="w-3.5 h-3.5 text-muted-foreground" />}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Access Groups Manager ───
function AccessGroupsManager() {
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<AccessGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const [groupsRes, permsRes] = await Promise.all([
      supabase.from("access_groups").select("*").order("created_at"),
      supabase.from("group_module_permissions").select("*"),
    ]);

    const groupsList = groupsRes.data || [];
    const permsList = permsRes.data || [];

    const enriched: AccessGroup[] = groupsList.map((g: any) => {
      const permissions: Record<string, boolean> = {};
      ALL_MODULES.forEach((m) => { permissions[m.key] = false; });
      permsList
        .filter((p: any) => p.group_id === g.id)
        .forEach((p: any) => { permissions[p.module_key] = p.has_access; });
      return { ...g, permissions };
    });

    setGroups(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("access_groups")
        .insert({ name: newGroupName.trim(), description: newGroupDesc.trim() || null })
        .select()
        .single();
      if (error) throw error;
      toast.success("Group created", { description: newGroupName });
      setNewGroupName("");
      setNewGroupDesc("");
      fetchGroups();
    } catch (err: any) {
      toast.error("Failed to create group", { description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (group: AccessGroup) => {
    if (group.is_system) return;
    try {
      const { error } = await supabase.from("access_groups").delete().eq("id", group.id);
      if (error) throw error;
      toast.success("Group deleted");
      fetchGroups();
    } catch (err: any) {
      toast.error("Delete failed", { description: err.message });
    }
  };

  const handleSavePermissions = async (group: AccessGroup) => {
    setSaving(true);
    try {
      // Delete existing permissions for this group
      await supabase.from("group_module_permissions").delete().eq("group_id", group.id);

      // Insert new permissions
      const perms = Object.entries(group.permissions)
        .filter(([, hasAccess]) => hasAccess)
        .map(([moduleKey]) => ({
          group_id: group.id,
          module_key: moduleKey,
          has_access: true,
        }));

      if (perms.length > 0) {
        const { error } = await supabase.from("group_module_permissions").insert(perms);
        if (error) throw error;
      }

      toast.success("Permissions saved", { description: group.name });
      setEditingGroup(null);
      fetchGroups();
    } catch (err: any) {
      toast.error("Save failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (moduleKey: string) => {
    if (!editingGroup) return;
    setEditingGroup({
      ...editingGroup,
      permissions: {
        ...editingGroup.permissions,
        [moduleKey]: !editingGroup.permissions[moduleKey],
      },
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />Access Groups
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Create groups with specific permissions, then assign users to control what they can access.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new group */}
        <div className="flex flex-col sm:flex-row gap-2 p-3 bg-background rounded-lg border border-border">
          <Input
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Description (optional)"
            value={newGroupDesc}
            onChange={(e) => setNewGroupDesc(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()} className="gap-1.5 shrink-0">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Group
          </Button>
        </div>

        {/* Groups list */}
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const enabledCount = Object.values(group.permissions).filter(Boolean).length;
              return (
                <div key={group.id} className="bg-background rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{group.name}</span>
                      {group.is_system && <Badge variant="secondary" className="text-[9px]">SYSTEM</Badge>}
                      <span className="text-[10px] text-muted-foreground">
                        {enabledCount}/{ALL_MODULES.length} modules
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setEditingGroup({ ...group })} className="h-7 text-xs gap-1">
                        <Pencil className="w-3 h-3" /> Edit
                      </Button>
                      {!group.is_system && (
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteGroup(group)} className="h-7 text-xs text-destructive hover:text-destructive gap-1">
                          <Trash2 className="w-3 h-3" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  {group.description && <p className="text-[10px] text-muted-foreground">{group.description}</p>}
                  {/* Module chips */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ALL_MODULES.filter((m) => group.permissions[m.key]).map((m) => (
                      <span key={m.key} className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">{m.label}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Edit permissions dialog */}
        <Dialog open={!!editingGroup} onOpenChange={(open) => { if (!open) setEditingGroup(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card">
            <DialogHeader>
              <DialogTitle>Manage Permissions — {editingGroup?.name}</DialogTitle>
            </DialogHeader>
            {editingGroup && (
              <div className="space-y-4">
                {MODULE_GROUPS.map((groupLabel) => (
                  <div key={groupLabel}>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">{groupLabel}</p>
                    <div className="space-y-1.5">
                      {ALL_MODULES.filter((m) => m.group === groupLabel).map((mod) => (
                        <div key={mod.key} className="flex items-center justify-between bg-background rounded-lg border border-border px-3 py-2">
                          <span className="text-xs text-foreground">{mod.label}</span>
                          <Switch
                            checked={editingGroup.permissions[mod.key] || false}
                            onCheckedChange={() => togglePermission(mod.key)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Button onClick={() => handleSavePermissions(editingGroup)} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Permissions
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── Team Manager (updated with group assignment) ───
function TeamManager() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState("analyst");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes, assignmentsRes, groupsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("user_group_assignments").select("user_id, group_id, access_groups(id, name)"),
      supabase.from("access_groups").select("id, name").order("created_at"),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const assignments = assignmentsRes.data || [];
    setGroups(groupsRes.data || []);

    const merged: TeamUser[] = profiles.map((p: any) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      title: p.title,
      team: p.team,
      roles: roles.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
      groups: assignments
        .filter((a: any) => a.user_id === p.user_id)
        .map((a: any) => a.access_groups)
        .filter(Boolean),
    }));

    setUsers(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-analyst", {
        body: {
          email,
          display_name: displayName || undefined,
          role: selectedRole,
          group_id: selectedGroupId || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User invited", { description: `Invitation sent to ${email}` });
      setEmail("");
      setDisplayName("");
      fetchTeam();
    } catch (err: any) {
      toast.error("Invite failed", { description: err.message });
    } finally {
      setInviting(false);
    }
  };

  const handleChangeGroup = async (userId: string, newGroupId: string) => {
    try {
      // Remove existing assignments
      await supabase.from("user_group_assignments").delete().eq("user_id", userId);
      // Add new assignment
      const { error } = await supabase.from("user_group_assignments").insert({
        user_id: userId,
        group_id: newGroupId,
      });
      if (error) throw error;
      toast.success("Group updated");
      fetchTeam();
    } catch (err: any) {
      toast.error("Update failed", { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />Invite a New User
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Send an invitation by email. Pick their role and which group they belong to.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="user@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Input
                type="text"
                placeholder="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Access Group (auto-detect)" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={inviting} className="gap-2 shrink-0">
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Send Invite
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Team roster */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />Your Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users yet.</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.user_id} className="flex items-center gap-3 bg-background rounded-lg p-3 border border-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {(u.display_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.display_name || "Unnamed"}</p>
                    <p className="text-[10px] text-muted-foreground">{u.title || "User"}{u.team ? ` · ${u.team}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.roles.map((role) => (
                      <span key={role} className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                        role === "admin" ? "border-primary/30 bg-primary/10 text-primary" :
                        role === "customer" ? "border-warning/30 bg-warning/10 text-warning" :
                        "border-muted bg-muted/50 text-muted-foreground"
                      }`}>{role}</span>
                    ))}
                    {u.groups.map((g) => (
                      <span key={g.id} className="text-[10px] bg-accent text-foreground border border-border px-2 py-0.5 rounded-full">{g.name}</span>
                    ))}
                  </div>
                  <Select
                    value={u.groups[0]?.id || ""}
                    onValueChange={(val) => handleChangeGroup(u.user_id, val)}
                  >
                    <SelectTrigger className="w-[120px] h-7 text-[10px]">
                      <SelectValue placeholder="Assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main AdminPanel ───
export function AdminPanel() {
  return (
    <Tabs defaultValue="team" className="space-y-6">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="team" className="gap-1.5 text-xs">
          <Users className="w-3.5 h-3.5" /> People
        </TabsTrigger>
        <TabsTrigger value="groups" className="gap-1.5 text-xs">
          <Shield className="w-3.5 h-3.5" /> Permissions
        </TabsTrigger>
        <TabsTrigger value="feeds" className="gap-1.5 text-xs">
          <Rss className="w-3.5 h-3.5" /> Data Sources
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-1.5 text-xs">
          <Link2 className="w-3.5 h-3.5" /> Integrations
        </TabsTrigger>
        <TabsTrigger value="automations" className="gap-1.5 text-xs">
          <Zap className="w-3.5 h-3.5" /> Automations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="team">
        <TeamManager />
      </TabsContent>

      <TabsContent value="groups">
        <AccessGroupsManager />
      </TabsContent>

      <TabsContent value="feeds" className="space-y-6">
        <DatabaseStatus />
        <FeedManager />
      </TabsContent>

      <TabsContent value="integrations">
        <AdminIntegrations />
      </TabsContent>

      <TabsContent value="automations">
        <AdminAutomations />
      </TabsContent>
    </Tabs>
  );
}
