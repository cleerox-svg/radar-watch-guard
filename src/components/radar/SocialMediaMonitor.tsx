/**
 * SocialMediaMonitor.tsx — Social Media IOC Feed Monitor.
 * Displays IOCs collected from TweetFeed (infosec Twitter community)
 * with filtering, tag clouds, and IOC type breakdowns.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { RefreshCw, Search, Hash, Globe, Server, FileCode, AlertTriangle, TrendingUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function useSocialIocs() {
  return useQuery({
    queryKey: ["social_iocs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_iocs")
        .select("*")
        .order("date_shared", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

const iocTypeIcons: Record<string, typeof Globe> = {
  url: Globe,
  domain: Globe,
  ip: Server,
  sha256: FileCode,
  md5: FileCode,
};

const confidenceColors: Record<string, string> = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function SocialMediaMonitor() {
  const { data: iocs, isLoading } = useSocialIocs();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isIngesting, setIsIngesting] = useState(false);

  const handleIngest = async (timeRange: string = "week") => {
    setIsIngesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-tweetfeed", {
        body: { timeRange },
      });
      if (error) throw error;
      toast.success(`Ingested ${data.fetched} IOCs from TweetFeed`, {
        description: `${data.upserted} new records added (${timeRange})`,
      });
      queryClient.invalidateQueries({ queryKey: ["social_iocs"] });
    } catch (err: any) {
      toast.error("TweetFeed ingestion failed", { description: err.message });
    } finally {
      setIsIngesting(false);
    }
  };

  const filtered = (iocs || []).filter((ioc) => {
    const matchType = typeFilter === "all" || ioc.ioc_type === typeFilter;
    const matchSearch =
      !searchTerm ||
      ioc.ioc_value?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ioc.tags?.some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ioc.source_user?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchType && matchSearch;
  });

  // Stats
  const typeCounts = (iocs || []).reduce((acc: Record<string, number>, ioc) => {
    acc[ioc.ioc_type] = (acc[ioc.ioc_type] || 0) + 1;
    return acc;
  }, {});

  const tagCounts = (iocs || []).reduce((acc: Record<string, number>, ioc) => {
    (ioc.tags || []).forEach((t: string) => {
      acc[t] = (acc[t] || 0) + 1;
    });
    return acc;
  }, {});

  const topTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  const highConfCount = (iocs || []).filter((i) => i.confidence === "high").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Social Media IOC Monitor</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time threat indicators from the infosec community on X/Twitter
            </p>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="week" onValueChange={(v) => handleIngest(v)}>
              <SelectTrigger className="w-32 h-9 text-xs">
                <SelectValue placeholder="Ingest..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => handleIngest("week")}
              disabled={isIngesting}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isIngesting ? "animate-spin" : ""}`} />
              Pull Feed
            </Button>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total IOCs", value: (iocs || []).length, icon: TrendingUp },
          { label: "High Confidence", value: highConfCount, icon: AlertTriangle },
          { label: "URLs", value: typeCounts["url"] || 0, icon: Globe },
          { label: "IPs", value: typeCounts["ip"] || 0, icon: Server },
          { label: "Hashes", value: (typeCounts["sha256"] || 0) + (typeCounts["md5"] || 0), icon: FileCode },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-3 card-interactive">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <kpi.icon className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-wider font-medium">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feed">Live Feed</TabsTrigger>
          <TabsTrigger value="tags">Tag Cloud</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search IOCs, tags, users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="url">URLs</SelectItem>
                <SelectItem value="domain">Domains</SelectItem>
                <SelectItem value="ip">IPs</SelectItem>
                <SelectItem value="sha256">SHA256</SelectItem>
                <SelectItem value="md5">MD5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* IOC Table */}
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Loading IOC feed...</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No IOCs found. Click "Pull Feed" to ingest from TweetFeed.</p>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-cyber">
              {filtered.map((ioc, idx) => {
                const Icon = iocTypeIcons[ioc.ioc_type] || Globe;
                return (
                  <motion.div
                    key={ioc.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                  >
                    <Card className="p-3 card-interactive">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-sm font-mono text-foreground truncate max-w-[400px]">
                              {ioc.ioc_value}
                            </code>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {ioc.ioc_type}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${confidenceColors[ioc.confidence || "low"]}`}
                            >
                              {ioc.confidence}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {(ioc.tags || []).slice(0, 5).map((tag: string) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded"
                              >
                                <Hash className="w-2.5 h-2.5" />
                                {tag}
                              </span>
                            ))}
                            {ioc.source_user && (
                              <span className="text-[10px] text-muted-foreground">
                                by @{ioc.source_user}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {new Date(ioc.date_shared).toLocaleString()}
                            </span>
                            {ioc.source_url && (
                              <a
                                href={ioc.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tags">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Trending Threat Tags</h3>
            {topTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet. Ingest IOCs first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, count], i) => (
                  <motion.button
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => {
                      setSearchTerm(tag);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent/50 transition-colors"
                    style={{
                      fontSize: `${Math.max(11, Math.min(18, 11 + count))}px`,
                    }}
                  >
                    <Hash className="w-3 h-3 text-primary" />
                    <span className="text-foreground">{tag}</span>
                    <span className="text-muted-foreground text-[10px]">({count})</span>
                  </motion.button>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
