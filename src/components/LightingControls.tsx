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
  SlidersHorizontal
} from "lucide-react";
import { LightingSettings, PlanType } from "@/src/types";

interface LightingControlsProps {
  settings: LightingSettings;
  onChange: (settings: LightingSettings) => void;
  userPlan?: PlanType;
}

export const LightingControls = React.memo(function LightingControls({ 
  settings, 
  onChange, 
  userPlan = 'studio' 
}: LightingControlsProps) {
  
  const handleChange = (key: keyof LightingSettings, value: number | readonly number[] | any) => {
    const newValue = Array.isArray(value) ? value[0] : (typeof value === 'number' ? value : 0);
    onChange({
      ...settings,
      [key]: newValue
    });
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
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              {label}
            </Label>
          </div>
          <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {value > 0 && settingKey !== 'brightness' && settingKey !== 'contrast' && settingKey !== 'saturation' ? `+${value}` : value}
            {(settingKey === 'brightness' || settingKey === 'contrast' || settingKey === 'saturation') ? '%' : ''}
          </span>
        </div>
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v: any) => handleChange(settingKey, v)}
          className="cursor-pointer"
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90 flex items-center gap-1.5">
          <SlidersHorizontal className="w-3 h-3" />
          Exposición y Tono
        </h4>
        <ControlItem label="Brillo" icon={Sun} value={settings.brightness} min={50} max={150} settingKey="brightness" />
        <ControlItem label="Contraste" icon={Contrast} value={settings.contrast} min={50} max={150} settingKey="contrast" />
        <ControlItem label="Exposición" icon={Zap} value={settings.exposure} min={-100} max={100} settingKey="exposure" />
      </div>

      <div className="space-y-4 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90 flex items-center gap-1.5">
          <Droplets className="w-3 h-3" />
          Color y Temperatura
        </h4>
        <ControlItem label="Saturación" icon={Droplets} value={settings.saturation} min={0} max={200} settingKey="saturation" />
        <ControlItem label="Vibrancia" icon={Wind} value={settings.vibrance} min={0} max={200} settingKey="vibrance" />
        <ControlItem label="Calidez" icon={Thermometer} value={settings.warmth} min={-100} max={100} settingKey="warmth" />
        <ControlItem label="Tinte" icon={Palette} value={settings.tint} min={-100} max={100} settingKey="tint" />
      </div>

      <div className="space-y-4 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Detalles y Sombras
        </h4>
        <ControlItem label="Iluminaciones" icon={Sun} value={settings.highlights} min={0} max={200} settingKey="highlights" />
        <ControlItem label="Sombras" icon={CloudSun} value={settings.shadows} min={0} max={200} settingKey="shadows" />
        <ControlItem label="Claridad" icon={Sparkles} value={settings.clarity} min={0} max={100} settingKey="clarity" />
        <ControlItem label="Viñeta" icon={CircleDot} value={settings.vignette} min={0} max={100} settingKey="vignette" />
      </div>
    </div>
  );
});
