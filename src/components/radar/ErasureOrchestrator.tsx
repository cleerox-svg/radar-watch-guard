/**
 * ErasureOrchestrator.tsx — Module C: Erasure & Interop Orchestrator (Mitigation)
 *
 * The automated response layer that uses API orchestration to neutralize threats:
 * - Network Level: Push blocklists to SEGs (Proofpoint/Mimecast)
 * - Infrastructure Level: Fire takedown requests to Bolster/Netcraft
 * - Identity Level: Trigger Okta workflows to sever compromised sessions
 *
 * Currently uses mock integrations with simulated responses.
 */

import { useState } from "react";
import { Shield, Zap, Globe, Users, Lock, ArrowRight, CheckCircle, Clock, AlertTriangle, Activity, Server, Key, ExternalLink, Ban, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ErasureAction {
  id: string;
  type: "network" | "infrastructure" | "identity";
  action: string;
  target: string;
  provider: string;
  status: "pending" | "executing" | "completed" | "failed";
  timestamp: string;
  details: string;
}

const mockErasures: ErasureAction[] = [
  { id: "1", type: "network", action: "Domain Blocked", target: "secure-bank-login.com", provider: "Proofpoint", status: "completed", timestamp: new Date(Date.now() - 3600000).toISOString(), details: "Pushed to SEG blocklist via API. All inbound mail from this domain now quarantined." },
  { id: "2", type: "infrastructure", action: "Takedown Submitted", target: "paypa1-verify.net", provider: "Netcraft", status: "executing", timestamp: new Date(Date.now() - 1800000).toISOString(), details: "SSL cert, DMARC failure evidence, and MX records submitted. Estimated takedown: 4-12 hours." },
  { id: "3", type: "identity", action: "Session Revoked", target: "j.doe@company.com", provider: "Okta", status: "completed", timestamp: new Date(Date.now() - 900000).toISOString(), details: "Active sessions terminated. Step-up MFA enforced for next login. Password reset required." },
  { id: "4", type: "network", action: "IP Range Blocked", target: "185.234.x.x/24", provider: "Mimecast", status: "completed", timestamp: new Date(Date.now() - 7200000).toISOString(), details: "C2 infrastructure IP range added to blocklist. 47 connection attempts blocked since." },
  { id: "5", type: "infrastructure", action: "Takedown Completed", target: "amaz0n-security.com", provider: "Bolster", status: "completed", timestamp: new Date(Date.now() - 14400000).toISOString(), details: "Domain registrar suspended domain. DNS propagation confirmed. Site no longer resolving." },
  { id: "6", type: "identity", action: "Account Locked", target: "admin@partner.io", provider: "Okta", status: "pending", timestamp: new Date(Date.now() - 300000).toISOString(), details: "Awaiting approval to lock compromised partner admin account. ATO confidence: 94%." },
];

const typeConfig = {
  network: { icon: Server, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", label: "Network Level" },
  infrastructure: { icon: Globe, color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20", label: "Infrastructure Level" },
  identity: { icon: Key, color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20", label: "Identity Level" },
};

const statusConfig = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  executing: { icon: RefreshCw, color: "text-blue-500 animate-spin", label: "Executing" },
  completed: { icon: CheckCircle, color: "text-emerald-500", label: "Completed" },
  failed: { icon: AlertTriangle, color: "text-red-500", label: "Failed" },
};

const mockIntegrations = [
  { name: "Proofpoint", type: "SEG", status: "connected", actions: 142, icon: Server, description: "Dynamic blocklist push via Email Protection API" },
  { name: "Mimecast", type: "SEG", status: "connected", actions: 87, icon: Server, description: "Gateway policy updates via Administration API" },
  { name: "Netcraft", type: "Takedown", status: "connected", actions: 34, icon: Globe, description: "Automated phishing site takedown submissions" },
  { name: "Bolster", type: "Takedown", status: "connected", actions: 21, icon: Ban, description: "Visual phishing detection & domain takedown" },
  { name: "Okta", type: "Identity", status: "connected", actions: 56, icon: Key, description: "Session revocation & step-up MFA enforcement" },
  { name: "CrowdStrike", type: "EDR", status: "available", actions: 0, icon: Shield, description: "Endpoint isolation & IOC sweeps" },
];

export function ErasureOrchestrator() {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const filteredActions = selectedType
    ? mockErasures.filter(e => e.type === selectedType)
    : mockErasures;

  const stats = {
    total: mockErasures.length,
    completed: mockErasures.filter(e => e.status === "completed").length,
    executing: mockErasures.filter(e => e.status === "executing").length,
    pending: mockErasures.filter(e => e.status === "pending").length,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-500" />
            Erasure & Interop Orchestrator
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Automated threat neutralization via API orchestration — blocks domains, fires takedowns, and severs compromised sessions.
          </p>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="py-4 text-center">
            <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-foreground">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total Actions</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="py-4 text-center">
            <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-emerald-500">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-card">
          <CardContent className="py-4 text-center">
            <Activity className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-blue-500">{stats.executing}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20 bg-card">
          <CardContent className="py-4 text-center">
            <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-yellow-500">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Type Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedType === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType(null)}
          className="text-xs"
        >
          All Levels
        </Button>
        {Object.entries(typeConfig).map(([key, config]) => (
          <Button
            key={key}
            variant={selectedType === key ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType(key)}
            className="text-xs gap-1"
          >
            <config.icon className="w-3 h-3" />
            {config.label}
          </Button>
        ))}
      </div>

      {/* Erasure Actions Timeline */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Recent Erasure Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredActions.map((action) => {
            const tConfig = typeConfig[action.type];
            const sConfig = statusConfig[action.status];
            return (
              <div key={action.id} className={cn("bg-background rounded-lg p-4 border", tConfig.bg)}>
                <div className="flex items-start gap-3">
                  <tConfig.icon className={cn("w-5 h-5 shrink-0 mt-0.5", tConfig.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-semibold text-foreground">{action.action}</h4>
                      <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1",
                        sConfig.color === "text-emerald-500" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" :
                        sConfig.color.includes("blue") ? "border-blue-500/30 bg-blue-500/10 text-blue-500" :
                        sConfig.color.includes("yellow") ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500" :
                        "border-red-500/30 bg-red-500/10 text-red-500"
                      )}>
                        <sConfig.icon className="w-3 h-3" />
                        {sConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="font-mono text-foreground">{action.target}</span>
                      <span>via</span>
                      <span className="font-semibold">{action.provider}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{action.details}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-2">
                      {new Date(action.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Integration Partners */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-primary" />
            Integration Partners
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            API-connected security stack for automated erasure orchestration.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mockIntegrations.map((integration) => (
              <div key={integration.name} className="bg-background rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <integration.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{integration.name}</span>
                  <span className={cn("ml-auto text-[10px] px-1.5 py-0.5 rounded-full border",
                    integration.status === "connected"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-muted bg-muted/50 text-muted-foreground"
                  )}>
                    {integration.status}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-1">{integration.type}</p>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
                {integration.actions > 0 && (
                  <p className="text-[10px] text-primary font-mono mt-2">{integration.actions} actions executed</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center font-mono">
        ⚡ Mock integrations — Real API endpoints can be connected in the Admin Panel
      </p>
    </motion.div>
  );
}
