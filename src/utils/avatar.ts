const SYSTEM_ROOM_KEYS = new Set(['group_question', 'debate', 'osint_room', 'trend_live']);

const warmedAvatarSet = new Set<string>();
const warmingPromises = new Map<string, Promise<boolean>>();

export const getHologramPortraitUrl = (name: string, customUrl?: string): string => {
  if (customUrl && !customUrl.startsWith('/portraits/')) {
    return customUrl;
  }
  const cleanName = (name || 'سقراط').trim();
  if (!cleanName || SYSTEM_ROOM_KEYS.has(cleanName)) {
    return getFallbackMonogramSvg(cleanName || '✦');
  }
  return `/api/persona-portrait?name=${encodeURIComponent(cleanName)}`;
};

export const getFallbackMonogramSvg = (name: string): string => {
  const rawInitial = (name || '✦').trim().charAt(0) || '✦';
  const initial = rawInitial
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="#18181b"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#f4f4f5" font-family="system-ui,sans-serif" font-weight="700" font-size="52">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const getAvatarUrl = (name: string, customUrl?: string) => {
  if (customUrl && !customUrl.startsWith('/portraits/')) return customUrl;
  if (!name) return '/api/persona-portrait?name=' + encodeURIComponent('سقراط');

  const trimmed = name.trim();
  if (SYSTEM_ROOM_KEYS.has(trimmed)) {
    return getFallbackMonogramSvg(trimmed);
  }

  return `/api/persona-portrait?name=${encodeURIComponent(trimmed)}`;
};

export const isPersonaAvatarReady = (name: string): boolean => {
  const clean = (name || '').trim();
  if (!clean || SYSTEM_ROOM_KEYS.has(clean)) return true;
  return warmedAvatarSet.has(clean);
};

/**
 * Automatically resolves & warms both the portrait image and Gemini-extracted 3D hologram
 * morphological traits (/api/persona-portrait-meta + /api/persona-portrait) in the background
 * whenever any historical or contemporary persona is added or discovered.
 */
export const prefetchPersonaAvatarAssets = async (name: string): Promise<boolean> => {
  const clean = (name || '').trim();
  if (!clean || SYSTEM_ROOM_KEYS.has(clean)) return false;
  if (warmedAvatarSet.has(clean)) return true;

  const existing = warmingPromises.get(clean);
  if (existing) return existing;

  const task = (async () => {
    try {
      const encoded = encodeURIComponent(clean);
      const [metaRes, imgRes] = await Promise.allSettled([
        fetch(`/api/persona-portrait-meta?name=${encoded}`),
        fetch(`/api/persona-portrait?name=${encoded}`)
      ]);

      const metaOk = metaRes.status === 'fulfilled' && metaRes.value.ok;
      const imgOk = imgRes.status === 'fulfilled' && imgRes.value.ok;

      if (metaOk || imgOk) {
        warmedAvatarSet.add(clean);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mindmirror-avatar-ready', { detail: { name: clean } }));
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      warmingPromises.delete(clean);
    }
  })();

  warmingPromises.set(clean, task);
  return task;
};
