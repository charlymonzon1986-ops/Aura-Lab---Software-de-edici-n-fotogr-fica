import * as React from "react";
import { LightingSettings, DEFAULT_SETTINGS } from "../types";

interface HistogramProps {
  settings: LightingSettings;
}

export function Histogram({ settings }: HistogramProps) {
  // Simplified visualization of how light distribution changes
  const points = React.useMemo(() => {
    const safeSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    const brightness = isNaN(safeSettings.brightness) ? 100 : safeSettings.brightness;
    const exposure = isNaN(safeSettings.exposure) ? 0 : safeSettings.exposure;
    const contrast = isNaN(safeSettings.contrast) ? 100 : safeSettings.contrast;

    const basePoints = Array.from({ length: 20 }, (_, i) => Math.sin(i / 3) * 20 + 30);
    const shift = (brightness - 100) / 2 + exposure;
    const contrastScale = contrast / 100;
    
    return basePoints.map((p, i) => {
      const x = i * 10;
      const normalizedX = (x - 100) * contrastScale + 100 + shift;
      const height = p * (1 + Math.abs(normalizedX - 100) / 200);
      const safeY = isNaN(height) ? 20 : Math.max(5, Math.min(60, height));
      return { x, y: safeY };
    });
  }, [settings]);

  return (
    <div className="h-24 w-full bg-zinc-900/30 rounded-lg border border-zinc-800/50 p-2 flex items-end gap-0.5 overflow-hidden">
      {points.map((p, i) => {
        const safeOpacity = isNaN(p.y) ? 0.5 : Math.max(0.1, Math.min(1, 0.3 + (p.y / 100)));
        return (
          <div 
            key={i}
            className="flex-1 bg-orange-500/40 rounded-t-[1px] transition-all duration-300"
            style={{ 
              height: `${p.y}%`,
              opacity: safeOpacity
            }}
          />
        );
      })}
    </div>
  );
}

