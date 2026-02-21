/**
 * PublicScanner.tsx — Public-facing Brand Risk Scanner landing page.
 *
 * Lead generation tool: prospects enter their domain, see a teaser
 * risk report (grade + high-level indicators), then must provide
 * their email to unlock the full detailed findings.
 */

import { useState, useEffect, useRef } from "react";
import {
  Search, Shield, ShieldCheck, ShieldX, ShieldAlert,
  Globe, Mail, Lock, KeyRound, AlertTriangle,
  CheckCircle, XCircle, Loader2, ArrowRight,
  Satellite, ChevronRight, Eye, EyeOff, Users,
  Zap, BarChart3, TrendingUp, Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const SCAN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-domain`;

interface ScanResult {
  domain: string;
  score: number;
  grade: string;
  overall_risk: string;
  email_spoofing: { risk: string; dmarc_policy: string | null; details: string; penalty: number };
  typosquats: { registered: any[]; risk: string; total_permutations: number; penalty: number };
  certificate_transparency: { certificates: any[]; risk: string; penalty: number };
  credential_exposure: { breaches: any[]; total_exposed_accounts: number; risk: string; details: string; penalty: number };
  dangling_dns: { subdomains_checked: number; vulnerable: any[]; risk: string; penalty: number; details: string };
  scanned_at: string;
}

const riskColors: Record<string, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-emerald-500",
};

const gradeColors: Record<string, string> = {
  A: "from-emerald-400 to-emerald-600",
  B: "from-emerald-500 to-emerald-700",
  C: "from-yellow-400 to-yellow-600",
  D: "from-orange-400 to-orange-600",
  F: "from-red-400 to-red-600",
};

const scanSteps = [
  "Resolving DNS records...",
  "Checking DMARC enforcement...",
  "Analyzing SPF configuration...",
  "Generating domain permutations...",
  "Scanning for active typosquats...",
  "Querying certificate transparency logs...",
  "Checking breach databases...",
  "Computing risk score...",
];

export default function PublicScanner() {
  const [domain, setDomain] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateName, setGateName] = useState("");
  const [gateCompany, setGateCompany] = useState("");
  const [gatePhone, setGatePhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const runScan = async () => {
    if (!domain.trim() || isScanning) return;
    setIsScanning(true);
    setResult(null);
    setError(null);
    setScanStep(0);
    setUnlocked(false);
    setShowGate(false);

    const interval = setInterval(() => {
      setScanStep((prev) => Math.min(prev + 1, scanSteps.length - 1));
    }, 700);

    try {
      const resp = await fetch(SCAN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Scan failed");
      clearInterval(interval);
      setScanStep(scanSteps.length);
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (e: any) {
      clearInterval(interval);
      setError(e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const submitLead = async () => {
    if (!gateEmail.trim() || !gateName.trim() || !result) return;
    setIsSubmitting(true);
    try {
      await supabase.from("scan_leads").insert({
        name: gateName.trim(),
        email: gateEmail.trim(),
        company: gateCompany.trim() || null,
        phone: gatePhone.trim() || null,
        submission_type: "brand_scan",
        domain_scanned: result.domain,
        scan_grade: result.grade,
        scan_score: result.score,
      });
      setUnlocked(true);
      setShowGate(false);
    } catch {
      setUnlocked(true);
      setShowGate(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const threatCount =
    (result?.typosquats.registered.length || 0) +
    (result?.certificate_transparency.certificates.length || 0) +
    (result?.credential_exposure.breaches.length || 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-primary" />
            <span className="font-bold tracking-wider text-foreground">LRX RADAR</span>
          </Link>
          <Link to="/">
            <Button variant="outline" size="sm" className="text-xs gap-1">
              Dashboard <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <Radio className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Free OSINT Risk Assessment</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-foreground">
            How Vulnerable Is Your Brand?
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Get an instant security assessment. We scan your domain for email spoofing risk,
            impersonation domains, certificate abuse, and credential leaks — in under 30 seconds.
          </p>

          {/* Search */}
          <form
            onSubmit={(e) => { e.preventDefault(); runScan(); }}
            className="max-w-xl mx-auto flex gap-2"
          >
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Enter your company domain..."
                disabled={isScanning}
                className="w-full bg-card border border-border rounded-xl pl-12 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50 shadow-lg"
              />
            </div>
            <Button type="submit" disabled={isScanning || !domain.trim()} size="lg" className="gap-2 rounded-xl px-6 shadow-lg">
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {isScanning ? "Scanning..." : "Scan"}
            </Button>
          </form>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" /> DMARC & SPF Analysis</span>
            <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-primary" /> Typosquat Detection</span>
            <span className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-primary" /> Certificate Monitoring</span>
            <span className="flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-primary" /> Breach Intelligence</span>
          </div>
        </div>
      </section>

      {/* Scanning animation */}
      {isScanning && (
        <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-8">
          <Card className="border-primary/20 bg-card shadow-xl">
            <CardContent className="py-8">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
                <p className="text-sm font-medium text-foreground">Scanning {domain}...</p>
              </div>
              <div className="space-y-2 font-mono text-xs max-w-md mx-auto">
                {scanSteps.map((step, i) => (
                  <div key={i} className={cn("flex items-center gap-2 transition-all duration-300", i <= scanStep ? "opacity-100" : "opacity-15")}>
                    {i < scanStep ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : i === scanStep ? (
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                    )}
                    <span className={i <= scanStep ? "text-foreground" : "text-muted-foreground"}>{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {error && (
        <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-8">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive flex items-center gap-2">
                <XCircle className="w-4 h-4" /> {error}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Results */}
      {result && (
        <section ref={resultRef} className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
          {/* Grade Hero */}
          <Card className="border-primary/20 bg-card shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                <div className={cn("flex items-center justify-center p-8 md:p-12 bg-gradient-to-br", gradeColors[result.grade] || gradeColors.F)}>
                  <div className="text-center">
                    <p className="text-white/80 text-xs font-medium uppercase tracking-widest mb-1">Risk Grade</p>
                    <span className="text-6xl md:text-7xl font-bold text-white">{result.grade}</span>
                    <p className="text-white/80 text-sm mt-2 font-mono">{result.score}/100</p>
                  </div>
                </div>
                <div className="flex-1 p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-1">{result.domain}</h2>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={cn("text-xs font-semibold uppercase px-2.5 py-1 rounded-full border",
                      result.overall_risk === "critical" ? "border-red-500/30 bg-red-500/10 text-red-500" :
                      result.overall_risk === "high" ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                      result.overall_risk === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    )}>
                      {result.overall_risk} risk
                    </span>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <MiniStat icon={Mail} label="Email Spoofing" risk={result.email_spoofing.risk} />
                    <MiniStat icon={Globe} label="Typosquats" risk={result.typosquats.risk} value={`${result.typosquats.registered.length} found`} />
                    <MiniStat icon={Lock} label="Cert Abuse" risk={result.certificate_transparency.risk} value={`${result.certificate_transparency.certificates.length} certs`} />
                    <MiniStat icon={KeyRound} label="Credentials" risk={result.credential_exposure.risk} value={result.credential_exposure.total_exposed_accounts > 0 ? `${result.credential_exposure.total_exposed_accounts.toLocaleString()} exposed` : "Clean"} />
                  </div>

                  {threatCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      We found <span className="font-bold text-foreground">{threatCount} threat indicators</span> across your attack surface.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teaser: DMARC finding — always visible */}
          <Card className="border-border bg-card">
            <CardContent className="py-5">
              <div className="flex items-start gap-3">
                {result.email_spoofing.dmarc_policy === "reject" ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <ShieldX className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Email Spoofing Protection</h3>
                  <p className="text-xs text-muted-foreground">{result.email_spoofing.details}</p>
                  <p className="text-xs font-mono mt-2 text-foreground">
                    DMARC: <span className={result.email_spoofing.dmarc_policy === "reject" ? "text-emerald-500" : "text-red-500"}>
                      {result.email_spoofing.dmarc_policy ? `p=${result.email_spoofing.dmarc_policy}` : "NOT CONFIGURED"}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gated sections */}
          {!unlocked ? (
            <div className="space-y-4">
              {/* Blurred teasers */}
              {result.typosquats.registered.length > 0 && (
                <Card className="border-border bg-card relative overflow-hidden">
                  <CardContent className="py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className={cn("w-4 h-4", riskColors[result.typosquats.risk])} />
                      <h3 className="text-sm font-semibold text-foreground">
                        {result.typosquats.registered.length} Impersonation Domain{result.typosquats.registered.length > 1 ? "s" : ""} Detected
                      </h3>
                    </div>
                    <div className="space-y-1.5 blur-sm select-none pointer-events-none">
                      {result.typosquats.registered.slice(0, 3).map((ts, i) => (
                        <div key={i} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2 border border-border text-xs">
                          <span className="font-mono text-foreground flex-1">{ts.domain.replace(/./g, "•")}</span>
                          {ts.has_mx && <span className="text-red-500 text-[10px]">MX Active</span>}
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent flex items-end justify-center pb-4">
                      <Button onClick={() => setShowGate(true)} size="sm" className="gap-2 shadow-lg">
                        <Eye className="w-4 h-4" /> Unlock Full Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.credential_exposure.breaches.length > 0 && (
                <Card className="border-border bg-card relative overflow-hidden">
                  <CardContent className="py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <KeyRound className={cn("w-4 h-4", riskColors[result.credential_exposure.risk])} />
                      <h3 className="text-sm font-semibold text-foreground">
                        {result.credential_exposure.total_exposed_accounts.toLocaleString()} Credentials Exposed in {result.credential_exposure.breaches.length} Breach{result.credential_exposure.breaches.length > 1 ? "es" : ""}
                      </h3>
                    </div>
                    <div className="space-y-1.5 blur-sm select-none pointer-events-none">
                      {result.credential_exposure.breaches.slice(0, 2).map((b, i) => (
                        <div key={i} className="bg-background rounded-lg px-3 py-2 border border-border text-xs">
                          <span className="font-semibold">{"•".repeat(b.title.length)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent flex items-end justify-center pb-4">
                      <Button onClick={() => setShowGate(true)} size="sm" className="gap-2 shadow-lg">
                        <Eye className="w-4 h-4" /> Unlock Full Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.certificate_transparency.certificates.length > 0 && (
                <Card className="border-border bg-card relative overflow-hidden">
                  <CardContent className="py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className={cn("w-4 h-4", riskColors[result.certificate_transparency.risk])} />
                      <h3 className="text-sm font-semibold text-foreground">
                        {result.certificate_transparency.certificates.length} Suspicious Certificate{result.certificate_transparency.certificates.length > 1 ? "s" : ""} Issued
                      </h3>
                    </div>
                    <div className="space-y-1.5 blur-sm select-none pointer-events-none">
                      {result.certificate_transparency.certificates.slice(0, 2).map((c, i) => (
                        <div key={i} className="bg-background rounded-lg px-3 py-2 border border-border text-xs">
                          <span className="font-mono">{"•".repeat(20)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent flex items-end justify-center pb-4">
                      <Button onClick={() => setShowGate(true)} size="sm" className="gap-2 shadow-lg">
                        <Eye className="w-4 h-4" /> Unlock Full Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CTA if no threats found to gate */}
              {threatCount === 0 && (
                <Card className="border-primary/20 bg-card">
                  <CardContent className="py-6 text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                    <p className="text-sm text-foreground font-medium">Your domain looks clean — but threats can appear at any time.</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">Set up continuous monitoring with LRX Radar to stay protected.</p>
                    <Link to="/">
                      <Button size="sm" className="gap-2">Open LRX Radar <ArrowRight className="w-3 h-3" /></Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            /* Full unlocked results */
            <div className="space-y-4">
              {/* Typosquats */}
              {result.typosquats.registered.length > 0 && (
                <Card className="border-border bg-card">
                  <CardContent className="py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className={cn("w-4 h-4", riskColors[result.typosquats.risk])} />
                      <h3 className="text-sm font-semibold text-foreground">
                        Impersonation Domains ({result.typosquats.registered.length})
                      </h3>
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {result.typosquats.registered.map((ts, i) => (
                        <div key={i} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2 border border-border text-xs">
                          <span className="font-mono text-foreground flex-1">{ts.domain}</span>
                          {ts.has_mx && <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-3 h-3" /> MX Active</span>}
                          {ts.has_web && <span className="flex items-center gap-1 text-yellow-500"><Globe className="w-3 h-3" /> Web</span>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Credential Exposure */}
              {result.credential_exposure.breaches.length > 0 && (
                <Card className="border-border bg-card">
                  <CardContent className="py-5">
                    <div className="flex items-center gap-2 mb-2">
                      <KeyRound className={cn("w-4 h-4", riskColors[result.credential_exposure.risk])} />
                      <h3 className="text-sm font-semibold text-foreground">Credential Exposure</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{result.credential_exposure.total_exposed_accounts.toLocaleString()} total accounts</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{result.credential_exposure.details}</p>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {result.credential_exposure.breaches.map((b, i) => (
                        <div key={i} className="bg-background rounded-lg p-3 border border-border text-xs space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{b.title}</span>
                            {b.is_verified && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-500">Verified</span>}
                            <span className="text-muted-foreground ml-auto shrink-0">{b.breach_date}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {b.pwn_count.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {b.data_classes.slice(0, 6).map((dc: string, j: number) => (
                              <span key={j} className={cn("text-[10px] px-1.5 py-0.5 rounded",
                                dc.toLowerCase().includes("password") ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
                              )}>{dc}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Certificates */}
              {result.certificate_transparency.certificates.length > 0 && (
                <Card className="border-border bg-card">
                  <CardContent className="py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className={cn("w-4 h-4", riskColors[result.certificate_transparency.risk])} />
                      <h3 className="text-sm font-semibold text-foreground">
                        Suspicious Certificates ({result.certificate_transparency.certificates.length})
                      </h3>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {result.certificate_transparency.certificates.map((cert, i) => (
                        <div key={i} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2 border border-border text-xs">
                          <span className="font-mono text-foreground flex-1 truncate">{cert.common_name}</span>
                          <span className="text-muted-foreground shrink-0">{new Date(cert.not_before).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CTA */}
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="py-6 flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-foreground mb-1">Want continuous monitoring?</h3>
                    <p className="text-xs text-muted-foreground">LRX Radar provides real-time threat detection, automated takedowns, and converged intelligence — 24/7.</p>
                  </div>
                  <Link to="/">
                    <Button className="gap-2 shrink-0">
                      Open LRX Radar <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center font-mono">
            Scanned at {new Date(result.scanned_at).toLocaleString()} · LRX Brand Risk Index v1.0
          </p>
        </section>
      )}

      {/* Value props — shown before scan */}
      {!result && !isScanning && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ValueCard icon={Mail} title="Email Spoofing" desc="Check if attackers can send emails as your CEO. We analyze DMARC enforcement and SPF records." />
            <ValueCard icon={Globe} title="Typosquat Detection" desc="We generate 60+ domain permutations and check which ones are registered with active mail servers." />
            <ValueCard icon={Lock} title="Certificate Abuse" desc="Query certificate transparency logs for SSL certs issued to impersonation domains targeting your brand." />
            <ValueCard icon={KeyRound} title="Credential Leaks" desc="Search breach databases for exposed employee credentials that enable account takeover attacks." />
          </div>
        </section>
      )}

      {/* Email Gate Modal */}
      {showGate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGate(false)}>
          <Card className="w-full max-w-md border-primary/20 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Eye className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Unlock Your Full Report</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your email to see all {threatCount} threat indicators, impersonation domains, and exposed credentials.
                </p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); submitLead(); }} className="space-y-3">
                <input
                  type="text"
                  required
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  placeholder="Your name *"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <input
                  type="email"
                  required
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                  placeholder="work@company.com *"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <input
                  type="text"
                  value={gateCompany}
                  onChange={(e) => setGateCompany(e.target.value)}
                  placeholder="Company name (optional)"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <input
                  type="tel"
                  value={gatePhone}
                  onChange={(e) => setGatePhone(e.target.value)}
                  placeholder="Phone number (optional)"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <Button type="submit" className="w-full gap-2" disabled={isSubmitting || !gateEmail.trim() || !gateName.trim()}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {isSubmitting ? "Unlocking..." : "Get Full Report"}
                </Button>
              </form>
              <p className="text-[10px] text-muted-foreground text-center mt-4">
                No spam. We'll only send your report and relevant security alerts.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Satellite className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground font-mono">LRX RADAR · Global Defense</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">v2.4.1</span>
        </div>
      </footer>
    </div>
  );
}

function MiniStat({ icon: Icon, label, risk, value }: { icon: any; label: string; risk: string; value?: string }) {
  return (
    <div className="bg-background rounded-lg p-2.5 border border-border text-center">
      <Icon className={cn("w-4 h-4 mx-auto mb-1", riskColors[risk])} />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("text-[10px] font-semibold uppercase", riskColors[risk])}>{risk}</p>
      {value && <p className="text-[10px] text-muted-foreground mt-0.5">{value}</p>}
    </div>
  );
}

function ValueCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card className="border-border bg-card hover:border-primary/30 transition-colors">
      <CardContent className="py-6 text-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}
