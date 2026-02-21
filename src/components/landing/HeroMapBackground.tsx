/**
 * HeroMapBackground.tsx — Decorative world map rendered behind the hero section.
 * Uses react-simple-maps with pulsing threat hotspot dots.
 */

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/** Simulated threat hotspot locations */
const hotspots: { name: string; coordinates: [number, number]; delay: number }[] = [
  { name: "US-East", coordinates: [-74, 40.7], delay: 0 },
  { name: "UK", coordinates: [-0.12, 51.5], delay: 0.4 },
  { name: "Russia", coordinates: [37.6, 55.7], delay: 0.8 },
  { name: "China", coordinates: [116.4, 39.9], delay: 1.2 },
  { name: "Brazil", coordinates: [-43.2, -22.9], delay: 1.6 },
  { name: "India", coordinates: [77.2, 28.6], delay: 0.3 },
  { name: "Nigeria", coordinates: [3.4, 6.5], delay: 0.7 },
  { name: "Germany", coordinates: [13.4, 52.5], delay: 1.1 },
  { name: "Australia", coordinates: [151.2, -33.9], delay: 1.5 },
  { name: "Japan", coordinates: [139.7, 35.7], delay: 0.5 },
  { name: "Iran", coordinates: [51.4, 35.7], delay: 0.9 },
  { name: "North Korea", coordinates: [125.7, 39.0], delay: 1.3 },
];

export function HeroMapBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.25]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 180, center: [10, 20] }}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--primary))"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: "none", opacity: 0.35 },
                    hover: { outline: "none", opacity: 0.35 },
                    pressed: { outline: "none", opacity: 0.35 },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Pulsing threat hotspot dots */}
          {hotspots.map((spot) => (
            <Marker key={spot.name} coordinates={spot.coordinates}>
              <circle r={2} fill="hsl(var(--primary))" opacity={0.9}>
                <animate
                  attributeName="opacity"
                  values="0.9;0.3;0.9"
                  dur="2.5s"
                  begin={`${spot.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
              <circle r={2} fill="none" stroke="hsl(var(--primary))" strokeWidth={0.5} opacity={0.6}>
                <animate
                  attributeName="r"
                  values="2;8"
                  dur="2.5s"
                  begin={`${spot.delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;0"
                  dur="2.5s"
                  begin={`${spot.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </Marker>
          ))}
        </ComposableMap>
      </div>
      {/* Gradient overlays to fade edges */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-transparent to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
    </div>
  );
}
