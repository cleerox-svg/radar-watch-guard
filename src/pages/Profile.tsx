/**
 * Profile.tsx — User profile management page.
 * Allows users to update their name, view email/role, and reset password.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Shield, Lock, Save, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, roles, primaryGroup, refetchProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  /** Populate form from profile on load */
  useEffect(() => {
    if (profile) {
      setFirstName((profile as any).first_name ?? "");
      setLastName((profile as any).last_name ?? "");
    }
  }, [profile]);

  /** Save first/last name to profiles table */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null,
      } as any)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to save profile", { description: error.message });
    } else {
      toast.success("Profile updated");
      refetchProfile();
    }
    setSaving(false);
  };

  /** Send password reset email */
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Failed to send reset email", { description: error.message });
    } else {
      setResetSent(true);
      toast.success("Password reset email sent — check your inbox");
    }
    setResetSending(false);
  };

  const roleLabel = roles.length > 0
    ? roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")
    : "User";

  return (
    <div className="min-h-screen bg-background bg-noise">
      {/* Top bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-6 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm font-bold text-foreground tracking-wide">My Profile</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Name form */}
        <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <User className="w-4 h-4 text-primary" />
            Personal Information
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">First Name</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Last Name</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                maxLength={50}
              />
            </div>
          </div>

          <Button type="submit" size="sm" className="gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>

        {/* Account info (read-only) */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mail className="w-4 h-4 text-primary" />
            Account Details
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Email Address</span>
              <p className="text-sm text-foreground font-mono bg-muted/50 rounded-lg px-3 py-2">{user?.email ?? "—"}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Access Type</span>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">{roleLabel}</p>
                <span className="text-xs text-muted-foreground">· {primaryGroup}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Password reset */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="w-4 h-4 text-primary" />
            Password & Security
          </div>
          <p className="text-xs text-muted-foreground">
            Click below to receive a password reset link at your email address.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={resetSending || resetSent}
            onClick={handlePasswordReset}
          >
            {resetSent ? (
              <><CheckCircle className="w-4 h-4 text-primary" /> Reset Email Sent</>
            ) : resetSending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
            ) : (
              <><Mail className="w-4 h-4" /> Send Password Reset Link</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
