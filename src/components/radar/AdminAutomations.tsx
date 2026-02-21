/**
 * AdminAutomations.tsx — Automation rule creation and management for the platform.
 * Admins can create rules that trigger actions based on threat events, takedowns,
 * investigation updates, and other platform signals.
 */

import { useState } from "react";
import {
  Zap, Plus, Trash2, Play, Pause, Pencil, ArrowRight,
  Shield, AlertTriangle, Globe, Target, Ticket, Mail,
  Bell, Webhook, ChevronDown, ChevronUp, Copy, ToggleLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Trigger definitions ───

interface TriggerDef {
  id: string;
  label: string;
  description: string;
  icon: typeof Zap;
  conditions: ConditionField[];
}

interface ConditionField {
  key: string;
  label: string;
  type: "select" | "number" | "text";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

const TRIGGERS: TriggerDef[] = [
  {
    id: "new_threat",
    label: "New Threat Detected",
    description: "Fires when a new threat is ingested from any feed source",
    icon: AlertTriangle,
    conditions: [
      { key: "severity", label: "Severity is", type: "select", options: [
        { label: "Any", value: "any" }, { label: "Critical", value: "critical" },
        { label: "High", value: "high" }, { label: "Medium", value: "medium" },
      ]},
      { key: "confidence_min", label: "Confidence ≥", type: "number", placeholder: "70" },
      { key: "attack_type", label: "Attack Type contains", type: "text", placeholder: "phishing" },
      { key: "brand", label: "Brand matches", type: "text", placeholder: "Your brand name" },
    ],
  },
  {
    id: "threat_escalation",
    label: "Threat Severity Escalated",
    description: "Fires when a threat's severity is increased (e.g. medium → critical)",
    icon: Shield,
    conditions: [
      { key: "new_severity", label: "Escalated to", type: "select", options: [
        { label: "Critical", value: "critical" }, { label: "High", value: "high" },
      ]},
    ],
  },
  {
    id: "takedown_requested",
    label: "Takedown Requested",
    description: "Fires when an analyst initiates a takedown via the Erasure Orchestrator",
    icon: Target,
    conditions: [
      { key: "domain_match", label: "Domain contains", type: "text", placeholder: "example" },
    ],
  },
  {
    id: "takedown_completed",
    label: "Takedown Completed",
    description: "Fires when a takedown is confirmed as resolved",
    icon: Target,
    conditions: [],
  },
  {
    id: "investigation_created",
    label: "Investigation Opened",
    description: "Fires when a new investigation ticket is created",
    icon: Ticket,
    conditions: [
      { key: "priority", label: "Priority is", type: "select", options: [
        { label: "Any", value: "any" }, { label: "Critical", value: "critical" },
        { label: "High", value: "high" },
      ]},
    ],
  },
  {
    id: "investigation_stale",
    label: "Investigation Stale",
    description: "Fires when an investigation has no updates for a configurable period",
    icon: Ticket,
    conditions: [
      { key: "stale_hours", label: "No update for (hours)", type: "number", placeholder: "48" },
    ],
  },
  {
    id: "hosting_provider_spike",
    label: "Hosting Provider Spike",
    description: "Fires when a hosting provider exceeds a threat count threshold",
    icon: Globe,
    conditions: [
      { key: "threshold", label: "Threat count ≥", type: "number", placeholder: "10" },
      { key: "window_hours", label: "Within (hours)", type: "number", placeholder: "24" },
    ],
  },
  {
    id: "breach_detected",
    label: "Credential Breach Found",
    description: "Fires when a dark web breach check finds exposed credentials",
    icon: Shield,
    conditions: [
      { key: "risk_level", label: "Risk level", type: "select", options: [
        { label: "Any", value: "any" }, { label: "Critical", value: "critical" }, { label: "High", value: "high" },
      ]},
    ],
  },
];

// ─── Action definitions ───

interface ActionDef {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  fields: { key: string; label: string; type: "text" | "select"; placeholder?: string; options?: { label: string; value: string }[] }[];
}

const ACTIONS: ActionDef[] = [
  {
    id: "create_ticket",
    label: "Create Investigation Ticket",
    description: "Auto-create an investigation ticket with pre-populated fields",
    icon: Ticket,
    fields: [
      { key: "title_template", label: "Title Template", type: "text", placeholder: "Auto: {{trigger.type}} — {{trigger.domain}}" },
      { key: "priority", label: "Priority", type: "select", options: [
        { label: "Critical", value: "critical" }, { label: "High", value: "high" },
        { label: "Medium", value: "medium" }, { label: "Low", value: "low" },
      ]},
      { key: "assign_to", label: "Auto-assign to", type: "select", options: [
        { label: "Unassigned", value: "unassigned" }, { label: "On-call Analyst", value: "oncall" },
      ]},
    ],
  },
  {
    id: "initiate_takedown",
    label: "Initiate Takedown",
    description: "Automatically submit a takedown request for the threat domain",
    icon: Target,
    fields: [
      { key: "takedown_type", label: "Method", type: "select", options: [
        { label: "Registrar Abuse Report", value: "registrar" },
        { label: "Hosting Provider Report", value: "hosting" },
        { label: "Google Safe Browsing", value: "safebrowsing" },
      ]},
    ],
  },
  {
    id: "send_notification",
    label: "Send Notification",
    description: "Push an alert via configured notification channels",
    icon: Bell,
    fields: [
      { key: "channel", label: "Channel", type: "select", options: [
        { label: "In-App Toast", value: "toast" },
        { label: "Slack (if connected)", value: "slack" },
        { label: "Teams (if connected)", value: "teams" },
        { label: "Email", value: "email" },
      ]},
      { key: "message_template", label: "Message", type: "text", placeholder: "🚨 {{trigger.label}}: {{trigger.domain}}" },
    ],
  },
  {
    id: "webhook",
    label: "Fire Webhook",
    description: "POST a JSON payload to an external URL",
    icon: Webhook,
    fields: [
      { key: "url", label: "Webhook URL", type: "text", placeholder: "https://hooks.example.com/automation" },
    ],
  },
  {
    id: "email_alert",
    label: "Send Email Alert",
    description: "Send a formatted email to specified recipients",
    icon: Mail,
    fields: [
      { key: "recipients", label: "Recipients", type: "text", placeholder: "soc@example.com, lead@example.com" },
      { key: "subject_template", label: "Subject", type: "text", placeholder: "[LRX] {{trigger.label}}" },
    ],
  },
  {
    id: "escalate_severity",
    label: "Escalate Threat Severity",
    description: "Automatically increase the severity level of the triggering threat",
    icon: AlertTriangle,
    fields: [
      { key: "target_severity", label: "Escalate to", type: "select", options: [
        { label: "Critical", value: "critical" }, { label: "High", value: "high" },
      ]},
    ],
  },
];

// ─── Rule type ───

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger_id: string;
  conditions: Record<string, string>;
  actions: { action_id: string; config: Record<string, string> }[];
  created_at: string;
  last_fired?: string;
  fire_count: number;
}

// ─── Seed demo rules ───

const DEMO_RULES: AutomationRule[] = [
  {
    id: "rule-1",
    name: "Critical Threat → Auto-Ticket + Slack Alert",
    enabled: true,
    trigger_id: "new_threat",
    conditions: { severity: "critical", confidence_min: "80" },
    actions: [
      { action_id: "create_ticket", config: { title_template: "Auto: Critical threat — {{domain}}", priority: "critical" } },
      { action_id: "send_notification", config: { channel: "slack", message_template: "🚨 Critical threat: {{domain}} ({{attack_type}})" } },
    ],
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    last_fired: new Date(Date.now() - 3600000).toISOString(),
    fire_count: 23,
  },
  {
    id: "rule-2",
    name: "Phishing Detected → Auto-Takedown",
    enabled: true,
    trigger_id: "new_threat",
    conditions: { attack_type: "phishing", confidence_min: "85" },
    actions: [
      { action_id: "initiate_takedown", config: { takedown_type: "registrar" } },
      { action_id: "email_alert", config: { recipients: "soc@example.com", subject_template: "[LRX] Phishing auto-takedown: {{domain}}" } },
    ],
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    last_fired: new Date(Date.now() - 7200000).toISOString(),
    fire_count: 8,
  },
  {
    id: "rule-3",
    name: "Stale Investigation Reminder",
    enabled: false,
    trigger_id: "investigation_stale",
    conditions: { stale_hours: "48" },
    actions: [
      { action_id: "send_notification", config: { channel: "toast", message_template: "⏰ Investigation {{ticket_id}} has had no updates for 48h" } },
    ],
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    fire_count: 0,
  },
];

export function AdminAutomations() {
  const [rules, setRules] = useState<AutomationRule[]>(DEMO_RULES);
  const [creating, setCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  // Builder state
  const [ruleName, setRuleName] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [selectedActions, setSelectedActions] = useState<{ action_id: string; config: Record<string, string> }[]>([]);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const resetBuilder = () => {
    setRuleName("");
    setSelectedTrigger("");
    setConditions({});
    setSelectedActions([]);
  };

  const openCreate = () => {
    resetBuilder();
    setCreating(true);
    setEditingRule(null);
  };

  const openEdit = (rule: AutomationRule) => {
    setRuleName(rule.name);
    setSelectedTrigger(rule.trigger_id);
    setConditions({ ...rule.conditions });
    setSelectedActions(rule.actions.map(a => ({ ...a, config: { ...a.config } })));
    setEditingRule(rule);
    setCreating(true);
  };

  const handleSave = () => {
    if (!ruleName.trim() || !selectedTrigger || selectedActions.length === 0) {
      toast.error("Incomplete rule", { description: "Need a name, trigger, and at least one action." });
      return;
    }

    const newRule: AutomationRule = {
      id: editingRule?.id || `rule-${Date.now()}`,
      name: ruleName.trim(),
      enabled: editingRule?.enabled ?? true,
      trigger_id: selectedTrigger,
      conditions,
      actions: selectedActions,
      created_at: editingRule?.created_at || new Date().toISOString(),
      fire_count: editingRule?.fire_count || 0,
      last_fired: editingRule?.last_fired,
    };

    if (editingRule) {
      setRules(prev => prev.map(r => r.id === editingRule.id ? newRule : r));
      toast.success("Rule updated");
    } else {
      setRules(prev => [newRule, ...prev]);
      toast.success("Rule created");
    }
    setCreating(false);
    resetBuilder();
    setEditingRule(null);
  };

  const handleDelete = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    toast.info("Rule deleted");
  };

  const toggleEnabled = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const addAction = () => {
    setSelectedActions(prev => [...prev, { action_id: "", config: {} }]);
  };

  const removeAction = (index: number) => {
    setSelectedActions(prev => prev.filter((_, i) => i !== index));
  };

  const trigger = TRIGGERS.find(t => t.id === selectedTrigger);
  const activeCount = rules.filter(r => r.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Automation Rules</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create if/then rules to automate responses across the platform — takedowns, tickets, alerts, and more.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Zap className="w-3 h-3" />
            {activeCount} Active
          </Badge>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Rule
          </Button>
        </div>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No automation rules yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const triggerDef = TRIGGERS.find(t => t.id === rule.trigger_id);
            const isExpanded = expandedRule === rule.id;
            return (
              <Card key={rule.id} className={`border-border bg-card transition-all ${!rule.enabled ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-4 p-3 lg:p-4">
                  <Switch checked={rule.enabled} onCheckedChange={() => toggleEnabled(rule.id)} />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedRule(isExpanded ? null : rule.id)}>
                    <div className="flex items-center gap-2">
                      {triggerDef && <triggerDef.icon className="w-4 h-4 text-primary shrink-0" />}
                      <span className="text-sm font-semibold text-foreground truncate">{rule.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {triggerDef?.label || rule.trigger_id}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
                      </span>
                      {rule.fire_count > 0 && (
                        <Badge variant="secondary" className="text-[9px]">
                          Fired {rule.fire_count}×
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rule)} className="h-7 w-7 p-0">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(rule.id)} className="h-7 w-7 p-0">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setExpandedRule(isExpanded ? null : rule.id)} className="h-7 w-7 p-0">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 border-t border-border mt-0 pt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-background rounded-lg border border-border p-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">When</p>
                        <p className="text-xs text-foreground font-medium">{triggerDef?.label}</p>
                        {Object.entries(rule.conditions).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(rule.conditions).map(([key, val]) => (
                              <p key={key} className="text-[10px] text-muted-foreground">
                                {key}: <span className="text-foreground font-medium">{val}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="bg-background rounded-lg border border-border p-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Then</p>
                        {rule.actions.map((action, i) => {
                          const actionDef = ACTIONS.find(a => a.id === action.action_id);
                          return (
                            <div key={i} className="flex items-center gap-2 mb-1">
                              {actionDef && <actionDef.icon className="w-3 h-3 text-primary" />}
                              <span className="text-xs text-foreground">{actionDef?.label || action.action_id}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {rule.last_fired && (
                      <p className="text-[10px] text-muted-foreground">
                        Last fired: {new Date(rule.last_fired).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={creating} onOpenChange={(open) => { if (!open) { setCreating(false); resetBuilder(); setEditingRule(null); } }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {editingRule ? "Edit Rule" : "Create Automation Rule"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Rule Name</label>
              <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Critical Phishing → Auto-Takedown" />
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">When this happens…</label>
              <Select value={selectedTrigger} onValueChange={(val) => { setSelectedTrigger(val); setConditions({}); }}>
                <SelectTrigger><SelectValue placeholder="Select a trigger…" /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <t.icon className="w-3.5 h-3.5" /> {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {trigger && (
                <p className="text-[10px] text-muted-foreground">{trigger.description}</p>
              )}
            </div>

            {/* Conditions */}
            {trigger && trigger.conditions.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Conditions (optional filters)</label>
                <div className="space-y-2">
                  {trigger.conditions.map((cond) => (
                    <div key={cond.key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">{cond.label}</span>
                      {cond.type === "select" ? (
                        <Select value={conditions[cond.key] || ""} onValueChange={(val) => setConditions(prev => ({ ...prev, [cond.key]: val }))}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                            {cond.options?.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={cond.type === "number" ? "number" : "text"}
                          placeholder={cond.placeholder}
                          value={conditions[cond.key] || ""}
                          onChange={(e) => setConditions(prev => ({ ...prev, [cond.key]: e.target.value }))}
                          className="flex-1"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Then do this…</label>
                <Button size="sm" variant="outline" onClick={addAction} className="h-6 text-[10px] gap-1">
                  <Plus className="w-3 h-3" /> Add Action
                </Button>
              </div>
              {selectedActions.map((action, i) => {
                const actionDef = ACTIONS.find(a => a.id === action.action_id);
                return (
                  <Card key={i} className="border-border bg-background">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select
                          value={action.action_id}
                          onValueChange={(val) => {
                            const updated = [...selectedActions];
                            updated[i] = { action_id: val, config: {} };
                            setSelectedActions(updated);
                          }}
                        >
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Select action…" /></SelectTrigger>
                          <SelectContent>
                            {ACTIONS.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                <span className="flex items-center gap-2">
                                  <a.icon className="w-3.5 h-3.5" /> {a.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => removeAction(i)} className="h-7 w-7 p-0 shrink-0">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                      {actionDef && actionDef.fields.map((field) => (
                        <div key={field.key} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-24 shrink-0">{field.label}</span>
                          {field.type === "select" ? (
                            <Select
                              value={action.config[field.key] || ""}
                              onValueChange={(val) => {
                                const updated = [...selectedActions];
                                updated[i].config[field.key] = val;
                                setSelectedActions(updated);
                              }}
                            >
                              <SelectTrigger className="flex-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>
                                {field.options?.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder={field.placeholder}
                              value={action.config[field.key] || ""}
                              onChange={(e) => {
                                const updated = [...selectedActions];
                                updated[i].config[field.key] = e.target.value;
                                setSelectedActions(updated);
                              }}
                              className="flex-1 text-xs"
                            />
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
              {selectedActions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 bg-background rounded-lg border border-dashed border-border">
                  No actions added yet. Click "Add Action" above.
                </p>
              )}
            </div>

            {/* Save */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setCreating(false); resetBuilder(); setEditingRule(null); }} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1 gap-2">
                <Zap className="w-4 h-4" />
                {editingRule ? "Update Rule" : "Create Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
