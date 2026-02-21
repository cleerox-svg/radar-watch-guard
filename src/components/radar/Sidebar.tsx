/**
 * Sidebar.tsx — Navigation filtered by user's access group module permissions.
 */

import { Satellite, X, Sun, Moon, Monitor, LogOut, Scan, Zap, Shield, BookOpen, Settings, Activity, Target, Globe, Radio, Skull, Brain, MessageSquare, BarChart3, AlertTriangle, ShieldCheck, UsersRound, Ticket, MailWarning, UserCircle, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
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
  | "investigations"
  | "heatmap"
  | "ato"
  | "email"
  | "stats"
  | "urgent"
  | "briefing"
  | "chat"
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

const navGroups: { label: string; items: { key: TabKey; icon: typeof Globe; label: string; description: string; accent?: string }[] }[] = [
  {
    label: "Detect & Respond",
    items: [
      { key: "exposure", icon: Scan, label: "Brand Exposure", description: "See where your brand is being targeted before attacks hit", accent: "text-cyan-500" },
      { key: "correlation", icon: Zap, label: "Signal Correlation", description: "Connect the dots across multiple threat signals", accent: "text-amber-500" },
      { key: "erasure", icon: Shield, label: "Takedown & Response", description: "Remove threats and coordinate your response", accent: "text-rose-500" },
      { key: "investigations", icon: Ticket, label: "Investigations", description: "Track ongoing cases and analyst work", accent: "text-violet-500" },
    ],
  },
  {
    label: "AI Insights",
    items: [
      { key: "briefing", icon: Brain, label: "Daily Briefing", description: "Your AI-written summary of today's threats", accent: "text-violet-500" },
      { key: "chat", icon: MessageSquare, label: "Ask the AI", description: "Get instant answers about your threat landscape", accent: "text-violet-400" },
    ],
  },
  {
    label: "Live Monitoring",
    items: [
      { key: "heatmap", icon: Globe, label: "Global Threat Map", description: "See threats plotted around the world in real time", accent: "text-emerald-500" },
      { key: "social-monitor", icon: Radio, label: "Social Feed", description: "Indicators shared by the security community", accent: "text-sky-500" },
      { key: "dark-web", icon: Skull, label: "Dark Web Alerts", description: "Check for leaked credentials and breach exposure", accent: "text-orange-500" },
      { key: "ato", icon: UsersRound, label: "Account Takeovers", description: "Track suspicious logins and hijacked accounts", accent: "text-pink-500" },
      { key: "email", icon: ShieldCheck, label: "Email Security", description: "Monitor SPF, DKIM, and DMARC compliance", accent: "text-emerald-400" },
      { key: "stats", icon: BarChart3, label: "Analytics", description: "Charts and trends across your threat data", accent: "text-sky-400" },
      { key: "urgent", icon: AlertTriangle, label: "Critical Alerts", description: "High-priority advisories that need attention now", accent: "text-amber-500" },
    ],
  },
  {
    label: "Help & Docs",
    items: [
      { key: "knowledge", icon: BookOpen, label: "Knowledge Base", description: "Guides, documentation, and API reference", accent: "text-muted-foreground" },
    ],
  },
];

const adminGroup = {
  label: "Platform Settings",
  items: [
    { key: "spam-traps" as TabKey, icon: MailWarning, label: "Spam Traps", description: "Honeypot intelligence from trap email addresses", accent: "text-amber-400" },
    { key: "admin" as TabKey, icon: Settings, label: "Admin Console", description: "Manage users, groups, and data feeds", accent: "text-muted-foreground" },
    { key: "leads" as TabKey, icon: UserPlus, label: "Leads", description: "Submissions from landing page forms", accent: "text-sky-400" },
  ],
};

const themeOptions = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
];

const coreModules = new Set<TabKey>(["exposure", "correlation", "erasure", "investigations"]);

export function Sidebar({ currentTab, onTabChange, onClose, isAdmin, userDisplayName, primaryGroup, onSignOut, hasModuleAccess }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Filter nav groups based on module access
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
    <aside className="w-64 h-full bg-card/95 backdrop-blur-xl border-r border-border flex flex-col z-20 shadow-xl">
      {/* Logo */}
      <div className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-6 border-b border-border">
        <Link to="/" className="flex items-center group">
          <div className="relative w-9 h-9 mr-3 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 rounded-xl animate-pulse-slow" />
            <div className="absolute inset-0 bg-primary/10 rounded-xl animate-ping-slow" />
            <Satellite className="w-5 h-5 text-primary relative z-10" />
          </div>
          <div>
            <span className="block text-lg font-extrabold tracking-wider text-foreground group-hover:text-primary transition-colors">LRX RADAR</span>
            <span className="block text-[10px] text-primary font-mono tracking-[0.2em] uppercase">Threat Intelligence</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 lg:py-4 space-y-4 overflow-y-auto scrollbar-cyber">
        {allGroups.map((group) => (
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
          <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors group">
            <UserCircle className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{userDisplayName}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{primaryGroup?.toUpperCase() || "USER"}</p>
            </div>
          </Link>
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
          <p className="text-[10px] text-muted-foreground font-mono">v3.1.0</p>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <p className="text-[10px] text-primary font-mono">ALL SYSTEMS OK</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
