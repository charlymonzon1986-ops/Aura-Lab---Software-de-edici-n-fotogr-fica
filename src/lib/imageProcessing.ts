import { LightingSettings } from "@/src/types";

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
export function renderProcessedToCanvas(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  settings: LightingSettings,
  maxWidth = 1920,
  maxHeight = 1080
) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  // Scale down if image is huge for preview performance, or use natural size for export
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

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  try {
    // Draw base image
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Get raw pixel buffer
    const rawData = ctx.getImageData(0, 0, targetWidth, targetHeight);

    // Process raw pixels
    const processedData = processImagePixels(rawData, settings);

    // Write processed pixels back to canvas
    ctx.putImageData(processedData, 0, 0);
  } catch (err) {
    // Fallback if canvas is tainted by cross-origin security restrictions
    ctx.filter = getFilterString(settings);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  }
}

export function getFilterString(settings: LightingSettings): string {
  const { brightness, contrast, saturation, exposure, warmth, tint } = settings;
  const effectiveBrightness = (brightness / 100) * (1 + exposure / 100);
  const sepia = warmth > 0 ? warmth / 100 : 0;
  const hueRotate = tint;

  return `
    brightness(${effectiveBrightness * 100}%) 
    contrast(${contrast}%) 
    saturate(${saturation}%) 
    sepia(${sepia * 100}%) 
    hue-rotate(${hueRotate}deg)
  `.replace(/\s+/g, ' ').trim();
}
