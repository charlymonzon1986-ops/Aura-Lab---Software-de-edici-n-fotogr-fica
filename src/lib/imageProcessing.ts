import { LightingSettings, DEFAULT_SETTINGS } from "@/src/types";

/**
 * Applies real photographic pixel manipulation to an ImageData object.
 * Modifies pixel RGB channels directly (No CSS filters).
 */
export function processImagePixels(imageData: ImageData, settings: LightingSettings): ImageData {
  const {
    brightness,
    contrast,
    saturation,
    exposure,
    warmth,
    tint,
    vibrance,
    highlights,
    shadows,
    clarity,
    vignette
  } = settings;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Pre-calculate factors
  const expFactor = Math.pow(2, exposure / 50);
  const brightFactor = brightness / 100;
  const contrastFactor = contrast / 100;
  const satFactor = saturation / 100;
  const vibranceFactor = vibrance / 100;
  const highlightFactor = highlights / 100;
  const shadowFactor = shadows / 100;
  const clarityFactor = clarity / 100;
  const vignetteFactor = vignette / 100;

  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Exposure & Brightness
    r = r * expFactor * brightFactor;
    g = g * expFactor * brightFactor;
    b = b * expFactor * brightFactor;

    // 2. Contrast (relative to midpoint 128)
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    // 3. Luminance calculation
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // 4. Highlights & Shadows
    if (lum > 128 && highlightFactor !== 1) {
      const weight = (lum - 128) / 127;
      const hScale = 1 + (highlightFactor - 1) * weight;
      r *= hScale;
      g *= hScale;
      b *= hScale;
    } else if (lum <= 128 && shadowFactor !== 1) {
      const weight = (128 - lum) / 128;
      const sScale = 1 + (shadowFactor - 1) * weight;
      r *= sScale;
      g *= sScale;
      b *= sScale;
    }

    // 5. Warmth (Kelvin balance: Warmth > 0 adds Red, cuts Blue) & Tint (Magenta/Green)
    if (warmth !== 0) {
      r += warmth * 0.5;
      b -= warmth * 0.5;
    }
    if (tint !== 0) {
      g -= tint * 0.4;
      r += tint * 0.2;
      b += tint * 0.2;
    }

    // 6. Saturation & Vibrance
    const curLum = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const diff = maxChannel - minChannel;
    
    // Vibrance affects less-saturated pixels more
    const vibScale = 1 + (vibranceFactor - 1) * (1 - diff / 255);
    const effectiveSat = satFactor * vibScale;

    r = curLum + (r - curLum) * effectiveSat;
    g = curLum + (g - curLum) * effectiveSat;
    b = curLum + (b - curLum) * effectiveSat;

    // 7. Clarity (Micro-contrast)
    if (clarityFactor > 0) {
      r += (r - 128) * clarityFactor * 0.25;
      g += (g - 128) * clarityFactor * 0.25;
      b += (b - 128) * clarityFactor * 0.25;
    }

    // 8. Vignette (Radial Falloff)
    if (vignetteFactor > 0) {
      const pixelIdx = i / 4;
      const px = pixelIdx % width;
      const py = Math.floor(pixelIdx / width);
      const dx = px - centerX;
      const dy = py - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normDist = dist / maxRadius;

      if (normDist > 0.35) {
        const falloff = Math.pow((normDist - 0.35) / 0.65, 2) * vignetteFactor;
        const vScale = Math.max(0, 1 - falloff);
        r *= vScale;
        g *= vScale;
        b *= vScale;
      }
    }

    // Clamp values between 0 and 255
    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

  return imageData;
}

/**
 * Draws the source image to target canvas with real pixel manipulation applied.
 */
export async function renderProcessedToCanvas(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  settings: LightingSettings,
  maxWidth = 0,
  maxHeight = 0
): Promise<void> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  let targetWidth = img.naturalWidth || img.width;
  let targetHeight = img.naturalHeight || img.height;

  if (maxWidth > 0 && targetWidth > maxWidth) {
    const scale = maxWidth / targetWidth;
    targetWidth = maxWidth;
    targetHeight = Math.round(targetHeight * scale);
  }
  if (maxHeight > 0 && targetHeight > maxHeight) {
    const scale = maxHeight / targetHeight;
    targetHeight = maxHeight;
    targetWidth = Math.round(targetWidth * scale);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  const rawData = ctx.getImageData(0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    const worker = new Worker('/imageWorker.js');
    
    worker.onmessage = (e) => {
      ctx.putImageData(e.data.imageData, 0, 0);
      worker.terminate();
      resolve();
    };
    
    worker.onerror = (err) => {
      worker.terminate();
      // Fallback sincrónico si el worker falla
      const processed = processImagePixels(rawData, settings);
      ctx.putImageData(processed, 0, 0);
      resolve();
    };
    
    // Transferir el buffer al worker (zero-copy, muy rápido)
    worker.postMessage(
      { imageData: rawData, settings },
      [rawData.data.buffer]
    );
  });
}

export function getFilterString(settings: LightingSettings): string {
  const safe = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const brightness = safe.brightness ?? 100;
  const contrast = safe.contrast ?? 100;
  const saturation = safe.saturation ?? 100;
  const exposure = safe.exposure ?? 0;
  const warmth = safe.warmth ?? 0;
  const tint = safe.tint ?? 0;
  const vibrance = safe.vibrance ?? 100;
  const highlights = safe.highlights ?? 100;
  const shadows = safe.shadows ?? 100;
  const clarity = safe.clarity ?? 0;

  const expMult = Math.pow(2, exposure / 50);
  const effectiveBrightness = (brightness / 100) * expMult;
  const effectiveSaturation = (saturation / 100) * ((vibrance / 100) * 0.3 + 0.7);
  
  const highlightOffset = (highlights - 100) / 100 * 0.1;
  const shadowOffset = (shadows - 100) / 100 * 0.08;
  const combinedBrightness = effectiveBrightness + highlightOffset + shadowOffset;
  
  const clarityContrast = 1 + (clarity / 100) * 0.15;
  const sepiaAmount = warmth > 0 ? (warmth / 100) * 0.2 : 0;
  const hueShift = warmth < 0 ? (warmth / 100) * 12 : tint * 0.5;

  const filters = [
    `brightness(${(combinedBrightness * 100).toFixed(1)}%)`,
    `contrast(${(contrast / 100 * clarityContrast * 100).toFixed(1)}%)`,
    `saturate(${(effectiveSaturation * 100).toFixed(1)}%)`,
  ];

  if (sepiaAmount > 0) filters.push(`sepia(${(sepiaAmount * 100).toFixed(1)}%)`);
  if (hueShift !== 0) filters.push(`hue-rotate(${hueShift.toFixed(1)}deg)`);

  return filters.join(' ');
}
