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
  Sparkles
} from "lucide-react";
import { LightingSettings, PlanType } from "@/src/types";
import { Badge } from "@/components/ui/badge";

interface LightingControlsProps {
  settings: LightingSettings;
  onChange: (settings: LightingSettings) => void;
  userPlan?: PlanType;
}

export const LightingControls = React.memo(function LightingControls({ settings, onChange, userPlan = 'free' }: LightingControlsProps) {
  // Local state for smooth drag updates
  const [localSettings, setLocalSettings] = React.useState<LightingSettings>(settings);
  const rafRef = React.useRef<number | null>(null);

  // Sync prop changes when external preset or photo changes
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (key: keyof LightingSettings, value: number | readonly number[]) => {
    const val = Array.isArray(value) ? value[0] : (value as number);
    const updated = { ...localSettings, [key]: val };
    setLocalSettings(updated);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      onChange(updated);
    });
  };

  const planLevels: Record<PlanType, number> = { free: 0, pro: 1, studio: 2 };
  const userLevel = planLevels[userPlan];

  const ControlItem = ({ 
    label, 
    icon: Icon, 
    value, 
    min, 
    max, 
    step = 1, 
    settingKey, 
    requiredPlan = 'free' 
  }: { 
    label: string, 
    icon: any, 
    value: number, 
    min: number, 
    max: number, 
    step?: number, 
    settingKey: keyof LightingSettings,
    requiredPlan?: PlanType
  }) => {
    const isLocked = userLevel < planLevels[requiredPlan];

    return (
      <div className={`space-y-3 ${isLocked ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Icon className="w-3.5 h-3.5 text-amber-500/80" />
            <Label className="text-xs font-medium uppercase tracking-wider text-zinc-300">{label}</Label>
            {isLocked && (
              <Badge variant="outline" className="text-[8px] h-4 px-1 border-amber-500/30 text-amber-500">
                {requiredPlan.toUpperCase()}
              </Badge>
            )}
          </div>
          <span className="text-xs font-mono font-semibold text-zinc-400">
            {value > 0 && settingKey !== 'brightness' && settingKey !== 'contrast' && settingKey !== 'saturation' ? `+${value}` : value}
            {settingKey === 'brightness' || settingKey === 'contrast' || settingKey === 'saturation' ? '%' : ''}
          </span>
        </div>
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => !isLocked && handleChange(settingKey, v)}
          className={`py-1.5 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          disabled={isLocked}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-5 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Exposición y Tono</h4>
        <ControlItem label="Brillo" icon={Sun} value={localSettings.brightness} min={50} max={150} settingKey="brightness" />
        <ControlItem label="Contraste" icon={Contrast} value={localSettings.contrast} min={50} max={150} settingKey="contrast" />
        <ControlItem label="Exposición" icon={Zap} value={localSettings.exposure} min={-100} max={100} settingKey="exposure" />
      </div>

      <div className="space-y-5 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Color y Temperatura</h4>
        <ControlItem label="Saturación" icon={Droplets} value={localSettings.saturation} min={0} max={200} settingKey="saturation" />
        <ControlItem label="Vibrancia" icon={Wind} value={localSettings.vibrance} min={0} max={200} settingKey="vibrance" requiredPlan="free" />
        <ControlItem label="Calidez" icon={Thermometer} value={localSettings.warmth} min={-100} max={100} settingKey="warmth" />
        <ControlItem label="Tinte" icon={Palette} value={localSettings.tint} min={-100} max={100} settingKey="tint" requiredPlan="free" />
      </div>

      <div className="space-y-5 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Detalles y Sombras</h4>
        <ControlItem label="Iluminaciones" icon={Sun} value={localSettings.highlights} min={0} max={200} settingKey="highlights" requiredPlan="free" />
        <ControlItem label="Sombras" icon={CloudSun} value={localSettings.shadows} min={0} max={200} settingKey="shadows" requiredPlan="free" />
        <ControlItem label="Claridad" icon={Sparkles} value={localSettings.clarity} min={0} max={100} settingKey="clarity" requiredPlan="free" />
        <ControlItem label="Viñeta" icon={CircleDot} value={localSettings.vignette} min={0} max={100} settingKey="vignette" requiredPlan="free" />
      </div>
    </div>
  );
});
