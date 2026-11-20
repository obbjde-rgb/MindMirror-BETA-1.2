// Advanced Generative AI Color Engine for MindMirror
// Procedurally calculates vibrant, high-contrast, non-repeating mixed paint/duotone/gradient color palettes

import { safeStorage } from './storage';

export interface AIThemePalette {
  name: string;
  category: string;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accentGlow: string;
  glowGradient: string;
}

const PALETTE_ARCHETYPES = [
  {
    category: 'شفق سايبر كوانتي',
    getColors: (baseHue: number) => {
      const h1 = baseHue;
      const h2 = (baseHue + 160) % 360;
      const h3 = (baseHue + 80) % 360;
      const h4 = (baseHue + 240) % 360;
      return {
        bg: hslToHex(h1, 50, 4),
        surface: hslToHex(h1, 45, 8),
        surface2: hslToHex(h1, 40, 14),
        border: hslToHex(h2, 55, 26),
        text: '#f8fafc',
        muted: hslToHex(h1, 20, 65),
        accent: hslToHex(h2, 95, 62),
        accent2: hslToHex(h1, 90, 64),
        accent3: hslToHex(h3, 95, 60),
        accent4: hslToHex(h4, 90, 58)
      };
    }
  },
  {
    category: 'وهج شمسي ياقوتي',
    getColors: (baseHue: number) => {
      const h1 = (baseHue + 25) % 360;
      const h2 = (baseHue + 195) % 360;
      return {
        bg: hslToHex(15, 45, 5),
        surface: hslToHex(15, 38, 9),
        surface2: hslToHex(15, 32, 15),
        border: hslToHex(38, 55, 25),
        text: '#fef2f2',
        muted: '#cbd5e1',
        accent: hslToHex(38, 98, 56),
        accent2: hslToHex(350, 92, 62),
        accent3: hslToHex(175, 88, 54),
        accent4: hslToHex(280, 85, 64)
      };
    }
  },
  {
    category: 'زمرد وأماثيست أثيري',
    getColors: (baseHue: number) => {
      return {
        bg: hslToHex(270, 50, 5),
        surface: hslToHex(270, 42, 9),
        surface2: hslToHex(270, 36, 15),
        border: hslToHex(160, 55, 26),
        text: '#f8fafc',
        muted: '#a7f3d0',
        accent: hslToHex(160, 95, 54),
        accent2: hslToHex(280, 90, 66),
        accent3: hslToHex(45, 95, 62),
        accent4: hslToHex(190, 92, 58)
      };
    }
  },
  {
    category: 'دووتون نصف نصف الماسي',
    getColors: (baseHue: number) => {
      const h1 = baseHue;
      const h2 = (baseHue + 180) % 360;
      return {
        bg: hslToHex(h1, 55, 5),
        surface: hslToHex(h1, 40, 10),
        surface2: hslToHex(h1, 35, 16),
        border: hslToHex(h2, 60, 30),
        text: '#ffffff',
        muted: '#cbd5e1',
        accent: hslToHex(h2, 98, 60),
        accent2: hslToHex((h2 + 30) % 360, 95, 64),
        accent3: hslToHex(h1, 90, 62),
        accent4: hslToHex((h1 + 120) % 360, 88, 58)
      };
    }
  },
  {
    category: 'صباغة التيتانيوم السائلة',
    getColors: (baseHue: number) => {
      const h1 = (baseHue + 120) % 360;
      const h2 = (baseHue + 240) % 360;
      return {
        bg: hslToHex(baseHue, 40, 5),
        surface: hslToHex(baseHue, 35, 9),
        surface2: hslToHex(baseHue, 30, 15),
        border: hslToHex(h1, 50, 28),
        text: '#f8fafc',
        muted: '#94a3b8',
        accent: hslToHex(h1, 95, 62),
        accent2: hslToHex(h2, 92, 60),
        accent3: hslToHex(baseHue, 96, 65),
        accent4: hslToHex((baseHue + 60) % 360, 90, 58)
      };
    }
  },
  {
    category: 'فيروزي ومرجاني كوانتي',
    getColors: (baseHue: number) => {
      return {
        bg: hslToHex(185, 45, 5),
        surface: hslToHex(185, 38, 9),
        surface2: hslToHex(185, 32, 15),
        border: hslToHex(15, 55, 28),
        text: '#f0fdf4',
        muted: '#99f6e4',
        accent: hslToHex(185, 95, 54),
        accent2: hslToHex(15, 92, 60),
        accent3: hslToHex(260, 88, 65),
        accent4: hslToHex(45, 95, 58)
      };
    }
  }
];

const ARABIC_ADJECTIVES = [
  'المتوهج', 'العميق', 'الاستثنائي', 'المشرق', 'النواسي', 
  'المركّب', 'الفائق', 'الماسوني', 'الأثيري', 'الرائد'
];

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generateRandomAITheme(): AIThemePalette {
  const baseHue = Math.floor(Math.random() * 360);
  const archetypeIdx = Math.floor(Math.random() * PALETTE_ARCHETYPES.length);
  const archetype = PALETTE_ARCHETYPES[archetypeIdx];
  const adj = ARABIC_ADJECTIVES[Math.floor(Math.random() * ARABIC_ADJECTIVES.length)];

  const colors = archetype.getColors(baseHue);
  const paletteName = `${archetype.category} ${adj} (${baseHue}°)`;

  const accentGlow = `${colors.accent}33`;
  const glowGradient = `radial-gradient(circle at 50% 0%, ${colors.accent}25 0%, ${colors.accent2}12 50%, transparent 85%)`;

  return {
    name: paletteName,
    category: archetype.category,
    ...colors,
    accentGlow,
    glowGradient
  };
}

export function applyAITheme(palette: AIThemePalette) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', 'ai-generative');

  root.style.setProperty('--bg', palette.bg);
  root.style.setProperty('--surface', palette.surface);
  root.style.setProperty('--surface2', palette.surface2);
  root.style.setProperty('--border', palette.border);
  root.style.setProperty('--text', palette.text);
  root.style.setProperty('--muted', palette.muted);
  root.style.setProperty('--color-accent', palette.accent);
  root.style.setProperty('--color-accent2', palette.accent2);
  root.style.setProperty('--color-accent3', palette.accent3);
  root.style.setProperty('--color-accent4', palette.accent4);
  root.style.setProperty('--color-glow', palette.accentGlow);
  root.style.setProperty('--glow-gradient', palette.glowGradient);

  try {
    safeStorage.setItem('mindmirror_ai_custom_theme', JSON.stringify(palette));
  } catch (e) {}
}

export function loadSavedAITheme(): AIThemePalette | null {
  try {
    const parsed = safeStorage.getJson<AIThemePalette | null>('mindmirror_ai_custom_theme', null);
    if (parsed && typeof parsed === 'object' && parsed.bg) {
      return parsed;
    }
  } catch (e) {}
  return null;
}
