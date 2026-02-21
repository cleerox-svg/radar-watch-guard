/**
 * LeadsFeed.tsx — Admin view of landing page lead submissions.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Users, Mail, Building2, Phone, Globe, Calendar, TrendingUp, Brain, Scan } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  submission_type: string;
  domain_scanned: string | null;
  scan_grade: string | null;
  scan_score: number | null;
  metadata: any;
  created_at: string;
}

const typeLabels: Record<string, { label: string; icon: typeof Scan; color: string }> = {
  brand_scan: { label: "Brand Scan", icon: Scan, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
  ai_briefing: { label: "AI Briefing", icon: Brain, color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
};

export function LeadsFeed() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("scan_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Subscribe to realtime inserts
  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scan_leads" }, () => {
        fetchLeads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  const todayCount = leads.filter((l) => {
    const d = new Date(l.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const uniqueCompanies = new Set(leads.filter((l) => l.company).map((l) => l.company)).size;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <Users className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{leads.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Leads</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{todayCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <Building2 className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{uniqueCompanies}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Companies</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <Brain className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{leads.filter((l) => l.submission_type === "ai_briefing").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead list */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />Lead Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No leads captured yet.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-cyber">
              {leads.map((lead) => {
                const typeInfo = typeLabels[lead.submission_type] || typeLabels.brand_scan;
                const TypeIcon = typeInfo.icon;
                return (
                  <div key={lead.id} className="bg-background rounded-lg border border-border p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {lead.name[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{lead.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${typeInfo.color}`}>
                            <TypeIcon className="w-2.5 h-2.5 mr-1" />
                            {typeInfo.label}
                          </Badge>
                          {lead.scan_grade && (
                            <span className="text-[10px] font-mono font-bold text-foreground bg-accent px-1.5 py-0.5 rounded">
                              Grade: {lead.scan_grade}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {lead.email}
                          </span>
                          {lead.company && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {lead.company}
                            </span>
                          )}
                          {lead.phone && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {lead.phone}
                            </span>
                          )}
                          {lead.domain_scanned && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Globe className="w-3 h-3" /> {lead.domain_scanned}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(lead.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
