/**
 * HeroMapBackground.tsx — Decorative world map rendered behind the hero section.
 * Uses react-simple-maps for a lightweight, data-free geographic visualization.
 */

import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function HeroMapBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.12] blur-[2px]">
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
                  strokeWidth={0.3}
                  style={{
                    default: { outline: "none", opacity: 0.4 },
                    hover: { outline: "none", opacity: 0.4 },
                    pressed: { outline: "none", opacity: 0.4 },
                  }}
                />
              ))
            }
          </Geographies>
        </ComposableMap>
      </div>
      {/* Gradient overlays to fade edges */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />
    </div>
  );
}
