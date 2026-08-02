self.onmessage = function(e) {
  const { imageData, settings } = e.data;
  
  const {
    brightness, contrast, saturation, exposure, warmth, tint,
    vibrance, highlights, shadows, clarity, vignette
  } = settings;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

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

    r = r * expFactor * brightFactor;
    g = g * expFactor * brightFactor;
    b = b * expFactor * brightFactor;

    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum > 128 && highlightFactor !== 1) {
      const weight = (lum - 128) / 127;
      const hScale = 1 + (highlightFactor - 1) * weight;
      r *= hScale; g *= hScale; b *= hScale;
    } else if (lum <= 128 && shadowFactor !== 1) {
      const weight = (128 - lum) / 128;
      const sScale = 1 + (shadowFactor - 1) * weight;
      r *= sScale; g *= sScale; b *= sScale;
    }

    if (warmth !== 0) { r += warmth * 0.5; b -= warmth * 0.5; }
    if (tint !== 0) { g -= tint * 0.4; r += tint * 0.2; b += tint * 0.2; }

    const curLum = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const diff = maxChannel - minChannel;
    const vibScale = 1 + (vibranceFactor - 1) * (1 - diff / 255);
    const effectiveSat = satFactor * vibScale;
    r = curLum + (r - curLum) * effectiveSat;
    g = curLum + (g - curLum) * effectiveSat;
    b = curLum + (b - curLum) * effectiveSat;

    if (clarityFactor > 0) {
      r += (r - 128) * clarityFactor * 0.25;
      g += (g - 128) * clarityFactor * 0.25;
      b += (b - 128) * clarityFactor * 0.25;
    }

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
        r *= vScale; g *= vScale; b *= vScale;
      }
    }

    data[i]     = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

  // Transferir el buffer de vuelta al hilo principal (zero-copy)
  self.postMessage({ imageData }, [imageData.data.buffer]);
};
