/**
 * Imprsn8Dashboard.tsx — Main dashboard page for the imprsn8 influencer protection platform.
 * Shell layout with sidebar + content area. Admin users see extra management tabs.
 */

import { useState, useCallback } from "react";
import { Menu, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Imprsn8Sidebar, type Imprsn8TabKey } from "@/components/imprsn8/Imprsn8Sidebar";
import { Imprsn8Overview } from "@/components/imprsn8/Imprsn8Overview";
import { Imprsn8MonitoredAccounts } from "@/components/imprsn8/Imprsn8MonitoredAccounts";
import { Imprsn8Reports } from "@/components/imprsn8/Imprsn8Reports";
import { Imprsn8Takedowns } from "@/components/imprsn8/Imprsn8Takedowns";
import { Imprsn8Settings } from "@/components/imprsn8/Imprsn8Settings";
import { Imprsn8AdminPanel } from "@/components/imprsn8/Imprsn8AdminPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";

const tabTitles: Record<Imprsn8TabKey, string> = {
  overview: "Protection Dashboard",
  accounts: "Monitored Accounts",
  reports: "Impersonation Reports",
  takedowns: "Takedown Requests",
  widget: "Report Widget",
  settings: "Account Settings",
  admin: "imprsn8 Admin",
};

const Imprsn8Dashboard = () => {
  const [currentTab, setCurrentTab] = useState<Imprsn8TabKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin } = useAuth();

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
      case "overview": return <Imprsn8Overview />;
      case "accounts": return <Imprsn8MonitoredAccounts />;
      case "reports": return <Imprsn8Reports />;
      case "takedowns": return <Imprsn8Takedowns />;
      case "settings": return <Imprsn8Settings />;
      case "admin": return isAdmin ? <Imprsn8AdminPanel /> : <PlaceholderTab label="Access Denied" />;
      case "widget": return <PlaceholderTab label="Report Widget Config — Coming soon" />;
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
          isAdmin={isAdmin}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 lg:h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-8 z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="hidden sm:flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
                <ChevronRight className="w-3 h-3 text-amber-500" />
              </div>
              <h2 className="text-base lg:text-lg font-bold text-foreground truncate">
                {tabTitles[currentTab]}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 rounded-full transition-all">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-[10px] lg:text-xs font-mono text-amber-500 font-medium hidden sm:inline">PROTECTED</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 scrollbar-cyber">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <p className="text-sm">{label}</p>
    </div>
  );
}

export default Imprsn8Dashboard;
