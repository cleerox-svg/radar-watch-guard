/**
 * SigentDashboard.tsx — Main dashboard page for the Sigent influencer protection platform.
 * Shell layout with sidebar + content area, similar to the Radar Index page.
 */

import { useState, useCallback } from "react";
import { Menu, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SigentSidebar, type SigentTabKey } from "@/components/sigent/SigentSidebar";
import { SigentOverview } from "@/components/sigent/SigentOverview";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";

const tabTitles: Record<SigentTabKey, string> = {
  overview: "Protection Dashboard",
  accounts: "Monitored Accounts",
  reports: "Impersonation Reports",
  takedowns: "Takedown Requests",
  widget: "Report Widget",
  settings: "Account Settings",
};

const SigentDashboard = () => {
  const [currentTab, setCurrentTab] = useState<SigentTabKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);

  const handleTabChange = (tab: SigentTabKey) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
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
        <SigentSidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onClose={() => setSidebarOpen(false)}
          userDisplayName={profile?.display_name}
          onSignOut={handleSignOut}
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
          {currentTab === "overview" && <SigentOverview />}
          {currentTab === "accounts" && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p className="text-sm">Monitored Accounts — Coming soon</p>
            </div>
          )}
          {currentTab === "reports" && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p className="text-sm">Impersonation Reports — Coming soon</p>
            </div>
          )}
          {currentTab === "takedowns" && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p className="text-sm">Takedown Requests — Coming soon</p>
            </div>
          )}
          {currentTab === "widget" && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p className="text-sm">Report Widget Config — Coming soon</p>
            </div>
          )}
          {currentTab === "settings" && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p className="text-sm">Account Settings — Coming soon</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SigentDashboard;
