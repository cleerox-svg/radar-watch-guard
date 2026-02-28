/**
 * PlatformSwitcher.tsx — Toggle between Trust Radar and imprsn8 sub-platforms.
 * Renders as a compact dropdown in the sidebar header area.
 * imprsn8 now uses the mask logo with purple/gold branding.
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Satellite, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import imprsn8Icon from "@/assets/imprsn8-icon.png";

interface Platform {
  id: "radar" | "imprsn8";
  name: string;
  tagline: string;
  icon?: typeof Satellite;
  iconImg?: string;
  path: string;
  accentClass: string;
}

const platforms: Platform[] = [
  {
    id: "radar",
    name: "TRUST RADAR",
    tagline: "Intelligence Platform",
    icon: Satellite,
    path: "/dashboard",
    accentClass: "text-primary",
  },
  {
    id: "imprsn8",
    name: "IMPRSN8",
    tagline: "Influencer Shield",
    iconImg: imprsn8Icon,
    path: "/imprsn8",
    accentClass: "text-imprsn8",
  },
];

interface PlatformSwitcherProps {
  className?: string;
}

export function PlatformSwitcher({ className }: PlatformSwitcherProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const currentPlatform = location.pathname.startsWith("/imprsn8")
    ? platforms[1]
    : platforms[0];

  const handleSwitch = (platform: Platform) => {
    setOpen(false);
    if (platform.id !== currentPlatform.id) {
      navigate(platform.path);
    }
  };

  const renderPlatformIcon = (platform: Platform, size = "w-4 h-4") => {
    if (platform.iconImg) {
      return <img src={platform.iconImg} alt={platform.name} className={cn(size, "rounded-sm object-contain")} />;
    }
    if (platform.icon) {
      const Icon = platform.icon;
      return <Icon className={cn(size, platform.accentClass)} />;
    }
    return null;
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center group gap-2.5 w-full"
      >
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className={cn(
            "absolute inset-0 rounded-lg animate-pulse-slow",
            currentPlatform.id === "imprsn8" ? "bg-imprsn8-purple" : "bg-primary/20"
          )} />
          <div className="relative z-10">
            {renderPlatformIcon(currentPlatform)}
          </div>
        </div>
        <div className="flex-1 text-left min-w-0">
          <span className={cn(
            "block text-sm font-extrabold tracking-wider transition-colors",
            currentPlatform.accentClass
          )}>
            {currentPlatform.name}
          </span>
          <span className={cn(
            "block text-[9px] font-mono tracking-[0.15em] uppercase",
            currentPlatform.id === "imprsn8" ? "text-imprsn8/70" : "text-primary/70"
          )}>
            {currentPlatform.tagline}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-3 h-3 text-muted-foreground transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
            >
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleSwitch(platform)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2.5 transition-colors text-left",
                    platform.id === currentPlatform.id
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  {renderPlatformIcon(platform)}
                  <div>
                    <p className={cn("text-xs font-bold tracking-wider", platform.accentClass)}>
                      {platform.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-mono">
                      {platform.tagline}
                    </p>
                  </div>
                  {platform.id === currentPlatform.id && (
                    <div className={cn(
                      "ml-auto w-1.5 h-1.5 rounded-full",
                      platform.id === "imprsn8" ? "bg-imprsn8" : "bg-primary"
                    )} />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
