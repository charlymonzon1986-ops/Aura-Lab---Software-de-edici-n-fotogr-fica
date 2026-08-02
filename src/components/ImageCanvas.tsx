import * as React from "react";
import { LightingSettings, DEFAULT_SETTINGS } from "@/src/types";
import { renderProcessedToCanvas } from "@/src/lib/imageProcessing";
import { ZoomIn, ZoomOut, Maximize2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageCanvasProps {
  imageUrl: string;
  title: string;
  settings: LightingSettings;
  onResetZoom?: () => void;
}

export function ImageCanvas({ imageUrl, title, settings }: ImageCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isComparing, setIsComparing] = React.useState(false);

  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [imgSize, setImgSize] = React.useState({ width: 0, height: 0 });

  // Listen to container resize with ResizeObserver
  React.useEffect(() => {
    if (!containerRef.current) return;

    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };

    measureContainer();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load Image Object
  React.useEffect(() => {
    setIsLoaded(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = "anonymous";

    const handleSuccess = (loadedImg: HTMLImageElement) => {
      if (!isMounted) return;
      imgRef.current = loadedImg;
      setImgSize({
        width: loadedImg.naturalWidth || loadedImg.width || 1200,
        height: loadedImg.naturalHeight || loadedImg.height || 800,
      });
      setIsLoaded(true);
    };

    img.onload = () => handleSuccess(img);

    img.onerror = () => {
      // Fallback without crossOrigin if CORS rejected anonymous mode
      const fallbackImg = new Image();
      fallbackImg.onload = () => handleSuccess(fallbackImg);
      fallbackImg.onerror = () => {
        if (isMounted) setIsLoaded(true);
      };
      fallbackImg.src = imageUrl;
    };

    img.src = imageUrl;

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  // Active settings depending on comparison mode
  const activeSettings = isComparing ? DEFAULT_SETTINGS : settings;

  // Render processed pixels onto canvas whenever activeSettings or image loads
  React.useEffect(() => {
    if (!isLoaded || !imgRef.current || !canvasRef.current) return;

    let animFrame: number;
    const updateCanvas = () => {
      if (imgRef.current && canvasRef.current) {
        renderProcessedToCanvas(imgRef.current, canvasRef.current, activeSettings, 1920, 1080);
      }
    };

    animFrame = requestAnimationFrame(updateCanvas);
    return () => cancelAnimationFrame(animFrame);
  }, [isLoaded, activeSettings]);

  const resetZoom = React.useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Calculate Fit-to-screen dimensions (Lightroom style default fit)
  const fitDimensions = React.useMemo(() => {
    if (!imgSize.width || !imgSize.height) return null;

    const w = containerSize.width || (containerRef.current ? containerRef.current.clientWidth : 0) || 800;
    const h = containerSize.height || (containerRef.current ? containerRef.current.clientHeight : 0) || 600;

    const padding = 32; // 16px padding on each side
    const availWidth = Math.max(200, w - padding);
    const availHeight = Math.max(200, h - padding);

    const scaleX = availWidth / imgSize.width;
    const scaleY = availHeight / imgSize.height;
    const fitScale = Math.min(scaleX, scaleY);

    return {
      width: Math.round(imgSize.width * fitScale),
      height: Math.round(imgSize.height * fitScale),
    };
  }, [imgSize, containerSize]);

  // Handle Mouse Down (Start Pan or prep for Click-Zoom)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  // Handle Mouse Move (Pan when dragging)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const dx = e.clientX - (dragStart.x + pan.x);
    const dy = e.clientY - (dragStart.y + pan.y);

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      setHasMoved(true);
    }

    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  // Handle Mouse Up (Click to toggle Zoom or finish Drag)
  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    // If mouse didn't drag significantly, it's a click!
    if (!hasMoved) {
      if (zoom <= 1.05) {
        // Zoom in to 2.5x around click location
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const clickX = e.clientX - rect.left - rect.width / 2;
          const clickY = e.clientY - rect.top - rect.height / 2;
          setZoom(2.5);
          setPan({ x: -clickX * 1.5, y: -clickY * 1.5 });
        } else {
          setZoom(2.5);
        }
      } else {
        // Zoom back out to normal 1.0x (Fit View)
        resetZoom();
      }
    }
  };

  // Handle Mouse Wheel Zoom inside image container
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prevZoom) => {
      const newZoom = Math.min(5, Math.max(0.8, prevZoom * zoomFactor));
      if (newZoom <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-0 min-w-0 flex items-center justify-center overflow-hidden select-none bg-zinc-950 p-4"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsDragging(false)}
      onWheel={handleWheel}
      style={{
        cursor: zoom <= 1.05 ? "zoom-in" : isDragging ? "grabbing" : "grab"
      }}
    >
      {/* Visual Badge when holding/comparing original */}
      {isComparing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-amber-500/90 text-zinc-950 font-bold font-mono text-[11px] px-3 py-1 rounded-full shadow-lg backdrop-blur-md uppercase tracking-wider animate-pulse flex items-center gap-1.5 pointer-events-none">
          <Eye className="w-3.5 h-3.5" /> FOTO ORIGINAL (ANTES)
        </div>
      )}

      <div
        className="relative transition-transform duration-75 ease-out flex items-center justify-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center"
        }}
      >
        <canvas
          ref={canvasRef}
          className="shadow-2xl rounded-lg select-none object-contain transition-opacity duration-200"
          style={{
            display: isLoaded ? "block" : "none",
            width: fitDimensions ? `${fitDimensions.width}px` : "auto",
            height: fitDimensions ? `${fitDimensions.height}px` : "auto",
            maxWidth: "100%",
            maxHeight: "100%"
          }}
        />

        {!isLoaded && (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-500 space-y-2">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">Procesando píxeles...</p>
          </div>
        )}
      </div>

      {/* Floating Zoom & Compare Controls Overlay */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-full border border-zinc-800/80 shadow-2xl z-20">
        {/* Compare Original Button (Hold or Click) */}
        <Button
          size="sm"
          variant={isComparing ? "default" : "ghost"}
          className={`h-8 px-3 text-xs font-medium rounded-full transition-all ${
            isComparing 
              ? "bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400" 
              : "text-zinc-300 hover:text-white hover:bg-zinc-800"
          }`}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsComparing(true);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            setIsComparing(false);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setIsComparing(true);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            setIsComparing(false);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="Mantén presionado para ver la foto original sin ajustes"
        >
          {isComparing ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
          {isComparing ? "Original" : "Antes / Después"}
        </Button>

        <div className="w-px h-4 bg-zinc-800" />

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-white rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.max(0.5, z - 0.25));
          }}
          title="Alejar"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>

        <span className="text-[10px] font-mono font-bold text-zinc-400 w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-white rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.min(5, z + 0.25));
          }}
          title="Acercar"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-4 bg-zinc-800" />

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-white rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            resetZoom();
          }}
          title="Restablecer tamaño (Ajustar a pantalla)"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
