/**
 * Index.tsx — Root page for the LRX Radar platform (v3.0 — Unified Attack Lifecycle).
 *
 * Architecture:
 *   Module A: Exposure & Context Engine (Pre-Attack)
 *   Module B: Active Correlation Matrix (Core Engine)
 *   Module C: Erasure & Interop Orchestrator (Mitigation)
 *   + Knowledge Base, Intelligence tools, and Monitoring modules
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronRight, Menu, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sidebar, type TabKey } from "@/components/radar/Sidebar";
import { ExposureEngine } from "@/components/radar/ExposureEngine";
import { CorrelationMatrix } from "@/components/radar/CorrelationMatrix";
import { ErasureOrchestrator } from "@/components/radar/ErasureOrchestrator";
import { InvestigationTracker } from "@/components/radar/InvestigationTracker";
import { KnowledgeBase } from "@/components/radar/KnowledgeBase";
import { ThreatHeatmap } from "@/components/radar/ThreatHeatmap";
import { AccountTakeover } from "@/components/radar/AccountTakeover";
import { EmailAuth } from "@/components/radar/EmailAuth";
import { ThreatStatistics } from "@/components/radar/ThreatStatistics";
import { UrgentThreatsNews } from "@/components/radar/UrgentThreatsNews";
import { ThreatBriefing } from "@/components/radar/ThreatBriefing";
import { ThreatChat } from "@/components/radar/ThreatChat";
import { SocialMediaMonitor } from "@/components/radar/SocialMediaMonitor";
import { DarkWebMonitor } from "@/components/radar/DarkWebMonitor";
import { AdminPanel } from "@/components/radar/AdminPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const tabOrder: TabKey[] = ["exposure", "correlation", "erasure", "investigations", "briefing", "chat", "heatmap", "social-monitor", "dark-web", "ato", "email", "stats", "urgent", "knowledge", "admin"];

const tabTitles: Record<TabKey, string> = {
  exposure: "Exposure & Context Engine",
  correlation: "Active Correlation Matrix",
  erasure: "Erasure & Interop Orchestrator",
  investigations: "Investigation Tracker",
  knowledge: "Knowledge Base",
  briefing: "AI Intelligence Briefing",
  chat: "Threat Intelligence Q&A",
  heatmap: "Global Threat Map",
  "social-monitor": "Social Media IOC Monitor",
  "dark-web": "Dark Web Monitor",
  ato: "Account Takeover War Room",
  email: "Email Auth Center",
  stats: "Threat Statistics",
  urgent: "Urgent Threats",
  admin: "Admin Panel",
};

const PULL_THRESHOLD = 80;

const Index = () => {
  const [currentTab, setCurrentTab] = useState<TabKey>("exposure");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef<number | null>(null);
  const isPulling = useRef(false);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("threats-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "threats" }, (payload) => {
        const threat = payload.new as { domain?: string; severity?: string; brand?: string };
        toast.error(`🚨 New ${threat.severity?.toUpperCase() || ""} threat detected`, {
          description: `${threat.brand || "Unknown"} — ${threat.domain || "unknown domain"}`,
          duration: 6000,
        });
        queryClient.invalidateQueries({ queryKey: ["threats"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "threat_news" }, (payload) => {
        const news = payload.new as { title?: string; severity?: string; cve_id?: string };
        toast.warning(`⚠️ New KEV: ${news.cve_id || ""}`, {
          description: news.title || "New actively exploited vulnerability",
          duration: 8000,
        });
        queryClient.invalidateQueries({ queryKey: ["threat_news"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    const currentIndex = tabOrder.indexOf(currentTab);
    if (direction === "left" && currentIndex < tabOrder.length - 1) {
      setCurrentTab(tabOrder[currentIndex + 1]);
    } else if (direction === "right" && currentIndex > 0) {
      setCurrentTab(tabOrder[currentIndex - 1]);
    }
  }, [currentTab]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    if (contentRef.current && contentRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current = false;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing || pullStartY.current === null) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 10 && contentRef.current && contentRef.current.scrollTop <= 0) {
      isPulling.current = true;
      setPullDistance(Math.min(dy * 0.5, PULL_THRESHOLD + 20));
    } else if (!isPulling.current) {
      pullStartY.current = null;
    }
  }, [isRefreshing]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPulling.current && pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.6);
      queryClient.invalidateQueries().then(() => {
        setTimeout(() => { setIsRefreshing(false); setPullDistance(0); }, 600);
      });
      isPulling.current = false;
      pullStartY.current = null;
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    setPullDistance(0);
    isPulling.current = false;
    pullStartY.current = null;

    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      handleSwipe(dx < 0 ? "left" : "right");
    }
  }, [handleSwipe, pullDistance, isRefreshing, queryClient]);

  const handleTabChange = (tab: TabKey) => {
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
        <Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onClose={() => setSidebarOpen(false)}
          isAdmin={isAdmin}
          userDisplayName={profile?.display_name}
          onSignOut={handleSignOut}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-noise">
        <header className="h-14 lg:h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-8 z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="hidden sm:flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <ChevronRight className="w-3 h-3 text-primary" />
              </div>
              <h2 className="text-base lg:text-lg font-bold text-foreground truncate">
                {tabTitles[currentTab]}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-full glow-radar transition-all">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-[10px] lg:text-xs font-mono text-primary font-medium hidden sm:inline">MONITORING</span>
              <span className="text-[10px] font-mono text-primary sm:hidden">LIVE</span>
            </div>
          </div>
        </header>

        {isMobile && pullDistance > 0 && (
          <div className="flex items-center justify-center overflow-hidden transition-all duration-150 bg-background/50" style={{ height: pullDistance }}>
            <RefreshCw
              className={`w-5 h-5 text-primary transition-transform duration-200 ${isRefreshing ? "animate-spin" : ""}`}
              style={{ transform: isRefreshing ? undefined : `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)`, opacity: Math.min(pullDistance / PULL_THRESHOLD, 1) }}
            />
            <span className="ml-2 text-xs font-mono text-muted-foreground">
              {isRefreshing ? "Refreshing…" : pullDistance >= PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
        )}

        <div
          ref={contentRef}
          className="flex-1 overflow-auto p-4 lg:p-8 scrollbar-cyber"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {currentTab === "exposure" && <ExposureEngine />}
          {currentTab === "correlation" && <CorrelationMatrix />}
          {currentTab === "erasure" && <ErasureOrchestrator />}
          {currentTab === "investigations" && <InvestigationTracker />}
          {currentTab === "knowledge" && <KnowledgeBase />}
          {currentTab === "briefing" && <ThreatBriefing />}
          {currentTab === "chat" && <ThreatChat />}
          {currentTab === "heatmap" && <ThreatHeatmap />}
          {currentTab === "social-monitor" && <SocialMediaMonitor />}
          {currentTab === "dark-web" && <DarkWebMonitor />}
          {currentTab === "ato" && <AccountTakeover />}
          {currentTab === "email" && <EmailAuth />}
          {currentTab === "stats" && <ThreatStatistics />}
          {currentTab === "urgent" && <UrgentThreatsNews />}
          {currentTab === "admin" && isAdmin && <AdminPanel />}
        </div>
      </main>
    </div>
  );
};

export default Index;
