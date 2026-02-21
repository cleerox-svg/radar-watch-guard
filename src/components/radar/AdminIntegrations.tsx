/**
 * AdminIntegrations.tsx — Integrations configuration panel for SSO/SAML,
 * ticketing systems, Google login, SIEM platforms, logging, and more.
 * Each integration card shows status, description, and a configure action.
 */

import { useState } from "react";
import {
  KeyRound, Ticket, Chrome, ShieldCheck, ScrollText, Webhook,
  ExternalLink, Check, Settings, AlertTriangle, Loader2, Globe,
  ChevronDown, ChevronUp, Link2, Unlink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ─── Integration category definitions ───

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: typeof KeyRound;
  category: string;
  status: "connected" | "configured" | "not_configured";
  fields: IntegrationField[];
  docsUrl?: string;
}

interface IntegrationField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

const INTEGRATIONS: Integration[] = [
  // ── Identity & SSO ──
  {
    id: "saml-sso",
    name: "SAML 2.0 SSO",
    description: "Enterprise single sign-on via SAML identity providers (Okta, Azure AD, OneLogin, PingIdentity).",
    icon: KeyRound,
    category: "Identity & SSO",
    status: "not_configured",
    docsUrl: "https://docs.oasis-open.org/security/saml/v2.0/",
    fields: [
      { key: "idp_entity_id", label: "IdP Entity ID", type: "text", placeholder: "https://idp.example.com/entity", required: true },
      { key: "idp_sso_url", label: "IdP SSO URL", type: "url", placeholder: "https://idp.example.com/sso", required: true },
      { key: "idp_certificate", label: "X.509 Certificate", type: "password", placeholder: "Paste PEM-encoded certificate", required: true },
      { key: "idp_provider", label: "Identity Provider", type: "select", options: [
        { label: "Okta", value: "okta" },
        { label: "Azure AD / Entra ID", value: "azure_ad" },
        { label: "OneLogin", value: "onelogin" },
        { label: "PingIdentity", value: "ping" },
        { label: "Google Workspace", value: "google_workspace" },
        { label: "Other", value: "other" },
      ]},
    ],
  },
  {
    id: "scim",
    name: "SCIM Provisioning",
    description: "Automatic user provisioning and deprovisioning via SCIM 2.0 from your identity provider.",
    icon: ShieldCheck,
    category: "Identity & SSO",
    status: "not_configured",
    fields: [
      { key: "scim_endpoint", label: "SCIM Endpoint", type: "url", placeholder: "Auto-generated", required: false },
      { key: "scim_token", label: "Bearer Token", type: "password", placeholder: "Generated on save", required: false },
    ],
  },
  {
    id: "google-oauth",
    name: "Sign in with Google",
    description: "Users can authenticate using their Google Workspace or personal Google accounts. Managed by Lovable Cloud — no API keys required.",
    icon: Chrome,
    category: "Identity & SSO",
    status: "connected",
    fields: [
      { key: "google_hd", label: "Restrict to Domain (optional)", type: "text", placeholder: "example.com" },
    ],
  },
  // ── Ticketing Systems ──
  {
    id: "jira",
    name: "Jira",
    description: "Bi-directional sync with Jira Cloud or Server. Create and update issues from investigation tickets.",
    icon: Ticket,
    category: "Ticketing",
    status: "not_configured",
    docsUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
    fields: [
      { key: "jira_url", label: "Jira Instance URL", type: "url", placeholder: "https://your-org.atlassian.net", required: true },
      { key: "jira_email", label: "Service Account Email", type: "text", placeholder: "bot@your-org.com", required: true },
      { key: "jira_api_token", label: "API Token", type: "password", placeholder: "Atlassian API token", required: true },
      { key: "jira_project_key", label: "Default Project Key", type: "text", placeholder: "SEC", required: true },
    ],
  },
  {
    id: "servicenow",
    name: "ServiceNow",
    description: "Create incidents and change requests in ServiceNow from threat detections and takedown actions.",
    icon: Ticket,
    category: "Ticketing",
    status: "not_configured",
    docsUrl: "https://developer.servicenow.com/dev.do#!/reference/api/",
    fields: [
      { key: "snow_instance", label: "Instance URL", type: "url", placeholder: "https://your-org.service-now.com", required: true },
      { key: "snow_username", label: "Service Account Username", type: "text", placeholder: "api_user", required: true },
      { key: "snow_password", label: "Password", type: "password", required: true },
      { key: "snow_table", label: "Target Table", type: "select", options: [
        { label: "Incident", value: "incident" },
        { label: "Security Incident", value: "sn_si_incident" },
        { label: "Change Request", value: "change_request" },
      ]},
    ],
  },
  // ── SIEM Platforms ──
  {
    id: "splunk",
    name: "Splunk",
    description: "Forward threat events and IOCs to Splunk via HEC (HTTP Event Collector) for correlation.",
    icon: ScrollText,
    category: "SIEM & Logging",
    status: "not_configured",
    fields: [
      { key: "splunk_hec_url", label: "HEC Endpoint", type: "url", placeholder: "https://splunk.example.com:8088", required: true },
      { key: "splunk_hec_token", label: "HEC Token", type: "password", required: true },
      { key: "splunk_index", label: "Target Index", type: "text", placeholder: "threat_intel" },
      { key: "splunk_sourcetype", label: "Sourcetype", type: "text", placeholder: "lrx:threat" },
    ],
  },
  {
    id: "sentinel",
    name: "Microsoft Sentinel",
    description: "Push threat intelligence to Azure Sentinel workspace via the Log Analytics API.",
    icon: ScrollText,
    category: "SIEM & Logging",
    status: "not_configured",
    fields: [
      { key: "sentinel_workspace_id", label: "Workspace ID", type: "text", required: true },
      { key: "sentinel_shared_key", label: "Primary Key", type: "password", required: true },
      { key: "sentinel_log_type", label: "Log Type", type: "text", placeholder: "LRXThreatIntel" },
    ],
  },
  {
    id: "elastic",
    name: "Elastic / ELK Stack",
    description: "Index threat events into Elasticsearch for Kibana dashboards and alerting.",
    icon: ScrollText,
    category: "SIEM & Logging",
    status: "not_configured",
    fields: [
      { key: "elastic_url", label: "Elasticsearch URL", type: "url", placeholder: "https://elastic.example.com:9200", required: true },
      { key: "elastic_api_key", label: "API Key", type: "password", required: true },
      { key: "elastic_index", label: "Index Pattern", type: "text", placeholder: "lrx-threats" },
    ],
  },
  // ── Logging ──
  {
    id: "syslog",
    name: "Syslog / CEF",
    description: "Forward events in CEF (Common Event Format) to your syslog collector or SOAR platform.",
    icon: ScrollText,
    category: "SIEM & Logging",
    status: "not_configured",
    fields: [
      { key: "syslog_host", label: "Syslog Host", type: "text", placeholder: "syslog.example.com", required: true },
      { key: "syslog_port", label: "Port", type: "text", placeholder: "514" },
      { key: "syslog_protocol", label: "Protocol", type: "select", options: [
        { label: "UDP", value: "udp" },
        { label: "TCP", value: "tcp" },
        { label: "TLS", value: "tls" },
      ]},
    ],
  },
  // ── Webhooks ──
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Send real-time JSON payloads on threat events, takedowns, and investigation updates to any endpoint.",
    icon: Webhook,
    category: "Webhooks & API",
    status: "not_configured",
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "url", placeholder: "https://hooks.example.com/lrx", required: true },
      { key: "webhook_secret", label: "Signing Secret (optional)", type: "password", placeholder: "HMAC signing key" },
      { key: "webhook_events", label: "Event Types", type: "select", options: [
        { label: "All Events", value: "all" },
        { label: "Threats Only", value: "threats" },
        { label: "Takedowns Only", value: "takedowns" },
        { label: "Investigations Only", value: "investigations" },
      ]},
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Receive threat alerts and investigation updates in Slack channels via incoming webhooks.",
    icon: Globe,
    category: "Webhooks & API",
    status: "not_configured",
    fields: [
      { key: "slack_webhook_url", label: "Incoming Webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/...", required: true },
      { key: "slack_channel", label: "Default Channel", type: "text", placeholder: "#security-alerts" },
    ],
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Push alerts and summaries to Teams channels via connector webhooks.",
    icon: Globe,
    category: "Webhooks & API",
    status: "not_configured",
    fields: [
      { key: "teams_webhook_url", label: "Connector Webhook URL", type: "url", placeholder: "https://outlook.office.com/webhook/...", required: true },
    ],
  },
];

