/**
 * Imprsn8Dashboard.tsx — Main dashboard for imprsn8 platform.
 * Wraps with Imprsn8Provider for influencer context. Admin/SOC see switcher + admin tabs.
 */

import { useState, useCallback } from "react";
import { Menu, ChevronRight } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";

const tabTitles: Record<Imprsn8TabKey, string> = {
  dashboard: "Protection Dashboard",
  accounts: "Monitored Accounts",
  threats: "Threats Found",
  takedowns: "Takedown Requests",
  agents: "AI Agents",
  settings: "Account Settings",
  all_influencers: "All Influencers",
  admin: "Admin Console",
};

/** Inner component that uses the Imprsn8 context */
function Imprsn8DashboardInner() {
  const [currentTab, setCurrentTab] = useState<Imprsn8TabKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { profile, signOut, roles } = useAuth();
  const { isAdminView } = useImprsn8();

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);

  const handleTabChange = (tab: Imprsn8TabKey) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (currentTab) {
      case "dashboard": return <Imprsn8Overview />;
      case "accounts": return <Imprsn8MonitoredAccounts />;
      case "threats": return <Imprsn8ThreatsFound />;
      case "takedowns": return <Imprsn8Takedowns />;
      case "agents": return <Imprsn8AgentsPanel />;
      case "settings": return <Imprsn8Settings />;
      case "all_influencers": return isAdminView ? <Imprsn8AllInfluencers /> : <PlaceholderTab label="Access Denied" />;
      case "admin": return isAdminView ? <Imprsn8AdminConsole /> : <PlaceholderTab label="Access Denied" />;
      default: return null;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden relative bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-md z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <Imprsn8Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onClose={() => setSidebarOpen(false)}
          userDisplayName={profile?.display_name}
          onSignOut={handleSignOut}
          userRole={roles[0] || "influencer"}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 lg:h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-2 sm:px-4 lg:px-8 z-10 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="hidden sm:flex h-6 w-6 items-center justify-center rounded-md bg-imprsn8/10 shrink-0">
                <ChevronRight className="w-3 h-3 text-imprsn8" />
              </div>
              <h2 className="text-sm sm:text-base lg:text-lg font-bold text-foreground truncate hidden sm:block">
                {tabTitles[currentTab]}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Imprsn8InfluencerSwitcher />
            <div className="flex items-center gap-1.5 sm:gap-2 bg-imprsn8/5 border border-imprsn8/20 px-2 sm:px-3 py-1.5 rounded-full transition-all shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-imprsn8 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-imprsn8" />
              </span>
              <span className="text-[10px] lg:text-xs font-mono text-imprsn8 font-medium hidden sm:inline">PROTECTED</span>
            </div>
          </div>
        </header>

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
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <p className="text-sm">{label}</p>
    </div>
  );
}

export default Imprsn8Dashboard;
