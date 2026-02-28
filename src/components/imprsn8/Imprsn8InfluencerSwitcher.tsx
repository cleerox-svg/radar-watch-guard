/**
 * Imprsn8InfluencerSwitcher.tsx — Header component for admin/SOC to switch
 * between "All Influencers" aggregated view and individual influencer views.
 */

import { useImprsn8 } from "./Imprsn8Context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, User } from "lucide-react";

export function Imprsn8InfluencerSwitcher() {
  const { selectedId, setSelectedId, allInfluencers, isAdminView, isAllView, currentInfluencer } = useImprsn8();

  if (!isAdminView) return null;

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedId || "all"} onValueChange={setSelectedId}>
        <SelectTrigger className="h-8 w-56 text-xs border-amber-500/20 bg-card">
          <div className="flex items-center gap-2">
            {isAllView ? <Users className="w-3 h-3 text-amber-500" /> : <User className="w-3 h-3 text-amber-500" />}
            <SelectValue placeholder="Select view..." />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3" />
              <span>All Influencers</span>
            </div>
          </SelectItem>
          {allInfluencers.map((inf) => (
            <SelectItem key={inf.id} value={inf.id}>
              <div className="flex items-center gap-2">
                <User className="w-3 h-3" />
                <span>{inf.display_name}</span>
                {inf.brand_name && <span className="text-muted-foreground">({inf.brand_name})</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isAllView && (
        <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[9px]">
          AGGREGATED
        </Badge>
      )}
      {currentInfluencer && !isAllView && (
        <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[9px] uppercase">
          {currentInfluencer.subscription_tier}
        </Badge>
      )}
    </div>
  );
}
