import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { 
  Sun, 
  Contrast, 
  Droplets, 
  Zap, 
  Thermometer, 
  CloudSun,
  Palette,
  Wind,
  CircleDot,
  Sparkles,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  Eye
} from "lucide-react";
import { LightingSettings, PlanType } from "@/src/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LightingControlsProps {
  settings: LightingSettings;
  onChange: (settings: LightingSettings) => void;
  userPlan?: PlanType;
}

export const LightingControls = React.memo(function LightingControls({ settings, onChange, userPlan = 'studio' }: LightingControlsProps) {
  // Local state for smooth drag updates
  const [localSettings, setLocalSettings] = React.useState<LightingSettings>(settings);
  const isInteractingRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Sync prop changes when external preset or photo changes (and user is not dragging)
  React.useEffect(() => {
    if (!isInteractingRef.current) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleChange = (key: keyof LightingSettings, value: number | readonly number[]) => {
    isInteractingRef.current = true;
    const val = Array.isArray(value) ? value[0] : (value as number);
    
    setLocalSettings(prev => {
      const updated = { ...prev, [key]: val };
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        onChange(updated);
        // Release interaction lock after frame propagates
        setTimeout(() => {
          isInteractingRef.current = false;
        }, 100);
      });

      return updated;
    });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const scrollByAmount = (amount: number) => {
    const scrollContainer = containerRef.current?.closest('.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.scrollBy({ top: amount, behavior: 'smooth' });
    }
  };

  const ControlItem = ({ 
    label, 
    icon: Icon, 
    value, 
    min, 
    max, 
    step = 0.5, 
    settingKey, 
  }: { 
    label: string, 
    icon: any, 
    value: number, 
    min: number, 
    max: number, 
    step?: number, 
    settingKey: keyof LightingSettings,
  }) => {
    return (
      <div className="space-y-2 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Icon className="w-3.5 h-3.5 text-amber-500" />
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">{label}</Label>
          </div>
          <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {value > 0 && settingKey !== 'brightness' && settingKey !== 'contrast' && settingKey !== 'saturation' ? `+${value}` : value}
            {settingKey === 'brightness' || settingKey === 'contrast' || settingKey === 'saturation' ? '%' : ''}
          </span>
        </div>
        <div className="relative flex items-center touch-pan-x py-1">
          <Slider
            value={[value]}
            min={min}
            max={max}
            step={step}
            onValueChange={(v) => handleChange(settingKey, v)}
            className="cursor-pointer py-1 accent-amber-500"
          />
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="space-y-5">
      {/* Quick Navigation & Vertical Movement Bar */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md p-2 rounded-xl border border-zinc-800/80 shadow-xl flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[9px] font-bold uppercase tracking-wider">
          <button 
            onClick={() => scrollToSection('sec-expo')} 
            className="px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 transition-colors whitespace-nowrap border border-zinc-800"
          >
            Exposición
          </button>
          <button 
            onClick={() => scrollToSection('sec-color')} 
            className="px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 transition-colors whitespace-nowrap border border-zinc-800"
          >
            Color
          </button>
          <button 
            onClick={() => scrollToSection('sec-detalles')} 
            className="px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 transition-colors whitespace-nowrap border border-zinc-800"
          >
            Detalles
          </button>
        </div>

        {/* Up / Down Move Panel Buttons */}
        <div className="flex items-center gap-1 shrink-0 border-l border-zinc-800 pl-1.5">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-md"
            onClick={() => scrollByAmount(-180)}
            title="Mover panel hacia arriba"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-md"
            onClick={() => scrollByAmount(180)}
            title="Mover panel hacia abajo"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Exposición y Tono */}
      <div id="sec-expo" className="space-y-4 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90 flex items-center gap-1.5">
          <SlidersHorizontal className="w-3 h-3" />
          Exposición y Tono
        </h4>
        <ControlItem label="Brillo" icon={Sun} value={localSettings.brightness} min={50} max={150} settingKey="brightness" />
        <ControlItem label="Contraste" icon={Contrast} value={localSettings.contrast} min={50} max={150} settingKey="contrast" />
        <ControlItem label="Exposición" icon={Zap} value={localSettings.exposure} min={-100} max={100} settingKey="exposure" />
      </div>

      {/* Color y Temperatura */}
      <div id="sec-color" className="space-y-4 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90 flex items-center gap-1.5">
          <Droplets className="w-3 h-3" />
          Color y Temperatura
        </h4>
        <ControlItem label="Saturación" icon={Droplets} value={localSettings.saturation} min={0} max={200} settingKey="saturation" />
        <ControlItem label="Vibrancia" icon={Wind} value={localSettings.vibrance} min={0} max={200} settingKey="vibrance" />
        <ControlItem label="Calidez" icon={Thermometer} value={localSettings.warmth} min={-100} max={100} settingKey="warmth" />
        <ControlItem label="Tinte" icon={Palette} value={localSettings.tint} min={-100} max={100} settingKey="tint" />
      </div>

      {/* Detalles y Sombras */}
      <div id="sec-detalles" className="space-y-4 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Detalles y Sombras
        </h4>
        <ControlItem label="Iluminaciones" icon={Sun} value={localSettings.highlights} min={0} max={200} settingKey="highlights" />
        <ControlItem label="Sombras" icon={CloudSun} value={localSettings.shadows} min={0} max={200} settingKey="shadows" />
        <ControlItem label="Claridad" icon={Sparkles} value={localSettings.clarity} min={0} max={100} settingKey="clarity" />
        <ControlItem label="Viñeta" icon={CircleDot} value={localSettings.vignette} min={0} max={100} settingKey="vignette" />
      </div>
    </div>
  );
});

