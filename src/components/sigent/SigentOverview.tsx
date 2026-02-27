/**
 * SigentOverview.tsx — Dashboard overview for influencer protection.
 * Shows key metrics, recent reports, and monitored account status.
 */

import { Shield, Users, AlertTriangle, FileText, Plus, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mockStats = [
  { label: "Monitored Accounts", value: "0", icon: Users, change: null },
  { label: "Impersonators Found", value: "0", icon: AlertTriangle, change: null },
  { label: "Active Takedowns", value: "0", icon: FileText, change: null },
  { label: "Protection Score", value: "—", icon: Shield, change: null },
];

export function SigentOverview() {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                Welcome to imprsn8
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Your social media identity protection platform powered by imprsn8. Add your verified accounts to start monitoring for impersonators across Twitter/X, Instagram, TikTok, and YouTube.
              </p>
            </div>
            <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[10px]">
              FREE TIER
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mockStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Get Started</CardTitle>
            <CardDescription className="text-xs">Add your first social media account to begin monitoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2 text-sm border-amber-500/20 hover:bg-amber-500/5">
              <Plus className="w-4 h-4 text-amber-500" />
              Add Twitter/X Account
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 text-sm border-amber-500/20 hover:bg-amber-500/5">
              <Plus className="w-4 h-4 text-amber-500" />
              Add Instagram Account
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 text-sm border-amber-500/20 hover:bg-amber-500/5">
              <Plus className="w-4 h-4 text-amber-500" />
              Add TikTok Account
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 text-sm border-amber-500/20 hover:bg-amber-500/5">
              <Plus className="w-4 h-4 text-amber-500" />
              Add YouTube Channel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Follower Reporting</CardTitle>
            <CardDescription className="text-xs">Share your unique report link so followers can alert you about fakes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-[10px] text-muted-foreground font-mono mb-1">YOUR REPORT LINK</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-foreground flex-1 truncate">
                  /imprsn8/report/your-token
                </code>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Add this link to your social media bios so followers can report impersonators directly to you.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">No activity yet. Add accounts to start monitoring.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
