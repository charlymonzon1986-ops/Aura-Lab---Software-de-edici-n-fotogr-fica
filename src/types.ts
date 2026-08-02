export interface Photo {
  id: string;
  url: string;
  title: string;
  description?: string;
  settings: LightingSettings;
  userId?: string;
  createdAt?: any;
  isPublic?: boolean;
}

export interface Preset {
  id: string;
  name: string;
  category: string;
  settings: LightingSettings;
  isSystem?: boolean;
  userId?: string;
  planRequired?: 'free' | 'pro' | 'studio';
}

export type PlanType = 'free' | 'pro' | 'studio';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  plan: PlanType;
  storageUsed: number;
  createdAt: string;
}

export const STORAGE_LIMITS: Record<PlanType, number> = {
  free: 2 * 1024 * 1024 * 1024, // 2GB
  pro: 50 * 1024 * 1024 * 1024, // 50GB
  studio: 1024 * 1024 * 1024 * 1024, // 1TB
};

export const PLAN_PRICES: Record<PlanType, number> = {
  free: 0,
  pro: 2900, // ARS por mes
  studio: 9900, // ARS por mes
};

export interface LightingSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  warmth: number;
  highlights: number;
  shadows: number;
  clarity: number;
  vibrance: number;
  tint: number;
  vignette: number;
}

export const DEFAULT_SETTINGS: LightingSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 0,
  warmth: 0,
  highlights: 100,
  shadows: 100,
  clarity: 0,
  vibrance: 100,
  tint: 0,
  vignette: 0,
};
