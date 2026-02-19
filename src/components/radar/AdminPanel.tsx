import { useState, useEffect } from "react";
import { UserPlus, Shield, Trash2, Loader2, Users, Copy, Database, Activity, TrendingUp, BarChart3, Rss, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  triggerIngestion,
  triggerCisaKevIngestion,
  triggerOtxIngestion,
  triggerThreatFoxIngestion,
  triggerSansIscIngestion,
  triggerRansomwatchIngestion,
  triggerTorExitIngestion,
  triggerMastodonIngestion,
} from "@/hooks/use-threat-data";

interface AnalystUser {
  user_id: string;
  display_name: string | null;
  title: string | null;
  team: string | null;
  roles: string[];
  email?: string;
}

interface TableStats {
  name: string;
  total: number;
  today: number;
}

function DatabaseStatus() {
  const [dbOnline, setDbOnline] = useState<boolean | null>(null);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

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
          return {
            name: t.name,
            total: totalRes.count ?? 0,
            today: todayRes.count ?? 0,
          };
        })
      );
      setTableStats(results);
      setDbOnline(true);
    } catch {
      setDbOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const totalRecords = tableStats.reduce((sum, t) => sum + t.total, 0);
  const totalToday = tableStats.reduce((sum, t) => sum + t.today, 0);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          Database Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status + Summary row */}
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
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Total Records</span>
                </div>
                <span className="text-sm font-bold text-foreground">{totalRecords.toLocaleString()}</span>
              </div>
              <div className="bg-background rounded-lg border border-border p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Added Today</span>
                </div>
                <span className="text-sm font-bold text-primary">{totalToday.toLocaleString()}</span>
              </div>
            </div>

            {/* Per-table breakdown */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2">Records by Source</p>
              {tableStats.map((t) => (
                <div key={t.name} className="flex items-center justify-between bg-background rounded-lg border border-border px-3 py-2">
                  <span className="text-xs font-medium text-foreground">{t.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">{t.total.toLocaleString()} total</span>
                    {t.today > 0 ? (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                        +{t.today} today
                      </span>
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
];

function FeedManager() {
  const [runningFeeds, setRunningFeeds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const runFeed = async (feed: typeof FEEDS[0]) => {
    setRunningFeeds((prev) => new Set(prev).add(feed.id));
    setResults((prev) => ({ ...prev, [feed.id]: undefined as any }));
    try {
      const data = await feed.trigger();
      const msg = data?.fetched != null
        ? `Fetched ${data.fetched}, new: ${data.new ?? data.upserted ?? "—"}`
        : "Completed";
      setResults((prev) => ({ ...prev, [feed.id]: { success: true, message: msg } }));
      toast.success(`${feed.name} ingestion complete`, { description: msg });
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      setResults((prev) => ({ ...prev, [feed.id]: { success: false, message: msg } }));
      toast.error(`${feed.name} failed`, { description: msg });
    } finally {
      setRunningFeeds((prev) => {
        const next = new Set(prev);
        next.delete(feed.id);
        return next;
      });
    }
  };

  const runAll = async () => {
    for (const feed of FEEDS) {
      runFeed(feed);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Rss className="w-5 h-5 text-primary" />
            Feed Ingestion Manager
          </CardTitle>
          <Button size="sm" variant="outline" onClick={runAll} className="gap-1.5 text-xs">
            <Play className="w-3 h-3" />
            Run All Feeds
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Trigger manual ingestion from all connected OSINT sources. {FEEDS.length} feeds configured.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FEEDS.map((feed) => {
            const isRunning = runningFeeds.has(feed.id);
            const result = results[feed.id];
            return (
              <div
                key={feed.id}
                className="flex items-center gap-3 bg-background rounded-lg border border-border px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{feed.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{feed.desc}</p>
                  {result && (
                    <p className={`text-[10px] mt-0.5 ${result.success ? "text-emerald-400" : "text-destructive"}`}>
                      {result.message}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isRunning}
                  onClick={() => runFeed(feed)}
                  className="shrink-0 h-7 w-7 p-0"
                >
                  {isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  ) : result?.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : result && !result.success ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPanel() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [analysts, setAnalysts] = useState<AnalystUser[]>([]);
  const [loading, setLoading] = useState(true);

  // ... keep existing code (fetchAnalysts, useEffect, handleInvite)
  const fetchAnalysts = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];

    const merged: AnalystUser[] = profiles.map((p: any) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      title: p.title,
      team: p.team,
      roles: roles.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
    }));

    setAnalysts(merged);
    setLoading(false);
  };

  useEffect(() => { fetchAnalysts(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke("invite-analyst", {
        body: { email, display_name: displayName || undefined },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Analyst invited", {
        description: `Invitation sent to ${email}`,
      });
      setEmail("");
      setDisplayName("");
      fetchAnalysts();
    } catch (err: any) {
      toast.error("Invite failed", { description: err.message });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Database Status */}
      <DatabaseStatus />

      {/* Feed Management */}
      <FeedManager />

      {/* Invite form */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite Analyst
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Invite a new analyst by email. They will receive an invitation to set their password and access the platform.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <Input
              type="email"
              placeholder="analyst@organization.com"
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
            <Button type="submit" disabled={inviting} className="gap-2 shrink-0">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {inviting ? "Inviting..." : "Send Invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Analyst roster */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            Team Roster
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : analysts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No analysts yet. Invite your first team member above.</p>
          ) : (
            <div className="space-y-2">
              {analysts.map((a) => (
                <div key={a.user_id} className="flex items-center gap-3 bg-background rounded-lg p-3 border border-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {(a.display_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.display_name || "Unnamed"}</p>
                    <p className="text-[10px] text-muted-foreground">{a.title || "Analyst"}{a.team ? ` · ${a.team}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {a.roles.map((role) => (
                      <span key={role} className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                        role === "admin"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-muted bg-muted/50 text-muted-foreground"
                      }`}>
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}