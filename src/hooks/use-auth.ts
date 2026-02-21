import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  title: string | null;
  team: string | null;
  idle_timeout_minutes: number | null;
  revoked_at: string | null;
}

interface UserRole {
  role: "admin" | "analyst" | "customer";
}

interface AccessGroup {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface GroupAssignment {
  group_id: string;
  access_groups: AccessGroup;
}

interface ModulePermission {
  module_key: string;
  has_access: boolean;
  group_id: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [allowedModules, setAllowedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const [profileRes, rolesRes, groupsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_group_assignments")
        .select("group_id, access_groups(id, name, description, is_system)")
        .eq("user_id", userId),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (rolesRes.data) setRoles((rolesRes.data as UserRole[]).map((r) => r.role));

    // Process group assignments and module permissions
    if (groupsRes.data && groupsRes.data.length > 0) {
      const userGroups = (groupsRes.data as any[])
        .map((ga: any) => ga.access_groups)
        .filter(Boolean);
      setGroups(userGroups);

      // Fetch module permissions for all assigned groups
      const groupIds = userGroups.map((g: AccessGroup) => g.id);
      const { data: permsData } = await supabase
        .from("group_module_permissions")
        .select("module_key, has_access, group_id")
        .in("group_id", groupIds)
        .eq("has_access", true);

      if (permsData) {
        const modules = new Set<string>();
        (permsData as ModulePermission[]).forEach((p) => {
          if (p.has_access) modules.add(p.module_key);
        });
        setAllowedModules(modules);
      }
    } else {
      setGroups([]);
      setAllowedModules(new Set());
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Log login event on SIGNED_IN
        if (_event === "SIGNED_IN") {
          supabase.from("session_events").insert({
            user_id: session.user.id,
            event_type: "login",
          }).then(() => {});
        }
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setGroups([]);
        setAllowedModules(new Set());
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    // Log session event before signing out
    if (user) {
      await supabase.from("session_events").insert({
        user_id: user.id,
        event_type: "logout",
      }).then(() => {});
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setGroups([]);
    setAllowedModules(new Set());
  }, [user]);

  const isAdmin = roles.includes("admin");

  /** Check if user has access to a specific module */
  const hasModuleAccess = useCallback((moduleKey: string) => {
    // Admins always have full access
    if (isAdmin) return true;
    return allowedModules.has(moduleKey);
  }, [isAdmin, allowedModules]);

  /** Get the primary group name for display */
  const primaryGroup = groups.length > 0 ? groups[0].name : (isAdmin ? "Admin" : roles.includes("analyst") ? "Analyst" : "User");

  return {
    user,
    session,
    profile,
    roles,
    groups,
    allowedModules,
    isAdmin,
    loading,
    signOut,
    hasModuleAccess,
    primaryGroup,
    refetchProfile: () => user && fetchProfile(user.id),
  };
}
