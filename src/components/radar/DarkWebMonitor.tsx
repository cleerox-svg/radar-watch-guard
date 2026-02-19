/**
 * DarkWebMonitor.tsx — Dark Web Breach Monitoring Dashboard.
 * Provides password breach checking (HIBP), email exposure analysis,
 * and domain breach scanning with cached results.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Search, ShieldAlert, ShieldCheck, Eye, EyeOff, Lock, Mail, Globe, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

function useBreachChecks() {
  return useQuery({
    queryKey: ["breach_checks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breach_checks")
        .select("*")
        .order("last_checked", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });
}

const riskColors: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const riskIcons: Record<string, typeof ShieldAlert> = {
  critical: ShieldAlert,
  high: ShieldAlert,
  medium: AlertTriangle,
  low: ShieldCheck,
};

export function DarkWebMonitor() {
  const { data: checks, isLoading } = useBreachChecks();
  const queryClient = useQueryClient();
  const [passwordInput, setPasswordInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const runCheck = async (checkType: string, value: string) => {
    if (!value.trim()) {
      toast.error("Please enter a value to check");
      return;
    }
    setIsChecking(checkType);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-breach", {
        body: { checkType, value: value.trim() },
      });
      if (error) throw error;
      setLastResult(data.result);
      queryClient.invalidateQueries({ queryKey: ["breach_checks"] });

      if (data.result.risk_level === "low") {
        toast.success("No breaches detected", { description: `${checkType} check passed` });
      } else {
        toast.warning(`${data.result.risk_level.toUpperCase()} risk detected`, {
          description: `${data.result.breaches_found} breach(es) found`,
        });
      }
    } catch (err: any) {
      toast.error("Breach check failed", { description: err.message });
    } finally {
      setIsChecking(null);
    }
  };

  // Stats
  const criticalCount = (checks || []).filter((c) => c.risk_level === "critical").length;
  const highCount = (checks || []).filter((c) => c.risk_level === "high").length;
  const totalBreaches = (checks || []).reduce((sum, c) => sum + (c.breaches_found || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground">Dark Web Monitor</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Check credentials and domains against breach databases and dark web sources
        </p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Checks Run", value: (checks || []).length, icon: Search },
          { label: "Total Breaches", value: totalBreaches, icon: ShieldAlert },
          { label: "Critical", value: criticalCount, icon: AlertTriangle },
          { label: "High Risk", value: highCount, icon: Eye },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-3 card-interactive">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <kpi.icon className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wider font-medium">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="password" className="space-y-4">
        <TabsList>
          <TabsTrigger value="password" className="gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Password
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email
          </TabsTrigger>
          <TabsTrigger value="domain" className="gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Domain
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            History
          </TabsTrigger>
        </TabsList>

        {/* Password Check */}
        <TabsContent value="password">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Password Breach Check</h3>
              <p className="text-xs text-muted-foreground">
                Uses HIBP Pwned Passwords with k-anonymity — your password never leaves your browser in plaintext.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password to check..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runCheck("password", passwordInput)}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                onClick={() => runCheck("password", passwordInput)}
                disabled={isChecking === "password"}
              >
                {isChecking === "password" ? "Checking..." : "Check"}
              </Button>
            </div>
            {lastResult?.check_type === "password" && <BreachResultCard result={lastResult} />}
          </Card>
        </TabsContent>

        {/* Email Check */}
        <TabsContent value="email">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Email Exposure Check</h3>
              <p className="text-xs text-muted-foreground">
                Checks email against known breach databases and dark web paste sites.
              </p>
            </div>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="user@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runCheck("email", emailInput)}
                className="flex-1"
              />
              <Button
                onClick={() => runCheck("email", emailInput)}
                disabled={isChecking === "email"}
              >
                {isChecking === "email" ? "Checking..." : "Check"}
              </Button>
            </div>
            {lastResult?.check_type === "email" && <BreachResultCard result={lastResult} />}
          </Card>
        </TabsContent>

        {/* Domain Check */}
        <TabsContent value="domain">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Domain Breach Scan</h3>
              <p className="text-xs text-muted-foreground">
                Scans domain against XposedOrNot breach database for organization-wide exposure.
              </p>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="example.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runCheck("domain", domainInput)}
                className="flex-1"
              />
              <Button
                onClick={() => runCheck("domain", domainInput)}
                disabled={isChecking === "domain"}
              >
                {isChecking === "domain" ? "Scanning..." : "Scan"}
              </Button>
            </div>
            {lastResult?.check_type === "domain" && <BreachResultCard result={lastResult} />}
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Loading history...</Card>
          ) : (checks || []).length === 0 ? (
            <Card className="p-8 text-center">
              <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No breach checks yet. Run your first check above.</p>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-cyber">
              {(checks || []).map((check, idx) => {
                const RiskIcon = riskIcons[check.risk_level || "low"] || ShieldCheck;
                return (
                  <motion.div
                    key={check.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                  >
                    <Card className="p-3 card-interactive">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                          check.risk_level === "low" ? "bg-emerald-500/10" : "bg-destructive/10"
                        }`}>
                          <RiskIcon className={`w-4 h-4 ${
                            check.risk_level === "low" ? "text-emerald-500" : "text-destructive"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-foreground truncate">
                              {check.check_value}
                            </code>
                            <Badge variant="outline" className="text-[10px] uppercase">{check.check_type}</Badge>
                            <Badge variant="outline" className={`text-[10px] ${riskColors[check.risk_level || "low"]}`}>
                              {check.risk_level}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>{check.breaches_found} breach(es)</span>
                            {check.pastes_found > 0 && <span>{check.pastes_found} paste(s)</span>}
                            <span className="ml-auto">{new Date(check.last_checked).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Inline result card shown after a breach check */
function BreachResultCard({ result }: { result: any }) {
  const isClean = result.risk_level === "low" && result.breaches_found === 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`p-4 border-2 ${isClean ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-start gap-3">
          {isClean ? (
            <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className={`font-semibold ${isClean ? "text-emerald-500" : "text-destructive"}`}>
              {isClean ? "No Breaches Detected" : `${result.breaches_found} Breach(es) Found`}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Risk Level: <span className="font-semibold uppercase">{result.risk_level}</span>
            </p>
            {result.breach_names?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {result.breach_names.map((name: string) => (
                  <Badge key={name} variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
            {result.check_type === "password" && result.breaches_found > 0 && (
              <p className="text-xs text-destructive mt-2">
                ⚠️ This password appeared in {result.breaches_found.toLocaleString()} known data breaches. Change it immediately.
              </p>
            )}
            {result.metadata?.reputation && (
              <p className="text-xs text-muted-foreground mt-1">
                Reputation: {result.metadata.reputation}
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
