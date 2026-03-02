/**
 * Imprsn8Sidebar.tsx — Collapsible navigation sidebar for imprsn8.
 * Supports role-based nav (admin/SOC/influencer/staff), icon-only collapse,
 * and the deep purple/gold design system from the reference prototype.
 */

import { X, Sun, Moon, Monitor, LogOut, UserCircle, LayoutDashboard, Users, AlertTriangle, FileText, Settings, Bot, Eye, Shield, Fingerprint, Radio, Key, BookOpen, Menu, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlatformSwitcher } from "@/components/PlatformSwitcher";
import { useImprsn8 } from "./Imprsn8Context";
import imprsn8Icon from "@/assets/imprsn8-icon.png";

export type Imprsn8TabKey =
  | "dashboard"
  | "accounts"
  | "threats"
  | "takedowns"
  | "agents"
  | "settings"
  | "all_influencers"
  | "admin"
  | "oci_vault"
  | "feeds"
  | "access_mgmt"
  | "knowledge_base";

interface Imprsn8SidebarProps {
  currentTab: Imprsn8TabKey;
  onTabChange: (tab: Imprsn8TabKey) => void;
  onClose?: () => void;
  userDisplayName?: string | null;
  onSignOut?: () => void;
  userRole?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  key: Imprsn8TabKey;
  icon: typeof Shield;
  label: string;
  description: string;
  badge?: boolean;
}

/** Role-based navigation — mirrors the reference JSX structure */
function getNavForRole(role: string, isAdminView: boolean): NavItem[] {
  if (role === "admin" || isAdminView) {
    return [
      { key: "dashboard", icon: LayoutDashboard, label: "Command Center", description: "Live stats, agent health, audit log" },
      { key: "threats", icon: AlertTriangle, label: "Threat Intel", description: "IOI feed, actor registry, attribution" },
      { key: "oci_vault", icon: Fingerprint, label: "OCI Vault", description: "Likeness fingerprints & clone detection" },
      { key: "agents", icon: Bot, label: "Agent Ops", description: "SENTINEL · RECON · VERITAS · NEXUS · ARBITER" },
      { key: "takedowns", icon: FileText, label: "Takedown Queue", description: "HITL review & platform filings", badge: true },
      { key: "feeds", icon: Radio, label: "Live Feeds", description: "Platform API ingestion & quota" },
      { key: "all_influencers", icon: Users, label: "Influencer Tenants", description: "Master roster & monitoring scope" },
      { key: "access_mgmt", icon: Key, label: "Access Mgmt", description: "RBAC, MFA, module permissions" },
      { key: "knowledge_base", icon: BookOpen, label: "Knowledge Base", description: "Guides, protocols, reference docs" },
      { key: "admin", icon: Settings, label: "Admin Console", description: "System health, licenses, config" },
    ];
  }

  if (role === "analyst") {
    return [
      { key: "dashboard", icon: LayoutDashboard, label: "Command Center", description: "Live stats, agent health, audit log" },
      { key: "threats", icon: AlertTriangle, label: "Threat Intel", description: "IOI feed, actor registry, attribution" },
      { key: "oci_vault", icon: Fingerprint, label: "OCI Vault", description: "Likeness fingerprints & clone detection" },
      { key: "agents", icon: Bot, label: "Agent Ops", description: "Agent health, runs & manual triggers" },
      { key: "takedowns", icon: FileText, label: "Takedown Queue", description: "HITL review & platform filings", badge: true },
      { key: "feeds", icon: Radio, label: "Live Feeds", description: "Platform API ingestion & quota" },
      { key: "all_influencers", icon: Users, label: "Influencer Tenants", description: "Master roster & monitoring scope" },
      { key: "knowledge_base", icon: BookOpen, label: "Knowledge Base", description: "Guides, protocols, reference docs" },
    ];
  }

  // Influencer view
  return [
    { key: "dashboard", icon: LayoutDashboard, label: "My Dashboard", description: "Protection overview & alerts" },
    { key: "oci_vault", icon: Fingerprint, label: "My Likeness Vault", description: "Your OCI fingerprints" },
    { key: "accounts", icon: Eye, label: "My Accounts", description: "Monitored social handles" },
    { key: "threats", icon: AlertTriangle, label: "My Alerts", description: "Impersonation reports" },
    { key: "takedowns", icon: FileText, label: "Takedown Status", description: "Removal request tracking" },
    { key: "knowledge_base", icon: BookOpen, label: "Knowledge Base", description: "Guides & documentation" },
    { key: "settings", icon: Settings, label: "Settings", description: "Profile & notification preferences" },
  ];
}

const themeOptions = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "Auto" },
];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  analyst: "SOC Analyst",
  influencer: "Influencer",
  customer: "Customer",
};
const roleIcons: Record<string, typeof Shield> = {
  admin: Key,
  analyst: Shield,
  influencer: Users,
  customer: Eye,
};

