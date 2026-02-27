/**
 * SigentSidebar.tsx — Navigation sidebar for the Sigent influencer protection platform.
 * Uses warm amber/gold accent to differentiate from Trust Radar's emerald theme.
 */

import { Shield, X, Sun, Moon, Monitor, LogOut, UserCircle, LayoutDashboard, Users, AlertTriangle, FileText, Settings, Eye, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlatformSwitcher } from "@/components/PlatformSwitcher";

export type SigentTabKey =
  | "overview"
  | "accounts"
  | "reports"
  | "takedowns"
  | "widget"
  | "settings";

interface SigentSidebarProps {
  currentTab: SigentTabKey;
  onTabChange: (tab: SigentTabKey) => void;
  onClose?: () => void;
  userDisplayName?: string | null;
  onSignOut?: () => void;
}

const navItems: { key: SigentTabKey; icon: typeof Shield; label: string; description: string }[] = [
  { key: "overview", icon: LayoutDashboard, label: "Dashboard", description: "Protection overview & stats" },
  { key: "accounts", icon: Users, label: "My Accounts", description: "Managed social accounts" },
  { key: "reports", icon: AlertTriangle, label: "Impersonators", description: "Detected & reported fakes" },
  { key: "takedowns", icon: FileText, label: "Takedowns", description: "Removal request tracking" },
  { key: "widget", icon: Eye, label: "Report Widget", description: "Embeddable follower reporting" },
  { key: "settings", icon: Settings, label: "Settings", description: "Profile & subscription" },
];

const themeOptions = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "Auto" },
];

export function SigentSidebar({ currentTab, onTabChange, onClose, userDisplayName, onSignOut }: SigentSidebarProps) {
  const { theme, setTheme } = useTheme();

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
        <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-500">
          Protection
        </p>
        <div className="space-y-px">
          {navItems.map((item) => {
            const active = currentTab === item.key;
            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange(item.key)}
                    className={cn(
                      "flex items-center w-full px-3 py-2 transition-all duration-200 rounded-lg text-left group relative overflow-hidden",
                      active
                        ? "bg-amber-500/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="sigent-sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-amber-500 rounded-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <item.icon className={cn(
                      "w-3.5 h-3.5 mr-2.5 shrink-0 transition-colors duration-200",
                      active ? "text-amber-500" : "group-hover:text-foreground"
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
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-border space-y-1.5">
        {userDisplayName && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg">
            <UserCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{userDisplayName}</p>
              <p className="text-[9px] text-amber-500/70 font-mono">INFLUENCER</p>
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
                theme === opt.value ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
          <p className="text-[9px] text-muted-foreground/50 font-mono">v1.0</p>
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
            <p className="text-[9px] text-amber-500/70 font-mono">GUARDING</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