const CATEGORIES = [...new Set(INTEGRATIONS.map((i) => i.category))];

const statusConfig = {
  connected: { label: "Connected", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  configured: { label: "Configured", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  not_configured: { label: "Not Configured", color: "bg-muted text-muted-foreground border-border" },
};

export function AdminIntegrations() {
  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, Integration["status"]>>({});
  const [configuring, setConfiguring] = useState<Integration | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(CATEGORIES[0]);

  const getStatus = (id: string) => integrationStatuses[id] || "not_configured";

  const openConfig = (integration: Integration) => {
    setConfiguring(integration);
    setFormValues({});
  };

  const handleSave = async () => {
    if (!configuring) return;
    setSaving(true);
    // Validate required fields
    const missing = configuring.fields.filter(f => f.required && !formValues[f.key]);
    if (missing.length > 0) {
      toast.error("Missing required fields", { description: missing.map(f => f.label).join(", ") });
      setSaving(false);
      return;
    }
    // Simulate save — in production this would store encrypted credentials via edge function
    await new Promise(resolve => setTimeout(resolve, 1200));
    setIntegrationStatuses(prev => ({ ...prev, [configuring.id]: "connected" }));
    toast.success(`${configuring.name} connected`, { description: "Integration configured successfully." });
    setSaving(false);
    setConfiguring(null);
  };

  const handleDisconnect = (id: string) => {
    setIntegrationStatuses(prev => ({ ...prev, [id]: "not_configured" }));
    toast.info("Integration disconnected");
  };

  const connectedCount = Object.values(integrationStatuses).filter(s => s === "connected").length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Platform Integrations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect LRX Radar to your identity, ticketing, SIEM, and notification infrastructure.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <Link2 className="w-3 h-3" />
          {connectedCount} / {INTEGRATIONS.length} Connected
        </Badge>
      </div>

      {/* Category sections */}
      {CATEGORIES.map((category) => {
        const items = INTEGRATIONS.filter(i => i.category === category);
        const isExpanded = expandedCategory === category;
        const catConnected = items.filter(i => getStatus(i.id) === "connected").length;

        return (
          <Card key={category} className="border-border bg-card">
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : category)}
              className="w-full flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-foreground">{category}</span>
                <span className="text-[10px] text-muted-foreground">
                  {catConnected > 0 ? `${catConnected} active` : `${items.length} available`}
                </span>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <CardContent className="pt-0 space-y-2">
                {items.map((integration) => {
                  const status = getStatus(integration.id);
                  const sc = statusConfig[status];
                  return (
                    <div key={integration.id} className="flex items-center gap-4 bg-background rounded-lg border border-border p-3 lg:p-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                        <integration.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{integration.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${sc.color}`}>{sc.label}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{integration.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {integration.docsUrl && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                            <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </a>
                          </Button>
                        )}
                        {status === "connected" ? (
                          <Button size="sm" variant="ghost" onClick={() => handleDisconnect(integration.id)} className="h-7 text-xs text-destructive hover:text-destructive gap-1">
                            <Unlink className="w-3 h-3" /> Disconnect
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openConfig(integration)} className="h-7 text-xs gap-1">
                            <Settings className="w-3 h-3" /> Configure
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Configuration dialog */}
      <Dialog open={!!configuring} onOpenChange={(open) => { if (!open) setConfiguring(null); }}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {configuring && <configuring.icon className="w-5 h-5 text-primary" />}
              Configure {configuring?.name}
            </DialogTitle>
          </DialogHeader>
          {configuring && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{configuring.description}</p>
              {configuring.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <Select value={formValues[field.key] || ""} onValueChange={(val) => setFormValues(prev => ({ ...prev, [field.key]: val }))}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {field.options?.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type === "password" ? "password" : "text"}
                      placeholder={field.placeholder}
                      value={formValues[field.key] || ""}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              {configuring.docsUrl && (
                <a href={configuring.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> View documentation
                </a>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfiguring(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save & Connect
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
