import { VOICE_GENDERS } from '../constants';
import { safeStorage } from './storage';

export interface ClonedVoiceRecord {
  displayName: string;
  voiceId: string;
  type: 'replicated';
  model: string;
  isStatelessKey?: boolean;
  expireTime?: string | null;
  createdAt: number;
}

const STORAGE_KEY = 'mindmirror_cloned_voices';
const GEMINI_PREBUILT_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr'] as const;

export const isReplicatedVoiceId = (value?: string | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith('voice_') ||
    trimmed.startsWith('voicekey_') ||
    trimmed.startsWith('voices/')
  );
};

export const normalizeVoiceId = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.startsWith('voices/') ? trimmed.slice('voices/'.length) : trimmed;
};

export const getClonedVoicesMap = (): Record<string, ClonedVoiceRecord> => {
  const raw = safeStorage.parseJSON<Record<string, ClonedVoiceRecord>>(STORAGE_KEY, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const sanitized: Record<string, ClonedVoiceRecord> = {};
  for (const [key, rec] of Object.entries(raw)) {
    if (rec && typeof rec === 'object' && typeof rec.voiceId === 'string' && isReplicatedVoiceId(rec.voiceId)) {
      sanitized[key] = {
        ...rec,
        displayName: (rec.displayName || key).trim(),
        voiceId: normalizeVoiceId(rec.voiceId),
        type: 'replicated',
        model: rec.model || 'gemini-3.8-flash-tts',
        createdAt: typeof rec.createdAt === 'number' ? rec.createdAt : Date.now(),
      };
    }
  }
  return sanitized;
};

export const saveClonedVoice = (record: ClonedVoiceRecord): void => {
  if (!record?.displayName || !isReplicatedVoiceId(record.voiceId)) return;
  const map = getClonedVoicesMap();
  const cleanName = record.displayName.trim();
  map[cleanName] = {
    ...record,
    displayName: cleanName,
    voiceId: normalizeVoiceId(record.voiceId),
    type: 'replicated',
  };
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export const removeClonedVoice = (displayNameOrId: string): ClonedVoiceRecord | null => {
  const map = getClonedVoicesMap();
  const target = (displayNameOrId || '').trim();
  if (!target) return null;

  let removed: ClonedVoiceRecord | null = null;
  if (map[target]) {
    removed = map[target];
    delete map[target];
  } else {
    for (const [key, rec] of Object.entries(map)) {
      if (rec.voiceId === target || rec.displayName === target) {
        removed = rec;
        delete map[key];
        break;
      }
    }
  }

  safeStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  return removed;
};

export const getClonedVoiceRecord = (voiceNameOrId?: string | null): ClonedVoiceRecord | null => {
  if (!voiceNameOrId || typeof voiceNameOrId !== 'string') return null;
  const target = voiceNameOrId.trim();
  if (!target) return null;

  const map = getClonedVoicesMap();
  if (map[target]) return map[target];

  const normalized = normalizeVoiceId(target);
  for (const rec of Object.values(map)) {
    if (rec.voiceId === normalized || rec.displayName === target) {
      return rec;
    }
  }

  if (isReplicatedVoiceId(target)) {
    return {
      displayName: normalized,
      voiceId: normalized,
      type: 'replicated',
      model: 'gemini-3.8-flash-tts',
      isStatelessKey: normalized.startsWith('voicekey_'),
      createdAt: Date.now(),
    };
  }

  return null;
};

export const getClonedVoiceId = (voiceNameOrId?: string | null): string | null => {
  const rec = getClonedVoiceRecord(voiceNameOrId);
  return rec ? rec.voiceId : null;
};

export const isCustomVoiceUnverified = (voiceName?: string | null): boolean => {
  if (!voiceName || typeof voiceName !== 'string') return false;
  if (VOICE_GENDERS[voiceName]) return false;
  return !getClonedVoiceId(voiceName);
};

export const buildSpeechVoiceConfig = (
  voiceNameOrId?: string | null
): { voice: string } | { prebuiltVoiceConfig: { voiceName: string } } => {
  const clonedVoiceId = getClonedVoiceId(voiceNameOrId);
  if (clonedVoiceId) {
    return { voice: clonedVoiceId };
  }

  const raw = (voiceNameOrId || 'Puck').trim();
  const exactPrebuilt = GEMINI_PREBUILT_VOICES.find(
    (v) => v.toLowerCase() === raw.toLowerCase()
  );
  if (exactPrebuilt) {
    return { prebuiltVoiceConfig: { voiceName: exactPrebuilt } };
  }

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = raw.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GEMINI_PREBUILT_VOICES.length;
  return { prebuiltVoiceConfig: { voiceName: GEMINI_PREBUILT_VOICES[index] } };
};
