/**
 * CrossReferencePanel.tsx — Reusable cross-reference enrichment panel.
 * Shows related indicators from other data sources alongside a widget's primary data.
 */

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Link2, Globe, Server, Shield, Mail, Skull } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrossRef {
  label: string;
  value: string;
  source: string;
  severity?: string;
  icon?: typeof Globe;
}

interface CrossReferencePanelProps {
  title: string;
  references: CrossRef[];
  maxItems?: number;
  className?: string;
}

const sevColors: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function CrossReferencePanel({ title, references, maxItems = 8, className }: CrossReferencePanelProps) {
  if (references.length === 0) return null;

  return (
    <Card className={cn("border-primary/10 bg-card/50", className)}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">{title}</span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">{references.length}</Badge>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-cyber">
          {references.slice(0, maxItems).map((ref, i) => {
            const Icon = ref.icon || Globe;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="font-mono text-foreground truncate flex-1">{ref.value}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">{ref.source}</span>
                {ref.severity && (
                  <Badge variant="outline" className={cn("text-[9px] px-1 py-0", sevColors[ref.severity] || sevColors.low)}>
                    {ref.severity}
                  </Badge>
                )}
              </div>
            );
          })}
          {references.length > maxItems && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              +{references.length - maxItems} more
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Utility hooks for building cross-references from platform data.
 */
export function buildThreatCrossRefs(
  primaryValues: string[],
  threats: any[] | undefined,
  matchField: "domain" | "ip_address" | "brand"
): CrossRef[] {
  if (!threats || primaryValues.length === 0) return [];
  const lowerValues = new Set(primaryValues.map(v => v.toLowerCase()));

  return threats
    .filter(t => {
      const val = t[matchField]?.toLowerCase();
      return val && lowerValues.has(val);
    })
    .slice(0, 10)
    .map(t => ({
      label: t.brand || t.domain,
      value: `${t.brand} — ${t.domain} (${t.attack_type})`,
      source: `threats/${t.source}`,
      severity: t.severity,
      icon: AlertTriangle,
    }));
}

export function buildTorCrossRefs(
  ips: string[],
  torNodes: any[] | undefined
): CrossRef[] {
  if (!torNodes || ips.length === 0) return [];
  const ipSet = new Set(ips);
  return torNodes
    .filter(n => ipSet.has(n.ip_address))
    .slice(0, 10)
    .map(n => ({
      label: n.ip_address,
      value: n.ip_address,
      source: "tor_exit_node",
      severity: "high",
      icon: Server,
    }));
}

export function buildSocialIocCrossRefs(
  matchValues: string[],
  socialIocs: any[] | undefined,
  matchType: "domain" | "ip"
): CrossRef[] {
  if (!socialIocs || matchValues.length === 0) return [];
  const valSet = new Set(matchValues.map(v => v.toLowerCase()));

  return socialIocs
    .filter(ioc => {
      if (matchType === "domain" && (ioc.ioc_type === "domain" || ioc.ioc_type === "url")) {
        return valSet.has(ioc.ioc_value?.toLowerCase());
      }
      if (matchType === "ip" && ioc.ioc_type === "ip") {
        return valSet.has(ioc.ioc_value);
      }
      return false;
    })
    .slice(0, 10)
    .map(ioc => ({
      label: ioc.ioc_value,
      value: `${ioc.ioc_type}: ${ioc.ioc_value} (${(ioc.tags || []).join(", ")})`,
      source: ioc.source,
      severity: ioc.confidence === "high" ? "high" : "medium",
      icon: Globe,
    }));
}
