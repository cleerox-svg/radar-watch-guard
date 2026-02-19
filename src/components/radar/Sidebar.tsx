/**
 * Sidebar.tsx — Redesigned navigation for the unified attack lifecycle architecture.
 * 
 * Module A: Exposure & Context Engine (Pre-Attack)
 * Module B: Active Correlation Matrix (Core Engine)
 * Module C: Erasure & Interop Orchestrator (Mitigation)
 * Knowledge Base: Technical documentation & API instructions
 */

import { Satellite, X, Sun, Moon, Monitor, LogOut, Scan, Zap, Shield, BookOpen, Settings, Activity, Target, Globe, Radio, Skull, Brain, MessageSquare, BarChart3, AlertTriangle, ShieldCheck, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type TabKey =
  | "exposure"
  | "correlation"
  | "erasure"
  | "knowledge"
  // Sub-views within modules (accessible from sidebar)
  | "heatmap"
  | "ato"
  | "email"
  | "stats"
  | "urgent"
  | "briefing"
  | "chat"
  | "social-monitor"
  | "dark-web"
  | "admin";

interface SidebarProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onClose?: () => void;
  isAdmin?: boolean;
  userDisplayName?: string | null;
  onSignOut?: () => void;
}

const navGroups: { label: string; items: { key: TabKey; icon: typeof Globe; label: string; description: string; accent?: string }[] }[] = [
  {
    label: "Attack Lifecycle",
    items: [
      { key: "exposure", icon: Scan, label: "Exposure Engine", description: "Pre-attack brand risk & context mapping", accent: "text-cyan-500" },
      { key: "correlation", icon: Zap, label: "Correlation Matrix", description: "Unified cross-signal campaign detection", accent: "text-amber-500" },
      { key: "erasure", icon: Shield, label: "Erasure Orchestrator", description: "Automated mitigation & interop", accent: "text-rose-500" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { key: "briefing", icon: Brain, label: "AI Briefing", description: "AI-generated threat report" },
      { key: "chat", icon: MessageSquare, label: "AI Q&A", description: "Ask about your threats" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { key: "heatmap", icon: Globe, label: "Threat Map", description: "Global threat visualization" },
      { key: "social-monitor", icon: Radio, label: "Social IOC Feed", description: "Community IOC monitor" },
      { key: "dark-web", icon: Skull, label: "Dark Web Monitor", description: "Breach & credential checks" },
      { key: "ato", icon: UsersRound, label: "ATO War Room", description: "Account takeover tracking" },
      { key: "email", icon: ShieldCheck, label: "Email Auth (DMARC)", description: "SPF/DKIM/DMARC reports" },
      { key: "stats", icon: BarChart3, label: "Statistics", description: "Analytics dashboard" },
      { key: "urgent", icon: AlertTriangle, label: "Urgent Threats", description: "Critical advisories" },
    ],
  },
  {
    label: "Resources",
    items: [
      { key: "knowledge", icon: BookOpen, label: "Knowledge Base", description: "Platform docs & API reference" },
    ],
  },
];

const adminGroup = {
  label: "Administration",
  items: [
    { key: "admin" as TabKey, icon: Settings, label: "Admin Panel", description: "Invite & manage analysts" },
  ],
};

const themeOptions = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
];

// Core modules get special visual treatment
const coreModules = new Set<TabKey>(["exposure", "correlation", "erasure"]);

export function Sidebar({ currentTab, onTabChange, onClose, isAdmin, userDisplayName, onSignOut }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  return (
    <aside className="w-64 h-full bg-card/95 backdrop-blur-xl border-r border-border flex flex-col z-20 shadow-xl">
      {/* Logo */}
      <div className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-6 border-b border-border">
        <div className="flex items-center">
          <div className="relative w-9 h-9 mr-3 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 rounded-xl animate-pulse-slow" />
            <div className="absolute inset-0 bg-primary/10 rounded-xl animate-ping-slow" />
            <Satellite className="w-5 h-5 text-primary relative z-10" />
          </div>
          <div>
            <span className="block text-lg font-extrabold tracking-wider text-foreground">LRX RADAR</span>
            <span className="block text-[10px] text-primary font-mono tracking-[0.2em] uppercase">Unified Defense</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 lg:py-4 space-y-4 overflow-y-auto scrollbar-cyber">
        {[...navGroups, ...(isAdmin ? [adminGroup] : [])].map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = currentTab === item.key;
                const isCore = coreModules.has(item.key);
                return (
                  <Tooltip key={item.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onTabChange(item.key)}
                        className={cn(
                          "flex items-center w-full px-3 py-2.5 transition-all duration-200 rounded-lg text-left group relative overflow-hidden",
                          active
                            ? "bg-primary/10 text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          isCore && !active && "hover:bg-accent/70"
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-full"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                        <item.icon className={cn(
                          "w-4 h-4 mr-3 shrink-0 transition-colors duration-200",
                          active ? "text-primary" : (item as any).accent || "group-hover:text-foreground"
                        )} />
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "font-medium text-sm truncate block transition-colors",
                            active && "text-foreground",
                            isCore && !active && "font-semibold"
                          )}>
                            {item.label}
                          </span>
                        </div>
                        {isCore && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs max-w-[200px]">
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
      <div className="px-3 py-3 border-t border-border space-y-3">
        {userDisplayName && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-foreground truncate">{userDisplayName}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{isAdmin ? "ADMIN" : "ANALYST"}</p>
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all"
          >
            {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : theme === "light" ? <Sun className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
            <span className="font-medium capitalize">{theme} Mode</span>
          </button>
          <AnimatePresence>
            {showThemeMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-50"
              >
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setTheme(opt.value); setShowThemeMenu(false); }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors",
                      theme === opt.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {onSignOut && (
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="font-medium">Sign Out</span>
          </button>
        )}

        <div className="flex items-center justify-between px-3">
          <p className="text-[10px] text-muted-foreground font-mono">v3.0.0</p>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <p className="text-[10px] text-primary font-mono">SIGNALS OK</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
