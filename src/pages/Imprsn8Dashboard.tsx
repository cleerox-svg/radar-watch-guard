/**
 * Imprsn8Dashboard.tsx — Main dashboard for imprsn8 platform.
 * Features collapsible sidebar, topbar with search + notifications,
 * and role-based module routing matching the reference prototype.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Menu, Search, Bell, Lock, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Imprsn8Provider, useImprsn8 } from "@/components/imprsn8/Imprsn8Context";
import { Imprsn8Sidebar, type Imprsn8TabKey } from "@/components/imprsn8/Imprsn8Sidebar";
import { Imprsn8InfluencerSwitcher } from "@/components/imprsn8/Imprsn8InfluencerSwitcher";
import { Imprsn8Overview } from "@/components/imprsn8/Imprsn8Overview";
import { Imprsn8MonitoredAccounts } from "@/components/imprsn8/Imprsn8MonitoredAccounts";
import { Imprsn8ThreatsFound } from "@/components/imprsn8/Imprsn8ThreatsFound";
import { Imprsn8Takedowns } from "@/components/imprsn8/Imprsn8Takedowns";
import { Imprsn8AgentsPanel } from "@/components/imprsn8/Imprsn8AgentsPanel";
import { Imprsn8Settings } from "@/components/imprsn8/Imprsn8Settings";
import { Imprsn8AllInfluencers } from "@/components/imprsn8/Imprsn8AllInfluencers";
import { Imprsn8AdminConsole } from "@/components/imprsn8/Imprsn8AdminConsole";
import { Imprsn8KnowledgeBase } from "@/components/imprsn8/Imprsn8KnowledgeBase";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/** Inner component that uses the Imprsn8 context */
function Imprsn8DashboardInner() {
  const [currentTab, setCurrentTab] = useState<Imprsn8TabKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const notifRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { profile, signOut, roles } = useAuth();
  const { isAdminView } = useImprsn8();

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);

  const handleTabChange = (tab: Imprsn8TabKey) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  };

  const primaryRole = roles[0] || "influencer";

  const renderContent = () => {
    switch (currentTab) {
      case "dashboard": return <Imprsn8Overview />;
      case "accounts": return <Imprsn8MonitoredAccounts />;
      case "threats": return <Imprsn8ThreatsFound />;
      case "takedowns": return <Imprsn8Takedowns />;
      case "agents": return isAdminView || primaryRole === "analyst" ? <Imprsn8AgentsPanel /> : <PlaceholderTab label="Access Denied" />;
      case "settings": return <Imprsn8Settings />;
      case "all_influencers": return isAdminView ? <Imprsn8AllInfluencers /> : <PlaceholderTab label="Access Denied" />;
      case "admin": return isAdminView ? <Imprsn8AdminConsole /> : <PlaceholderTab label="Access Denied" />;
      case "oci_vault": return <PlaceholderModule title="OCI Likeness Vault" subtitle="Biometric Identity Vectors · Perceptual Fingerprints · Clone Detection" />;
      case "feeds": return <PlaceholderModule title="Live Feed Configuration" subtitle="Real-time ingestion · Auto rate-limit control · Platform API management" />;
      case "access_mgmt": return <PlaceholderModule title="Access Management" subtitle="RBAC · MFA Enforcement · Module-level Permissions" />;
      case "knowledge_base": return <Imprsn8KnowledgeBase />;
      default: return null;
    }
  };

  /** Fake notification data */
  const notifications = [
    { msg: "CRITICAL: @zoehart1ey_real detected — 94% OCI match", time: "3m ago", color: "text-imprsn8-red" },
    { msg: "ARBITER: Takedown package ready — analyst review required", time: "5m ago", color: "text-imprsn8-orange" },
    { msg: "VERITAS: Likeness scan completed — 2 new clones", time: "12m ago", color: "text-imprsn8-purple-bright" },
    { msg: "WATCHDOG: All agents within approved TTP bounds", time: "1h ago", color: "text-imprsn8-green" },
    { msg: "SENTINEL-Alpha: 18,821 feeds scanned — 7 IOI alerts", time: "2h ago", color: "text-imprsn8-blue" },
  ];

  return (
    <div className="h-screen flex overflow-hidden relative bg-imprsn8-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-md z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Imprsn8Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onClose={() => setSidebarOpen(false)}
          userDisplayName={profile?.display_name}
          onSignOut={handleSignOut}
          userRole={primaryRole}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar — mirrors reference: search, LIVE badge, takedown alert, notifications */}
        <header className="h-[58px] bg-imprsn8-nav border-b border-imprsn8-nav-border flex items-center px-4 lg:px-5 gap-3 z-10 shrink-0">
          {/* Mobile menu button */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-accent text-imprsn8-text-muted transition-colors">
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-[340px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-imprsn8-text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threats, influencers, agents..."
                className="w-full py-2 pl-9 pr-3 rounded-lg border border-imprsn8-input-border bg-imprsn8-input-bg text-foreground text-[13px] placeholder:text-imprsn8-text-muted/65 focus:outline-none focus:border-imprsn8-purple transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* LIVE indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-imprsn8-green/10 border border-imprsn8-green/30 rounded-lg">
              <span className="relative flex h-[7px] w-[7px]">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-imprsn8-green opacity-75" />
                <span className="relative inline-flex rounded-full h-[7px] w-[7px] bg-imprsn8-green" />
              </span>
              <span className="text-xs font-bold text-imprsn8-green">LIVE</span>
            </div>

            {/* Pending takedowns alert */}
            <button
              onClick={() => handleTabChange("takedowns")}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-imprsn8-red/10 border border-imprsn8-red/30 rounded-lg text-xs font-bold text-imprsn8-red hover:bg-imprsn8-red/15 transition-colors"
            >
              <Lock className="w-[13px] h-[13px]" />
              <span>2 takedowns need review</span>
            </button>

            {/* Influencer switcher */}
            <Imprsn8InfluencerSwitcher />

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 border border-imprsn8-card-border rounded-lg text-imprsn8-text-muted hover:bg-accent transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-[5px] right-[5px] w-[7px] h-[7px] rounded-full bg-imprsn8-red border-2 border-imprsn8-nav" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-card border border-imprsn8-card-border rounded-xl shadow-xl z-50">
                  <div className="px-4 py-3 border-b border-imprsn8-divider font-bold text-foreground text-sm">Notifications</div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((n, i) => (
                      <div key={i} className={cn(
                        "flex gap-3 px-4 py-3",
                        i < notifications.length - 1 && "border-b border-imprsn8-divider"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", n.color.replace("text-", "bg-"))} />
                        <div className="flex-1">
                          <p className="text-xs text-foreground leading-relaxed">{n.msg}</p>
                          <p className="text-[11px] text-imprsn8-text-muted mt-1">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-imprsn8-divider">
                    <button className="w-full text-center text-xs text-imprsn8-purple-bright font-semibold hover:underline">
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 scrollbar-cyber">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

/** Wrapper that provides the Imprsn8 context */
const Imprsn8Dashboard = () => (
  <Imprsn8Provider>
    <Imprsn8DashboardInner />
  </Imprsn8Provider>
);

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-imprsn8-text-muted">
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** Placeholder for new modules — will be replaced with full implementations */
function PlaceholderModule({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[26px] font-extrabold text-foreground tracking-tight font-display">{title}</h1>
        <p className="text-[13px] text-imprsn8-text-muted mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed border-imprsn8-card-border rounded-2xl bg-imprsn8-purple-light/30">
        <div className="text-center">
          <div className="text-4xl mb-3">🚧</div>
          <p className="text-sm font-semibold text-foreground">Coming Soon</p>
          <p className="text-xs text-imprsn8-text-muted mt-1">This module is being built based on the reference prototype</p>
        </div>
      </div>
    </div>
  );
}

export default Imprsn8Dashboard;
