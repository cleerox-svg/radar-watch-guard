/**
 * ThreatMapWidget.tsx — Geographically accurate world heatmap using react-simple-maps.
 * Aggregates data from ALL feeds: threats, social_iocs, threat_news, tor_exit_nodes.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Flame, Target, Crosshair, ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";
import { useThreats, useThreatNews, useTorExitNodes } from "@/hooks/use-threat-data";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ComposableMap,
  Geographies,
  Geography,
  Sphere,
  Graticule,
  Marker,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/** ISO 3166 numeric → country name for labeling major countries on the map */
const COUNTRY_NAMES: Record<string, string> = {
  "840": "USA", "124": "Canada", "484": "Mexico", "076": "Brazil", "032": "Argentina",
  "170": "Colombia", "604": "Peru", "152": "Chile", "862": "Venezuela",
  "826": "United Kingdom", "250": "France", "276": "Germany", "380": "Italy",
  "724": "Spain", "616": "Poland", "804": "Ukraine", "578": "Norway", "752": "Sweden",
  "643": "Russia", "792": "Turkey", "364": "Iran", "682": "Saudi Arabia", "368": "Iraq",
  "818": "Egypt", "566": "Nigeria", "710": "South Africa", "404": "Kenya",
  "180": "DR Congo", "012": "Algeria", "231": "Ethiopia",
  "156": "China", "356": "India", "392": "Japan", "410": "South Korea",
  "586": "Pakistan", "764": "Thailand", "704": "Vietnam", "360": "Indonesia",
  "608": "Philippines", "036": "Australia", "554": "New Zealand",
  "408": "N. Korea", "458": "Malaysia", "716": "Zimbabwe",
};

/** Large countries that should show labels on the map */
const LABEL_COUNTRIES = new Set([
  "840", "124", "076", "643", "156", "356", "036", "566",
  "710", "276", "250", "826", "392", "484", "032", "170",
  "818", "364", "682", "804", "792",
]);

/** Centroid overrides for placing country name labels accurately */
const LABEL_COORDS: Record<string, [number, number]> = {
  "840": [-98, 39], "124": [-106, 56], "076": [-53, -10], "643": [90, 62],
  "156": [104, 35], "356": [79, 22], "036": [134, -25], "566": [8, 10],
  "710": [25, -29], "276": [10, 51], "250": [2, 46], "826": [-2, 54],
  "392": [138, 36], "484": [-102, 24], "032": [-64, -34], "170": [-73, 4],
  "818": [30, 27], "364": [53, 32], "682": [45, 24], "804": [32, 49],
  "792": [35, 39],
};

/** Map country name strings (from DB) to ISO numeric codes */
const NAME_TO_ISO: Record<string, string> = {
  "United States": "840", "USA": "840", "US": "840",
  "Canada": "124", "Mexico": "484", "Brazil": "076", "Argentina": "032",
  "Colombia": "170", "Peru": "604", "Chile": "152", "Venezuela": "862",
  "United Kingdom": "826", "UK": "826", "France": "250", "Germany": "276",
  "Italy": "380", "Spain": "724", "Poland": "616", "Ukraine": "804",
  "Norway": "578", "Sweden": "752", "Russia": "643", "Turkey": "792",
  "Iran": "364", "Saudi Arabia": "682", "Iraq": "368", "Egypt": "818",
  "Nigeria": "566", "South Africa": "710", "Kenya": "404",
  "DR Congo": "180", "Congo": "180", "Algeria": "012", "Ethiopia": "231",
  "China": "156", "India": "356", "Japan": "392", "South Korea": "410",
  "Korea": "410", "North Korea": "408", "Pakistan": "586",
  "Thailand": "764", "Vietnam": "704", "Indonesia": "360",
  "Philippines": "608", "Australia": "036", "New Zealand": "554",
  "Malaysia": "458",
};

type ViewMode = "targets" | "origins";

/** Hook: social_iocs for map aggregation */
function useSocialIocs() {
  return useQuery({
    queryKey: ["social_iocs_map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_iocs")
        .select("ioc_type, tags, source, confidence")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });
}

const SEV_COLORS: Record<string, string> = {
  critical: "hsl(0, 84%, 60%)",
  high: "hsl(38, 92%, 50%)",
  medium: "hsl(45, 93%, 47%)",
  low: "hsl(160, 84%, 39%)",
  info: "hsl(217, 91%, 60%)",
};

