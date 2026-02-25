/**
 * Sidebar.tsx — Streamlined navigation with agent-centric organization.
 * Four clear categories: Mission Control, Agents, Intelligence, Platform.
 */

import { Satellite, X, Sun, Moon, Monitor, LogOut, Shield, Brain, MessageSquare, Globe, Radio, Skull, UsersRound, ShieldCheck, BarChart3, AlertTriangle, Settings, BookOpen, Ticket, MailWarning, UserCircle, UserPlus, Bot, Scan, Zap, Gavel, Fingerprint, Camera, Network, TrendingDown, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export type TabKey =
  | "exposure"
  | "correlation"
  | "erasure"
  | "knowledge"
  | "investigations"
  | "heatmap"
  | "ato"
  | "email"
  | "stats"
  | "urgent"
  | "briefing"
  | "chat"
  | "agents"
  | "social-monitor"
  | "dark-web"
  | "spam-traps"
  | "leads"
  | "admin";

interface SidebarProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onClose?: () => void;
  isAdmin?: boolean;
  userDisplayName?: string | null;
  primaryGroup?: string;
  onSignOut?: () => void;
  hasModuleAccess?: (moduleKey: string) => boolean;
}

const navGroups: { label: string; accent?: string; items: { key: TabKey; icon: typeof Globe; label: string; description: string; accent?: string; badge?: string }[] }[] = [
  {
    label: "Mission Control",
    accent: "text-primary",
    items: [
      { key: "heatmap", icon: Globe, label: "Threat Map", description: "Real-time global attack visualization", accent: "text-emerald-500" },
      { key: "exposure", icon: Scan, label: "Brand Exposure", description: "Your attack surface at a glance", accent: "text-cyan-500" },
      { key: "urgent", icon: AlertTriangle, label: "Critical Alerts", description: "Threats requiring immediate action", accent: "text-amber-500", badge: "!" },
      { key: "briefing", icon: Brain, label: "Daily Briefing", description: "AI-generated threat summary", accent: "text-violet-500" },
    ],
  },
  {
    label: "Investigate",
    accent: "text-cyan-400",
    items: [
      { key: "correlation", icon: Zap, label: "Signal Correlation", description: "Cross-reference threat signals", accent: "text-amber-500" },
      { key: "investigations", icon: Ticket, label: "Investigations", description: "Track ongoing cases", accent: "text-violet-500" },
      { key: "erasure", icon: Shield, label: "Takedown & Response", description: "Remove threats and respond", accent: "text-rose-500" },
    ],
  },
  {
    label: "Agents & Automation",
    accent: "text-emerald-400",
    items: [
      { key: "agents", icon: Bot, label: "Agent Hub", description: "AI agent command center & approvals", accent: "text-emerald-500" },
      { key: "chat", icon: MessageSquare, label: "TrustBot", description: "AI assistant for threat analysis", accent: "text-violet-400" },
    ],
  },
  {
    label: "Intelligence Feeds",
    accent: "text-sky-400",
    items: [
      { key: "social-monitor", icon: Radio, label: "Social Intel", description: "Community threat indicators", accent: "text-sky-500" },
      { key: "dark-web", icon: Skull, label: "Dark Web", description: "Breach & credential monitoring", accent: "text-orange-500" },
      { key: "ato", icon: UsersRound, label: "Account Takeover", description: "Suspicious login tracking", accent: "text-pink-500" },
      { key: "email", icon: ShieldCheck, label: "Email Auth", description: "SPF, DKIM, DMARC status", accent: "text-emerald-400" },
      { key: "stats", icon: BarChart3, label: "Analytics", description: "Feed metrics & trends", accent: "text-sky-400" },
    ],
  },
];

const adminGroup = {
  label: "Platform",
  accent: "text-muted-foreground",
  items: [
    { key: "knowledge" as TabKey, icon: BookOpen, label: "Knowledge Base", description: "Docs & API reference", accent: "text-muted-foreground" },
    { key: "spam-traps" as TabKey, icon: MailWarning, label: "Spam Traps", description: "Honeypot intel", accent: "text-amber-400" },
    { key: "admin" as TabKey, icon: Settings, label: "Admin", description: "Users, groups & feeds", accent: "text-muted-foreground" },
    { key: "leads" as TabKey, icon: UserPlus, label: "Leads", description: "Form submissions", accent: "text-sky-400" },
  ],
};

const themeOptions = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "Auto" },
];

export function Sidebar({ currentTab, onTabChange, onClose, isAdmin, userDisplayName, primaryGroup, onSignOut, hasModuleAccess }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        hasModuleAccess ? hasModuleAccess(item.key) : true
      ),
    }))
    .filter((group) => group.items.length > 0);

  const allGroups = [
    ...filteredNavGroups,
    ...(isAdmin || (hasModuleAccess && hasModuleAccess("admin")) ? [adminGroup] : []),
  ];

  return (
    <aside className="w-60 h-full bg-card/95 backdrop-blur-xl border-r border-border flex flex-col z-20 shadow-xl">
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <Link to="/" className="flex items-center group gap-2.5">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 rounded-lg animate-pulse-slow" />
            <Satellite className="w-4 h-4 text-primary relative z-10" />
          </div>
          <div>
            <span className="block text-sm font-extrabold tracking-wider text-foreground group-hover:text-primary transition-colors">TRUST RADAR</span>
            <span className="block text-[9px] text-primary/70 font-mono tracking-[0.15em] uppercase">Intelligence Platform</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto scrollbar-cyber">
        {allGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className={cn("px-3 mb-1 text-[9px] font-bold uppercase tracking-[0.15em]", group.accent || "text-muted-foreground/60")}>
              {group.label}
            </p>
            <div className="space-y-px">
              {group.items.map((item) => {
                const active = currentTab === item.key;
                return (
                  <Tooltip key={item.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onTabChange(item.key)}
                        className={cn(
                          "flex items-center w-full px-3 py-2 transition-all duration-200 rounded-lg text-left group relative overflow-hidden",
                          active
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-full"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                        <item.icon className={cn(
                          "w-3.5 h-3.5 mr-2.5 shrink-0 transition-colors duration-200",
                          active ? "text-primary" : (item as any).accent || "group-hover:text-foreground"
                        )} />
                        <span className={cn(
                          "text-[13px] truncate block transition-colors",
                          active ? "font-semibold text-foreground" : "font-medium"
                        )}>
                          {item.label}
                        </span>
                        {(item as any).badge && active === false && (
                          <span className="ml-auto w-4 h-4 rounded-full bg-destructive/20 text-destructive text-[9px] font-bold flex items-center justify-center">
                            {(item as any).badge}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs max-w-[180px]">
                      {item.description}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-border space-y-1.5">
        {userDisplayName && (
          <Link to="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/50 transition-colors group">
            <UserCircle className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{userDisplayName}</p>
              <p className="text-[9px] text-muted-foreground font-mono">{primaryGroup?.toUpperCase() || "USER"}</p>
            </div>
          </Link>
        )}

        <div className="flex items-center gap-1 px-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors",
                theme === opt.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <opt.icon className="w-3 h-3" />
            </button>
          ))}
        </div>

        {onSignOut && (
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <LogOut className="w-3 h-3" />
            <span className="text-[11px] font-medium">Sign Out</span>
          </button>
        )}

        <div className="flex items-center justify-between px-3 py-0.5">
          <p className="text-[9px] text-muted-foreground/50 font-mono">v4.1</p>
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <p className="text-[9px] text-primary/70 font-mono">LIVE</p>
          </div>
        </div>
      </div>
    </aside>
  );
}