export function Imprsn8Sidebar({
  currentTab,
  onTabChange,
  onClose,
  userDisplayName,
  onSignOut,
  userRole = "influencer",
  collapsed = false,
  onToggleCollapse,
}: Imprsn8SidebarProps) {
  const { theme, setTheme } = useTheme();
  const { isAdminView } = useImprsn8();
  const navItems = getNavForRole(userRole, isAdminView);

  const RoleIcon = roleIcons[userRole] || Users;

  const renderItem = (item: NavItem) => {
    const active = currentTab === item.key;
    return (
      <Tooltip key={item.key}>
        <TooltipTrigger asChild>
          <button
            onClick={() => onTabChange(item.key)}
            className={cn(
              "flex items-center w-full transition-all duration-200 rounded-lg text-left group relative overflow-hidden",
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
              active
                ? "bg-imprsn8-purple-light text-foreground"
                : "text-imprsn8-text-muted hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {active && (
              <motion.div
                layoutId="imprsn8-sidebar-active"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-imprsn8-purple-bright rounded-full"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <div className="relative shrink-0">
              <item.icon className={cn(
                "w-[17px] h-[17px] transition-colors duration-200",
                !collapsed && "mr-2.5",
                active ? "text-imprsn8-purple-bright" : "group-hover:text-foreground"
              )} />
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-imprsn8-red border-2 border-imprsn8-nav" />
              )}
            </div>
            {!collapsed && (
              <>
                <span className={cn(
                  "text-[13px] truncate block transition-colors flex-1",
                  active ? "font-bold text-foreground" : "font-normal"
                )}>
                  {item.label}
                </span>
                {active && (
                  <div className="w-[5px] h-[5px] rounded-full bg-imprsn8-purple-bright shrink-0 ml-auto" />
                )}
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-[180px]">
          <div className="font-semibold">{item.label}</div>
          <div className="text-muted-foreground">{item.description}</div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside className={cn(
      "h-full bg-imprsn8-nav border-r border-imprsn8-nav-border flex flex-col z-20 shadow-xl transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo + collapse toggle */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-imprsn8-nav-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[10px] shrink-0 bg-gradient-to-br from-imprsn8-gold to-imprsn8-purple flex items-center justify-center shadow-lg">
            <img src={imprsn8Icon} alt="imprsn8" className="w-5 h-5 object-contain" />
          </div>
          {!collapsed && (
            <span className="font-display font-extrabold text-xl text-foreground tracking-tight whitespace-nowrap">
              imprsn<span className="text-imprsn8-gold-bright">8</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-accent text-imprsn8-text-muted transition-colors hidden lg:flex"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-accent text-imprsn8-text-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-3 py-2.5 border-b border-imprsn8-nav-border">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-imprsn8-purple-light border border-imprsn8-card-border rounded-lg">
            <RoleIcon className="w-3.5 h-3.5 text-imprsn8-purple-bright" />
            <span className="text-xs font-bold text-imprsn8-purple-bright whitespace-nowrap">
              {roleLabels[userRole] || userRole}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto scrollbar-cyber">
        {navItems.map(renderItem)}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-imprsn8-nav-border space-y-1.5">
        {/* User info */}
        <div className={cn("flex items-center gap-2.5", collapsed ? "justify-center" : "px-2")}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-imprsn8-gold to-imprsn8-purple flex items-center justify-center shrink-0">
            <span className="text-[11px] font-extrabold text-white">
              {userDisplayName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
            </span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-[13px] font-bold text-foreground truncate">{userDisplayName || "User"}</p>
                <p className="text-[11px] text-imprsn8-text-muted">{roleLabels[userRole] || userRole}</p>
              </div>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="p-1 rounded-lg text-imprsn8-text-muted hover:text-imprsn8-red hover:bg-destructive/10 transition-colors shrink-0"
                  title="Sign out"
                >
                  <LogOut className="w-[15px] h-[15px]" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Theme toggle */}
        {!collapsed && (
          <div className="flex items-center gap-1 px-1">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors",
                  theme === opt.value ? "bg-imprsn8-purple-light text-imprsn8-purple-bright" : "text-imprsn8-text-muted hover:bg-accent hover:text-foreground"
                )}
              >
                <opt.icon className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Status bar */}
        <div className={cn("flex items-center px-2 py-0.5", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <p className="text-[9px] text-imprsn8-text-dim font-mono">v2.0</p>}
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-imprsn8-green opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-imprsn8-green" />
            </span>
            {!collapsed && <p className="text-[9px] text-imprsn8-green font-mono font-bold">LIVE</p>}
          </div>
        </div>
      </div>
    </aside>
  );
}
