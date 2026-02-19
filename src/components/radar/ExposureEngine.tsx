/**
 * ExposureEngine.tsx — Module A: Exposure & Context Engine (Pre-Attack)
 * 
 * The landing module that maps a client's attack surface:
 * - Authorized sending infrastructure (SPF/DKIM)
 * - Exposed credentials in the wild
 * - Dormant typosquatted domains
 * - Dynamic "Brand Risk Graph" showing impersonation ease
 * 
 * Wraps the existing BrandRiskAssessor + adds context from live threat data.
 */

import { useState, useMemo } from "react";
import { Scan, Shield, AlertTriangle, Globe, Mail, Lock, Users, Activity, ArrowRight, Eye, Target, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandRiskAssessor } from "./BrandRiskAssessor";
import { useThreats, useEmailAuthReports, useAtoEvents } from "@/hooks/use-threat-data";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function ExposureEngine() {
  const { data: threats } = useThreats();
  const { data: emailReports } = useEmailAuthReports();
  const { data: atoEvents } = useAtoEvents();
  const [showScanner, setShowScanner] = useState(false);

  const exposureMetrics = useMemo(() => {
    const threatCount = threats?.length || 0;
    const activeBrands = new Set(threats?.map((t: any) => t.brand?.toLowerCase()).filter(Boolean)).size;
    const weaponizedDomains = new Set(threats?.filter((t: any) => t.status === "active").map((t: any) => t.domain)).size;
    
    const totalVolume = emailReports?.reduce((s: number, r: any) => s + (r.volume || 0), 0) || 0;
    const dmarcFail = emailReports?.filter((r: any) => !r.dmarc_aligned).reduce((s: number, r: any) => s + (r.volume || 0), 0) || 0;
    const dmarcFailRate = totalVolume > 0 ? Math.round((dmarcFail / totalVolume) * 100) : 0;

    const unresolvedAto = atoEvents?.filter((a: any) => !a.resolved).length || 0;
    const highRiskAto = atoEvents?.filter((a: any) => (a.risk_score || 0) >= 70).length || 0;

    // Compute a composite exposure score (0-100, higher = more exposed)
    let score = 0;
    if (weaponizedDomains > 10) score += 30;
    else if (weaponizedDomains > 5) score += 20;
    else if (weaponizedDomains > 0) score += 10;

    if (dmarcFailRate > 50) score += 25;
    else if (dmarcFailRate > 20) score += 15;
    else if (dmarcFailRate > 5) score += 8;

    if (unresolvedAto > 5) score += 25;
    else if (unresolvedAto > 2) score += 15;
    else if (unresolvedAto > 0) score += 8;

    if (activeBrands > 10) score += 20;
    else if (activeBrands > 5) score += 12;
    else if (activeBrands > 0) score += 5;

    const grade = score >= 75 ? "F" : score >= 55 ? "D" : score >= 35 ? "C" : score >= 15 ? "B" : "A";

    return { threatCount, activeBrands, weaponizedDomains, dmarcFailRate, unresolvedAto, highRiskAto, score: Math.min(score, 100), grade };
  }, [threats, emailReports, atoEvents]);

  const gradeColor = {
    A: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    B: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    C: "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
    D: "border-orange-500/30 bg-orange-500/10 text-orange-500",
    F: "border-red-500/30 bg-red-500/10 text-red-500",
  }[exposureMetrics.grade];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Hero: Brand Exposure Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Exposure Score Card */}
        <Card className="border-primary/20 bg-card lg:col-span-1">
          <CardContent className="py-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Scan className="w-4 h-4 text-primary" />
              Brand Exposure Index
            </div>
            <div className={cn("w-24 h-24 rounded-2xl border-2 flex items-center justify-center", gradeColor)}>
              <span className="text-4xl font-bold">{exposureMetrics.grade}</span>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-foreground">{exposureMetrics.score}/100</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {exposureMetrics.score >= 55 ? "HIGH EXPOSURE — Immediate action needed" :
                 exposureMetrics.score >= 25 ? "MODERATE EXPOSURE — Review recommended" :
                 "LOW EXPOSURE — Good security posture"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Context Grid */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Attack Surface Context
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              How easy it is for threat actors to impersonate your organization right now.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard icon={Target} label="Targeted Brands" value={exposureMetrics.activeBrands} color="text-red-500" />
              <MetricCard icon={Globe} label="Weaponized Domains" value={exposureMetrics.weaponizedDomains} color="text-orange-500" />
              <MetricCard icon={Mail} label="DMARC Fail Rate" value={`${exposureMetrics.dmarcFailRate}%`} color={exposureMetrics.dmarcFailRate > 20 ? "text-red-500" : "text-emerald-500"} />
              <MetricCard icon={Users} label="Unresolved ATO" value={exposureMetrics.unresolvedAto} color={exposureMetrics.unresolvedAto > 3 ? "text-red-500" : "text-emerald-500"} />
              <MetricCard icon={AlertTriangle} label="High-Risk ATO" value={exposureMetrics.highRiskAto} color="text-orange-500" />
              <MetricCard icon={Activity} label="Total Threats" value={exposureMetrics.threatCount} color="text-cyan-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Indicators */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            Trust Infrastructure Gaps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <GapIndicator
              label="Email Authentication"
              status={exposureMetrics.dmarcFailRate < 5 ? "strong" : exposureMetrics.dmarcFailRate < 20 ? "partial" : "weak"}
              detail={`${exposureMetrics.dmarcFailRate}% of email volume failing DMARC alignment`}
            />
            <GapIndicator
              label="Domain Impersonation Defense"
              status={exposureMetrics.weaponizedDomains === 0 ? "strong" : exposureMetrics.weaponizedDomains < 5 ? "partial" : "weak"}
              detail={`${exposureMetrics.weaponizedDomains} active impersonation domains detected`}
            />
            <GapIndicator
              label="Identity Protection"
              status={exposureMetrics.unresolvedAto === 0 ? "strong" : exposureMetrics.unresolvedAto < 3 ? "partial" : "weak"}
              detail={`${exposureMetrics.unresolvedAto} unresolved account takeover events`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Deep Scan Section */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Deep Domain Analysis
            </CardTitle>
            <Button
              variant={showScanner ? "outline" : "default"}
              size="sm"
              onClick={() => setShowScanner(!showScanner)}
              className="text-xs"
            >
              {showScanner ? "Hide Scanner" : "Run Deep Scan"}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Scan a domain for DMARC/SPF, typosquats, certificate abuse, credential exposure, and dangling DNS.
          </p>
        </CardHeader>
      </Card>

      {showScanner && <BrandRiskAssessor />}
    </motion.div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-background rounded-lg p-3 border border-border text-center">
      <Icon className={cn("w-4 h-4 mx-auto mb-1", color)} />
      <p className="text-lg font-bold font-mono text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function GapIndicator({ label, status, detail }: { label: string; status: "strong" | "partial" | "weak"; detail: string }) {
  const config = {
    strong: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", text: "STRONG" },
    partial: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", text: "PARTIAL" },
    weak: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", text: "WEAK" },
  }[status];

  return (
    <div className={cn("flex items-center gap-3 rounded-lg p-3 border", config.bg)}>
      <config.icon className={cn("w-5 h-5 shrink-0", config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", config.bg, config.color)}>
        {config.text}
      </span>
    </div>
  );
}
