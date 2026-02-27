/**
 * SigentSettings.tsx — Influencer account settings: profile, brand info, notification prefs.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Save, Shield } from "lucide-react";

export function SigentSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["influencer-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [displayName, setDisplayName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [reportEmail, setReportEmail] = useState("");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBrandName(profile.brand_name ?? "");
      setBio(profile.bio ?? "");
      setWebsite(profile.website_url ?? "");
      setReportEmail(profile.report_email ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("influencer_profiles")
        .update({
          display_name: displayName,
          brand_name: brandName,
          bio,
          website_url: website,
          report_email: reportEmail,
        })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer-profile"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-32" /></Card>)}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" /> Profile Settings
          </CardTitle>
          <CardDescription className="text-xs">Manage your influencer identity and brand info</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Brand Name</Label>
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand or alias" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short description" rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Report Email</Label>
              <Input value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} placeholder="alerts@..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-amber-500/30 text-amber-500 uppercase">
              {profile?.subscription_tier ?? "free"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {profile?.max_monitored_accounts ?? 3} monitored accounts included
            </span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
        <Save className="w-4 h-4" />
        {save.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
