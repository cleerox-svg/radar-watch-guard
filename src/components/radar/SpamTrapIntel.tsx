/**
 * SpamTrapIntel.tsx — Admin-only spam trap intelligence dashboard.
 * Displays honeypot catch data completely isolated from other modules.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Mail, Shield, Globe, TrendingUp, AlertTriangle, BarChart3,
  Search, Filter, Loader2, ShieldAlert, CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
  AreaChart, Area,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  phishing: "hsl(0, 72%, 51%)",
  spam: "hsl(45, 93%, 47%)",
  scam: "hsl(280, 68%, 50%)",
  "brand-abuse": "hsl(200, 80%, 50%)",
};

const CATEGORY_LABELS: Record<string, string> = {
  phishing: "Phishing",
  spam: "Spam",
  scam: "Scam",
  "brand-abuse": "Brand Abuse",
};

interface SpamTrapHit {
  id: string;
  trap_address: string;
  sender_email: string;
  sender_domain: string;
  sender_ip: string | null;
  country: string | null;
  subject: string;
  spf_pass: boolean;
  dkim_pass: boolean;
  category: string;
  brand_mentioned: string | null;
  confidence: number;
  received_at: string;
}

export function SpamTrapIntel() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: hits = [], isLoading } = useQuery({
    queryKey: ["spam_trap_hits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spam_trap_hits")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as SpamTrapHit[];
    },
  });

  // Filtered hits
  const filtered = useMemo(() => {
    let result = hits;
    if (categoryFilter) result = result.filter((h) => h.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (h) =>
          h.sender_domain.toLowerCase().includes(q) ||
          h.subject.toLowerCase().includes(q) ||
          h.sender_email.toLowerCase().includes(q) ||
          (h.brand_mentioned && h.brand_mentioned.toLowerCase().includes(q))
      );
    }
    return result;
  }, [hits, categoryFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayHits = hits.filter((h) => new Date(h.received_at) >= today);
    const phishingCount = hits.filter((h) => h.category === "phishing").length;
    const brandAbuse = hits.filter((h) => h.brand_mentioned).length;
    const spfFailRate = hits.length > 0
      ? Math.round((hits.filter((h) => !h.spf_pass).length / hits.length) * 100)
      : 0;
    const avgConfidence = hits.length > 0
      ? Math.round(hits.reduce((s, h) => s + h.confidence, 0) / hits.length)
      : 0;
    return { total: hits.length, today: todayHits.length, phishingCount, brandAbuse, spfFailRate, avgConfidence };
  }, [hits]);

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    hits.forEach((h) => { counts[h.category] = (counts[h.category] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({
      name: CATEGORY_LABELS[name] || name,
      value,
      color: CATEGORY_COLORS[name] || "hsl(var(--muted))",
    }));
  }, [hits]);

  // Daily volume for area chart (last 7 days)
  const dailyVolume = useMemo(() => {
    const days: Record<string, Record<string, number>> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      days[d] = { phishing: 0, spam: 0, scam: 0, "brand-abuse": 0 };
    }
    hits.forEach((h) => {
      const d = format(new Date(h.received_at), "MMM dd");
      if (days[d] && days[d][h.category] !== undefined) {
        days[d][h.category]++;
      }
    });
    return Object.entries(days).map(([date, cats]) => ({ date, ...cats }));
  }, [hits]);

  // Top sender domains
  const topDomains = useMemo(() => {
    const counts: Record<string, { count: number; category: string }> = {};
    hits.forEach((h) => {
      if (!counts[h.sender_domain]) counts[h.sender_domain] = { count: 0, category: h.category };
      counts[h.sender_domain].count++;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([domain, { count, category }]) => ({ domain, count, category }));
  }, [hits]);

  // Top impersonated brands
  const topBrands = useMemo(() => {
    const counts: Record<string, number> = {};
    hits.forEach((h) => {
      if (h.brand_mentioned) counts[h.brand_mentioned] = (counts[h.brand_mentioned] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([brand, count]) => ({ brand, count }));
  }, [hits]);

  // Auth pass/fail for donut
  const authData = useMemo(() => {
    const spfPass = hits.filter((h) => h.spf_pass).length;
    const dkimPass = hits.filter((h) => h.dkim_pass).length;
    return [
      { name: "SPF Pass", value: spfPass, color: "hsl(142, 71%, 45%)" },
      { name: "SPF Fail", value: hits.length - spfPass, color: "hsl(0, 72%, 51%)" },
      { name: "DKIM Pass", value: dkimPass, color: "hsl(200, 80%, 50%)" },
      { name: "DKIM Fail", value: hits.length - dkimPass, color: "hsl(30, 80%, 50%)" },
    ];
  }, [hits]);

  // Country breakdown
  const countryData = useMemo(() => {
    const counts: Record<string, number> = {};
    hits.forEach((h) => {
      if (h.country) counts[h.country] = (counts[h.country] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));
  }, [hits]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading spam trap data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo banner */}
      <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
        <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Spam Trap Intelligence — Demo Mode</p>
          <p className="text-xs text-muted-foreground">This data is synthetic and isolated from all other platform modules. Admin-only access.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Catches", value: stats.total, icon: Mail, accent: "text-primary" },
          { label: "Today", value: stats.today, icon: TrendingUp, accent: "text-primary" },
          { label: "Phishing", value: stats.phishingCount, icon: AlertTriangle, accent: "text-destructive" },
          { label: "Brand Abuse", value: stats.brandAbuse, icon: Shield, accent: "text-amber-500" },
          { label: "SPF Fail Rate", value: `${stats.spfFailRate}%`, icon: XCircle, accent: "text-destructive" },
          { label: "Avg Confidence", value: `${stats.avgConfidence}%`, icon: BarChart3, accent: "text-primary" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <kpi.icon className={`w-4 h-4 mx-auto mb-1.5 ${kpi.accent}`} />
              <p className="text-lg font-bold text-foreground">{kpi.value}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily volume */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily Trap Volume (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="phishing" stackId="1" fill={CATEGORY_COLORS.phishing} stroke={CATEGORY_COLORS.phishing} fillOpacity={0.6} />
                <Area type="monotone" dataKey="spam" stackId="1" fill={CATEGORY_COLORS.spam} stroke={CATEGORY_COLORS.spam} fillOpacity={0.6} />
                <Area type="monotone" dataKey="scam" stackId="1" fill={CATEGORY_COLORS.scam} stroke={CATEGORY_COLORS.scam} fillOpacity={0.6} />
                <Area type="monotone" dataKey="brand-abuse" stackId="1" fill={CATEGORY_COLORS["brand-abuse"]} stroke={CATEGORY_COLORS["brand-abuse"]} fillOpacity={0.6} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category pie */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                  {categoryData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Second row: top domains, brands, country, auth */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top sender domains */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Sender Domains</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topDomains.map((d) => (
              <div key={d.domain} className="flex items-center justify-between bg-background rounded-lg border border-border px-3 py-2">
                <span className="text-[11px] font-mono text-foreground truncate max-w-[140px]">{d.domain}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded border" style={{ borderColor: CATEGORY_COLORS[d.category] + "60", color: CATEGORY_COLORS[d.category] }}>
                    {CATEGORY_LABELS[d.category]}
                  </span>
                  <span className="text-xs font-bold text-foreground">{d.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top impersonated brands */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Impersonated Brands</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topBrands} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="brand" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={80} />
                <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Country origins */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4" />Origin Countries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {countryData.map((c) => (
              <div key={c.country} className="flex items-center justify-between bg-background rounded-lg border border-border px-3 py-1.5">
                <span className="text-xs font-mono text-foreground">{c.country}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(c.count / (countryData[0]?.count || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-foreground w-6 text-right">{c.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Auth results */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Email Auth Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* SPF */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">SPF</span>
                  <span className="text-[10px] text-muted-foreground">{hits.filter(h => h.spf_pass).length} pass / {hits.filter(h => !h.spf_pass).length} fail</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${hits.length > 0 ? (hits.filter(h => h.spf_pass).length / hits.length) * 100 : 0}%` }} />
                  <div className="h-full bg-destructive flex-1" />
                </div>
              </div>
              {/* DKIM */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">DKIM</span>
                  <span className="text-[10px] text-muted-foreground">{hits.filter(h => h.dkim_pass).length} pass / {hits.filter(h => !h.dkim_pass).length} fail</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500" style={{ width: `${hits.length > 0 ? (hits.filter(h => h.dkim_pass).length / hits.length) * 100 : 0}%` }} />
                  <div className="h-full bg-orange-500 flex-1" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                High SPF/DKIM fail rates indicate spoofed senders — common in phishing campaigns.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hit log table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-sm">Recent Trap Catches</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search sender, subject, brand…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-[200px]"
                />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${!categoryFilter ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  All
                </button>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${categoryFilter === key ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Time</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Category</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Sender</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Subject</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Brand</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Origin</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-semibold">SPF</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-semibold">DKIM</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-semibold">Conf</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((hit) => (
                  <tr key={hit.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-2 px-2 text-muted-foreground font-mono whitespace-nowrap">
                      {format(new Date(hit.received_at), "MMM dd HH:mm")}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{ borderColor: CATEGORY_COLORS[hit.category] + "60", color: CATEGORY_COLORS[hit.category] }}
                      >
                        {CATEGORY_LABELS[hit.category] || hit.category}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-foreground max-w-[180px] truncate">{hit.sender_domain}</td>
                    <td className="py-2 px-2 text-foreground max-w-[250px] truncate">{hit.subject}</td>
                    <td className="py-2 px-2">
                      {hit.brand_mentioned ? (
                        <Badge variant="secondary" className="text-[9px]">{hit.brand_mentioned}</Badge>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-muted-foreground">{hit.country || "—"}</td>
                    <td className="py-2 px-2 text-center">
                      {hit.spf_pass ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <XCircle className="w-3.5 h-3.5 text-destructive mx-auto" />}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {hit.dkim_pass ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <XCircle className="w-3.5 h-3.5 text-destructive mx-auto" />}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`font-bold ${hit.confidence >= 80 ? "text-destructive" : hit.confidence >= 50 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {hit.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">No trap catches match your filters.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