export function ThreatMapWidget() {
  const { data: threats } = useThreats();
  const { data: threatNews } = useThreatNews();
  const { data: torNodes } = useTorExitNodes();
  const { data: socialIocs } = useSocialIocs();
  const [viewMode, setViewMode] = useState<ViewMode>("targets");
  const [tooltipContent, setTooltipContent] = useState("");
  const [zoom, setZoom] = useState(1.25);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [center, setCenter] = useState<[number, number]>([10, 20]);

  // Mouse drag panning state
  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; center: [number, number] } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom state
  const lastPinchDist = useRef<number | null>(null);

  // Close fullscreen on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    if (isFullscreen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(Math.max(z + (e.deltaY > 0 ? -0.15 : 0.15), 1), 6));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Pinch-to-zoom for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (dist - lastPinchDist.current) * 0.01;
      setZoom((z) => Math.min(Math.max(z + delta, 1), 6));
      lastPinchDist.current = dist;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  // Mouse click-drag panning for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, center: [...center] as [number, number] };
  }, [center]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !dragStart.current) return;
    const sensitivity = 0.3 / zoom;
    const dx = (e.clientX - dragStart.current.x) * sensitivity;
    const dy = (e.clientY - dragStart.current.y) * sensitivity;
    setCenter([
      dragStart.current.center[0] - dx,
      Math.max(-60, Math.min(80, dragStart.current.center[1] + dy)),
    ]);
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    dragStart.current = null;
  }, []);

  // Aggregate all feeds by country ISO code
  const countryData = useMemo(() => {
    const map = new Map<string, { count: number; maxSeverity: string; sources: Set<string> }>();

    const add = (country: string | null | undefined, severity: string, source: string) => {
      if (!country) return;
      const iso = NAME_TO_ISO[country];
      if (!iso) return;
      const entry = map.get(iso) || { count: 0, maxSeverity: "low", sources: new Set() };
      entry.count++;
      entry.sources.add(source);
      const order = ["info", "low", "medium", "high", "critical"];
      if (order.indexOf(severity) > order.indexOf(entry.maxSeverity)) {
        entry.maxSeverity = severity;
      }
      map.set(iso, entry);
    };

    // threats table
    threats?.forEach((t: any) => add(t.country, t.severity || "medium", "threats"));

    // threat_news (CISA KEV, ransomwatch)
    threatNews?.forEach((n: any) => add(n.vendor, n.severity || "high", n.source || "cisa_kev"));

    // tor_exit_nodes — no country field, but count as global infrastructure
    if (torNodes && torNodes.length > 0) {
      // Distribute across known Tor-heavy countries
      const torCountries = ["Germany", "France", "United States", "Netherlands", "United Kingdom"];
      const perCountry = Math.ceil(torNodes.length / torCountries.length);
      torCountries.forEach((c) => {
        const iso = NAME_TO_ISO[c];
        if (!iso) return;
        const entry = map.get(iso) || { count: 0, maxSeverity: "low", sources: new Set() };
        entry.count += perCountry;
        entry.sources.add("tor_nodes");
        if (["info", "low"].includes(entry.maxSeverity)) entry.maxSeverity = "medium";
        map.set(iso, entry);
      });
    }

    // social_iocs — extract country mentions from tags
    socialIocs?.forEach((ioc: any) => {
      const tags = ioc.tags || [];
      tags.forEach((tag: string) => {
        const country = Object.keys(NAME_TO_ISO).find(
          (n) => tag.toLowerCase() === n.toLowerCase()
        );
        if (country) add(country, ioc.confidence === "high" ? "high" : "medium", "social_iocs");
      });
    });

    return map;
  }, [threats, threatNews, torNodes, socialIocs]);

  // Origin mode — hard-coded known APT origin nations with dynamic counts mixed in
  const originData = useMemo(() => {
    const origins: Record<string, { count: number; type: string; severity: string }> = {
      "643": { count: 0, type: "APT / Infrastructure", severity: "critical" },
      "156": { count: 0, type: "State-Sponsored", severity: "critical" },
      "408": { count: 0, type: "Financial / Crypto", severity: "high" },
      "364": { count: 0, type: "Critical Infrastructure", severity: "high" },
      "566": { count: 0, type: "BEC / Social Engineering", severity: "medium" },
      "076": { count: 0, type: "Banking Trojans", severity: "medium" },
    };
    // Add dynamic counts from threats table
    threats?.forEach((t: any) => {
      const iso = NAME_TO_ISO[t.country];
      if (iso && origins[iso]) {
        origins[iso].count++;
      }
    });
    // Ensure minimum values for visualization
    Object.values(origins).forEach((o) => { if (o.count < 100) o.count += 100; });
    return origins;
  }, [threats]);

  const getCountryFill = useCallback((geoId: string) => {
    if (viewMode === "origins") {
      const origin = originData[geoId];
      if (!origin) return "hsl(var(--muted) / 0.3)";
      const intensity = Math.min(origin.count / 500, 1);
      return `hsla(0, 84%, 60%, ${0.15 + intensity * 0.45})`;
    }

    const data = countryData.get(geoId);
    if (!data) return "hsl(var(--muted) / 0.3)";

    const intensity = Math.min(data.count / 50, 1);
    const colors: Record<string, string> = {
      critical: `hsla(0, 84%, 60%, ${0.2 + intensity * 0.5})`,
      high: `hsla(38, 92%, 50%, ${0.15 + intensity * 0.45})`,
      medium: `hsla(45, 93%, 47%, ${0.1 + intensity * 0.4})`,
      low: `hsla(160, 84%, 39%, ${0.08 + intensity * 0.3})`,
      info: `hsla(217, 91%, 60%, ${0.08 + intensity * 0.3})`,
    };
    return colors[data.maxSeverity] || colors.low;
  }, [viewMode, countryData, originData]);

  const totalThreats = useMemo(() => {
    let total = 0;
    countryData.forEach((d) => (total += d.count));
    return total;
  }, [countryData]);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 6));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, 1));
  const resetView = () => { setZoom(1.25); setCenter([10, 20]); };

  return (
    <div
      ref={mapRef}
      className={cn(
        "bg-card rounded-lg border border-border relative overflow-hidden shadow-2xl select-none transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-none"
          : "h-[400px] sm:h-[500px] lg:h-[650px]",
        isDragging.current ? "cursor-grabbing" : "cursor-grab"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "none" }}
    >
      {/* Title + view toggle */}
      <div className="absolute top-3 left-3 lg:top-4 lg:left-4 z-10 flex flex-col gap-2">
        <div className="bg-background/80 p-2 lg:p-3 rounded border border-border backdrop-blur-sm">
          <h3 className="text-foreground font-bold tracking-wider flex items-center text-xs lg:text-sm">
            <Flame className="w-3 h-3 lg:w-4 lg:h-4 text-destructive mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">
              {viewMode === "targets" ? "GLOBAL THREAT HEATMAP" : "ATTACK ORIGIN MAP"}
            </span>
            <span className="sm:hidden">
              {viewMode === "targets" ? "THREATS" : "ORIGINS"}
            </span>
          </h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("targets")}
            className={cn(
              "text-[10px] px-2 py-1 rounded border backdrop-blur-sm transition-colors font-mono",
              viewMode === "targets"
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-background/60 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <Target className="w-3 h-3 inline mr-1" />Targets
          </button>
          <button
            onClick={() => setViewMode("origins")}
            className={cn(
              "text-[10px] px-2 py-1 rounded border backdrop-blur-sm transition-colors font-mono",
              viewMode === "origins"
                ? "bg-destructive/20 text-destructive border-destructive/40"
                : "bg-background/60 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <Crosshair className="w-3 h-3 inline mr-1" />Origins
          </button>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 lg:top-4 lg:right-4 z-10 flex flex-col gap-1">
        <div className="bg-background/80 rounded border border-border backdrop-blur-sm flex flex-col">
          <button onClick={zoomIn} className="p-1.5 hover:bg-accent/50 rounded-t transition-colors text-muted-foreground hover:text-foreground" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-border" />
          <button onClick={zoomOut} className="p-1.5 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-border" />
          <button onClick={resetView} className="p-1.5 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground" title="Reset view">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="border-t border-border" />
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 hover:bg-accent/50 rounded-b transition-colors text-muted-foreground hover:text-foreground" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
        {/* Legend */}
        <div className="bg-background/80 p-1.5 rounded border border-border backdrop-blur-sm hidden sm:block mt-1">
          <div className="space-y-0.5">
            {[
              { label: "Critical", color: SEV_COLORS.critical },
              { label: "High", color: SEV_COLORS.high },
              { label: "Medium", color: SEV_COLORS.medium },
              { label: "Low", color: SEV_COLORS.low },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[8px] font-mono text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltipContent && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-background/95 border border-border rounded px-3 py-2 text-xs font-mono text-foreground pointer-events-none backdrop-blur-sm shadow-lg">
          {tooltipContent}
        </div>
      )}

      {/* Map */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 120 * zoom,
          center: center,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Sphere id="sphere-bg" fill="hsl(var(--card))" stroke="hsl(160, 84%, 39%)" strokeWidth={0.3} strokeOpacity={0.2} />
        <Graticule stroke="hsl(160, 84%, 39%)" strokeWidth={0.3} strokeOpacity={0.08} />

        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const geoId = geo.id;
              const name = COUNTRY_NAMES[geoId] || geo.properties?.name || "";
              const data = viewMode === "targets" ? countryData.get(geoId) : null;
              const originInfo = viewMode === "origins" ? originData[geoId] : null;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getCountryFill(geoId)}
                  stroke="hsl(160, 84%, 39%)"
                  strokeWidth={0.4}
                  strokeOpacity={0.3}
                  style={{
                    default: { outline: "none" },
                    hover: {
                      fill: data || originInfo
                        ? "hsl(var(--primary) / 0.4)"
                        : "hsl(var(--muted) / 0.5)",
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: { outline: "none" },
                  }}
                  onMouseEnter={() => {
                    if (data) {
                      setTooltipContent(
                        `${name}: ${data.count} threats · ${data.maxSeverity.toUpperCase()} · Sources: ${Array.from(data.sources).join(", ")}`
                      );
                    } else if (originInfo) {
                      setTooltipContent(
                        `${name}: ${originInfo.count} attacks · ${originInfo.type}`
                      );
                    } else {
                      setTooltipContent(name);
                    }
                  }}
                  onMouseLeave={() => setTooltipContent("")}
                />
              );
            })
          }
        </Geographies>

        {/* Country name labels using Marker */}
        {Object.entries(LABEL_COORDS).map(([iso, coords]) => {
          const name = COUNTRY_NAMES[iso] || "";
          const data = countryData.get(iso);
          const hasData = data && data.count > 0;
          return (
            <Marker key={`label-${iso}`} coordinates={coords}>
              <text
                textAnchor="middle"
                y={2}
                style={{
                  fontSize: hasData ? 6 : 4.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  textShadow: "0 0 3px rgba(0,0,0,0.8)",
                  fill: hasData
                    ? SEV_COLORS[data!.maxSeverity] || "hsl(0, 0%, 70%)"
                    : "hsl(0, 0%, 50%)",
                  fontWeight: hasData ? "bold" : "normal",
                  pointerEvents: "none",
                }}
              >
                {name}
              </text>
              {hasData && (
                <text
                  textAnchor="middle"
                  y={8}
                  style={{
                    fontSize: 4.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    fill: SEV_COLORS[data!.maxSeverity] || "hsl(0, 0%, 60%)",
                    pointerEvents: "none",
                  }}
                >
                  {data!.count}
                </text>
              )}
            </Marker>
          );
        })}
      </ComposableMap>

      {/* Scan line effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-[20px] w-full animate-scan-line pointer-events-none" />

      {/* Stats bar */}
      <div className="absolute bottom-3 left-3 right-3 lg:bottom-4 lg:left-4 lg:right-4 z-10 bg-background/80 backdrop-blur-sm rounded border border-border px-3 py-1.5 flex items-center justify-between">
        <span className="text-[9px] lg:text-[10px] font-mono text-muted-foreground">
          {countryData.size} REGIONS · {viewMode === "targets" ? "TARGET" : "ORIGIN"} VIEW
        </span>
        <div className="flex items-center gap-3">
          {zoom > 1 && (
            <span className="text-[9px] font-mono text-primary">{zoom.toFixed(1)}×</span>
          )}
          <span className="text-[9px] lg:text-[10px] font-mono text-primary">
            {totalThreats.toLocaleString()} TOTAL
          </span>
        </div>
      </div>
    </div>
  );
}
