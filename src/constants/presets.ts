import { Preset } from "../types";

export const SYSTEM_PRESETS: Preset[] = [
  {
    id: "p1",
    name: "Amanecer Cálido",
    category: "Naturaleza",
    isSystem: true,
    planRequired: "free",
    settings: {
      brightness: 110,
      contrast: 105,
      saturation: 120,
      exposure: 5,
      warmth: 15,
      highlights: 110,
      shadows: 100,
      clarity: 10,
      vibrance: 110,
      tint: 0,
      vignette: 0
    }
  },
  {
    id: "p2",
    name: "Boda Elegante",
    category: "Eventos",
    isSystem: true,
    planRequired: "pro",
    settings: {
      brightness: 115,
      contrast: 95,
      saturation: 90,
      exposure: 10,
      warmth: 5,
      highlights: 120,
      shadows: 110,
      clarity: 5,
      vibrance: 100,
      tint: 0,
      vignette: 10
    }
  },
  {
    id: "p3",
    name: "Urbano Brutalista",
    category: "Arquitectura",
    isSystem: true,
    planRequired: "pro",
    settings: {
      brightness: 90,
      contrast: 130,
      saturation: 80,
      exposure: -5,
      warmth: -10,
      highlights: 90,
      shadows: 80,
      clarity: 30,
      vibrance: 90,
      tint: 5,
      vignette: 20
    }
  },
  {
    id: "p4",
    name: "Cine Noir",
    category: "Retrato",
    isSystem: true,
    planRequired: "studio",
    settings: {
      brightness: 85,
      contrast: 150,
      saturation: 0,
      exposure: -10,
      warmth: 0,
      highlights: 100,
      shadows: 70,
      clarity: 40,
      vibrance: 0,
      tint: 0,
      vignette: 40
    }
  },
  {
    id: "p5",
    name: "Golden Hour Pro",
    category: "Naturaleza",
    isSystem: true,
    planRequired: "studio",
    settings: {
      brightness: 120,
      contrast: 110,
      saturation: 140,
      exposure: 15,
      warmth: 30,
      highlights: 130,
      shadows: 110,
      clarity: 20,
      vibrance: 120,
      tint: 0,
      vignette: 15
    }
  }
];
