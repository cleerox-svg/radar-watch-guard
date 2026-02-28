/**
 * Imprsn8Context.tsx — Influencer context provider for imprsn8.
 * Manages which influencer is being viewed (single or "all" for admins).
 * Provides influencer profiles, selection state, and query helpers.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface InfluencerProfile {
  id: string;
  user_id: string;
  display_name: string;
  brand_name: string | null;
  avatar_url: string | null;
  subscription_tier: string;
  max_monitored_accounts: number | null;
  onboarding_completed: boolean | null;
  created_at: string;
}

interface Imprsn8ContextValue {
  /** "all" for aggregated admin view, or a specific influencer UUID */
  selectedId: string;
  setSelectedId: (id: string) => void;
  /** Whether currently viewing all influencers (admin only) */
  isAllView: boolean;
  /** The currently selected influencer profile (null in "all" view) */
  currentInfluencer: InfluencerProfile | null;
  /** All influencer profiles (admin only, empty for influencers) */
  allInfluencers: InfluencerProfile[];
  /** The logged-in user's own influencer profile */
  ownProfile: InfluencerProfile | null;
  /** Whether the current user is admin/SOC */
  isAdminView: boolean;
  /** Loading state */
  loading: boolean;
  /** Helper: returns filter object for queries — { influencer_id: uuid } or empty for "all" */
  getInfluencerFilter: () => { influencer_id?: string };
}

const Imprsn8Context = createContext<Imprsn8ContextValue | null>(null);

export function Imprsn8Provider({ children }: { children: ReactNode }) {
  const { user, isAdmin, roles } = useAuth();
  const isAdminView = isAdmin || roles.includes("analyst");

  const [selectedId, setSelectedId] = useState<string>(isAdminView ? "all" : "");

  /** Fetch all influencer profiles (admin/analyst) */
  const { data: allInfluencers = [], isLoading: loadingAll } = useQuery({
    queryKey: ["imprsn8-all-influencers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_profiles")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return data as InfluencerProfile[];
    },
    enabled: isAdminView,
  });

  /** Fetch own influencer profile (non-admin) */
  const { data: ownProfile = null, isLoading: loadingOwn } = useQuery({
    queryKey: ["imprsn8-own-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as InfluencerProfile | null;
    },
    enabled: !!user,
  });

  // For non-admins, lock to their own profile
  const effectiveId = isAdminView ? selectedId : (ownProfile?.id ?? "");
  const isAllView = effectiveId === "all";

  const currentInfluencer = isAllView
    ? null
    : allInfluencers.find((i) => i.id === effectiveId) ?? ownProfile;

  const getInfluencerFilter = useCallback(() => {
    if (isAllView) return {};
    if (effectiveId) return { influencer_id: effectiveId };
    return {};
  }, [isAllView, effectiveId]);

  return (
    <Imprsn8Context.Provider
      value={{
        selectedId: effectiveId,
        setSelectedId,
        isAllView,
        currentInfluencer,
        allInfluencers,
        ownProfile,
        isAdminView,
        loading: loadingAll || loadingOwn,
        getInfluencerFilter,
      }}
    >
      {children}
    </Imprsn8Context.Provider>
  );
}

export function useImprsn8() {
  const ctx = useContext(Imprsn8Context);
  if (!ctx) throw new Error("useImprsn8 must be used inside Imprsn8Provider");
  return ctx;
}
