import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Satellite, Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (authLoading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Authentication failed", { description: error.message });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Failed to send reset email", { description: error.message });
    } else {
      setResetSent(true);
      toast.success("Password reset email sent");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-noise p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto relative">
            <div className="absolute inset-0 bg-primary/5 rounded-2xl animate-pulse-slow" />
            <Satellite className="w-8 h-8 text-primary relative z-10" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider text-foreground">LRX RADAR</h1>
          <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">Analyst Authentication Required</p>
        </div>

        {/* Login form */}
        <form onSubmit={forgotMode ? handleForgotPassword : handleLogin} className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
            <Lock className="w-4 h-4 text-primary" />
            Secure Sign In
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="cleerox@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {forgotMode ? (
            <>
              <Button type="submit" className="w-full gap-2" disabled={loading || resetSent} onClick={handleForgotPassword}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {resetSent ? "Email Sent — Check Inbox" : loading ? "Sending…" : "Send Reset Link"}
              </Button>
              <button type="button" onClick={() => { setForgotMode(false); setResetSent(false); }} className="text-xs text-primary hover:underline w-full text-center">
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {loading ? "Authenticating..." : "Sign In"}
              </Button>
              <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-muted-foreground hover:text-primary w-full text-center">
                Forgot password?
              </button>
            </>
          )}

          <p className="text-[10px] text-center text-muted-foreground font-mono">
            Invite-only platform · Contact your admin for access
          </p>
        </form>
      </div>
    </div>
  );
}
