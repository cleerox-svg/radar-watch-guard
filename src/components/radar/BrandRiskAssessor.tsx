/**
 * BrandRiskAssessor.tsx — Brand Health & Risk Scanner module.
 *
 * Lets analysts input a domain and runs OSINT checks:
 * DMARC/SPF, typosquats, and certificate transparency.
 * Displays a risk grade, score, and detailed breakdown.
 */

import { useState } from "react";
import { Search, Shield, ShieldAlert, ShieldCheck, ShieldX, Globe, Mail, Lock, AlertTriangle, CheckCircle, XCircle, Loader2, ArrowRight, KeyRound, Users, Unlink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SCAN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-domain`;

interface ScanResult {
  domain: string;
  score: number;
  grade: string;
  overall_risk: string;
  email_spoofing: {
    dmarc_record: string | null;
    dmarc_policy: string | null;
    spf_record: string | null;
    spf_strict: boolean;
    risk: string;
    details: string;
    penalty: number;
  };
  typosquats: {
    total_permutations: number;
    registered: { domain: string; has_mx: boolean; has_web: boolean }[];
    risk: string;
    penalty: number;
  };
  certificate_transparency: {
    certificates: { issuer: string; common_name: string; not_before: string; not_after: string }[];
    risk: string;
    penalty: number;
  };
  credential_exposure: {
    breaches: {
      name: string;
      title: string;
      domain: string;
      breach_date: string;
      pwn_count: number;
      data_classes: string[];
      is_verified: boolean;
    }[];
    total_exposed_accounts: number;
    risk: string;
    penalty: number;
    details: string;
  };
  dangling_dns: {
    subdomains_checked: number;
    vulnerable: {
      subdomain: string;
      cname_target: string;
      provider: string;
      status: string;
    }[];
    risk: string;
    penalty: number;
    details: string;
  };
  scanned_at: string;
}

const riskColors: Record<string, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-emerald-500",
};

const gradeColors: Record<string, string> = {
  A: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  B: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  C: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
  D: "text-orange-500 border-orange-500/30 bg-orange-500/10",
  F: "text-red-500 border-red-500/30 bg-red-500/10",
};

const scanSteps = [
  "Resolving DNS records...",
  "Checking DMARC enforcement...",
  "Analyzing SPF configuration...",
  "Generating domain permutations...",
  "Scanning for typosquats...",
  "Querying certificate transparency logs...",
  "Checking subdomain CNAME records...",
  "Detecting dangling DNS entries...",
  "Computing risk score...",
];

export function BrandRiskAssessor() {
  const [domain, setDomain] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    if (!domain.trim() || isScanning) return;
    setIsScanning(true);
    setResult(null);
    setError(null);
    setScanStep(0);

    // Animate scan steps
    const interval = setInterval(() => {
      setScanStep((prev) => Math.min(prev + 1, scanSteps.length - 1));
    }, 800);

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
    } catch (e: any) {
      clearInterval(interval);
      setError(e.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Brand Risk Assessor
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Enter a domain to scan for email spoofing risk, typosquats, and certificate abuse.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); runScan(); }}
            className="flex gap-2"
          >
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="company.com"
                disabled={isScanning}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
              />
            </div>
            <Button type="submit" disabled={isScanning || !domain.trim()} className="gap-2">
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isScanning ? "Scanning..." : "Scan Domain"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Scanning animation */}
      {isScanning && (
        <Card className="border-primary/20 bg-card">
          <CardContent className="py-6">
            <div className="space-y-2 font-mono text-xs">
              {scanSteps.map((step, i) => (
                <div key={i} className={cn("flex items-center gap-2 transition-opacity duration-300", i <= scanStep ? "opacity-100" : "opacity-20")}>
                  {i < scanStep ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : i === scanStep ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                  )}
                  <span className={cn(i <= scanStep ? "text-foreground" : "text-muted-foreground")}>{step}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm text-destructive flex items-center gap-2">
              <XCircle className="w-4 h-4" /> {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Grade card */}
          <Card className="border-primary/20 bg-card">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className={cn("w-24 h-24 rounded-2xl border-2 flex items-center justify-center", gradeColors[result.grade] || gradeColors.F)}>
                  <span className="text-4xl font-bold">{result.grade}</span>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl font-bold text-foreground">{result.domain}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Risk Score: <span className="font-mono font-bold text-foreground">{result.score}/100</span>
                  </p>
                  <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                    <span className={cn("text-xs font-semibold uppercase px-2 py-0.5 rounded-full border",
                      result.overall_risk === "critical" ? "border-red-500/30 bg-red-500/10 text-red-500" :
                      result.overall_risk === "high" ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                      result.overall_risk === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    )}>
                      {result.overall_risk} risk
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div>
                    <Mail className={cn("w-5 h-5 mx-auto mb-1", riskColors[result.email_spoofing.risk])} />
                    <p className="text-[10px] text-muted-foreground">Email</p>
                    <p className={cn("text-xs font-semibold uppercase", riskColors[result.email_spoofing.risk])}>{result.email_spoofing.risk}</p>
                  </div>
                  <div>
                    <Globe className={cn("w-5 h-5 mx-auto mb-1", riskColors[result.typosquats.risk])} />
                    <p className="text-[10px] text-muted-foreground">Typosquats</p>
                    <p className={cn("text-xs font-semibold uppercase", riskColors[result.typosquats.risk])}>{result.typosquats.risk}</p>
                  </div>
                  <div>
                    <Lock className={cn("w-5 h-5 mx-auto mb-1", riskColors[result.certificate_transparency.risk])} />
                    <p className="text-[10px] text-muted-foreground">Cert Abuse</p>
                    <p className={cn("text-xs font-semibold uppercase", riskColors[result.certificate_transparency.risk])}>{result.certificate_transparency.risk}</p>
                  </div>
                  <div>
                    <KeyRound className={cn("w-5 h-5 mx-auto mb-1", riskColors[result.credential_exposure.risk])} />
                    <p className="text-[10px] text-muted-foreground">Credentials</p>
                    <p className={cn("text-xs font-semibold uppercase", riskColors[result.credential_exposure.risk])}>{result.credential_exposure.risk}</p>
                  </div>
                  <div>
                    <Unlink className={cn("w-5 h-5 mx-auto mb-1", riskColors[result.dangling_dns.risk])} />
                    <p className="text-[10px] text-muted-foreground">DNS Hijack</p>
                    <p className={cn("text-xs font-semibold uppercase", riskColors[result.dangling_dns.risk])}>{result.dangling_dns.risk}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Spoofing */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className={cn("w-4 h-4", riskColors[result.email_spoofing.risk])} />
                Email Spoofing Risk
                <span className={cn("ml-auto text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border",
                  result.email_spoofing.risk === "critical" ? "border-red-500/30 bg-red-500/10 text-red-500" :
                  result.email_spoofing.risk === "high" ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                  result.email_spoofing.risk === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                )}>{result.email_spoofing.risk}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{result.email_spoofing.details}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-background rounded-lg p-3 border border-border">
                  <p className="text-muted-foreground mb-1">DMARC Policy</p>
                  <div className="flex items-center gap-2">
                    {result.email_spoofing.dmarc_policy === "reject" ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ShieldX className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-mono font-bold text-foreground">
                      {result.email_spoofing.dmarc_policy ? `p=${result.email_spoofing.dmarc_policy}` : "NOT CONFIGURED"}
                    </span>
                  </div>
                </div>
                <div className="bg-background rounded-lg p-3 border border-border">
                  <p className="text-muted-foreground mb-1">SPF Record</p>
                  <div className="flex items-center gap-2">
                    {result.email_spoofing.spf_record ? (
                      result.email_spoofing.spf_strict ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-yellow-500" />
                      )
                    ) : (
                      <ShieldX className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-mono text-foreground truncate">
                      {result.email_spoofing.spf_record ? (result.email_spoofing.spf_strict ? "Hard-fail (-all)" : "Soft-fail (~all)") : "NOT CONFIGURED"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typosquats */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className={cn("w-4 h-4", riskColors[result.typosquats.risk])} />
                Typosquat Detection
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  {result.typosquats.registered.length} found / {result.typosquats.total_permutations} checked
                </span>
                <span className={cn("ml-auto text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border",
                  result.typosquats.risk === "critical" ? "border-red-500/30 bg-red-500/10 text-red-500" :
                  result.typosquats.risk === "high" ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                  result.typosquats.risk === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                )}>{result.typosquats.risk}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.typosquats.registered.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.typosquats.registered.map((ts, i) => (
                    <div key={i} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2 border border-border text-xs">
                      <span className="font-mono text-foreground flex-1">{ts.domain}</span>
                      <div className="flex items-center gap-2">
                        {ts.has_mx && (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="w-3 h-3" /> MX Active
                          </span>
                        )}
                        {ts.has_web && (
                          <span className="flex items-center gap-1 text-yellow-500">
                            <Globe className="w-3 h-3" /> Web Active
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> No active typosquat domains detected.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Certificate Transparency */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className={cn("w-4 h-4", riskColors[result.certificate_transparency.risk])} />
                Certificate Transparency
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  {result.certificate_transparency.certificates.length} suspicious certs (90 days)
                </span>
                <span className={cn("ml-auto text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border",
                  result.certificate_transparency.risk === "critical" ? "border-red-500/30 bg-red-500/10 text-red-500" :
                  result.certificate_transparency.risk === "high" ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                  result.certificate_transparency.risk === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                )}>{result.certificate_transparency.risk}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.certificate_transparency.certificates.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.certificate_transparency.certificates.map((cert, i) => (
                    <div key={i} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2 border border-border text-xs">
                      <span className="font-mono text-foreground flex-1 truncate">{cert.common_name}</span>
                      <span className="text-muted-foreground shrink-0">{new Date(cert.not_before).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> No suspicious certificates found in the last 90 days.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Credential Exposure */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <KeyRound className={cn("w-4 h-4", riskColors[result.credential_exposure.risk])} />
                Credential Exposure
                {result.credential_exposure.total_exposed_accounts > 0 && (
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    {result.credential_exposure.total_exposed_accounts.toLocaleString()} accounts exposed
                  </span>
                )}
                <span className={cn("ml-auto text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border",
                  result.credential_exposure.risk === "critical" ? "border-red-500/30 bg-red-500/10 text-red-500" :
                  result.credential_exposure.risk === "high" ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                  result.credential_exposure.risk === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                )}>{result.credential_exposure.risk}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{result.credential_exposure.details}</p>
              {result.credential_exposure.breaches.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.credential_exposure.breaches.map((breach, i) => (
                    <div key={i} className="bg-background rounded-lg p-3 border border-border text-xs space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{breach.title}</span>
                        {breach.is_verified && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-500">Verified</span>
                        )}
                        <span className="text-muted-foreground ml-auto shrink-0">{breach.breach_date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {breach.pwn_count.toLocaleString()} accounts
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {breach.data_classes.slice(0, 6).map((dc, j) => (
                          <span key={j} className={cn("text-[10px] px-1.5 py-0.5 rounded",
                            dc.toLowerCase().includes("password") ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
                          )}>{dc}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> No known breaches found for this domain.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Dangling DNS / Subdomain Hijacking */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Unlink className={cn("w-4 h-4", riskColors[result.dangling_dns.risk])} />
                Subdomain Hijacking
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  {result.dangling_dns.subdomains_checked} subdomains checked
                </span>
                <span className={cn("ml-auto text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border",
                  result.dangling_dns.risk === "critical" ? "border-red-500/30 bg-red-500/10 text-red-500" :
                  result.dangling_dns.risk === "high" ? "border-orange-500/30 bg-orange-500/10 text-orange-500" :
                  result.dangling_dns.risk === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                )}>{result.dangling_dns.risk}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{result.dangling_dns.details}</p>
              {result.dangling_dns.vulnerable.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.dangling_dns.vulnerable.map((entry, i) => (
                    <div key={i} className="bg-background rounded-lg p-3 border border-border text-xs space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-foreground">{entry.subdomain}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border",
                          entry.status === "dangling"
                            ? "bg-red-500/10 border-red-500/30 text-red-500"
                            : "bg-yellow-500/10 border-yellow-500/30 text-yellow-500"
                        )}>
                          {entry.status === "dangling" ? "DANGLING" : "SUSPICIOUS"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>CNAME → <span className="font-mono text-foreground">{entry.cname_target}</span></span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted">{entry.provider}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> No dangling DNS records or subdomain hijacking risks detected.
                </p>
              )}
            </CardContent>
          </Card>

          <p className="text-[10px] text-muted-foreground text-center font-mono">
            Scanned at {new Date(result.scanned_at).toLocaleString()} · LRX Brand Risk Index v1.0
          </p>
        </div>
      )}
    </div>
  );
}
