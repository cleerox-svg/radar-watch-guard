/**
 * Imprsn8Sidebar.tsx — Navigation sidebar for imprsn8 with purple/gold branding.
 * Uses the imprsn8 design tokens for a distinctive look separate from Trust Radar.
 */

import { X, Sun, Moon, Monitor, LogOut, UserCircle, LayoutDashboard, Users, AlertTriangle, FileText, Settings, Bot, Eye, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlatformSwitcher } from "@/components/PlatformSwitcher";
import { useImprsn8 } from "./Imprsn8Context";

export type Imprsn8TabKey =
  | "dashboard"
  | "accounts"
  | "threats"
  | "takedowns"
  | "agents"
  | "settings"
  | "all_influencers"
  | "admin";

interface Imprsn8SidebarProps {
  currentTab: Imprsn8TabKey;
  onTabChange: (tab: Imprsn8TabKey) => void;
  onClose?: () => void;
  userDisplayName?: string | null;
  onSignOut?: () => void;
  userRole?: string;
}

interface NavItem {
  key: Imprsn8TabKey;
  icon: typeof Shield;
  label: string;
  description: string;
  section: "main" | "admin";
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard", description: "Protection overview & alerts", section: "main" },
  { key: "accounts", icon: Eye, label: "Monitored Accounts", description: "Monitored social handles & scan status", section: "main" },
  { key: "threats", icon: AlertTriangle, label: "Threats Found", description: "Impersonation reports from all agents", section: "main" },
  { key: "takedowns", icon: FileText, label: "Takedowns", description: "Removal request tracking", section: "main" },
  { key: "agents", icon: Bot, label: "AI Agents", description: "Agent health, runs & manual triggers", section: "main" },
  { key: "settings", icon: Settings, label: "Settings", description: "Profile & notification preferences", section: "main" },
  { key: "all_influencers", icon: Users, label: "All Influencers", description: "Master roster of all influencers", section: "admin", adminOnly: true },
  { key: "admin", icon: Shield, label: "Admin Console", description: "Users, groups, feeds & access control", section: "admin", adminOnly: true },
];

const themeOptions = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "Auto" },
];

export function Imprsn8Sidebar({ currentTab, onTabChange, onClose, userDisplayName, onSignOut, userRole }: Imprsn8SidebarProps) {
  const { theme, setTheme } = useTheme();
  const { isAdminView } = useImprsn8();

  const mainItems = navItems.filter((item) => item.section === "main");
  const adminItems = navItems.filter((item) => item.section === "admin");

  const renderItem = (item: NavItem) => {
    const active = currentTab === item.key;
    return (
      <Tooltip key={item.key}>
        <TooltipTrigger asChild>
          <button
            onClick={() => onTabChange(item.key)}
            className={cn(
              "flex items-center w-full px-3 py-2 transition-all duration-200 rounded-lg text-left group relative overflow-hidden",
              active
                ? "bg-imprsn8-purple-light text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {active && (
              <motion.div
                layoutId="imprsn8-sidebar-active"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-imprsn8 rounded-full"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <item.icon className={cn(
              "w-3.5 h-3.5 mr-2.5 shrink-0 transition-colors duration-200",
              active ? "text-imprsn8" : "group-hover:text-foreground"
            )} />
            <span className={cn(
              "text-[13px] truncate block transition-colors",
              active ? "font-semibold text-foreground" : "font-medium"
            )}>
              {item.label}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-[180px]">
          {item.description}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside className="w-60 h-full bg-card/95 backdrop-blur-xl border-r border-border flex flex-col z-20 shadow-xl">
      {/* Platform Switcher */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <PlatformSwitcher className="flex-1" />
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto scrollbar-cyber">
        <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-imprsn8">
          Protection
        </p>
        <div className="space-y-px">
          {mainItems.map(renderItem)}
        </div>

        {isAdminView && (
          <>
            <div className="my-3 mx-3 border-t border-border" />
            <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-imprsn8/70">
              Administration
            </p>
            <div className="space-y-px">
              {adminItems.map(renderItem)}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-border space-y-1.5">
        {userDisplayName && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg">
            <UserCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{userDisplayName}</p>
              <p className="text-[9px] text-imprsn8/70 font-mono uppercase">{userRole || "INFLUENCER"}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 px-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors",
                theme === opt.value ? "bg-imprsn8-gold-dim text-imprsn8" : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
          <p className="text-[9px] text-muted-foreground/50 font-mono">v2.0</p>
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-imprsn8 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-imprsn8" />
            </span>
            <p className="text-[9px] text-imprsn8/70 font-mono">GUARDING</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
