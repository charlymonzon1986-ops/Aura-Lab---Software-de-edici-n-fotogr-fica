import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Download, FileImage, Sparkles, AlertCircle, Loader2 } from "lucide-react";

export interface ExportOptions {
  format: 'jpeg' | 'png' | 'webp';
  quality: number; // 0-1
  maxWidth: number; // 0 = original, -1 = half, -2 = quarter, 2048 = web
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  isExporting: boolean;
}

export function ExportModal({ open, onClose, onExport, isExporting }: ExportModalProps) {
  const [format, setFormat] = React.useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [quality, setQuality] = React.useState<number>(92);
  const [sizePreset, setSizePreset] = React.useState<'original' | 'half' | 'quarter' | 'web'>('original');

  const getMaxWidth = (): number => {
    switch (sizePreset) {
      case 'original': return 0;
      case 'half': return -1;
      case 'quarter': return -2;
      case 'web': return 2048;
    }
  };

  // Ancho de referencia para la estimación
  const refWidth = sizePreset === 'web' ? 2048 : 
                   sizePreset === 'half' ? 3000 : 
                   sizePreset === 'quarter' ? 1500 : 6000;
  const refHeight = refWidth * 0.667;
  const pixels = refWidth * refHeight;

  const estimatedMB = format === 'png' 
    ? (pixels * 3) / (1024 * 1024) * 0.5  // PNG comprime ~50%
    : (pixels * 3) / (1024 * 1024) * (1 - quality / 100) * 0.15 + 0.3;

  const getMbColor = (mb: number) => {
    if (mb < 5) return 'text-amber-400';
    if (mb <= 15) return 'text-zinc-400';
    return 'text-red-400';
  };

  const handleExportClick = () => {
    onExport({
      format,
      quality: quality / 100,
      maxWidth: getMaxWidth(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && !isExporting) onClose(); }}>
      <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-zinc-100 p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="flex flex-row items-center gap-2 pb-2 border-b border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-white">Opciones de Exportación</DialogTitle>
            <p className="text-xs text-zinc-400">Configura el formato, resolución y calidad del archivo final.</p>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* FORMATO */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <FileImage className="w-3.5 h-3.5" />
              Formato de Imagen
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('jpeg')}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                  format === 'jpeg'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                <span className="font-bold text-xs uppercase tracking-wider text-amber-400">JPEG</span>
                <span className="text-[10px] text-zinc-400 mt-1 leading-tight">Alta compresión, ideal para compartir</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('png')}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                  format === 'png'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                <span className="font-bold text-xs uppercase tracking-wider text-amber-400">PNG</span>
                <span className="text-[10px] text-zinc-400 mt-1 leading-tight">Sin pérdida, ideal para impresión</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('webp')}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                  format === 'webp'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                <span className="font-bold text-xs uppercase tracking-wider text-amber-400">WEBP</span>
                <span className="text-[10px] text-zinc-400 mt-1 leading-tight">Máxima eficiencia, ideal para web</span>
              </button>
            </div>
          </div>

          {/* CALIDAD */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Calidad
              </label>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {format === 'png' ? '100% (Sin pérdida)' : `${quality}%`}
              </span>
            </div>

            {format === 'png' ? (
              <p className="text-xs text-zinc-500 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-800/50 italic">
                PNG usa compresión sin pérdida (la calidad no es configurable).
              </p>
            ) : (
              <div className="space-y-2 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60">
                <Slider
                  value={[quality]}
                  min={60}
                  max={100}
                  step={1}
                  onValueChange={(val) => {
                    const num = Array.isArray(val) ? val[0] : val;
                    if (typeof num === 'number') setQuality(num);
                  }}
                  className="py-1 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                  <span>60% = archivo más pequeño</span>
                  <span>100% = máxima fidelidad</span>
                </div>
              </div>
            )}
          </div>

          {/* TAMAÑO DE SALIDA */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
              Tamaño de Salida
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSizePreset('original')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  sizePreset === 'original'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                <div className="font-bold text-xs text-amber-400">Original</div>
                <div className="text-[10px] text-zinc-400">Resolución completa</div>
              </button>

              <button
                type="button"
                onClick={() => setSizePreset('half')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  sizePreset === 'half'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                <div className="font-bold text-xs text-amber-400">½ Tamaño</div>
                <div className="text-[10px] text-zinc-400">Mitad de la resolución</div>
              </button>

              <button
                type="button"
                onClick={() => setSizePreset('quarter')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  sizePreset === 'quarter'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                <div className="font-bold text-xs text-amber-400">¼ Tamaño</div>
                <div className="text-[10px] text-zinc-400">Un cuarto de la resolución</div>
              </button>

              <button
                type="button"
                onClick={() => setSizePreset('web')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  sizePreset === 'web'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                <div className="font-bold text-xs text-amber-400">Web (2048px)</div>
                <div className="text-[10px] text-zinc-400">Máximo 2048px de ancho</div>
              </button>
            </div>
          </div>

          {/* ESTIMACIÓN DE TAMAÑO & NOTA */}
          <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">Tamaño estimado del archivo:</span>
              <span className={`font-mono font-bold ${getMbColor(estimatedMB)}`}>
                ~{estimatedMB.toFixed(1)} MB
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 flex items-start gap-1.5 pt-1 border-t border-zinc-800/60">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
              <span>
                Los formatos TIFF y RAW no están disponibles en la versión web. Están planeados para la versión de escritorio (Aura Lab Desktop).
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 pt-2 border-t border-zinc-800/80">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleExportClick}
            disabled={isExporting}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
