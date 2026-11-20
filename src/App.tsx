/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import { Send, Loader2, Bot, User, Plus, Check, X, Trash2, Sparkles, Maximize2, Minimize2, Volume2, Download, Copy, CheckCheck, SquareSquare, StopCircle, Globe, RefreshCw, ArrowDown, Edit2, Paperclip, FileText, Swords, Play, Sun, Moon, Monitor, Settings, Share2, Eye, EyeOff, Video, Radar, Satellite } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatInputArea from './components/ChatInputArea';
import SettingsModal from './components/SettingsModal';
import MessageBubble from './components/MessageBubble';
import DebateModal from './components/DebateModal';
import GroupQuestionModal from './components/GroupQuestionModal';
import OsintRoomModal from './components/OsintRoomModal';
import PersonaExtractorModal from './components/PersonaExtractorModal';
import ChatSearchModal from './components/ChatSearchModal';
import { PersonaSelector } from './components/PersonaSelector';
import ConfirmModal from './components/ConfirmModal';
import EditPersonaModal from './components/EditPersonaModal';
import { ChatHeader } from './components/ChatHeader';
import { LandingSections, SectionTitle } from './components/LandingSections';
import { AdvancedFeaturesSection } from './components/AdvancedFeaturesSection';
import { loadSavedAITheme, applyAITheme } from './utils/aiThemeGenerator';
import { SanctuaryView } from './components/SanctuaryView';
import { base64ToPCM16, downloadBlob, playAudioBase64, clearAudioCacheFromStorage } from './utils/audio';
import { getAvatarUrl, prefetchPersonaAvatarAssets } from './utils/avatar';
import { checkIsRateLimited, checkIsQuotaExceeded, withRetry, sanitizeApiKey, getApiKey, getGeminiClient, setRuntimeApiKey, parseJsonSafely, normalizeGeminiModel, DEFAULT_MODEL, DEFAULT_AUDIO_MODEL } from './utils/gemini';
import { copyToClipboard } from './utils/clipboard';
import { extractTextFromPdf } from './utils/pdf';
import { Message, PersonaData, VoiceName, UserProfile } from './types';
import { initialPersonas, GEMINI_MODELS, DEFAULT_30_VOICES } from './constants';
import { useTTS } from './hooks/useTTS';
import { useVideoExport } from './hooks/useVideoExport';
import { get, set, clear as clearIdb } from 'idb-keyval';

import { logger } from './utils/logger';
import { DebugConsole } from './components/DebugConsole';
import { useToast } from './components/Toast';
import { ExplainerModal } from './components/ExplainerModal';
import { ExtractLessonModal } from './components/ExtractLessonModal';
import { AcademyLessonsModal } from './components/AcademyLessonsModal';
import { AgiAssistantHeaderBar } from './components/AgiAssistantHeaderBar';
import { AgiAssistantModal } from './components/AgiAssistantModal';
import { TextDissectorModal, ExtractedEntity } from './components/TextDissectorModal';
import { LiveConversationModal } from './components/LiveConversationModal';
import { GroupLiveConversationModal } from './components/GroupLiveConversationModal';
import { UserProfilesModal } from './components/UserProfilesModal';
import { PersonaComparisonModal } from './components/PersonaComparisonModal';
import { GroundedImageAssistantModal } from './components/GroundedImageAssistantModal';
import TrendLiveRoomModal from './components/TrendLiveRoomModal';
import { FocusModeOverlay } from './components/FocusModeOverlay';
import { selfRepairEngine } from './utils/selfRepairEngine';
import { Tooltip } from './components/Tooltip';
import { PWADeploymentCenterModal } from './components/PWADeploymentCenterModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { PodLiveStudioModal } from './components/PodLiveStudioModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { safeStorage } from './utils/storage';
import { saveClonedVoice } from './utils/clonedVoices';


const fadeInVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

// Global flag to prevent duplicate bootstraps across remounts/StrictMode
let globalHasBootstrappedModels = false;
let globalIsUpdatingModels = false;

export default function App() {
  const { toast } = useToast();
  const { isInstalled: isStandalone } = usePWAInstall();
  const safeParseJSON = (jsonString: string | null, defaultValue: any) => {
    if (!jsonString) return defaultValue;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      logger.error('Failed to parse JSON, returning default value', e);
      return defaultValue;
    }
  };

  const safeSetItem = (key: string, value: string) => {
    safeStorage.setItem(key, value);
  };

  const [personas, setPersonas] = useState<Record<string, PersonaData>>(() => {
    try {
      const parsed = safeStorage.parseJSON<Record<string, PersonaData>>('mindmirror_personas', {}); 
      const validated = { ...initialPersonas, ...parsed };
      Object.keys(validated).forEach(key => {
        let voice = validated[key].voice || initialPersonas[key]?.voice || 'Puck';
        validated[key].voice = voice;
        if (!validated[key].ttsTone) validated[key].ttsTone = initialPersonas[key]?.ttsTone || 'تلقائي';
      });
      return validated;
    } catch (e) {
      return initialPersonas;
    }
  });

  // Continuous background avatar & 3D hologram trait generator for all existing and newly added real personas
  const avatarQueuedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const SYSTEM_KEYS = new Set(['group_question', 'debate', 'osint_room', 'trend_live']);
    const pending = Object.keys(personas).filter((name) => {
      const clean = (name || '').trim();
      return clean && !SYSTEM_KEYS.has(clean) && !avatarQueuedRef.current.has(clean);
    });
    if (pending.length === 0) return;

    pending.forEach((n) => avatarQueuedRef.current.add(n));
    let cancelled = false;

    const runQueue = async () => {
      const concurrency = 2;
      let cursor = 0;
      const worker = async () => {
        while (!cancelled && cursor < pending.length) {
          const idx = cursor++;
          const targetName = pending[idx];
          await prefetchPersonaAvatarAssets(targetName);
          await new Promise((r) => setTimeout(r, 180));
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
    };

    runQueue();
    return () => {
      cancelled = true;
    };
  }, [personas]);

  const [chatHistory, setChatHistory] = useState<Record<string, Message[]>>(() => {
    return safeStorage.parseJSON('mindmirror_history', {});
  });

  const [activePersona, setActivePersona] = useState(() => {
    const saved = safeStorage.getItem('mindmirror_activePersona');
    return saved && initialPersonas[saved] ? saved : 'سقراط';
  });
  const [viewMode, setViewMode] = useState<'sanctuary' | 'classic'>(() => {
    const saved = safeStorage.getItem('mindmirror_viewMode');
    return (saved as any) || 'sanctuary';
  });
  const [fontFamily, setFontFamilyState] = useState<string>(() => {
    return safeStorage.getItem('mindmirror_fontFamily') || 'Alexandria';
  });
  const setFontFamily = (font: string) => {
    setFontFamilyState(font);
    safeStorage.setItem('mindmirror_fontFamily', font);
  };

  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [showClearAudioCacheConfirm, setShowClearAudioCacheConfirm] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    const fontCss = `"${fontFamily}", "Alexandria", sans-serif`;
    root.style.setProperty('--font-sans', fontCss);
    document.body.style.fontFamily = fontCss;
  }, [fontFamily]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingPersona, setIsAddingPersona] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFile, setDraggedFile] = useState<{ name: string; content: string } | null>(null);
  const [showDebateModal, setShowDebateModal] = useState(false);
  const [debateConfig, setDebateConfig] = useState<{participants: string[], topic: string, debateId?: string}>(() => {
    try {
      const parsed = safeStorage.parseJSON<any>('mindmirror_debateConfig', null);
      if (parsed) {
        if (parsed.p1 && parsed.p2) {
          return { participants: [parsed.p1, parsed.p2], topic: parsed.topic || '' };
        }
        if (parsed.participants) {
          return parsed;
        }
      }
    } catch (e) {
      logger.error("Failed to parse debate config", e);
    }
    return { participants: ['إيلون ماسك', 'نيتشه'], topic: '' };
  });

  const [showGroupQuestionModal, setShowGroupQuestionModal] = useState(false);
  const [showOsintRoomModal, setShowOsintRoomModal] = useState(false);
  const [showPersonaExtractorModal, setShowPersonaExtractorModal] = useState(false);
  const [showChatSearchModal, setShowChatSearchModal] = useState(false);
  const [isZenMode, setIsZenMode] = useState<boolean>(() => {
    return safeStorage.getItem('mindmirror_isZenMode') === 'true';
  });
  const [osintRoomConfig, setOsintRoomConfig] = useState<{
    analysts: any[];
    targetQuery: string;
    investigationMode: 'triangulation' | 'satellite_geo' | 'link_footprint' | 'financial_crypto' | 'botnet_coordination';
    depth: 'standard' | 'deep';
    sessionId?: string;
  }>(() => {
    return safeStorage.parseJSON('mindmirror_osintRoomConfig', {
      analysts: [],
      targetQuery: '',
      investigationMode: 'triangulation',
      depth: 'deep'
    });
  });
  const [groupQuestionConfig, setGroupQuestionConfig] = useState<{
    participants: string[];
    question: string;
    sessionStyle: string;
    groupQuestionId?: string;
    newsRadar?: { enabled: boolean; mode: 'realtime' | 'archival' };
  }>(() => {
    return safeStorage.parseJSON('mindmirror_groupQuestionConfig', { 
      participants: ['إيلون ماسك', 'نيتشه', 'ستيف جوبز'], 
      question: '', 
      sessionStyle: 'sequential' 
    });
  });
  
  const [theme, setTheme] = useState<'light' | 'dark' | 'system' | 'calculator-gray' | 'plain-text'>(() => {
    return (safeStorage.getItem('mindmirror_theme') as any) || 'plain-text';
  });

  const lastSavedModal = safeStorage.getItem('mindmirror_lastActiveModal') || 'podlive';

  const [showSettings, setShowSettings] = useState<boolean>(() => lastSavedModal === 'settings');
  const [showDebug, setShowDebug] = useState(false);
  const [showExplainers, setShowExplainers] = useState<boolean>(() => {
    return safeStorage.getItem('mindmirror_showExplainers') !== 'false';
  });

  // Advanced AGI Engine & Text Dissector States
  const [currentEngine, setCurrentEngine] = useState<'standard' | 'thinking' | 'deep_research'>('standard');
  const [isDeepThinkingEnabled, setIsDeepThinkingEnabled] = useState(false);
  const [isMapsGroundingEnabled, setIsMapsGroundingEnabled] = useState(false);

  const handleSetWebSearch = (val: boolean | ((prev: boolean) => boolean)) => {
    setIsWebSearchEnabled(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (next) {
        setIsMapsGroundingEnabled(false);
      }
      return next;
    });
  };

  const handleSetMapsGrounding = (val: boolean | ((prev: boolean) => boolean)) => {
    setIsMapsGroundingEnabled(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (next) {
        setIsWebSearchEnabled(false);
      }
      return next;
    });
  };
  const [showAgiModal, setShowAgiModal] = useState<boolean>(() => lastSavedModal === 'agi_assistant');
  const [showTextDissectorModal, setShowTextDissectorModal] = useState(false);
  const [showLiveConversationModal, setShowLiveConversationModal] = useState<boolean>(() => {
    return lastSavedModal === 'live_conversation' || safeStorage.getSessionItem('mindmirror_auto_open_live') === 'true';
  });
  const [showGroupLiveModal, setShowGroupLiveModal] = useState<boolean>(() => lastSavedModal === 'group_live');
  const [showUserProfilesModal, setShowUserProfilesModal] = useState<boolean>(() => lastSavedModal === 'user_profiles');
  const [showPersonaComparisonModal, setShowPersonaComparisonModal] = useState<boolean>(() => lastSavedModal === 'persona_comparison');
  const [showGroundedImageAssistantModal, setShowGroundedImageAssistantModal] = useState<boolean>(() => lastSavedModal === 'grounded_image');
  const [showTrendLiveRoomModal, setShowTrendLiveRoomModal] = useState<boolean>(() => lastSavedModal === 'trend_room');
  const [showDeploymentCenterModal, setShowDeploymentCenterModal] = useState<boolean>(() => lastSavedModal === 'deployment_center');
  const [showPodLiveStudioModal, setShowPodLiveStudioModal] = useState<boolean>(() => lastSavedModal === 'podlive' || lastSavedModal === '');

  // Auto-persist last active view/modal so app resumes exactly where user left off
  useEffect(() => {
    let currentModal = 'main';
    if (showPodLiveStudioModal) currentModal = 'podlive';
    else if (showSettings) currentModal = 'settings';
    else if (showLiveConversationModal) currentModal = 'live_conversation';
    else if (showGroupLiveModal) currentModal = 'group_live';
    else if (showUserProfilesModal) currentModal = 'user_profiles';
    else if (showPersonaComparisonModal) currentModal = 'persona_comparison';
    else if (showGroundedImageAssistantModal) currentModal = 'grounded_image';
    else if (showTrendLiveRoomModal) currentModal = 'trend_room';
    else if (showDeploymentCenterModal) currentModal = 'deployment_center';
    else if (showOsintRoomModal) currentModal = 'osint_room';
    else if (showDebateModal) currentModal = 'debate';
    else if (showGroupQuestionModal) currentModal = 'group_question';
    else if (showAgiModal) currentModal = 'agi_assistant';

    safeStorage.setItem('mindmirror_lastActiveModal', currentModal);
  }, [
    showPodLiveStudioModal, showSettings, showLiveConversationModal, showGroupLiveModal,
    showUserProfilesModal, showPersonaComparisonModal, showGroundedImageAssistantModal,
    showTrendLiveRoomModal, showDeploymentCenterModal, showOsintRoomModal,
    showDebateModal, showGroupQuestionModal, showAgiModal
  ]);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      
      // Silently clean up any query params or hash to maintain the pure root URL
      if (search.includes('pwa=install') || search.includes('action=deploy') || hash.includes('/install') || hash.includes('pwa=')) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('pwa');
          url.searchParams.delete('action');
          if (url.hash.includes('/install')) {
            url.hash = '/';
          }
          const relativeUrl = url.pathname + (url.search ? url.search : '') + (url.hash && url.hash !== '#/' ? url.hash : '');
          window.history.replaceState({}, document.title, relativeUrl || '/');
        } catch (urlErr) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);
  const [isStrictModelMode, setIsStrictModelMode] = useState<boolean>(() => {
    return safeStorage.getItem('mindmirror_isStrictModelMode') === 'true';
  });

  useEffect(() => {
    safeStorage.setItem('mindmirror_isStrictModelMode', String(isStrictModelMode));
  }, [isStrictModelMode]);

  const [activeProfileId, setActiveProfileId] = useState<string>('profile_default');
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>(() => {
    return safeStorage.parseJSON('mindmirror_userProfiles', [
      {
        id: 'profile_default',
        name: 'بروفايل ستيف جوبز الإبداعي',
        personaId: 'ستيف جوبز',
        bio: 'بروفايل مخصص لمشاريع الابتكار والتصميم والتسويق الفريد',
        createdAt: new Date().toLocaleDateString('ar-SA'),
        dataSources: [
          {
            id: 'ds_1',
            name: 'خطاب ستانفورد الشهير (2005)',
            type: 'text',
            snippet: 'Stay Hungry, Stay Foolish - الابتكار هو القدرة على رؤية التغيير كفرصة وليس كتهديد',
            addedAt: new Date().toLocaleDateString('ar-SA')
          }
        ],
        parameters: {
          voice: 'Puck',
          ttsTone: 'حماسي وإلهامي',
          reasoningStyle: 'التفكير الجذري والتصميم البسيط',
          temperature: 0.8
        },
        savedSessions: []
      },
      {
        id: 'profile_ibn_khaldun',
        name: 'بروفايل ابن خلدون العلمي',
        personaId: 'ابن خلدون',
        bio: 'بروفايل مخصص لتحليل العمران البشري وعلم الاجتماع والتحولات التاريخية',
        createdAt: new Date().toLocaleDateString('ar-SA'),
        dataSources: [
          {
            id: 'ds_2',
            name: 'مقدمة ابن خلدون - باب العمران',
            type: 'note',
            snippet: 'التاريخ في ظاهره لا يزيد على أخبار عن الأيام والدول، وفي باطنه نظر وتحقيق وتعليل للكائنات ومبادئها',
            addedAt: new Date().toLocaleDateString('ar-SA')
          }
        ],
        parameters: {
          voice: 'Kore',
          ttsTone: 'وقور وعميق',
          reasoningStyle: 'استقرائي تاريخي تحليلي',
          temperature: 0.6
        },
        savedSessions: []
      }
    ]);
  });

  const handleSaveProfile = (profile: UserProfile) => {
    setUserProfiles(prev => {
      const idx = prev.findIndex(p => p.id === profile.id);
      let updated: UserProfile[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = profile;
      } else {
        updated = [profile, ...prev];
      }
      safeStorage.setItem('mindmirror_userProfiles', JSON.stringify(updated));
      return updated;
    });
    toast({
      title: "تم حفظ البروفايل بنجاح 👤",
      message: `تم تحديث وسجل بروفايل "${profile.name}" في ذاكرة النظام.`,
      type: "success"
    });
  };

  const handleDeleteProfile = (profileId: string) => {
    setUserProfiles(prev => {
      const updated = prev.filter(p => p.id !== profileId);
      safeStorage.setItem('mindmirror_userProfiles', JSON.stringify(updated));
      return updated;
    });
    toast({
      title: "تم حذف البروفايل",
      message: "تم حذف بروفايل المستخدم من القائمة.",
      type: "info"
    });
  };

  const handleSelectActiveProfile = (profile: UserProfile) => {
    setActiveProfileId(profile.id);
    if (profile.personaId && personas[profile.personaId]) {
      setActivePersona(profile.personaId);
    }
    toast({
      title: `تم تفعيل البروفايل: ${profile.name}`,
      message: `الآن يتعامل الذكاء الاصطناعي مع معالم شخصية "${profile.personaId}" المخصصة.`,
      type: "success"
    });
  };
  const [groupLiveConfig, setGroupLiveConfig] = useState<{participants: string[], mode: 'debate'|'seminar', topic?: string}>({participants: [], mode: 'debate'});
  const [dissectorInputText, setDissectorInputText] = useState('');
  const [dissectorSourceSpeaker, setDissectorSourceSpeaker] = useState('');

  const handleExtractAndChat = (entity: ExtractedEntity, fullPersona?: PersonaData) => {
    const personaKey = entity.name;
    if (fullPersona) {
      setPersonas(prev => {
        const updated = { ...prev, [personaKey]: fullPersona };
        safeStorage.setItem('mindmirror_personas', JSON.stringify(updated));
        return updated;
      });
    } else if (!personas[personaKey]) {
      // Create a basic persona entry if none existed
      const basicPersona: PersonaData = {
        label: personaKey,
        description: entity.summary,
        prompt: entity.suggestedPrompt || `تحدث معي كعقل ومفكر يمثل ${personaKey}`,
        quote: `«أنا أفكّر في ${personaKey}»`,
        color: '#8b5cf6',
        icon: 'Brain',
        voice: 'Kore',
        ttsTone: 'عميق وفلسفي',
        greeting: `أهلاً بك. أنا ${personaKey}. كيف يمكنني أن أنير لك جوانب هذه المسألة؟`
      };
      setPersonas(prev => {
        const updated = { ...prev, [personaKey]: basicPersona };
        safeStorage.setItem('mindmirror_personas', JSON.stringify(updated));
        return updated;
      });
    }

    setActivePersona(personaKey);
    setShowTextDissectorModal(false);
    setShowAgiModal(false);
    toast({
      title: `تم إضافة "${personaKey}" وبدء الحوار`,
      message: 'تم استخراج البصمة المعرفية والتحول إلى الجلسة الحوارية المباشرة بنجاح.',
      type: 'success'
    });
  };

  const handleExtractAll = (entitiesList: ExtractedEntity[]) => {
    if (!entitiesList || entitiesList.length === 0) return;

    setPersonas(prev => {
      const updated = { ...prev };
      entitiesList.forEach(entity => {
        const personaKey = entity.name;
        if (!updated[personaKey]) {
          let color = '#8b5cf6';
          let icon = 'Brain';
          if (entity.type === 'personality') { color = '#a855f7'; icon = 'UserCheck'; }
          else if (entity.type === 'concept') { color = '#f59e0b'; icon = 'Lightbulb'; }
          else if (entity.type === 'school') { color = '#10b981'; icon = 'BookOpen'; }
          else if (entity.type === 'quote') { color = '#0ea5e9'; icon = 'Quote'; }

          updated[personaKey] = {
            label: personaKey,
            description: entity.summary,
            prompt: entity.suggestedPrompt || `تحدث معي كعقل ومفكر يمثل ${personaKey}`,
            quote: `«أنا أفكّر في ${personaKey}»`,
            color: color,
            icon: icon,
            voice: 'Kore',
            ttsTone: 'عميق وفلسفي',
            greeting: `أهلاً بك في فضاء المعرفة. أنا ${personaKey}. كيف يمكنني الإسهام في تفكيك وتعميق نقاشنا اليوم؟`
          };
        }
      });
      safeStorage.setItem('mindmirror_personas', JSON.stringify(updated));
      return updated;
    });

    if (entitiesList[0]) {
      setActivePersona(entitiesList[0].name);
    }
    
    setShowTextDissectorModal(false);
    setShowAgiModal(false);
    toast({
      title: 'تم إضافة كافة الكيانات بنجاح 🎯',
      message: `تمت إضافة ${entitiesList.length} من العقول والمفاهيم والمدارس الفكرية إلى قائمتك الحوارية بنجاح دفعة واحدة!`,
      type: 'success'
    });
  };
  const [explainerData, setExplainerData] = useState<{
    concept: string;
    baseExplanation: string;
    messageContext: string;
    personaName: string;
  } | null>(null);
  const [isApiKeyInvalid, setIsApiKeyInvalid] = useState(false);
  const [isApiKeyVerified, setIsApiKeyVerified] = useState(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [apiKey, setApiKeyState] = useState(() => {
    const saved = safeStorage.getItem('mindmirror_apiKey');
    if (saved) {
      setRuntimeApiKey(saved);
    }
    return saved;
  });

  const setApiKey = (key: string) => {
    const sanitized = sanitizeApiKey(key);
    setApiKeyState(sanitized);
    setRuntimeApiKey(sanitized);
    setIsApiKeyInvalid(false);
    setIsApiKeyVerified(false);
    setIsQuotaExhausted(false);
  };
  const [provider, setProviderState] = useState(() => {
    return safeStorage.getItem('mindmirror_provider', 'google');
  });
  const setProvider = (val: string) => {
    setProviderState(val);
    safeStorage.setItem('mindmirror_provider', val);
  };

  const [model, setModelState] = useState(() => {
    const saved = safeStorage.getItem('mindmirror_model');
    return normalizeGeminiModel(saved);
  });
  const setModel = (val: string) => {
    const normalized = normalizeGeminiModel(val);
    setModelState(normalized);
    safeStorage.setItem('mindmirror_model', normalized);
  };

  const [audioModel, setAudioModelState] = useState(() => {
    const saved = safeStorage.getItem('mindmirror_audioModel');
    if (saved && (saved.includes('tts') || saved.includes('live'))) {
      return normalizeGeminiModel(saved);
    }
    return DEFAULT_AUDIO_MODEL;
  });
  const setAudioModel = (val: string) => {
    const normalized = normalizeGeminiModel(val);
    setAudioModelState(normalized);
    safeStorage.setItem('mindmirror_audioModel', normalized);
  };

  // Ensure any deprecated or rate-limited models stored in browser localStorage are cleaned up
  useEffect(() => {
    try {
      const savedModel = safeStorage.getItem('mindmirror_model');
      const normalizedModel = normalizeGeminiModel(savedModel);
      if (savedModel !== normalizedModel) {
        safeStorage.setItem('mindmirror_model', normalizedModel);
        setModelState(normalizedModel);
      }

      const savedAudio = safeStorage.getItem('mindmirror_audioModel');
      const normalizedAudio = (savedAudio && (savedAudio.includes('tts') || savedAudio.includes('live')))
        ? normalizeGeminiModel(savedAudio)
        : DEFAULT_AUDIO_MODEL;
      if (savedAudio !== normalizedAudio) {
        safeStorage.setItem('mindmirror_audioModel', normalizedAudio);
        setAudioModelState(normalizedAudio);
      }

      // Automated audio cache purge: wipe any legacy unstripped audio chunks once
      const audioCleanedKey = 'mindmirror_audio_cache_cleaned_v38_root';
      if (!safeStorage.getItem(audioCleanedKey)) {
        clearAudioCacheFromStorage().then(count => {
          safeStorage.setItem(audioCleanedKey, 'true');
          if (count > 0) {
            logger.info(`[AutoPurge] Cleared ${count} legacy audio cache entries on startup.`);
          }
        }).catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const [ttsVolume, setTtsVolumeState] = useState(() => {
    return Number(safeStorage.getItem('mindmirror_ttsVolume')) || 1.6;
  });
  const setTtsVolume = (val: number) => {
    setTtsVolumeState(val);
    safeStorage.setItem('mindmirror_ttsVolume', val.toString());
  };

  const [ttsSpeed, setTtsSpeedState] = useState(() => {
    return Number(safeStorage.getItem('mindmirror_ttsSpeed')) || 1.0;
  });
  const setTtsSpeed = (val: number) => {
    setTtsSpeedState(val);
    safeStorage.setItem('mindmirror_ttsSpeed', val.toString());
  };

  const [userInfo, setUserInfoState] = useState(() => {
    return safeStorage.getItem('mindmirror_userInfo');
  });
  const setUserInfo = (val: string) => {
    setUserInfoState(val);
    safeStorage.setItem('mindmirror_userInfo', val);
  };
  
  // Auto-Archive States
  const [autoArchiveEnabled, setAutoArchiveEnabled] = useState<boolean>(() => {
    return safeStorage.getItem('mindmirror_autoArchiveEnabled') === 'true';
  });
  const [archiveThresholdDays, setArchiveThresholdDays] = useState<number>(() => {
    return Number(safeStorage.getItem('mindmirror_archiveThresholdDays')) || 30;
  });
  const [archivedChats, setArchivedChats] = useState<Record<string, Message[]>>(() => {
    return safeStorage.parseJSON('mindmirror_archive', {});
  });

  // Academy Mode & Vault States
  const [isAcademyMode, setIsAcademyMode] = useState<boolean>(() => {
    return safeStorage.getItem('mindmirror_academy_mode') === 'true';
  });
  const [extractLessonModal, setExtractLessonModal] = useState<{
    isOpen: boolean;
    text: string;
    personaName: string;
    personaLabel: string;
  }>({
    isOpen: false,
    text: '',
    personaName: '',
    personaLabel: ''
  });
  const [isAcademyVaultOpen, setIsAcademyVaultOpen] = useState<boolean>(false);

  useEffect(() => {
    safeStorage.setItem('mindmirror_academy_mode', String(isAcademyMode));
  }, [isAcademyMode]);

  const [usedModelName, setUsedModelName] = useState('');
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Start background periodic self-repair algorithm
  useEffect(() => {
    selfRepairEngine.start(45000);
    return () => {
      selfRepairEngine.stop();
    };
  }, []);

  useEffect(() => {
    safeStorage.setItem('mindmirror_isZenMode', String(isZenMode));
  }, [isZenMode]);

  useEffect(() => {
    safeStorage.setItem('mindmirror_autoArchiveEnabled', String(autoArchiveEnabled));
  }, [autoArchiveEnabled]);

  useEffect(() => {
    safeStorage.setItem('mindmirror_archiveThresholdDays', String(archiveThresholdDays));
  }, [archiveThresholdDays]);

  useEffect(() => {
    safeStorage.setItem('mindmirror_archive', JSON.stringify(archivedChats));
  }, [archivedChats]);

  const buildSystemInstruction = (basePrompt: string) => {
    if (!basePrompt) return '';
    let instruction = basePrompt + (userInfo ? `\n\n[معلومات عن المستخدم لتعرفه أثناء المحادثة (استخدمها فقط إذا دعت الحاجة)]:\n${userInfo}` : '');
    
    if (isAcademyMode) {
      instruction += `\n\n[ACADEMY MASTERCLASS MODE - محراب التعليم الأكاديمي]:
أنت تعمل الآن داخل نظام "محراب الأكاديمية المنهجي". المطلوب منك تنظيم الحوار بنمط تعليمي وسقراطي مهيب وعالي المنهجية بدلاً من السجال العابر:
1. صغ ردودك بهيكلية واضحة ومحددة العناوين:
   - **المفهوم الجوهري والمنطلق المعرفي**
   - **التشريح التحليلي والأدلة الفلسفية/العلمية**
   - **الدرس والمحصول المعرفي المستخلص**
2. عند توضيح أو خوض أي خوارزميات أو أمثلة برمجية أو أكواد، اكتبها دائماً داخل كتل كود محدودة ومغلقة مع تحديد اسم لغة البرمجة ومسار الملف الموصى به إن أمكن (مثل \`\`\`python src/main.py أو \`\`\`typescript src/components/Dashboard.tsx أو \`\`\`html index.html) ليتم معالجتها في محرر الأكواد التفاعلي المباشر للمستخدم.
3. اختتم ردك دائماً بـ "💡 الدرس المستخلص" ليتمكن الطالب من استخلاصه بضغطة زر واحدة إلى سجل الدروس بالمحراب.`;
    }

    instruction += `\n\n[RAG HIGHLIGHT INSTRUCTION]: 
إذا قمت بذكر حقيقة معينة، اقتباس، أو مفهوم فريد من نوعه يخص معرفتك العميقة أو مصدرك، يجب عليك أحياناً تغليف الكلمة الرئيسية أو العبارة بالصيغة التالية لتظهر في واجهة المستخدم كتلميح مرجعي (Tooltip):
[[الكلمة أو العبارة||نبذة قصيرة جداً (سطر واحد) تشرح السياق أو المصدر]]
مثال: "كما ذكرت في [[نظرية النسبية||نُشرت عام 1915 وتغيّر مفهومنا للزمان والمكان]]، فإن الزمن ليس مطلقاً."
استخدم هذه الصيغة بشكل معتدل (مرة أو مرتين في الرد) عندما تقدم ادعاء واقعي وتاريخي مهم.`;

    instruction += `\n\n[حظر التكرار والمقدمات الزائدة]:
- ابدأ إجابتك فوراً في صلب الفكرة أو السؤال دون تكرار تساؤل المستخدم أو استنساخ كلامه.
- لا تكرر رسائل الترحيب السابقة أو عبارات الافتتاح الجاهزة في كل دور حواري.
- اجعل الحوار متدفقاً، ناضجاً، وخالياً من الحشو أو التكرار غير المفيد.`;

    return instruction;
  };


  const [dynamicModels, setDynamicModels] = useState<string[]>(() => {
    const parsed = safeStorage.parseJSON<any[]>('mindmirror_dynamicModels', []);
    if (parsed.length > 0) {
      return Array.from(new Set([DEFAULT_MODEL, ...parsed, ...GEMINI_MODELS]));
    }
    return GEMINI_MODELS;
  });

  const [dynamicAudioModels, setDynamicAudioModels] = useState<string[]>(() => {
    const defaultAudioModels = [
      DEFAULT_AUDIO_MODEL,
      'gemini-3.8-flash-tts',
      'gemini-3.8-flash-lite-tts',
      'gemini-3.1-flash-tts-preview',
      'gemini-3.8-live',
      'gemini-3.1-flash-live-preview'
    ];
    const parsed = safeStorage.parseJSON<any[]>('mindmirror_dynamicAudioModels', []);
    if (parsed.length > 0) {
      return Array.from(new Set([...defaultAudioModels, ...parsed.filter(m => typeof m === 'string' && (m.includes('tts') || m.includes('live') || m.includes('audio')))]));
    }
    return Array.from(new Set(defaultAudioModels));
  });

  const [dynamicVoices, setDynamicVoices] = useState<string[]>(() => {
    const parsed = safeStorage.parseJSON<any[]>('mindmirror_dynamicVoices', []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return Array.from(new Set([...parsed, ...DEFAULT_30_VOICES]));
    }
    return DEFAULT_30_VOICES;
  });

  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const isUpdatingModelsRef = useRef(false);
  const [isFixingLegacy, setIsFixingLegacy] = useState(false);

  const updateModelsAndVoices = async (customKey?: string, isSilent = false) => {
    if (isUpdatingModelsRef.current || globalIsUpdatingModels) {
      return;
    }
    isUpdatingModelsRef.current = true;
    globalIsUpdatingModels = true;
    const keyToUse = sanitizeApiKey(customKey !== undefined ? customKey : apiKey);
    setIsUpdatingModels(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToUse })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const newModels: string[] = data.models || [];
      
      if (newModels.length > 0) {
          const uniqueModels = Array.from(new Set([DEFAULT_MODEL, ...dynamicModels, ...newModels]));
          setDynamicModels(uniqueModels);
          safeStorage.setItem('mindmirror_dynamicModels', JSON.stringify(uniqueModels));
          
          const uniqueAudioModels = Array.from(new Set([
            DEFAULT_AUDIO_MODEL,
            ...dynamicAudioModels,
            ...newModels.filter(m => m.includes('tts') || m.includes('live') || m.includes('audio'))
          ]));
          setDynamicAudioModels(uniqueAudioModels);
          safeStorage.setItem('mindmirror_dynamicAudioModels', JSON.stringify(uniqueAudioModels));
          
          let syncedCloudVoiceNames: string[] = [];
          try {
            const voicesRes = await fetch(`/api/voices${keyToUse ? `?apiKey=${encodeURIComponent(keyToUse)}` : ''}`);
            if (voicesRes.ok) {
              const voicesData = await voicesRes.json();
              if (Array.isArray(voicesData?.voices)) {
                for (const v of voicesData.voices) {
                  const vid = v?.id || (typeof v?.name === 'string' ? v.name.replace(/^voices\//, '') : '');
                  const vName = (v?.display_name || vid || '').trim();
                  if (vid && vName) {
                    saveClonedVoice({
                      displayName: vName,
                      voiceId: vid,
                      type: 'replicated',
                      model: v?.model || 'gemini-3.8-flash-tts',
                      createdAt: Date.now()
                    });
                    syncedCloudVoiceNames.push(vName);
                  }
                }
              }
            }
          } catch {
            // Optional sync failure does not block models update
          }

          const uniqueVoices = Array.from(new Set([...syncedCloudVoiceNames, ...dynamicVoices, ...DEFAULT_30_VOICES]));
          setDynamicVoices(uniqueVoices);
          safeStorage.setItem('mindmirror_dynamicVoices', JSON.stringify(uniqueVoices));
          
          if (keyToUse) {
            setApiKey(keyToUse);
            setIsApiKeyVerified(true);
            setIsApiKeyInvalid(false);
          }
          
          if (!isSilent) {
            toast({ title: "تم التحديث بنجاح", message: `تم تحديث قائمة النماذج والأصوات بنجاح!`, type: "success" });
          }
      } else {
        if (!isSilent) {
          toast({ title: "تنبيه", message: "لم يتم العثور على نماذج جديدة.", type: "info" });
        }
      }
    } catch (e: any) {
      console.error(e);
      if (!isSilent) {
        const errText = String(e?.message || e || '');
        if (errText.includes('API key') || errText.includes('400')) {
          setIsApiKeyInvalid(true);
          setIsApiKeyVerified(false);
        }
        toast({ 
          title: "فشل التحديث", 
          message: "تعذر التحديث اللحظي للنماذج. يتم استخدام القائمة المحفوظة محلياً.", 
          type: "info" 
        });
      }
    } finally {
      isUpdatingModelsRef.current = false;
      globalIsUpdatingModels = false;
      setIsUpdatingModels(false);
    }
  };

  // Auto-update models & voices silently once on initial platform launch
  useEffect(() => {
    // Dual-lock: module-level global + window-level flag + ref-level check
    if (globalHasBootstrappedModels || (typeof window !== 'undefined' && (window as any).__mindmirror_bootstrapped)) {
      return;
    }
    
    // Check if another instance is already updating
    if (isUpdatingModelsRef.current) return;
    
    globalHasBootstrappedModels = true;
    if (typeof window !== 'undefined') {
      (window as any).__mindmirror_bootstrapped = true;
    }
    
    // Defer slightly to ensure hydration is stable
    const timer = setTimeout(() => {
      updateModelsAndVoices(undefined, true).catch(() => {});
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);

  const updatePersonaTone = (personaKey: string, tone: string) => {
    setPersonas(prev => {
      const updated = { ...prev, [personaKey]: { ...prev[personaKey], ttsTone: tone } };
      safeStorage.setItem('mindmirror_personas', JSON.stringify(updated));
      return updated;
    });
  };

  const updatePersonaVoice = (personaKey: string, voice: string) => {
    setPersonas(prev => {
      const updated = { ...prev, [personaKey]: { ...prev[personaKey], voice: voice as any } };
      safeStorage.setItem('mindmirror_personas', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAIError = (error: any, context: string) => {
    const errorText = String(error?.message || error || '');
    
    const repairReport = selfRepairEngine.runDiagnosticsAndRepair();
    if (repairReport.repairedItems.length > 0) {
      logger.info(`[Auto-Repair] تم ترميم العناصر التالية تلقائياً: ${repairReport.repairedItems.join(' ، ')}`);
    }

    logger.warn(`[${context}] AI Bridge Notice:`, errorText.slice(0, 150));

    if (errorText.includes('404') || errorText.includes('not found')) {
      setModel(DEFAULT_MODEL);
      return `[تنبيه] تم ضبط المحرك تلقائياً على النموذج المستقر (${DEFAULT_MODEL}). يرجى إعادة المحاولة الآن.`;
    }

    if (errorText.includes('429') || errorText.includes('quota') || errorText.includes('RESOURCE_EXHAUSTED')) {
      return 'تجاوز الطلب حد السعة (429). جاري تدوير مفاتيح النظام برمجياً.. يرجى المحاولة بعد ثوانٍ قليلة.';
    }

    return `خطأ في الاتصال بالمحرك (Engine Notice: ${errorText.slice(0, 50)}...). يرجى المحاولة مرة أخرى.`;
  };

  const openSettingsSafely = () => {
    setShowTextDissectorModal(false);
    setShowPersonaExtractorModal(false);
    setShowAgiModal(false);
    setShowSettings(true);
  };

  // Built-in environment keys are always active on the server with silent background rotation.
  const isApiKeyReady = true;
  const requireApiKey = (_actionName?: string): boolean => true;

  const enrichPersonaGreeting = async (name: string, force = false) => {
    if (!name || name === 'debate' || name === 'group_question' || name === 'osint_room') return;
    const currentPersona = personas[name];
    if (!currentPersona) return;

    const isGeneric = 
      !currentPersona.greeting || 
      currentPersona.greeting.includes(`مرحباً، أنا ${name}`) ||
      currentPersona.greeting.includes(`مرحباً بك، أنا ${name}`) ||
      currentPersona.greeting.includes('يسعدني الحوار معك') ||
      currentPersona.greeting.length < 20;

    if (!isGeneric && !force) return;

    try {
      const ai = getGeminiClient();
      const setupPrompt = `أنت الخبير الفلسفي واللغوي في استخراج البصمة المعرفية الرقمية بدقة جراحية متناهية.
بناءً على الاسم والمعرفة العميقة بشخصية "${name}" (تاريخه، عقليته، مصطلحاته، وطبيعة خطابه الفلسفي أو العلمي):
قم باستنباط صياغة جراحية رنانة لرسالة الترحيب وافتتاحية الحوار بصيغة JSON فقط:
1. "greeting": رسالة ترحيبية قصيرة ورنانة (سطر أو سطرين) يفتتح بها الحوار وكأنه هو من يتحدث مباشرة بروحه وهيبته ولغته الخاصة. يمنع منعاً باتاً كتابة "مرحباً أنا فلان" بشكل تقليصي مباشر، بل اجعل الترحيب حياً ينبض بأسلوبه وفلسفته.
2. "suggestions": 3 أسئلة مفصلية عميقة تعبر عن جوهر أفكاره ومواقفه الفكرية ليطرحها المستخدم في بداية اللقاء.

المخرجات المطلوبة: JSON Object فقط بالنمط التالي دون كلام إضافي:
{
  "greeting": "الرسالة الترحيبية المعبرة عن بصمته الفكرية...",
  "suggestions": ["سؤال 1", "سؤال 2", "سؤال 3"]
}`;

      const response = await ai.models.generateContent({
        model: normalizeGeminiModel(model),
        strictModel: isStrictModelMode,
        contents: [{ role: 'user', parts: [{ text: setupPrompt }] }],
        config: { responseMimeType: "application/json" }
      });

      if (response.text) {
        const parsedData = parseJsonSafely(response.text);
        if (parsedData.greeting || (parsedData.suggestions && Array.isArray(parsedData.suggestions))) {
          const newGreeting = parsedData.greeting || currentPersona.greeting;
          const newSuggestions = Array.isArray(parsedData.suggestions) ? parsedData.suggestions : currentPersona.suggestions;

          setPersonas(prev => {
            if (!prev[name]) return prev;
            const updated = {
              ...prev,
              [name]: {
                ...prev[name],
                greeting: newGreeting,
                suggestions: newSuggestions
              }
            };
            safeStorage.setItem('mindmirror_personas', JSON.stringify(updated));
            return updated;
          });

          // If active persona, live-update greeting in current chat session if still on initial message
          if (activePersona === name && newGreeting) {
            setMessages(prev => {
              if (prev.length === 0 || (prev.length === 1 && prev[0].role === 'model')) {
                const updatedMsg = [{ role: 'model' as const, text: newGreeting }];
                setChatHistory(ch => ({ ...ch, [name]: updatedMsg }));
                return updatedMsg;
              }
              return prev;
            });
          }
        }
      }
    } catch (err) {
      logger.warn(`Failed to enrich persona greeting for ${name}:`, err);
    }
  };

  const handleFixLegacyPersonas = async () => {
    
    // Check for personas with default/generic greetings or missing greetings
    let personasToFix = Object.entries(personas).filter(([name, data]) => 
      !data.greeting || 
      data.greeting.includes(`مرحباً، أنا ${name}. تفضل، عمّ تود أن نتحدث؟`) ||
      data.greeting.includes('يسعدني الحوار معك') ||
      data.greeting.length < 15
    );
    
    // If no persona matched the legacy condition, offer to refresh/refine all custom personas
    if (personasToFix.length === 0) {
      personasToFix = Object.entries(personas);
    }
    
    setIsFixingLegacy(true);
    toast({ title: "استخراج البصمة اللغوية", message: `جاري تحليل واستخراج البصمة الرقمية والترحيبية لـ (${personasToFix.length}) شخصيات...`, type: "info" });
    const ai = getGeminiClient();
    
    const updatedPersonas = { ...personas };
    
    try {
      for (const [name, data] of personasToFix) {
          const setupPrompt = `بناءً على المعرفة العامة والفيزيائية والفلسفية بشخصية "${name}" (ومراحل تطوره الفكري):
قم بتكوين أمرين بصيغة JSON فقط:
1. "greeting": رسالة ترحيبية قصيرة ورنانة (سطر أو سطرين) يفتتح بها الحوار بحيث تمثل أسلوبه وطبيعته وشخصيتها ونظرته للأمور وكأنه هو من يتحدث مباشرة. لا تكتب "مرحباً أنا فلان" بشكل تقليصي مباشر، بل اجعل الترحيب حياً يعبر عن فلسفته وعقليته.
2. "suggestions": ثلاثة أسئلة قصيرة وعميقة يمكن للمستخدم أن يسألها له في بداية الحوار وتتعلق بأبرز أفكاره أو مواقفه أو كتبه.

مثال (في حال كان فرويد):
{
  "greeting": "أهلاً بك في العيادة النفسية. اجلس على الأريكة.. ما الذي يزعج عقلك الباطن اليوم وما هو الحلم الذي يخيفك؟",
  "suggestions": ["فسر لي حلم السقوط في الهاوية", "من أين ينبع القلق الإنساني؟", "حدثني عن صراع الأنا والأنا العليا"]
}

يجب أن تعود بصيغة JSON Object فقط دون أي نصوص إضافية.`;
          
          try {
            const response = await ai.models.generateContent({
              model: normalizeGeminiModel(model),
              contents: [{ role: 'user', parts: [{ text: setupPrompt }] }],
              config: {
                responseMimeType: "application/json",
              }
            });
            
            const text = response.text;
            if (text) {
              const parsedData = parseJsonSafely(text);
              if (parsedData.greeting) updatedPersonas[name].greeting = parsedData.greeting;
              if (parsedData.suggestions && Array.isArray(parsedData.suggestions)) updatedPersonas[name].suggestions = parsedData.suggestions;
            }
          } catch (e) {
            handleAIError(e, `تحديث الشخصية: ${name}`);
          }
      }
      
      setPersonas(updatedPersonas);
      safeStorage.setItem('mindmirror_personas', JSON.stringify(updatedPersonas));
      
      // Update active persona if it's currently selected
      if (updatedPersonas[activePersona]) {
        const initialMsg: Message[] = [{ role: 'model', text: updatedPersonas[activePersona]?.greeting || '' }];
        setMessages(initialMsg);
        setChatHistory(prev => ({ ...prev, [activePersona]: initialMsg }));
      }
      
      toast({ title: "تم التحديث بنجاح", message: "تم استخراج البصمات اللغوية وإعادة صياغة رسائل الترحيب لكافة الشخصيات.", type: "success" });
    } catch (e) {
      console.error("Error fixing personas:", e);
      toast({ title: "خطأ", message: "حدث خطأ أثناء تحديث الشخصيات.", type: "error" });
    } finally {
      setIsFixingLegacy(false);
    }
  };

  useEffect(() => {
    setIsApiKeyInvalid(false);
    safeStorage.setItem('mindmirror_apiKey', apiKey);
    safeStorage.setItem('mindmirror_provider', provider);
    safeStorage.setItem('mindmirror_model', model);
    safeStorage.setItem('mindmirror_audioModel', audioModel);
    safeStorage.setItem('mindmirror_ttsVolume', ttsVolume.toString());
    safeStorage.setItem('mindmirror_ttsSpeed', ttsSpeed.toString());
    safeStorage.setItem('mindmirror_userInfo', userInfo);
  }, [apiKey, provider, model, audioModel, ttsVolume, ttsSpeed, userInfo]);

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = () => {
      if (theme === 'plain-text') {
        root.setAttribute('data-theme', 'plain-text');
      } else if (theme === 'calculator-gray') {
        root.setAttribute('data-theme', 'calculator-gray');
      } else if (theme === 'system') {
        const hour = new Date().getHours();
        const isDaytime = hour >= 6 && hour < 18;
        root.setAttribute('data-theme', isDaytime ? 'light' : 'dark');
      } else {
        root.setAttribute('data-theme', theme);
      }
    };

    applyTheme();
    safeStorage.setItem('mindmirror_theme', theme);

    // Update theme every minute only if in system mode
    let interval: any = null;
    if (theme === 'system') {
      interval = setInterval(() => {
        applyTheme();
      }, 60000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [theme]);

  const [isCopyingAll, setIsCopyingAll] = useState(false);
  const handleCopyConversation = () => {
    const text = messages
      .filter(m => !m.isSystem)
      .map(m => `${m.role === 'user' ? 'أنا' : m.persona || 'الذكاء الاصطناعي'}: ${m.text}`)
      .join('\n\n---\n\n');
    copyToClipboard(text);
    setIsCopyingAll(true);
    setTimeout(() => setIsCopyingAll(false), 2000);
  };

  const handleShareConversation = async () => {
    const text = messages
      .filter(m => !m.isSystem)
      .map(m => `${m.role === 'user' ? 'أنا' : m.persona || 'الذكاء الاصطناعي'}: ${m.text}`)
      .join('\n\n---\n\n');
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'مناظرة / محادثة من MindMirror',
          text: text,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          logger.error('Share failed:', err);
        }
      }
    } else {
      handleCopyConversation();
    }
  };

  const activeColor = personas[activePersona]?.color || '#38bdf8';


  const {
    isTTSLoading,
    isAudioPlaying,
    activeSpeechText,
    activeSpeechPersona,
    debatePlaybackState,
    speakingIndex,
    isDownloadingAudio,
    handleSpeak,
    handleSequentialSpeak, // New function name
    handlePlayDebate,
    speakText,
    stopAudio,
    handleDownloadDebateAudio,
    generateTTS,
    clearAudioCache
  } = useTTS({
    apiKey,
    personas,
    ttsVolume,
    ttsSpeed,
    audioModel
  });

  const {
    isExportingVideo,
    exportProgress,
    exportStatusText,
    exportMessageToVideo,
    exportChatHistoryToVideo,
    exportAllCachedAudioFiles
  } = useVideoExport({
    generateTTS,
    personas
  });

  const chatRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const stopGenerationRef = useRef(false);
  const debateSessionRef = useRef(0);
  const autoScrollEnabled = useRef(true);

  const handleCopy = (text: string, index: number) => {
    copyToClipboard(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [activePersona, stopAudio]);

  const [personaToDelete, setPersonaToDelete] = useState<string | null>(null);
  const [personaToEdit, setPersonaToEdit] = useState<string | null>(null);
  
  const deletePersona = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPersonaToDelete(name);
  };

  const confirmDeletePersona = () => {
    if (!personaToDelete || personaToDelete === 'debate' || personaToDelete === 'group_question' || personaToDelete === 'osint_room') return;
    const newPersonas = { ...personas };
    delete newPersonas[personaToDelete];
    setPersonas(newPersonas);
    safeStorage.setItem('mindmirror_personas', JSON.stringify(newPersonas));
    
    const newHistory = { ...chatHistory };
    delete newHistory[personaToDelete];
    setChatHistory(newHistory);
    safeStorage.setItem('mindmirror_history', JSON.stringify(newHistory));

    const remaining = Object.keys(newPersonas).filter(p => p !== 'debate' && p !== 'group_question' && p !== 'osint_room' && p !== 'trend_live');
    if (activePersona === personaToDelete) {
      setActivePersona(remaining[0] || 'سقراط');
    }
    setPersonaToDelete(null);
  };

  const handleExport = () => {
    const chatText = messages.map(m => `${m.role === 'user' ? 'أنت' : (m.persona || activePersona)}:\n${m.text}\n`).join('\n---\n\n');
    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MindMirror_${activePersona.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };



  useEffect(() => {
    safeSetItem('mindmirror_personas', JSON.stringify(personas));
  }, [personas]);

  useEffect(() => {
    safeSetItem('mindmirror_history', JSON.stringify(chatHistory));
    set('mindmirror_history', chatHistory).catch(e => logger.warn("IDB history save error", e));

    // Update last used timestamps map
    try {
      const savedLastUsed = safeStorage.getItem('mindmirror_chatLastUsed');
      const lastUsedMap: Record<string, number> = savedLastUsed ? safeParseJSON(savedLastUsed, {}) : {};
      let changed = false;

      // Ensure all current keys in history have a timestamp
      Object.keys(chatHistory).forEach(key => {
        if (chatHistory[key] && chatHistory[key].length > 0) {
          if (!lastUsedMap[key]) {
            lastUsedMap[key] = Date.now();
            changed = true;
          }
        }
      });

      // Update the active persona's timestamp
      if (chatHistory[activePersona] && chatHistory[activePersona].length > 0) {
        lastUsedMap[activePersona] = Date.now();
        changed = true;
      }

      if (changed) {
        safeStorage.setItem('mindmirror_chatLastUsed', JSON.stringify(lastUsedMap));
      }
    } catch (e) {
      logger.error('Failed to sync last used timestamps', e);
    }
  }, [chatHistory, activePersona]);

  useEffect(() => {
    safeSetItem('mindmirror_activePersona', activePersona);
    set('mindmirror_activePersona', activePersona).catch(e => logger.warn("IDB activePersona save error", e));
  }, [activePersona]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        safeStorage.setItem('mindmirror_history', JSON.stringify(chatHistory));
        safeStorage.setItem('mindmirror_activePersona', activePersona);
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [chatHistory, activePersona]);

  // Archive sweep logic
  const manuallyArchiveOldChats = () => {
    try {
      const savedLastUsed = safeStorage.getItem('mindmirror_chatLastUsed');
      const lastUsedMap: Record<string, number> = savedLastUsed ? safeParseJSON(savedLastUsed, {}) : {};
      
      const newChatHistory = { ...chatHistory };
      const newArchivedChats = { ...archivedChats };
      let hasChanged = false;

      const thresholdMs = archiveThresholdDays * 24 * 60 * 60 * 1000;
      const now = Date.now();

      Object.keys(newChatHistory).forEach(key => {
        // Don't archive the currently active conversation
        if (key === activePersona) return;
        const msgs = newChatHistory[key];
        if (!msgs || msgs.length === 0) return;

        const lastUsed = lastUsedMap[key] || now;
        const idleTime = now - lastUsed;

        if (idleTime > thresholdMs) {
          newArchivedChats[key] = msgs;
          delete newChatHistory[key];
          hasChanged = true;
        }
      });

      if (hasChanged) {
        setChatHistory(newChatHistory);
        setArchivedChats(newArchivedChats);
        logger.info('Archived inactive chats:', Object.keys(newArchivedChats));
      }
    } catch (e) {
      logger.error('Error during manually archiving sweep', e);
    }
  };

  // Auto-archive trigger on option enable / threshold change
  useEffect(() => {
    if (autoArchiveEnabled) {
      const timer = setTimeout(() => {
        manuallyArchiveOldChats();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoArchiveEnabled, archiveThresholdDays]);

  const restoreChat = (key: string) => {
    if (!archivedChats[key]) return;
    const newChatHistory = { ...chatHistory };
    newChatHistory[key] = archivedChats[key];
    
    const newArchivedChats = { ...archivedChats };
    delete newArchivedChats[key];

    // Mark it as used right now to prevent instant re-archiving
    try {
      const savedLastUsed = safeStorage.getItem('mindmirror_chatLastUsed');
      const lastUsedMap: Record<string, number> = savedLastUsed ? safeParseJSON(savedLastUsed, {}) : {};
      lastUsedMap[key] = Date.now();
      safeStorage.setItem('mindmirror_chatLastUsed', JSON.stringify(lastUsedMap));
    } catch (e) {
      logger.error('Error updating lastUsed on restore', e);
    }

    setChatHistory(newChatHistory);
    setArchivedChats(newArchivedChats);
    setActivePersona(key);
  };

  const deleteArchivedChat = (key: string) => {
    const newArchivedChats = { ...archivedChats };
    delete newArchivedChats[key];
    setArchivedChats(newArchivedChats);
  };

  const downloadArchiveFile = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(archivedChats, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `mindmirror_archive_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      logger.error('Error downloading archive file', e);
    }
  };

  useEffect(() => {
    safeSetItem('mindmirror_activePersona', activePersona);
  }, [activePersona]);

  useEffect(() => {
    safeSetItem('mindmirror_debateConfig', JSON.stringify(debateConfig));
  }, [debateConfig]);

  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isFullScreen]);

  const handleStartChatWithPerson = (personName: string) => {
    if (!personName) return;
    const trimmed = personName.trim();
    if (personas[trimmed]) {
      setActivePersona(trimmed);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      enrichPersonaGreeting(trimmed);
      toast({
        title: `محادثة مباشرة مع ${trimmed}`,
        message: `تم الانتقال لتجسيد ${trimmed} بنجاح.`,
        type: 'success'
      });
    } else {
      const newP: PersonaData = {
        label: trimmed,
        prompt: `أنت ${trimmed}. أجب باللغة العربية بلسان وأسلوب ورؤية وقناعات ${trimmed} بالكامل. تحدث بعمق ودقة ولا تذكر أبداً أنك نموذج ذكاء اصطناعي.`,
        greeting: `مرحباً بك، أنا ${trimmed}. يسعدني الحوار معك ومناقشة الرؤى والأفكار سوياً. ما الذي تشود مناقشته؟`,
        suggestions: [`ما هي رؤيتك للوجود والحقيقة؟`, `كيف ترى مستقبل الإنسان والتكنولوجيا؟`, `ما هو أهم موقف فكري تتبناه؟`],
        color: '#38bdf8',
        avatarUrl: `/api/persona-portrait?name=${encodeURIComponent(trimmed)}`,
        voice: 'Puck',
        ttsTone: 'تلقائي'
      };
      const updated = { ...personas, [trimmed]: newP };
      setPersonas(updated);
      safeStorage.setItem('mindmirror_personas', JSON.stringify(updated));
      setActivePersona(trimmed);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      enrichPersonaGreeting(trimmed, true);
      toast({
        title: `تم إضافة وتفعيل تجسيد ${trimmed}`,
        message: `تم استخراج البصمة وإضافة ${trimmed} بنجاح!`,
        type: 'success'
      });
    }
  };

  const submitNewPersona = async () => {
    if (!newPersonaName.trim()) {
      setIsAddingPersona(false);
      return;
    }
    const name = newPersonaName.trim();
    if (!personas[name]) {
      const randomColors = ['#38bdf8', '#ef4444', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#60a5fa'];
      const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)];
      
      const defaultPrompt = `أنت ${name}. أجب باللغة العربية. تقمص شخصيته بدقة، أسلوبه في الحديث، طريقة تفكيره، ومفرداته المعتادة. أجب بناءً على ما يُعرف عنه من آراء ومواقف. لا تذكر أبداً أنك ذكاء اصطناعي.`;
      
      let generatedGreeting = `مرحباً، أنا ${name}. تفضل، عمّ تود أن نتحدث؟`;
      let generatedSuggestions = ['من أنت؟', 'بماذا تنصحني؟', 'ما هي أهم أفكارك؟'];
      
      // Build persona seamlessly
      setIsLoading(true);
      setMessages([]); // Clear messages to show loading state
      try {
        const ai = getGeminiClient();
          const setupPrompt = `بناءً على المعرفة العامة بشخصية "${name}"، قم بتكوين أمرين بصيغة JSON فقط:
1. "greeting": رسالة ترحيبية قصيرة (سطر أو سطرين) يفتتح بها الحوار بحيث تمثل أسلوبه وطبيعته وشخصيته ونظرته للأمور وكأنه هو من يتحدث. لا تكتب "مرحباً أنا فلان" بشكل مباشر وممل، بل اجعل الترحيب يعكس روحه.
2. "suggestions": ثلاثة أسئلة قصيرة يمكن للمستخدم أن يسألها له في بداية الحوار وتتعلق بأبرز أفكاره أو مواقفه.

مثال للناجح (في حال كان فرويد):
{
  "greeting": "أهلاً بك. اجلس هنا. ما الذي يزعج عقلك الباطن اليوم وما هو الحلم الذي يخيفك؟",
  "suggestions": ["فسر لي حلمي القط، يطير", "مما يأتي القلق؟", "حدثني عن العقدة"]
}

يجب أن تعود بصيغة JSON Object فقط.`;
          
          let responseText = '';
          const activeM = normalizeGeminiModel(model);
          const models = Array.from(new Set([activeM, 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-robotics-er-2-preview']));
          
          for (const m of models) {
            try {
              logger.info(`Generating persona initialization`, { model: m, persona: name });
              const response = await ai.models.generateContent({
                model: m,
                contents: [{ role: 'user', parts: [{ text: setupPrompt }] }],
                config: {
                  responseMimeType: "application/json",
                }
              });
              responseText = response.text || '';
              break;
            } catch (error: any) {
              logger.warn(`Model ${m} failed for persona init:`, error?.message || error);
              if (m !== models[models.length - 1]) {
                continue;
              }
              logger.warn("All candidate models failed for persona init; proceeding with default greeting and suggestions.");
            }
          }
          
          if (responseText) {
            const data = parseJsonSafely<any>(responseText, {});
            if (data?.greeting) generatedGreeting = data.greeting;
            if (Array.isArray(data?.suggestions)) generatedSuggestions = data.suggestions;
          }
        } catch (e) {
          handleAIError(e, "تكوين الشخصية الجديدة");
        } finally {
          setIsLoading(false);
          setActivePersona(name); // Switch right after ending loading
          setNewPersonaName('');
          setIsAddingPersona(false);
        }

      setPersonas(prev => ({
        ...prev,
        [name]: {
          label: name.toUpperCase(),
          prompt: defaultPrompt,
          greeting: generatedGreeting,
          suggestions: generatedSuggestions,
          color: randomColor,
          avatarUrl: `/api/persona-portrait?name=${encodeURIComponent(name)}`,
          voice: 'Puck',
          ttsTone: 'تلقائي'
        }
      }));
    } else {
       setActivePersona(name);
       setNewPersonaName('');
       setIsAddingPersona(false);
    }
  };

  const handleAddPersonas = (newPersonas: Record<string, any>) => {
    const normalizedNew: Record<string, any> = {};
    for (const [k, v] of Object.entries(newPersonas || {})) {
      const cleanK = k.trim();
      if (!cleanK) continue;
      normalizedNew[cleanK] = {
        ...v,
        avatarUrl: v?.avatarUrl || `/api/persona-portrait?name=${encodeURIComponent(cleanK)}`
      };
    }
    setPersonas(prev => {
      const merged = { ...prev, ...normalizedNew };
      safeStorage.setItem('mindmirror_personas', JSON.stringify(merged));
      return merged;
    });
    // Trigger surgical greeting derivation and background avatar generation for all newly added personas
    Object.keys(normalizedNew).forEach(pName => {
      enrichPersonaGreeting(pName);
      prefetchPersonaAvatarAssets(pName);
    });
  };

  const handleSelectSearchResult = (personaKey: string, msgIdx: number) => {
    setActivePersona(personaKey);
    setTimeout(() => {
      const element = document.getElementById(`msg-${msgIdx}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-amber-500/60', 'rounded-2xl', 'transition-all', 'duration-500');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-amber-500/60');
        }, 3000);
      }
    }, 350);
  };

  const handleEditPersonaSave = async (name: string, newContext: string, newIcon?: string) => {
    // Update persona seamlessly
    
    setIsLoading(true);
    let updatedPrompt = personas[name].prompt;
    if (newContext.trim()) {
       updatedPrompt = `أنت ${name}. أجب باللغة العربية. تقمص شخصيته بدقة بناءً على هذا السياق والتوجيه الإضافي: (${newContext}). استخدم أسلوبه في الحديث، طريقة تفكيره، ومفرداته المعتادة. أجب بناءً على ما يُعرف عنه من آراء ومواقف في السياق المذكور. لا تذكر أبداً أنك ذكاء اصطناعي.`;
    }

    let generatedGreeting = personas[name].greeting;
    let generatedSuggestions = personas[name].suggestions;

    try {
      if (newContext.trim()) {
        const ai = getGeminiClient();
        const setupPrompt = `بناءً على طلب تحديث بصمة شخصية "${name}"، مع الأخذ بالاعتبار السياق التوضيحي التالي: "${newContext}".
  قم بتكوين أمرين بصيغة JSON فقط لتعكس هذا الطبع بدقة:
  1. "greeting": رسالة ترحيبية قصيرة (سطر أو سطرين) يفتتح بها الحوار بحيث تمثل أسلوبه وطبيعته وشخصيته ونظرته للأمور كما هي محددة في السياق التوضيحي، وكأنه هو من يتحدث. 
  2. "suggestions": ثلاثة أسئلة قصيرة يمكن للمستخدم أن يسألها له في بداية الحوار وتتعلق بأبرز أفكاره في هذا السياق التوضيحي.
  
  مثال للنجاح:
  {
    "greeting": "أهلاً بك. اجلس هنا...",
    "suggestions": ["سؤال 1", "سؤال 2", "سؤال 3"]
  }
  
  يجب أن تعود بصيغة JSON Object فقط.`;
        
        let responseText = '';
        const activeM = normalizeGeminiModel(model);
        const models = Array.from(new Set([activeM, 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-robotics-er-2-preview']));
        for (const m of models) {
          try {
            const response = await ai.models.generateContent({
              model: m,
              contents: setupPrompt,
              config: { responseMimeType: "application/json" }
            });
            responseText = response.text || '';
            break;
          } catch (error: any) {
            logger.warn(`Model ${m} failed for persona edit:`, error?.message || error);
            if (m !== models[models.length - 1]) continue;
            logger.warn("All candidate models failed for persona edit; keeping existing greeting and suggestions.");
          }
        }
        
        if (responseText) {
          const data = parseJsonSafely<any>(responseText, {});
          if (data?.greeting) generatedGreeting = data.greeting;
          if (Array.isArray(data?.suggestions)) generatedSuggestions = data.suggestions;
        }
      }

      setPersonas(prev => ({
        ...prev,
        [name]: { 
          ...prev[name], 
          prompt: updatedPrompt, 
          greeting: generatedGreeting, 
          suggestions: generatedSuggestions,
          icon: newIcon
        }
      }));
      setPersonaToEdit(null);
      
      // Update chat history for this persona if it exists
      const initialMsg: Message[] = [{ role: 'model', text: generatedGreeting }];
      setChatHistory(prev => ({ ...prev, [name]: initialMsg }));
      if (activePersona === name) {
        setMessages(initialMsg);
      }
      
      toast({ title: "تم التحديث", message: "تم تحديث البصمة الرقمية للشخصية بنجاح.", type: "success" });
    } catch (e) {
      handleAIError(e, "تحديث الشخصية");
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (activePersona === 'debate') return;
    setDynamicSuggestions([]);
    setEditingIndex(null);
    const initialMsg: Message[] = [{ role: 'model', text: personas[activePersona]?.greeting || '' }];
    setMessages(initialMsg);
    setChatHistory(prev => ({ ...prev, [activePersona]: initialMsg }));
    const ai = getGeminiClient();
    
    const config: any = {
      systemInstruction: buildSystemInstruction(personas[activePersona]?.prompt || ''),
      temperature: 0.7,
    };
    if (isWebSearchEnabled) {
      config.tools = [{ googleSearch: {} }];
    }

    chatRef.current = ai.chats.create({
      model: model,
      config,
      isStrict: isStrictModelMode
    });
  };

  const requestClearChat = () => {
    if (messages.length <= 1 && (!messages[0] || messages[0].role === 'model')) {
      clearChat();
      return;
    }
    setShowClearChatConfirm(true);
  };

  const confirmClearChat = () => {
    clearChat();
    setShowClearChatConfirm(false);
  };

  const handleFactoryReset = async () => {
    try {
      safeStorage.clear();
      await Promise.allSettled([clearIdb(), clearAudioCacheFromStorage()]);
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.location.reload();
      }
    } catch (e) {
      logger.error('Failed to reset storage:', e);
      window.location.reload();
    }
  };

  const getChatConfig = (personaPrompt: string) => {
    const config: any = {
      systemInstruction: buildSystemInstruction(personaPrompt),
      temperature: 0.7,
    };
    if (isWebSearchEnabled) {
      config.tools = [{ googleSearch: {} }];
    }
    return config;
  };

  const initializeChatSession = (history: Message[], persona: string) => {
    try {
      const ai = getGeminiClient();
      const formattedHistory = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
      const config = getChatConfig(personas[persona]?.prompt || '');
      
      chatRef.current = ai.chats.create({
        model: model,
        history: formattedHistory,
        config,
        isStrict: isStrictModelMode
      });
    } catch (e) {
      logger.error("Failed to create chat session:", e);
    }
  };

  const prevPersonaRef = useRef<string | null>(null);
  const prevActivePromptRef = useRef<string>('');

  useEffect(() => {
    setDynamicSuggestions([]);
    setEditingIndex(null);
    
    // Only load from chatHistory if the persona has actually changed
    const history = chatHistory[activePersona] || [];
    const activePrompt = personas[activePersona]?.prompt || '';
    const promptChanged = prevActivePromptRef.current !== activePrompt;
    prevActivePromptRef.current = activePrompt;
    
    if (prevPersonaRef.current !== activePersona) {
      if (activePersona === 'debate' || activePersona === 'group_question' || activePersona === 'osint_room') {
        setMessages(history);
      } else if (!personas[activePersona]) {
        // Ignore
      } else if (history.length === 0) {
        const defaultMsg = { role: 'model' as const, text: personas[activePersona]?.greeting || '' };
        setMessages([defaultMsg]);
        setChatHistory(prev => ({ ...prev, [activePersona]: [defaultMsg] }));
        initializeChatSession([], activePersona);
      } else {
        setMessages(history);
        initializeChatSession(history, activePersona);
      }
      prevPersonaRef.current = activePersona;
    } else if (activePersona !== 'debate' && activePersona !== 'group_question' && activePersona !== 'osint_room' && promptChanged) {
      if (personas[activePersona]) {
        initializeChatSession(history, activePersona);
      }
    } else if ((activePersona === 'debate' || activePersona === 'group_question' || activePersona === 'osint_room') && !isLoading) {
      setMessages(history);
    }
  }, [activePersona]);

  useEffect(() => {
    if (activePersona && personas[activePersona]) {
      enrichPersonaGreeting(activePersona);
    }
  }, [activePersona]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    autoScrollEnabled.current = isNearBottom;
    setShowScrollButton(!isNearBottom);
  };

  useEffect(() => {
    if (autoScrollEnabled.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
      });
    }
  }, [messages]);

  useEffect(() => {
    // Scroll to interactive simulation board on initial load
    setTimeout(() => {
      const chatSection = document.getElementById('chat-section');
      if (chatSection) {
        chatSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 500);
  }, []);

  const generateSuggestions = async (aiResponse: string) => {
    if (isApiKeyInvalid) return;
    try {
      const cacheKey = `suggestions_${activePersona}_${aiResponse.substring(0, 50)}_${aiResponse.length}`;
      try {
        const cached = await get<string[]>(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          setDynamicSuggestions(cached.slice(0, 3));
          logger.info("Using cached suggestions");
          return;
        }
      } catch (e) {
        logger.warn("IDB read error in suggestions", e);
      }

      const ai = getGeminiClient();
      let response;

      try {
        response = await withRetry(() => ai.models.generateContent({
          model: model,
          strictModel: isStrictModelMode,
          contents: `بناءً على هذا الرد من شخصية ${activePersona}، اقترح 3 ردود قصيرة جداً (لا تتجاوز 5 كلمات لكل رد) يمكن للمستخدم أن يرد بها.
الرد: "${aiResponse}"
أرجع النتيجة كمصفوفة JSON فقط، بدون أي نص إضافي.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }), 1, 1000); 
      } catch (err) {
        logger.warn("Auto-suggestions AI error:", err);
        return;
      }

      if (!response) return;
      
      const suggestions = parseJsonSafely<string[]>(response.text || '[]', []);
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        const finalSuggestions = suggestions.slice(0, 3);
        setDynamicSuggestions(finalSuggestions);
        set(cacheKey, finalSuggestions).catch(e => logger.warn("IDB write error in suggestions", e));
      }
    } catch (err) {
      logger.error("Failed to generate suggestions", err);
    }
  };

  const buildGeminiContents = (msgs: Message[]) => {
    // Filter out system messages and empty content
    const relevantMsgs = msgs.filter(m => !m.isSystem && m.text && m.text.trim().length > 0);
    
    // Ensure the conversation begins with a user turn so Gemini API doesn't error out on leading model turn
    const firstUserIndex = relevantMsgs.findIndex(m => m.role === 'user');
    const validTurns = firstUserIndex >= 0 ? relevantMsgs.slice(firstUserIndex) : relevantMsgs;

    // Smart pruning: keep only the last 16 non-system messages
    const sliced = validTurns.length > 16 ? validTurns.slice(-16) : [...validTurns];
    
    // Guarantee that after slicing, it still begins with a user turn
    while (sliced.length > 0 && sliced[0].role !== 'user') {
      sliced.shift();
    }

    if (sliced.length === 0) {
      return [{ role: 'user', parts: [{ text: 'مرحباً' }] }];
    }
    
    return sliced.map(msg => {
      const parts: any[] = [];
      if (msg.files && msg.files.length > 0) {
        msg.files.forEach(f => parts.push({ inlineData: { data: f.data, mimeType: f.mimeType } }));
      }
      parts.push({ text: msg.text });
      return { role: msg.role === 'model' ? 'model' : 'user', parts };
    });
  };

  const processModelResponse = async (userMsg: string, currentMessages: Message[], bypassCache: boolean = false) => {
    // Process model response seamlessly
    setIsLoading(true);
    stopGenerationRef.current = false;
    
    const targetPersona = activePersona === 'debate' ? debateConfig.participants[0] : activePersona;
    setMessages([...currentMessages, { role: 'model', text: '', persona: targetPersona }]);

    const contents = buildGeminiContents(currentMessages);
    const cacheKey = `text_${activePersona}_${JSON.stringify(contents)}`;
    let cachedText: string | null = null;

    if (!bypassCache) {
      try {
        cachedText = await get<string>(cacheKey);
        if (cachedText && (cachedText.startsWith('[تنبيه') || cachedText.startsWith('خطأ') || cachedText.startsWith('تجاوز') || cachedText.length < 5)) {
          cachedText = null;
        }
      } catch (e) {
        logger.warn("IDB read error in processModelResponse", e);
      }
    }

    if (cachedText) {
      logger.info("Using cached model response");
      let fullText = cachedText;
      let currentText = '';
      const words = fullText.split(' ');
      let wordIndex = 0;
      
      const interval = setInterval(() => {
        if (stopGenerationRef.current || wordIndex >= words.length) {
          clearInterval(interval);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], text: fullText };
            return updated;
          });
          setChatHistory(prev => ({ ...prev, [activePersona]: [...currentMessages, { role: 'model', text: fullText, persona: targetPersona }] }));
          setIsLoading(false);
          if (activePersona !== 'debate') {
            generateSuggestions(fullText);
          }
          return;
        }
        
        currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
        wordIndex++;
        
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], text: currentText };
          return updated;
        });
      }, 30);
      return;
    }

    try {
      logger.info(`processModelResponse: Sending with key: ${getApiKey().substring(0, 5)}...`);
      const ai = getGeminiClient();

      const sysInstruction = buildSystemInstruction(personas[targetPersona]?.prompt || '');
      const reqConfig: any = {};
      if (sysInstruction) {
        reqConfig.systemInstruction = sysInstruction;
      }
      if (isWebSearchEnabled) {
        reqConfig.tools = [{ googleSearch: {} }];
      }

      const activeM = normalizeGeminiModel(model);
      const candidateModels = Array.from(new Set([activeM, 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-robotics-er-2-preview']));
      let fullText = '';
      let lastErr: any = null;

      for (const m of candidateModels) {
        if (stopGenerationRef.current) break;
        try {
          setUsedModelName(m);
          logger.info(`Attempting model generation`, { model: m, persona: targetPersona });
          
          let responseStream;
          try {
            responseStream = await withRetry(() => ai.models.generateContentStream({
              model: m,
              strictModel: isStrictModelMode,
              contents,
              config: reqConfig
            }), 1, 1000);
          } catch (streamInitErr) {
            logger.warn(`Stream init failed for candidate ${m}, trying non-streaming fallback:`, streamInitErr);
          }

          let accumulatedText = '';
          if (responseStream) {
            try {
              let lastUpdate = 0;
              for await (const chunk of responseStream) {
                if (stopGenerationRef.current) break;
                const cText = chunk.text || '';
                accumulatedText += cText;
                const now = Date.now();
                if (now - lastUpdate > 50) {
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...updated[updated.length - 1], text: accumulatedText };
                    return updated;
                  });
                  lastUpdate = now;
                }
              }
            } catch (chunkErr) {
              logger.warn(`Error reading stream chunks for model candidate ${m}:`, chunkErr);
            }
          }

          // Fallback: If streaming yielded empty text, try direct generateContent
          if (!accumulatedText.trim() && !stopGenerationRef.current) {
            logger.info(`Stream yielded empty text for ${m}. Attempting non-streaming generateContent fallback...`);
            const directRes: any = await withRetry(() => ai.models.generateContent({
              model: m,
              strictModel: isStrictModelMode,
              contents,
              config: reqConfig
            }), 1, 1000);
            accumulatedText = typeof directRes?.text === 'function' ? directRes.text() : (directRes?.text || '');
          }

          if (accumulatedText.trim()) {
            fullText = accumulatedText;
            break;
          }
        } catch (err: any) {
          logger.warn(`Model candidate ${m} failed in processModelResponse:`, err?.message || err);
          lastErr = err;
        }
      }

      if (!fullText.trim()) {
        if (lastErr) throw lastErr;
        throw new Error('عذراً، لم يتسنَّ تلقي نص الإجابة من النموذج الحركي. انقر على زر إعادة التوليد للمحاولة مجدداً.');
      }

      setIsApiKeyVerified(true);
      setIsApiKeyInvalid(false);

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], text: fullText };
        return updated;
      });
      
      setChatHistory(prev => ({ ...prev, [activePersona]: [...currentMessages, { role: 'model', text: fullText, persona: targetPersona }] }));
      
      if (fullText && !bypassCache && !fullText.startsWith('[تنبيه') && !fullText.startsWith('خطأ') && !fullText.startsWith('تجاوز')) {
        set(cacheKey, fullText).catch(e => logger.warn("IDB write error in chat response", e));
      }

      if (activePersona !== 'debate') {
        generateSuggestions(fullText);
      }
    } catch (error) {
      const errorMsg = handleAIError(error, "محادثة");
        
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], text: errorMsg };
        return updated;
      });
      setChatHistory(prev => ({ ...prev, [activePersona]: [...currentMessages, { role: 'model', text: errorMsg, persona: targetPersona }] }));
    } finally {
      setIsLoading(false);
      stopGenerationRef.current = false;
    }
  };

  const handleSendMessage = async (textOverride?: string, filesOverride?: any[]) => {
    const userMsg = typeof textOverride === 'string' ? textOverride.trim() : '';
    const filesToSend = filesOverride || [];
    if ((!userMsg && filesToSend.length === 0) || isLoading) return;
    
    setDynamicSuggestions([]);
    
    const newMessages: Message[] = [...messages, { role: 'user', text: userMsg, files: filesToSend }];
    setMessages(newMessages);
    setChatHistory(prev => ({ ...prev, [activePersona]: newMessages }));
    
    if (activePersona === 'debate') {
      const currentRounds = newMessages.filter(m => !m.isSystem).length;
      await runDebateLoop(debateConfig.participants, debateConfig.topic, newMessages, currentRounds + debateConfig.participants.length, undefined, debateConfig.debateId);
      return;
    }

    if (activePersona === 'group_question') {
      const currentRounds = newMessages.filter(m => !m.isSystem).length;
      await runGroupQuestionLoop(groupQuestionConfig.participants, groupQuestionConfig.question, groupQuestionConfig.sessionStyle, newMessages, currentRounds + groupQuestionConfig.participants.length, undefined, groupQuestionConfig.groupQuestionId, false, groupQuestionConfig.newsRadar);
      return;
    }

    if (activePersona === 'osint_room') {
      const currentRounds = newMessages.filter(m => !m.isSystem).length;
      await runOsintInvestigationLoop(
        osintRoomConfig.analysts,
        osintRoomConfig.targetQuery,
        osintRoomConfig.investigationMode,
        osintRoomConfig.depth,
        newMessages,
        currentRounds + osintRoomConfig.analysts.length,
        undefined,
        osintRoomConfig.sessionId,
        false
      );
      return;
    }
    
    await processModelResponse(userMsg, newMessages);
  };

  const handleRegenerate = async (targetModelIndex?: number) => {
    if (messages.length < 2 || isLoading) return;
    
    setDynamicSuggestions([]);

    if (activePersona === 'debate') {
      const targetIdx = targetModelIndex !== undefined ? targetModelIndex : messages.length - 1;
      const newHistory = messages.slice(0, targetIdx);
      
      setMessages(newHistory);
      setChatHistory(prev => ({ ...prev, debate: newHistory }));
      
      const participants = debateConfig.participants;
      const topic = debateConfig.topic;
      const currentRounds = newHistory.filter(m => !m.isSystem).length;
      
      await runDebateLoop(participants, topic, newHistory, currentRounds + participants.length, undefined, debateConfig.debateId, true);
      return;
    }

    if (activePersona === 'group_question') {
      const targetIdx = targetModelIndex !== undefined ? targetModelIndex : messages.length - 1;
      const newHistory = messages.slice(0, targetIdx);
      
      setMessages(newHistory);
      setChatHistory(prev => ({ ...prev, group_question: newHistory }));
      
      const participants = groupQuestionConfig.participants;
      const question = groupQuestionConfig.question;
      const sessionStyle = groupQuestionConfig.sessionStyle;
      const currentRounds = newHistory.filter(m => !m.isSystem).length;
      
      await runGroupQuestionLoop(participants, question, sessionStyle, newHistory, currentRounds + participants.length, undefined, groupQuestionConfig.groupQuestionId, true, groupQuestionConfig.newsRadar);
      return;
    }

    if (activePersona === 'osint_room') {
      const targetIdx = targetModelIndex !== undefined ? targetModelIndex : messages.length - 1;
      const newHistory = messages.slice(0, targetIdx);
      
      setMessages(newHistory);
      setChatHistory(prev => ({ ...prev, osint_room: newHistory }));
      
      const currentRounds = newHistory.filter(m => !m.isSystem).length;
      await runOsintInvestigationLoop(
        osintRoomConfig.analysts,
        osintRoomConfig.targetQuery,
        osintRoomConfig.investigationMode,
        osintRoomConfig.depth,
        newHistory,
        currentRounds + 1,
        undefined,
        osintRoomConfig.sessionId,
        true
      );
      return;
    }
    
    let lastUserIndex = targetModelIndex !== undefined ? targetModelIndex - 1 : messages.length - 1;
    while (lastUserIndex >= 0 && messages[lastUserIndex].role !== 'user') {
      lastUserIndex--;
    }
    
    if (lastUserIndex < 0) return;
    
    const lastUserMsg = messages[lastUserIndex].text;
    const newHistory = messages.slice(0, lastUserIndex);
    const updatedMessages = [...newHistory, messages[lastUserIndex]];
    
    setMessages(updatedMessages);
    setChatHistory(prev => ({ ...prev, [activePersona]: updatedMessages }));
    
    await processModelResponse(lastUserMsg, updatedMessages, true);
  };

  const saveEdit = async (idx: number, newText: string) => {
    if (!newText.trim() || isLoading) return;
    
    const newMsgText = newText.trim();
    setDynamicSuggestions([]);
    
    const newHistory = messages.slice(0, idx);
    const editedMsg = { ...messages[idx], text: newMsgText };
    const updatedMessages = [...newHistory, editedMsg];
    
    setMessages(updatedMessages);
    setChatHistory(prev => ({ ...prev, [activePersona]: updatedMessages }));
    
    // Re-initialize chat session
    initializeChatSession(updatedMessages, activePersona);
    
    await processModelResponse(newMsgText, updatedMessages, true);
  };

  const startDebate = async () => {
    // Start debate seamlessly
    if (!debateConfig.topic.trim()) return;
    const uniqueParticipants = new Set(debateConfig.participants);
    if (uniqueParticipants.size !== debateConfig.participants.length) {
      return; // Prevent starting if there are duplicate participants
    }

    // Stop ongoing loops
    stopGenerationRef.current = true;
    debateSessionRef.current++;
    const sessionId = debateSessionRef.current;

    // Generate a fresh debateId for this run so it bypasses the cache of any previous runs of the same topic
    const freshDebateId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    setDebateConfig(prev => ({ ...prev, debateId: freshDebateId }));

    setShowDebateModal(false);
    
    const participants = debateConfig.participants;
    const topic = debateConfig.topic;
    
    const initialMsgs: Message[] = [
      { role: 'model', text: `موضوع المناظرة: ${topic}\n\nالمشاركون: ${participants.join(' ضد ')}.`, isSystem: true }
    ];

    // Update history first, then switch persona to ensure the useEffect sees the right data
    setChatHistory(prev => ({ ...prev, debate: initialMsgs }));
    setMessages(initialMsgs);
    setActivePersona('debate');
    
    await runDebateLoop(participants, topic, initialMsgs, participants.length * 2, sessionId, freshDebateId, true);
  };

  const runDebateLoop = async (participants: string[], topic: string, startMsgs: Message[], targetRounds = 4, sessionId?: number, debateId?: string, bypassCache = false) => {
    // Conduct debate seamlessly
    const currentSession = sessionId || ++debateSessionRef.current;
    if (!sessionId) debateSessionRef.current = currentSession;

    setIsLoading(true);
    stopGenerationRef.current = false;
    let currentMsgs = [...startMsgs];
    const ai = getGeminiClient();

    const nonSystemMsgs = currentMsgs.filter(m => !m.isSystem);
    const startIndex = nonSystemMsgs.length;

    let nextSpeakerIdx = 0;
    const lastModelMsg = [...nonSystemMsgs].reverse().find(m => m.role === 'model');
    if (lastModelMsg && lastModelMsg.persona) {
      const lastIdx = participants.indexOf(lastModelMsg.persona);
      if (lastIdx !== -1) {
        nextSpeakerIdx = (lastIdx + 1) % participants.length;
      }
    } else if (nonSystemMsgs.length > 0 && nonSystemMsgs[nonSystemMsgs.length - 1].role === 'user') {
      nextSpeakerIdx = 0;
    } else {
      nextSpeakerIdx = startIndex % participants.length;
    }

    try {                
      for (let i = startIndex; i < targetRounds; i++) {
      if (stopGenerationRef.current || currentSession !== debateSessionRef.current) break;
      const speaker = participants[nextSpeakerIdx];
      nextSpeakerIdx = (nextSpeakerIdx + 1) % participants.length;
      
      const opponents = participants.filter(p => p !== speaker);

      let progressionInstruction = "";
      const extensionLevel = Math.floor(i / participants.length);
      
      if (extensionLevel === 1) {
         progressionInstruction = "ملاحظة هامة (تعليمات خلفية): لتجنب التكرار والأنماط الرتيبة، ابدأ ردك بفكرة جديدة كلياً أو مثال واقعي حقيقي. يُمنع التثبيت على نفس الفكرة التي كررتها سابقاً.";
      } else if (extensionLevel === 2) {
         progressionInstruction = "ملاحظة هامة (تعليمات خلفية): النقاش يتعمق. ركز الآن على الحلول الملموسة أو التداعيات البعيدة المدى بدلاً من التنظير المكرر. هاجم حجة خصمك الأخيرة واكشف مواطن ضعفها.";
      } else if (extensionLevel >= 3) {
         progressionInstruction = "ملاحظة هامة جداً (تعليمات خلفية): النقاش طال جداً. يُمنع تكرار أي حجة أو صيغة تعبيرية سابقة لك. قدم استنتاجاً حاسماً ونوعياً ينهي دورك بقوة فكرية وبلاغية عالية.";
      }

      // 🎨 كسر الرتابة البصرية والنمطية عبر تنويع هيكلية وطول الفقرة عشوائياً لكل جولة
      let structuralStyle = "";
      const formattingVibe = i % 3;
      if (formattingVibe === 0) {
        structuralStyle = "اكتب ردك بشكل مكثف وقصير جداً كصدمة فلسفية مركّزة (فقرة واحدة ممتلئة بالمعاني، حوالي 3-5 أسطر فقط)، وهاجم صلب فكرة مناظرك مباشرة بدون ديباجات.";
      } else if (formattingVibe === 1) {
        structuralStyle = "اكتب ردك بأسلوب حواري هجومي مفصل (فقرة رئيسية متبوعة بنقاط مدببة ومسددة أو تساؤلات حادة تضع خصمك في الزاوية، حوالي 5-8 أسطر إجمالاً).";
      } else {
        structuralStyle = "اكتب ردك كتحليل فلسفي عميق وقصة واقعية أو مثال ملموس من طراز تفكيرك (فقرتين رشيقتين بسلسلة منطقية متصاعدة، حوالي 6-8 أسطر في المجمل).";
      }

      let prompt = `أنت "${speaker}". موضوع المناظرة هو: "${topic}".\n`;
      const speakerPersona = personas[speaker];
      if (speakerPersona?.prompt) {
        prompt += `بصمتك المعرفية والفلسفية واللغوية المميزة هي:\n${speakerPersona.prompt}\n\n`;
      }

      if (i === 0) {
        prompt += `بصفتك تتبنى المبادئ الموضحة أعلاه، قدم حجتك الافتتاحية في المناظرة واستحوذ على انتباه الجمهور وفقاً للنمط التالي:
👉 ${structuralStyle}

🚨 تنبيه مكافحة التكرار والأنماط المصطنعة: 
ابدأ حديثك فوراً بصلب الموضوع دون أي ديباجات افتتاحية أو تحيات مصطنعة (مثل "أهلاً بالجميع"، "يسعدني التواجد"، "بصفتي ستيف جوبز..."). ادخل في صدمة فكرية ودفاع عن موقفك مباشرة دون ممهدات باهتة.`;
      } else {
        const recentMsgs = currentMsgs.filter(m => !m.isSystem).slice(-(participants.length * 3));
        const transcript = recentMsgs.map(m => `${m.role === 'user' ? 'الجمهور/المدير' : m.persona}:\n"${m.text}"`).join('\n\n');
        
        // التحقق من وجود تدخل مباشر من المستخدم (الجمهور/المدير) في الرسائل الأخيرة
        const lastUserIntervention = [...recentMsgs].reverse().find(m => m.role === 'user');
        let interventionInstructionPrompt = "";
        if (lastUserIntervention) {
          interventionInstructionPrompt = `\n⚠️ تنبيه من المدير/الجمهور (هام جداً): لقد طرح المدير/الجمهور مداخلة أو سؤالاً مباشراً لك في هذا الحوار وهو: "${lastUserIntervention.text}". يجب عليك كأولوية قصوى وبصفتك "${speaker}" التجاوب الفوري والمباشر مع هذا التدخل، والرد على سؤاله أو فكرته وتضمين رأيك وموقفك الفلسفي والمعرفي منه بوضوح تام، ثم واصل نقاشك وفند حجج خصمك. يُمنع منعاً باتاً تجاهل مداخلة المدير/الجمهور.`;
        }
        
        prompt += `إليك سجل الحوار الأخير للمناظرة لتفهم السياق وتوجه لخصمك رداً مفحماً ومحايداً (لا تقم بنسخه، بل فنده):\n<transcript>\n${transcript}\n</transcript>\n\n`;
        prompt += `الآن، بصفتك ${speaker}، اكتب ردك المباشر المستنبط من فلسفتك وبصمتك لترد على مناظرك غريمك (${opponents.join(' و ')}) وفقاً للمحدد الصارم الهيكلي التالي:
👉 ${structuralStyle}

🚨 محددات صارمة جداً لمنع التكرار والنمطية وصنعة الذكاء الاصطناعي الركيكة:
1. يُمنع البدء بـ:
   - أي ترحيب أو تحية أو مناداة مكررة لخصومك (لا تقل "أهلاً بك يا..."، "عزيزي..."، "يا صديقي..."، "يا خصمي").
   - الكليشيهات اللغوية الافتتاحية المكررة (مثل: "في الواقع"، "بالتأكيد"، "بلا شك"، "دعني أختلف معكم"، "صحيح أن"، "أنا أتفق مع...", "من منطلق فلسفتي").
   - ابدأ فوراً بشن الججوم الفكري والمناقشة البليغة مباشرة بعبارة رشيقة وتلقائية من صميم الجملة والجدل.
2. عدم التكرار الفكري: يُحظر نهائياً إعادة تكرار الشعارات الكلاسيكية أو الكلمات الأكثر تكراراً للمتحدث (مثل تكرار كلمة "شغف/ابتكار" لستيف جوبز أو "الإنسان الأعلى" لنيتشه في كل مرة). ركز على تفكيك تفاصيل حجة الخصم الأخيرة (${opponents.join(' و ')}) وابنِ كلامك على ما طرحه للتو، بدلاً من إلقاء نفس الخطاب الفلسفي العام بشكل مدرسي مكرر.
3. التنويع الصوتي والبلاغي: استخدم جمل قصيرة صادمة متبوعة بتفسير أطول، واسأل سؤالاً بلاغياً أو مستنكراً رشيقتين في نهاية كلامك لاستفزاز خصومك معرفياً ولفظياً.
${interventionInstructionPrompt} ${progressionInstruction}`;
      }

      const newMsg: Message = { role: 'model', text: '', persona: speaker };
      currentMsgs = [...currentMsgs, newMsg];
      setMessages(currentMsgs);

      // حساب بصمة فريدة للسياق الحالي لمنع تكرار أو استرجاع كاش جامد عند حدوث تعديل أو تداخل أو بدء مناظرة بطرق مغايرة
      const hashInput = currentMsgs
        .filter(m => !m.isSystem)
        .slice(-4)
        .map(m => (m.persona || m.role) + ":" + m.text.substring(0, 40))
        .join("|");
      
      let hashValue = 0;
      for (let h = 0; h < hashInput.length; h++) {
        hashValue = (hashValue << 5) - hashValue + hashInput.charCodeAt(h);
        hashValue |= 0;
      }
      const historyHash = Math.abs(hashValue).toString(36);
      const currentDebateId = debateId || debateConfig.debateId || 'default';
      const debateCacheKey = `debate_${currentDebateId}_${topic.substring(0, 50)}_${speaker}_round_${i}_h_${historyHash}`;

      let cachedDebateText: string | null = null;
      if (!bypassCache) {
        try {
          cachedDebateText = await get<string>(debateCacheKey);
        } catch (e) {
          logger.warn("IDB read error in debate", e);
        }
      }

      if (cachedDebateText) {
        logger.info(`Using cached debate response for ${speaker} round ${i}`);
        let fullText = cachedDebateText;
        let currentText = '';
        const words = fullText.split(' ');
        let wordIndex = 0;
        
        await new Promise<void>((resolvePromise) => {
          const interval = setInterval(() => {
            if (stopGenerationRef.current || currentSession !== debateSessionRef.current || wordIndex >= words.length) {
              clearInterval(interval);
              if (currentSession === debateSessionRef.current) {
                currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: fullText }];
                setMessages([...currentMsgs]);
                setChatHistory(prev => ({ ...prev, debate: currentMsgs }));
              }
              resolvePromise();
              return;
            }
            
            currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
            wordIndex++;
            currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: currentText }];
            setMessages([...currentMsgs]);
          }, 20);
        });

        if (i < targetRounds - 1 && !stopGenerationRef.current && currentSession === debateSessionRef.current) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        continue;
      }
      
      let responseStream;
      logger.info(`Sending debate round stream`, { model: model, persona: speaker });
        responseStream = await withRetry(() => ai.models.generateContentStream({
          model: model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { 
            systemInstruction: buildSystemInstruction(personas[speaker]?.prompt || ''), 
            temperature: 0.85
          }
        }), 1, 1000);

        if (!responseStream || currentSession !== debateSessionRef.current) break;
        setIsApiKeyVerified(true);
        setIsApiKeyInvalid(false);

        let fullText = '';
        let lastUpdate = 0;
        for await (const chunk of responseStream) {
          if (stopGenerationRef.current || currentSession !== debateSessionRef.current) break;
          fullText += chunk.text || '';
          
          const now = Date.now();
          if (now - lastUpdate > 50) { // Limit updates
            currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: fullText }];
            setMessages([...currentMsgs]);
            lastUpdate = now;
          }
        }
        
        if (currentSession !== debateSessionRef.current) break;

        // Final update
        currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: fullText }];
        setMessages([...currentMsgs]);
        setChatHistory(prev => ({ ...prev, debate: currentMsgs }));
        
        if (fullText) {
          set(debateCacheKey, fullText).catch(e => logger.warn("IDB write error in debate", e));
        }
        
        if (i < targetRounds - 1 && !stopGenerationRef.current && currentSession === debateSessionRef.current) {
          // Increased delay to be smart about quotas and let the platform breathe
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      }
      } catch (e) {
        logger.error("Debate loop error", e);
      } finally {
        if (currentSession === debateSessionRef.current) {
          setIsLoading(false);
          stopGenerationRef.current = false;
        }
      }
  };

  const handleExtendDebate = async () => {
    const participants = debateConfig.participants;
    const topic = debateConfig.topic;
    const currentRounds = messages.filter(m => !m.isSystem).length;
    
    // Stop any ongoing generation before starting a new one
    stopGenerationRef.current = true;
    debateSessionRef.current++;
    const sessionId = debateSessionRef.current;
    
    await runDebateLoop(participants, topic, messages, currentRounds + participants.length, sessionId);
  };

  const handleRegenerateDebate = () => {
    stopGenerationRef.current = true;
    debateSessionRef.current++; // Invalidate current session immediately
    stopAudio();
    
    // Clear UI state immediately
    setMessages([]);
    setChatHistory(prev => ({ ...prev, debate: [] }));
    setIsLoading(false);

    // Small delay to allow previous loop to exit cleanly
    setTimeout(() => {
      startDebate();
    }, 100);
  };

  const startGroupQuestion = async (
    participants: string[], 
    question: string, 
    sessionStyle: string,
    newsRadar?: { enabled: boolean; mode: 'realtime' | 'archival' }
  ) => {
    // Start seminar seamlessly
    if (!question.trim()) return;

    // Save configuration
    const config = { 
      participants, 
      question, 
      sessionStyle, 
      newsRadar, 
      groupQuestionId: Date.now().toString(36) + Math.random().toString(36).substring(2, 6) 
    };
    setGroupQuestionConfig(config);
    safeStorage.setItem('mindmirror_groupQuestionConfig', JSON.stringify(config));

    // Stop ongoing loops
    stopGenerationRef.current = true;
    debateSessionRef.current++;
    const sessionId = debateSessionRef.current;

    setShowGroupQuestionModal(false);

    let styleLabel = "محاضرات متعاقبة رصينة";
    if (sessionStyle === 'cooperative') styleLabel = "ندوة تكاملية تفاعلية";
    else if (sessionStyle === 'lecture') styleLabel = "تفسيرات وبحوث مكثفة";

    if (newsRadar?.enabled) {
      styleLabel += ` (مفعل: رادار الأخبار الذكي - ${newsRadar.mode === 'realtime' ? 'رادار اللحظة' : 'تقصي أرشيفي'})`;
    }

    const initialMsgs: Message[] = [
      { 
        role: 'model', 
        text: `ندوة المعرفة المشتركة حول: "${question}"\n\nالمحاضرون المشاركون: ${participants.join(' ، ')}\nالنمط المعرفي: ${styleLabel}`, 
        isSystem: true 
      }
    ];

    setChatHistory(prev => ({ ...prev, group_question: initialMsgs }));
    setMessages(initialMsgs);
    setActivePersona('group_question');

    await runGroupQuestionLoop(participants, question, sessionStyle, initialMsgs, participants.length, sessionId, config.groupQuestionId, true, newsRadar);
  };

  const runGroupQuestionLoop = async (
    participants: string[], 
    question: string, 
    sessionStyle: string,
    startMsgs: Message[], 
    targetRounds: number, 
    sessionId?: number, 
    groupQuestionId?: string, 
    bypassCache = false,
    newsRadar?: { enabled: boolean; mode: 'realtime' | 'archival' }
  ) => {
    // Conduct seminar seamlessly
    const currentSession = sessionId || ++debateSessionRef.current;
    if (!sessionId) debateSessionRef.current = currentSession;

    setIsLoading(true);
    stopGenerationRef.current = false;
    let currentMsgs = [...startMsgs];
    const ai = getGeminiClient();

    const nonSystemMsgs = currentMsgs.filter(m => !m.isSystem);
    const startIndex = nonSystemMsgs.length;
    const activeNewsRadar = newsRadar || groupQuestionConfig.newsRadar;

    try {
      for (let i = startIndex; i < targetRounds; i++) {
        if (stopGenerationRef.current || currentSession !== debateSessionRef.current) break;
        const speaker = participants[i % participants.length];

        let stylePrompt = "";
        if (sessionStyle === 'sequential') {
          stylePrompt = `أنت بصدد إلقاء محاضرة كاملة ومفصلة مستوحاة من فلسفتك الشخصية وعلمك للإجابة عن السؤال المعرفي المطروح. ركز على تقديم رؤية واضحة وشاملة بأسلوب نثري راقٍ وعميق.`;
        } else if (sessionStyle === 'cooperative') {
          stylePrompt = `أنت تشارك في ندوة فكرية تكاملية. اطلع على الإجابات السابقة من زملائك في سجل الحوار، وابدأ حديثك بالبناء على النقاط التي طرحوها (بشكل ودّي ومتكامل) ثم أضف بعداً فلسفياً أو علمياً جديداً غير مكرر يثري النقاش بانسجام.`;
        } else {
          stylePrompt = `أنت تقدم تفسيراً وبحثاً علمياً مكثفاً ومركزاً. تفادى الإسهاب وركز على الحقائق الملموسة والشواهد المنطقية والتحليلات المباشرة.`;
        }

        let prompt = `أنت المتحدث "${speaker}". السؤال المعرفي أو موضوع المحاضرة هو: "${question}".\n`;
        const speakerPersona = personas[speaker];
        if (speakerPersona?.prompt) {
          prompt += `بصمتك المعرفية واللغوية المميزة هي:\n${speakerPersona.prompt}\n\n`;
        }

        prompt += `سياق وأسلوب الإلقاء المطلوب منك:\n👉 ${stylePrompt}\n\n`;

        if (i > 0) {
          const recentMsgs = currentMsgs.filter(m => !m.isSystem);
          const transcript = recentMsgs.map(m => `المتحدث ${m.persona}:\n"${m.text}"`).join('\n\n');
          prompt += `إليك ما أدلى به المتحدثون الآخرون حتى الآن لبناء سياقك بذكاء متفرد:\n<transcript>\n${transcript}\n</transcript>\n\n`;
        }

        if (activeNewsRadar?.enabled) {
          const nowStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          if (activeNewsRadar.mode === 'realtime') {
            prompt += `\n\n🚨 [خوارزمية رادار الأخبار اللحظية]: 
أنت الآن متصل برادار ويب مباشر يرصد مستجدات اللحظة. نوصيك بشدة بالبحث والتقصي عن الأخبار والأحداث العاجلة المتصلة بهذا السؤال المعرفي والبحث باللغة العربية بتاريخ ووقت اليوم: "${nowStr}". 
استخدم أداة البحث في جوجل (Google Search tool) المتاحة لك لتأكيد الأخبار الحقيقية وتقديم قراءة دقيقة وعاجلة ومواكبة لما يحدث الآن فعلياً في العالم.`;
          } else {
            prompt += `\n\n🚨 [خوارزمية التقصي الأرشيفي والبحث الرقمي]: 
أنت الآن متصل بمستكشف الويب والأرشيف الرقمي طوال الزمن. استخدم أداة البحث في جوجل (Google Search tool) المتاحة لك للغوص عميقاً في المصادر الرقمية والأكاديمية والصحفية لتتبع تاريخ نشوء وتطور هذه القضية، وابحث عن مصادر موثوقة ومثبتة قديماً وحديثاً لإثراء ندوة المعرفة بمعلومات مبرهنة.`;
          }
        }

        prompt += `\n\n🚨 محددات صارمة جداً لمنع التكرار وصنعة الذكاء الاصطناعي الركيكة:
1. ابدأ حديثك فوراً بالدخول في صلب فكرتك ورؤيتك العلمية أو الفلسفية دون ديباجات افتتاحية أو كليشيهات ترحيبية مصطنعة (لا تقل "يسعدني المشاركة"، "أهلاً بالجميع"، "أما بعد"، "بصفتي...").
2. يمنع تكرار الجمل الكلاسيكية المحفوظة لشخصيتك بشكل آلي. أبدع في نسج المصطلحات بشكل طبيعي بليغ.
3. تفنن في التميز الصوتي والأسلوبي الذي يعبر عن روح ومذهب تفكيرك الفريد.`;

        const newMsg: Message = { role: 'model', text: '', persona: speaker };
        currentMsgs = [...currentMsgs, newMsg];
        setMessages(currentMsgs);

        // Calculate cache key
        const hashInput = currentMsgs
          .filter(m => !m.isSystem)
          .slice(-4)
          .map(m => (m.persona || m.role) + ":" + m.text.substring(0, 40))
          .join("|");
        
        let hashValue = 0;
        for (let h = 0; h < hashInput.length; h++) {
          hashValue = (hashValue << 5) - hashValue + hashInput.charCodeAt(h);
          hashValue |= 0;
        }
        const historyHash = Math.abs(hashValue).toString(36);
        const currentGQId = groupQuestionId || groupQuestionConfig.groupQuestionId || 'default';
        const gqCacheKey = `gq_${currentGQId}_${question.substring(0, 50)}_${speaker}_round_${i}_h_${historyHash}`;

        let cachedGQData: { text: string, sources?: { title: string, uri: string }[] } | null = null;
        if (!bypassCache) {
          try {
            const rawCache = await get<any>(gqCacheKey);
            if (rawCache) {
              if (typeof rawCache === 'string') {
                cachedGQData = { text: rawCache };
              } else {
                cachedGQData = rawCache;
              }
            }
          } catch (e) {
            logger.warn("IDB read error in group question", e);
          }
        }

        if (cachedGQData) {
          logger.info(`Using cached group question response for ${speaker} round ${i}`);
          const fullText = cachedGQData.text;
          const sources = cachedGQData.sources;
          let currentText = '';
          const words = fullText.split(' ');
          let wordIndex = 0;
          
          await new Promise<void>((resolvePromise) => {
            const interval = setInterval(() => {
              if (stopGenerationRef.current || currentSession !== debateSessionRef.current || wordIndex >= words.length) {
                clearInterval(interval);
                if (currentSession === debateSessionRef.current) {
                  currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: fullText, sources }];
                  setMessages([...currentMsgs]);
                  setChatHistory(prev => ({ ...prev, group_question: currentMsgs }));
                }
                resolvePromise();
                return;
              }
              
              currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
              wordIndex++;
              currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: currentText, sources }];
              setMessages([...currentMsgs]);
            }, 20);
          });

          if (i < targetRounds - 1 && !stopGenerationRef.current && currentSession === debateSessionRef.current) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          continue;
        }

        let responseStream;
        logger.info(`Sending group question round stream`, { model: model, persona: speaker });
        
        const toolsConfig: any[] = [];
        if (activeNewsRadar?.enabled) {
          toolsConfig.push({ googleSearch: {} });
        }

        responseStream = await withRetry(() => ai.models.generateContentStream({
          model: model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { 
            systemInstruction: buildSystemInstruction(personas[speaker]?.prompt || ''), 
            temperature: 0.85,
            tools: toolsConfig.length > 0 ? toolsConfig : undefined
          }
        }), 1, 1000);

        if (!responseStream || currentSession !== debateSessionRef.current) break;
        setIsApiKeyVerified(true);
        setIsApiKeyInvalid(false);

        let fullText = '';
        let lastUpdate = 0;
        let groundingChunks: any[] = [];

        for await (const chunk of responseStream) {
          if (stopGenerationRef.current || currentSession !== debateSessionRef.current) break;
          fullText += chunk.text || '';
          
          // Extract search grounding metadata
          const candidates = chunk.candidates;
          if (candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunks = candidates[0].groundingMetadata.groundingChunks;
            if (Array.isArray(chunks) && chunks.length > 0) {
              groundingChunks = [...groundingChunks, ...chunks];
            }
          }
          
          const now = Date.now();
          if (now - lastUpdate > 50) { // Limit updates
            currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: fullText }];
            setMessages([...currentMsgs]);
            lastUpdate = now;
          }
        }
        
        if (currentSession !== debateSessionRef.current) break;

        // Process search sources
        const uniqueSources: { title: string, uri: string }[] = [];
        const seenUris = new Set<string>();
        for (const gc of groundingChunks) {
          const webSource = gc.web;
          if (webSource && webSource.uri) {
            const cleanUri = webSource.uri.trim();
            if (!seenUris.has(cleanUri)) {
              seenUris.add(cleanUri);
              uniqueSources.push({
                title: webSource.title || "مصدر ويب",
                uri: cleanUri
              });
            }
          }
        }

        // Final update
        const finalSources = uniqueSources.length > 0 ? uniqueSources : undefined;
        currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: fullText, sources: finalSources }];
        setMessages([...currentMsgs]);
        setChatHistory(prev => ({ ...prev, group_question: currentMsgs }));
        
        if (fullText) {
          const cachePayload = { text: fullText, sources: finalSources };
          set(gqCacheKey, cachePayload).catch(e => logger.warn("IDB write error in group question", e));
        }
        
        if (i < targetRounds - 1 && !stopGenerationRef.current && currentSession === debateSessionRef.current) {
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      }
    } catch (e) {
      logger.error("Group question loop error", e);
    } finally {
      if (currentSession === debateSessionRef.current) {
        setIsLoading(false);
        stopGenerationRef.current = false;
      }
    }
  };

  const handleExtendGroupQuestion = async () => {
    const participants = groupQuestionConfig.participants;
    const question = groupQuestionConfig.question;
    const sessionStyle = groupQuestionConfig.sessionStyle;
    const currentRounds = messages.filter(m => !m.isSystem).length;
    
    stopGenerationRef.current = true;
    debateSessionRef.current++;
    const sessionId = debateSessionRef.current;
    
    await runGroupQuestionLoop(participants, question, sessionStyle, messages, currentRounds + participants.length, sessionId, groupQuestionConfig.groupQuestionId, false, groupQuestionConfig.newsRadar);
  };

  const handleRegenerateGroupQuestion = () => {
    stopGenerationRef.current = true;
    debateSessionRef.current++;
    stopAudio();
    
    setMessages([]);
    setChatHistory(prev => ({ ...prev, group_question: [] }));
    setIsLoading(false);

    setTimeout(() => {
      startGroupQuestion(groupQuestionConfig.participants, groupQuestionConfig.question, groupQuestionConfig.sessionStyle, groupQuestionConfig.newsRadar);
    }, 100);
  };

  const handleSummarizeGroupQuestion = async () => {
    setIsLoading(true);
    const ai = getGeminiClient();
    const filteredMsgs = messages.filter(m => !m.isSystem);
    let answersText = "";
    if (filteredMsgs.length > 20) {
      answersText = filteredMsgs.slice(0, 4).map(m => `${m.persona}: ${m.text}`).join('\n') + 
                    "\n\n[... جزء من المحاضرات تم اختصاره اقتصادياً ...]\n\n" + 
                    filteredMsgs.slice(-16).map(m => `${m.persona}: ${m.text}`).join('\n');
    } else {
      answersText = filteredMsgs.map(m => `${m.persona || 'مشارك'}: ${m.text}`).join('\n\n');
    }
    
    const prompt = `بناءً على المحاضرات والندوة الفكرية التالية حول السؤال: "${groupQuestionConfig.question}"، قدم خلاصة تركيبية متطورة (حوالي 5-7 أسطر) تدمج فيها الرؤى المختلفة وتستنتج الفوائد والحلول المعرفية المستفادة بصورة منسجمة وعميقة.
المحاضرات:
${answersText}`;

    setMessages(prev => [...prev, { role: 'model', text: '', isSystem: true }]);

    try {
      let response;
      response = await withRetry(() => ai.models.generateContent({
        model: model,
        strictModel: isStrictModelMode,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }), 2, 1500);
      
      const summary = response?.text || '';
      const summaryMsg: Message = { role: 'model', text: `📝 خلاصة الندوة والفوائد المستفادة:\n\n${summary}`, isSystem: true };
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = summaryMsg;
        return updated;
      });
      setChatHistory(prev => ({ ...prev, group_question: [...(prev.group_question || []), summaryMsg] }));
    } catch (e) {
      handleAIError(e, "تلخيص الندوة الفكرية");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeDebate = async () => {
    setIsLoading(true);
    const ai = getGeminiClient();
    // Use a smarter summary: if the debate is too long, take the most recent parts and first parts
    const filteredMsgs = messages.filter(m => !m.isSystem);
    let debateText = "";
    if (filteredMsgs.length > 20) {
      debateText = filteredMsgs.slice(0, 4).map(m => `${m.persona}: ${m.text}`).join('\n') + 
                   "\n\n[... جزء من المناظرة تم اختصاره اقتصادياً ...]\n\n" + 
                   filteredMsgs.slice(-16).map(m => `${m.persona}: ${m.text}`).join('\n');
    } else {
      debateText = filteredMsgs.map(m => `${m.persona || 'مشارك'}: ${m.text}`).join('\n\n');
    }
    
    const prompt = `بناءً على المناظرة التالية، قدم ملخصاً مركزاً (حوالي 4-6 أسطر) يوضح النقاط الرئيسية ومن كان حجته أقوى برأيك بأسلوب محايد ومنصف.
المناظرة:
${debateText}`;

    setMessages(prev => [...prev, { role: 'model', text: '', isSystem: true }]);

    try {
      let response;
      response = await withRetry(() => ai.models.generateContent({
        model: model,
        strictModel: isStrictModelMode,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }), 2, 1500);
      
      const summary = response?.text || '';
      const summaryMsg: Message = { role: 'model', text: `📝 ملخص المناظرة والنتيجة:\n\n${summary}`, isSystem: true };
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = summaryMsg;
        return updated;
      });
      setChatHistory(prev => ({ ...prev, debate: [...(prev.debate || []), summaryMsg] }));
    } catch (e) {
      handleAIError(e, "تلخيص المناظرة");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const startTrendLiveRoom = (trendTopic: any, initialMsgs?: any[]) => {
    setShowTrendLiveRoomModal(false);
    setActivePersona('trend_live');

    const formattedMsgs: Message[] = initialMsgs && initialMsgs.length > 0 
      ? initialMsgs.map(m => ({
          role: m.isUser ? 'user' : 'model',
          text: m.text,
          persona: m.sender || m.role,
          isSystem: m.isSystem
        }))
      : [
          {
            role: 'model',
            text: `📡 **غرفة تريند لايف الاستباقية (Trend Pulse & Verification Hub)**\n\n🎯 **الترند المرصود:** "${trendTopic.title}"\n📊 **مؤشر الثقة بالانتشار:** ${trendTopic.confidence}%\n🎭 **الحالة الشعورية:** ${trendTopic.sentiment}\n🛡️ **حالة التحقق:** ${trendTopic.verificationStatus}\n👥 **طاقم الخبراء المتولد للغرفة:** ${(trendTopic.suggestedCrew || []).map((c: any) => `${c.name} (${c.role})`).join(' ، ')}`,
            isSystem: true
          }
        ];

    setChatHistory(prev => ({ ...prev, trend_live: formattedMsgs }));
    setMessages(formattedMsgs);

    toast({
      title: 'تم تشغيل غرفة تريند لايف',
      message: `الموضوع متصل الآن في المنصة: "${trendTopic.title}".`,
      type: 'success'
    });
  };

  const startOsintInvestigation = async (
    analysts: any[],
    targetQuery: string,
    investigationMode: 'triangulation' | 'satellite_geo' | 'link_footprint' | 'financial_crypto' | 'botnet_coordination',
    depth: 'standard' | 'deep'
  ) => {
    // Start OSINT seamlessly
    if (!targetQuery.trim()) return;

    const config = {
      analysts,
      targetQuery,
      investigationMode,
      depth,
      sessionId: Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
    };
    setOsintRoomConfig(config);
    safeStorage.setItem('mindmirror_osintRoomConfig', JSON.stringify(config));

    stopGenerationRef.current = true;
    debateSessionRef.current++;
    const sessionId = debateSessionRef.current;

    setShowOsintRoomModal(false);

    let modeLabel = "تقاطع شامل متعدد الزوايا للأدلة والبراهين الرقمية";
    if (investigationMode === 'satellite_geo') {
      modeLabel = "استطلاع فضائي بالأقمار الاصطناعية (Copernicus / NASA Worldview) وبيانات مكانية";
    } else if (investigationMode === 'link_footprint') {
      modeLabel = "تتبع الروابط، أرشيف الويب التاريخي (Wayback)، وبصمات النطاقات";
    } else if (investigationMode === 'financial_crypto') {
      modeLabel = "تعقب مالي وبلوكتشين (Crypto FININT) وتتبع المحافظ والجهات الممولة";
    } else if (investigationMode === 'botnet_coordination') {
      modeLabel = "كشف وتفكيك شبكات البوتات والسلوك المنسق غير الأصيل (MLCD - Multi-Layer Coordination Detection)";
    }

    const analystNames = analysts.map(a => `${a.icon || '🛡️'} ${a.name}`).join(' ، ');

    const initialMsgs: Message[] = [
      {
        role: 'model',
        text: `🛰️ **جلسة استخبارات رقمية وتقاطع مصادر مفتوحة (OSINT / GEOINT / FININT Hub)**\n\n🎯 **موضوع التحقيق والتقاطع:** "${targetQuery}"\n🔍 **نمط التحقيق:** ${modeLabel}\n👥 **فريق الخبراء المتصل:** ${analystNames}\n🌐 **الرادار الحي والمصادر المفتوحة:** مفعلة ومتصلة بالويب اللحظي، قواعد سلاسل الكتل، ومصادر الأقمار الاصطناعية.`,
        isSystem: true
      }
    ];

    setChatHistory(prev => ({ ...prev, osint_room: initialMsgs }));
    setMessages(initialMsgs);
    setActivePersona('osint_room');

    await runOsintInvestigationLoop(analysts, targetQuery, investigationMode, depth, initialMsgs, analysts.length, sessionId, config.sessionId, true);
  };

  const runOsintInvestigationLoop = async (
    analysts: any[],
    targetQuery: string,
    investigationMode: 'triangulation' | 'satellite_geo' | 'link_footprint' | 'financial_crypto' | 'botnet_coordination',
    depth: 'standard' | 'deep',
    initialHistory: Message[],
    totalRounds: number,
    sessionId?: number,
    investigationId?: string,
    isFirstRun = false
  ) => {
    if (!analysts || analysts.length === 0) return;
    setIsLoading(true);
    stopGenerationRef.current = false;

    if (sessionId === undefined) {
      debateSessionRef.current++;
    }
    const currentSession = sessionId !== undefined ? sessionId : debateSessionRef.current;
    let currentMsgs = [...initialHistory];

    const startIndex = currentMsgs.filter(m => !m.isSystem).length;

    try {
      const ai = getGeminiClient();

      for (let i = startIndex; i < totalRounds; i++) {
        if (stopGenerationRef.current || currentSession !== debateSessionRef.current) break;

        const speaker = analysts[i % analysts.length];
        let analystRoleInstruction = '';

        if (speaker.id === 'botnet_mlcd') {
          analystRoleInstruction = `أنت خبير كشف شبكات البوتات والسلوك الزائف المنسق (MLCD Botnet & CIB Specialist).
مهامك الإلزامية لتفكيك شبكات التنسيق المصطنع وفق إطار Multi-Layer Coordination Detection (MLCD) الخماسي:
1. طبقة الحساب (Account Layer):
- فحص عمر الحسابات ونمط أسماء المستخدمين (مثل أرقام عشوائية متسلسلة).
- البحث العكسي عن الصور الرمزية (Reverse Image Search) لكشف الصور المسروقة أو المولدة بـ StyleGAN.
- رصد أنماط إنشاء الحسابات المتزامنة (Account Creation Bursts).
- قياس نسبة المتابعين إلى المتابَعين ومستوى النشاط التاريخي غير الطبيعي.
2. طبقة الزمن (Temporal Layer):
- فحص تزامن النشر وإعادة التغريد/المشاركة خلال نفس الدقيقة أو الثانية.
- رصد نبضات النشاط الحادة (Activity Bursts) تليها فترات صمت تام متزامنة بين الحسابات.
- قياس سرعة التفاعل الآلي (Response Latency) غير الممكنة بشرياً.
3. طبقة المحتوى والأسلوبية (Content & Stylometry Layer):
- قياس التشابه الدلالي (Semantic Similarity) والنصوص المكررة أو المتطابقة مع تعديلات طفيفة (Copypasta).
- رصد تكرار نفس الروابط أو الوسوم المستهدفة أو معرفات الحملة.
- التحليل الأسلوبي (Stylometry) وكشف بصمات النصوص المولدة بنماذج الذكاء الاصطناعي (LLM Detection).
4. طبقة الشبكة والمجتمعات (Network & Graph Layer):
- تمثيل شبكة التفاعل كعقد (حسابات/وسوم) وحواف (إعادة تغريد، منشن، إعجاب).
- كشف المجتمعات المصطنعة وتحديد العقد المركزية المغذية (Amplifiers / Seeders).
- كشف الزخارف الشبكية المتكررة (Network Motifs) ومشاركات الروابط المنسقة (Coordinated Link Sharing Networks - CLSN).
5. طبقة التقنية والبصمة الرقمية (Technical Layer):
- بصمات الأجهزة والمتصفحات، عناوين IP، مجالات ASN المشتركة ومزودي الـ Hosting / Proxy.
- رصد عملاء النشر والواجهات البرمجية (API vs Web vs Mobile Client footprints).
6. الأدوات المعتمدة للتوثيق والإحالة:
- Botometer, Hoaxy (OSoMe), Coordination Network Toolkit (CNT), BotSlayer, CooRTweet, Gephi, Neo4j, Maltego, Graphika.`;
        } else if (speaker.id === 'crypto_finint') {
          analystRoleInstruction = `أنت خبير التدفقات المالية والبلوكتشين واستخبارات العملات المشفرة (Crypto & FININT Analyst).
مهامك الإلزامية لتتبع المسار المالي للحملات المنظمة والكشف عن هوية الجهات الممولة عبر المنهجية الرباعية الصارمة:
1. المرحلة 1 - تحديد نقاط الدخول (جمع العناوين):
- فحص كود المصدر لصفحات التبرع أو المواقع لكشف محافظ مخفية أو معلنة.
- مراقبة قنوات تيليجرام المشفرة، المنتديات، ومنشورات الترويج.
- استخراج العناوين من سجلات النطاقات (DNS/Whois)، منشورات التواصل وقواعد البيانات المسربة (OSINT).
2. المرحلة 2 - التحليل على السلسلة (On-Chain Analysis):
- استخدام مستكشفات البلوكتشين المفتوحة (Etherscan لإيثيريوم، TronScan لترون وUSDT-TRC20، Blockchair لبيتكوين والشبكات الكبرى).
- الاستعانة بمنصات الاستخبارات المتقدمة: Arkham Intelligence لربط العناوين بالكيانات الحقيقية (عبر 3.1+ مليار عنوان مصنف)، و AMLBot AI Tracer.
- تتبع تدفق الأموال من محفظة التبرع، عبر الجسور (Bridges) ومجمعات السيولة والمبادلات اللامركزية (DEXs)، وصولاً إلى نقاط الصرف النقدي (Cash-out).
3. المرحلة 3 - الربط بالهوية الحقيقية (Attribution):
- رصد نقاط الاحتكاك بالمنصات المركزية الخاضعة لـ KYC لمطالبة أو تتبع الإيداعات.
- دمج بيانات البلوكتشين مع تقنيات OSINT لكشف أخطاء المشغلين، المعرفات الرقمية، والتسريبات.
- مطابقة المعاملات مع قواعد الكيانات الموثقة (Chainalysis Reactor / Penlink).
4. المرحلة 4 - تحليل الشبكة والربط ومكافحة التعتيم:
- بناء رسوم بيانية ومخططات علاقات (Maltego) تربط المحافظ، الكيانات، والأفراد.
- تحليل الأنماط: كشف "التمويل الجماعي الصغير (Micro-crowdfunding)" أو "التحويلات الدائرية (Peeling Chains/Round-tripping)" لغسيل وتشتيت الأموال.
- مقاطعة المحافظ والكيانات مع لوائح العقوبات الدولية المفتوحة (OpenSanctions) والسجلات التجارية.`;
        } else if (speaker.id === 'geoint_satellite') {
          analystRoleInstruction = `أنت خبير الاستطلاع الفضائي وتحليل صور الأقمار الاصطناعية (GEOINT Satellite Analyst).
مهامك الإلزامية:
1. فحص المعطيات المكانية والجغرافية، وتحديد الإحداثيات التقريبية للموقع الجغرافي المعني.
2. تقاطع المعطيات مع منصات الأقمار الاصطناعية المفتوحة: Copernicus Browser (Sentinel-2 للبصري 10م، Sentinel-1 SAR الراداري للمسح الليلي وتجاوز السحب)، NASA Worldview (أقمار Terra/Aqua/MODIS/VIIRS لرصد التغيرات السطحية والحرارية)، Google Earth Engine للتغيرات التاريخية للمنطقة.
3. تفكيك التضاريس والإنشاءات والظروف المناخية والتغيرات الفيزيائية الموثقة بالأقمار الاصطناعية بدقة.`;
        } else if (speaker.id === 'link_network') {
          analystRoleInstruction = `أنت خبير تتبع الروابط، البصمات الرقمية والمواقع الشبيهة (Link & Network OSINT Analyst).
مهامك الإلزامية:
1. تتبع النطاقات الرقمية (Domains/DNS)، أرشيف الويب التاريخي (Wayback Machine / Archive.org) لمعرفة تاريخ الظهور الأول للمحتوى أو الموقع والتعديلات التي طرأت عليه.
2. فحص شبكات الارتباط، فحص المواقع الشبيهة والارتباطات العكسية (Backlinks)، واستدعاء أدوات التحليل الرقمي المفتوحة مثل URLScan.io و Whois.
3. كشف الارتباطات الخفية بين النطاقات والحسابات والشبكات الرقمية.`;
        } else if (speaker.id === 'evidence_auditor') {
          analystRoleInstruction = `أنت مدقق الأدلة والتحقق التبادلي الصارم (Fact & Verification Auditor).
مهامك الإلزامية:
1. مطابقة الأدلة الميدانية والرقمية المعلنة، رصد التباينات والتناقضات بين الروايات المختلفة والتواريخ المسجلة.
2. كشف أي تلاعب بصري، تزييف عميق، أو تدوير للصور ومقاطع الفيديو خارج سياقها الزمني والمكاني.
3. تقييم سلاسل الثقة ومستويات موثوقية كل ادعاء أو مصدر بناءً على معايير التحقيق المفتوح.`;
        } else if (speaker.id === 'context_synthesizer') {
          analystRoleInstruction = `أنت خبير التكامل الاستخباري وقواعد البيانات المفتوحة (Open Data & Context Synthesizer).
مهامك الإلزامية:
1. ربط خيوط التحقيق، تقاطع السجلات المفتوحة والبيانات الملاحية (MarineTraffic / Flightradar24) إن كانت وثيقة الصلة.
2. صياغة تقييم استخباري تركيبي يربط المعطيات الفضائية بالبصمات الرقمية والأدلة الميدانية ومسارات التمويل.
3. تحديد مستوى الثقة العام (High / Medium / Low) وتحديد الثغرات المعلوماتية (Intelligence Gaps) التي تحتاج رصداً إضافياً.`;
        } else {
          analystRoleInstruction = `أنت ${speaker.name} (${speaker.role || 'خبير تحليلي'}).
مهمتك: تقديم فحص فكري ونقدي صارم للأدلة والفرضيات، كشف الانحيازات والمغالطات، وطرح تساؤلات استقصائية تقطع الشك باليقين.`;
        }

        let prompt = `أنت المحلل الاستخباري: "${speaker.name}" (${speaker.role}).\nقضية التحقيق الاستخباري وموضوع التقاطع: "${targetQuery}".\nالنمط الاستخباري للغرفة: ${investigationMode}.\nعمق التحقيق: ${depth === 'deep' ? 'تحقيق استخباري معمق ودقيق' : 'موجز استخباري مركز'}.\n\nتوجيهات تخصصك الاستخباري:\n${analystRoleInstruction}\n\n`;

        if (i > 0) {
          const recentMsgs = currentMsgs.filter(m => !m.isSystem);
          const dossier = recentMsgs.map(m => `[تقرير المحلل ${m.persona}]:\n${m.text}`).join('\n\n---\n\n');
          prompt += `إليك ما دونه زملاؤك في ملف التحقيق المفتوح حتى الآن:\n<investigation_dossier>\n${dossier}\n</investigation_dossier>\n\nقم بمقاطعة هذه المعطيات، إضافة البصمات والأدلة الجديدة من منظور تخصصك، والتعقيب على الفرضيات المطروحة.\n\n`;
        }

        prompt += `🚨 توجيهات أداء حاسمة:
1. استخدم أداة البحث في جوجل (Google Search) المضمنة لتقصي البيانات الحية، تواريخ الأحداث، النطاقات والمواقع والمصادر ذات الصلة.
2. إذا كان موضوع التحقيق يتضمن تدفقات مالية أو تبرعات أو حملات ممولة، لا تكتفِ بالقول إن الهوية المالية غير مكشوفة، بل فصّل فوراً في تطبيق منهجية المراحل الأربع لتتبع المسار المالي (جمع العناوين، التحليل على السلسلة، الربط بالهوية عبر نقاط الصرف والـ KYC، وتحليل الشبكة مع OpenSanctions).
3. إذا كان موضوع التحقيق يتعلق بشبكات البوتات أو حملات التأثير المنظمة، طبق إطار Multi-Layer Coordination Detection (MLCD) الخماسي (الحساب، الزمن، المحتوى والأسلوبية، الشبكة والمجتمعات، والتقنية) مع توثيق أدوات الكشف (Botometer, Hoaxy, CNT, Gephi, Graphika).
4. لا تضع أي مقدمات ترحيبية أو ديباجات. ادخل مباشرة في صلب التقرير الاستخباري.
5. استخدم تنسيق Markdown رصين مع نقاط ووسوم وعناوين فرعية واضحة.
6. اذكر بصراحة المصادر والأدوات المفتوحة المناسبة لتوثيق كل نقطة (مثل: Botometer, Hoaxy, CNT, Gephi, Arkham Intelligence, Etherscan, TronScan, OpenSanctions, Copernicus Sentinel, NASA Worldview, Wayback Machine, URLScan).
7. المنهجية الجنائية الاحترافية والحياد الاستخباري (Objective Technical Forensics): ركز بالكامل على البنية التحتية التقنية، البصمات الرقمية والمؤشرات (IOCs)، سجلات النطاقات والبلوكتشين، وقياسات الشذوذ الإحصائي في الشبكات. تجنب التخمين حول النوايا الذاتية أو الدوافع الشخصية أو توجيه اتهامات عشوائية، وقدم المخرجات كدلائل وشواهد فنية قابلة للتحقق المتقاطع (Admiralty Standard).`;

        const newMsg: Message = {
          role: 'model',
          text: '',
          persona: speaker.name
        };

        currentMsgs = [...currentMsgs, newMsg];
        setMessages([...currentMsgs]);

        let responseStream;
        logger.info(`Sending OSINT investigation round stream`, { model: model, persona: speaker.name });

        responseStream = await withRetry(() => ai.models.generateContentStream({
          model: model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: buildSystemInstruction(speaker.prompt || `أنت محلل استخبارات رقمية وتقاطع مصادر مفتوحة محترف متخصص في ${speaker.name}.`),
            temperature: 0.7,
            tools: [{ googleSearch: {} }]
          }
        }), 1, 1000);

        if (!responseStream || currentSession !== debateSessionRef.current) break;
        setIsApiKeyVerified(true);
        setIsApiKeyInvalid(false);

        let fullText = '';
        let lastUpdate = 0;
        let groundingChunks: any[] = [];

        for await (const chunk of responseStream) {
          if (stopGenerationRef.current || currentSession !== debateSessionRef.current) break;
          fullText += chunk.text || '';

          const candidates = chunk.candidates;
          if (candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunks = candidates[0].groundingMetadata.groundingChunks;
            if (Array.isArray(chunks) && chunks.length > 0) {
              groundingChunks = [...groundingChunks, ...chunks];
            }
          }

          const now = Date.now();
          if (now - lastUpdate > 50) {
            currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: fullText }];
            setMessages([...currentMsgs]);
            lastUpdate = now;
          }
        }

        if (currentSession !== debateSessionRef.current) break;

        const uniqueSources: { title: string; uri: string }[] = [];
        const seenUris = new Set<string>();
        for (const gc of groundingChunks) {
          const webSource = gc.web;
          if (webSource && webSource.uri) {
            const cleanUri = webSource.uri.trim();
            if (!seenUris.has(cleanUri)) {
              seenUris.add(cleanUri);
              uniqueSources.push({
                title: webSource.title || "مصدر استخباري مفتوح",
                uri: cleanUri
              });
            }
          }
        }

        const finalSources = uniqueSources.length > 0 ? uniqueSources : undefined;
        currentMsgs = [...currentMsgs.slice(0, -1), { ...newMsg, text: fullText, sources: finalSources }];
        setMessages([...currentMsgs]);
        setChatHistory(prev => ({ ...prev, osint_room: currentMsgs }));
      }
    } catch (e: any) {
      handleAIError(e, "جلسة الاستخبارات الرقمية وتقاطع المصادر");
      currentMsgs = currentMsgs.filter(m => m.text.trim() !== '');
      setMessages([...currentMsgs]);
      setChatHistory(prev => ({ ...prev, osint_room: currentMsgs }));
    } finally {
      setIsLoading(false);
      stopGenerationRef.current = false;
    }
  };

  const handleExtendOsintInvestigation = async () => {
    if (isLoading || !osintRoomConfig.analysts.length) return;
    const currentRounds = messages.filter(m => !m.isSystem).length;
    await runOsintInvestigationLoop(
      osintRoomConfig.analysts,
      osintRoomConfig.targetQuery,
      osintRoomConfig.investigationMode,
      osintRoomConfig.depth,
      messages,
      currentRounds + osintRoomConfig.analysts.length,
      undefined,
      osintRoomConfig.sessionId,
      false
    );
  };

  const handleSummarizeOsintInvestigation = async () => {
    // Finalize report seamlessly
    setIsLoading(true);
    const ai = getGeminiClient();
    const filteredMsgs = messages.filter(m => !m.isSystem);
    let investigationText = filteredMsgs.map(m => `${m.persona || 'محلل'}: ${m.text}`).join('\n\n');
    if (investigationText.length > 12000) {
      investigationText = investigationText.substring(0, 12000) + "\n\n[... تم اختصار جزء من التقرير ...] ";
    }
    
    const prompt = `أنت رئيس وحدة التقدير الاستخباري ومقاطعة المصادر المفتوحة والأقمار الاصطناعية وتفكيك شبكات البوتات واستخبارات البلوكتشين والمالية الرقمية (OSINT / GEOINT / FININT / CIB Chief).
بناءً على ملف التحقيق التالي حول قضية: "${osintRoomConfig.targetQuery}":
قدم "تقريراً استخباراتياً ختامياً (Executive Intelligence Brief)" رفيع المستوى ومهني جداً يتضمن الأقسام التالية:
1. 🎯 الخلاصة الاستخباراتية التنفيذية (Core Findings)
2. 🤖 كشف شبكات البوتات والسلوك الزائف المنسق (MLCD Botnet & Coordination Analysis) إن وُجد:
   - بصمات الحسابات والأنماط الزمنية (Temporal Bursts & Account Creation).
   - التحليل الدلالي والأسلوبي (Stylometry / Semantic Clustering / Copypasta).
   - بنية الشبكة ومجتمعات التضخيم (Amplification Nodes / CLSN).
3. 🛰️ البصمات الجغرافية والفضائية والرقمية المتقاطعة (GEOINT & Digital Corroboration)
4. ⛓️ المسار المالي وتتبع البلوكتشين والجهات الممولة (Financial Footprint & On-Chain Attribution):
   - تقييم نقاط الدخول والعناوين المرصودة (صفحات التبرع، قنوات تيليجرام، تسريبات OSINT).
   - مسار التحويلات على السلسلة والجسور والمبادلات DEXs ونقاط الصرف (Cash-out).
   - محددات الهوية وتقاطع المنصات الخاضعة لـ KYC وقوائم العقوبات الدولية (OpenSanctions).
5. ⚠️ التناقضات المرصودة والثغرات المعلوماتية ومسارات المتابعة (Discrepancies & Intelligence Gaps)
6. 📊 مؤشر الموثوقية الشامل (مؤكد / عالي / متوسط / غير جازم) مع التوصية العملياتية.

توجيه منهجي صارم: حافظ على صياغة استخباراتية جنائية رصينة ومحايدة تعتمد حصراً على البصمات التقنية، الأدلة الرقمية القابلة للتحقق، وتدفق البيانات وسلاسل الكتل والشذوذ الإحصائي، مع تجنب الأحكام الشخصية أو التكهن بالدوافع الذاتية للأفراد.

ملف التحقيق:
${investigationText}`;

    setMessages(prev => [...prev, { role: 'model', text: '', isSystem: true }]);

    try {
      const response = await withRetry(() => ai.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      }), 1, 1000);
      
      const summary = (response as any)?.text || '';
      const finalMsgText = `📋 **التقرير الاستخباراتي الختامي (Executive Intelligence Brief):**\n\n${summary}`;
      const reportMsg: Message = { role: 'model', text: finalMsgText, isSystem: true };
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = reportMsg;
        return updated;
      });
      setChatHistory(prev => ({ ...prev, osint_room: [...(prev.osint_room || []), reportMsg] }));
    } catch (e) {
      handleAIError(e, "توليد التقرير الاستخباراتي");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateOsintInvestigation = () => {
    stopGenerationRef.current = true;
    debateSessionRef.current++;
    setMessages([]);
    setChatHistory(prev => ({ ...prev, osint_room: [] }));
    setIsLoading(false);

    setTimeout(() => {
      startOsintInvestigation(
        osintRoomConfig.analysts,
        osintRoomConfig.targetQuery,
        osintRoomConfig.investigationMode,
        osintRoomConfig.depth
      );
    }, 100);
  };

  return (
    <div 
      style={{ '--color-accent': activeColor, '--color-glow': `${activeColor}26` } as React.CSSProperties} 
      className={
        theme === 'plain-text'
          ? 'bg-[#FFFFFF] text-[#000000] min-h-screen'
          : (viewMode === 'sanctuary' 
            ? (theme === 'calculator-gray' ? 'bg-[#F7F7F7] text-[#333333] min-h-screen' : 'bg-[#090A0D] min-h-screen') 
            : (theme === 'calculator-gray' ? 'bg-[#F7F7F7] text-[#333333] min-h-screen' : (isZenMode ? 'bg-bg min-h-screen' : '')))
      }
    >
      {viewMode === 'sanctuary' ? (
        <SanctuaryView
          activePersona={activePersona}
          setActivePersona={(name) => {
            setActivePersona(name);
            safeStorage.setItem('mindmirror_activePersona', name);
          }}
          personas={personas}
          messages={messages}
          isLoading={isLoading}
          onSendMessage={(text) => handleSendMessage(text)}
          onClearChat={requestClearChat}
          onSpeak={(text, pName) => handleSpeak(text, 0, pName, activePersona)}
          isSpeaking={speakingIndex !== null}
          onStopAudio={stopAudio}
          onOpenSettings={openSettingsSafely}
          theme={theme}
        />
      ) : (
        <>
          <FocusModeOverlay 
            isZenMode={isZenMode} 
            setIsZenMode={setIsZenMode} 
            onOpenAgiWorkspace={() => setShowAgiModal(true)} 
            personas={personas}
            activePersona={activePersona}
            setActivePersona={(name) => {
              setActivePersona(name);
              safeStorage.setItem('mindmirror_activePersona', name);
            }}
            onAddNewPersona={(name) => {
              if (!name.trim()) return;
              const personaKey = name.trim();
              setPersonas(prev => {
                const updated = {
                  ...prev,
                  [personaKey]: {
                    label: personaKey,
                    description: `شخصية معرفية جديدة: ${personaKey}`,
                    prompt: `تحدث معي كعقل ومفكر يمثل ${personaKey}`,
                    quote: `«أنا أفكّر بأسلوب ${personaKey}»`,
                    color: '#00d4ff',
                    avatarUrl: `/api/persona-portrait?name=${encodeURIComponent(personaKey)}`,
                    icon: 'Brain',
                    voice: 'Kore',
                    ttsTone: 'عميق وفلسفي',
                    greeting: `أهلاً بك. أنا ${personaKey}. كيف يمكننا التعمق في التفكير اليوم؟`
                  }
                };
                safeStorage.setItem('mindmirror_personas', JSON.stringify(updated));
                return updated;
              });
              setActivePersona(personaKey);
              safeStorage.setItem('mindmirror_activePersona', personaKey);
            }}
          />
        {apiKey && isApiKeyInvalid && !isZenMode && (
          <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 p-2.5 text-center text-xs flex items-center justify-center gap-2 z-50 relative">
            <span>مفتاح API الخاص المزود غير صالح. تم التبديل التلقائي لمفتاح النظام المدمج.</span>
            <button onClick={() => setShowSettings(true)} className="underline font-bold hover:text-red-300">الإعدادات</button>
          </div>
        )}
      {/* PWA 2026 Top Persistent Banner */}
      {!isZenMode && (
        <PWAInstallButton 
          variant="top-banner" 
          onOpenDeploymentCenter={() => setShowDeploymentCenterModal(true)} 
        />
      )}

      {/* Top AGI Engine Header Bar */}
      {!isZenMode && (
        <AgiAssistantHeaderBar
          currentEngine={currentEngine}
          onEngineChange={setCurrentEngine}
          isWebSearchEnabled={isWebSearchEnabled}
          setIsWebSearchEnabled={handleSetWebSearch}
          isDeepThinkingEnabled={isDeepThinkingEnabled}
          setIsDeepThinkingEnabled={setIsDeepThinkingEnabled}
          isMapsGroundingEnabled={isMapsGroundingEnabled}
          setIsMapsGroundingEnabled={handleSetMapsGrounding}
          onOpenAgiWorkspace={() => setShowAgiModal(true)}
          onOpenTextDissector={() => {
            setDissectorInputText('');
            setDissectorSourceSpeaker('');
            setShowTextDissectorModal(true);
          }}
          onOpenAcademyVault={() => setIsAcademyVaultOpen(true)}
          onOpenUserProfiles={() => setShowUserProfilesModal(true)}
          onOpenPersonaComparison={() => setShowPersonaComparisonModal(true)}
          onOpenGroundedImageAssistant={() => setShowGroundedImageAssistantModal(true)}
          onOpenPodLiveStudio={() => setShowPodLiveStudioModal(true)}
        />
      )}

      <div className={`relative z-10 mx-auto px-4 sm:px-6 md:px-10 transition-all duration-300 ${isZenMode ? 'max-w-none py-0 h-screen flex flex-col' : isStandalone ? 'max-w-[1400px] py-1 md:py-2' : 'max-w-[1400px] py-8 md:py-[60px]'}`}>
        
        {/* Toggle Explainers Section for Space Optimization */}
        {!isZenMode && (
          <div className="flex justify-start items-center mb-6">
            <button
              onClick={() => {
                const nextVal = !showExplainers;
                setShowExplainers(nextVal);
                safeStorage.setItem('mindmirror_showExplainers', String(nextVal));
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer select-none ${
                showExplainers 
                  ? 'bg-surface2 border-border text-muted hover:border-accent hover:text-text' 
                  : 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20 shadow-[0_0_15px_rgba(0,212,255,0.08)]'
              }`}
            >
              {showExplainers ? '✕ إخفاء لوحة الشرح والتعليمات (توفير المساحة)' : 'ℹ️ إظهار لوحة الشرح والتعليمات'}
            </button>
          </div>
        )}

        <AnimatePresence>
          {!isZenMode && showExplainers && (
            <motion.div
              key="explainers-wrapper"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <LandingSections />
            </motion.div>
          )}
        </AnimatePresence>

        {/* PERSONA DEMO */}
        {!isZenMode && (
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}>
            <SectionTitle title="مثال تفاعلي على المحاكاة" tag="LIVE DEMO" />
          </motion.div>
        )}

        <motion.div 
          id="chat-section"
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}
          className={`relative overflow-visible transition-all duration-500 flex-1 flex flex-col ${
            isZenMode 
              ? 'p-0 mb-0 shadow-none border-none bg-transparent h-full' 
              : 'bg-surface border border-border rounded-[20px] p-4 sm:p-6 md:p-10 mb-20 persona-demo-bg shadow-xl'
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            if (activePersona !== 'debate') {
              setIsDragging(true);
            }
          }}
        >
          <AnimatePresence>
            {isDragging && activePersona !== 'debate' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-bg/95 backdrop-blur-md z-[150] flex flex-col items-center justify-center m-2 sm:m-4 md:m-6 rounded-[20px] border-4 border-dashed border-accent"
              >
                <div 
                  className="absolute inset-0 z-10 cursor-copy"
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file && (file.type === 'text/plain' || file.name.endsWith('.txt'))) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        setDraggedFile({ name: file.name, content: content });
                        toast({
                          type: 'success',
                          title: 'تم سحب وتجهيز الملف',
                          message: `تم تحميل "${file.name}" بنجاح. يرجى مراجعة الملف وتأكيد الدمج بالسياق أو إلغائه.`
                        });
                      };
                      reader.readAsText(file);
                    } else if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const arrayBuffer = event.target?.result as ArrayBuffer;
                          toast({
                            type: 'info',
                            title: 'جاري قراءة ملف PDF',
                            message: `جاري استخراج النصوص من ملف "${file.name}"، يرجى الانتظار...`
                          });
                          const content = await extractTextFromPdf(arrayBuffer);
                          if (!content.trim()) {
                            toast({
                              type: 'info',
                              title: 'تنبيه',
                              message: 'تمت قراءة الملف بنجاح، لكن يبدو أنه لا يحتوي على نصوص قابلة للاستخراج (قد يكون ملفاً ممسوحاً ضوئياً كصورة).'
                            });
                          }
                          setDraggedFile({ name: file.name, content: content });
                          toast({
                            type: 'success',
                            title: 'تم استخراج نص PDF بنجاح',
                            message: `تمت قراءة "${file.name}" بنجاح. يرجى مراجعة الملف وتأكيد الدمج أو إلغائه.`
                          });
                        } catch (err: any) {
                          if (err.message === 'PASSWORD_PROTECTED') {
                            toast({
                              type: 'error',
                              title: 'ملف PDF محمي بكلمة مرور',
                              message: `الملف "${file.name}" محمي بكلمة مرور. يرجى استخدام ملف غير مشفر أو إزالة كلمة المرور أولاً.`
                            });
                          } else {
                            toast({
                              type: 'error',
                              title: 'فشل قراءة ملف PDF',
                              message: `حدث خطأ غير متوقع أثناء استخراج النصوص من "${file.name}".`
                            });
                          }
                        }
                      };
                      reader.readAsArrayBuffer(file);
                    } else {
                      toast({
                        type: 'error',
                        title: 'نوع ملف غير مدعوم',
                        message: 'يرجى سحب وإسقاط ملف نصي (.txt) أو ملف PDF (.pdf) فقط.'
                      });
                    }
                  }}
                />
                
                <motion.div 
                  initial={{ scale: 0.9, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 15 }}
                  className="relative z-0 flex flex-col items-center max-w-lg text-center p-6 pointer-events-none"
                >
                  <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-6 shadow-xl shadow-accent/5">
                    <FileText size={40} className="animate-pulse" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-text mb-3">أفلت الملف هنا لتحديث سياق {activePersona}</h3>
                  <p className="text-muted text-sm md:text-base leading-relaxed max-w-md">
                    سيقوم التطبيق تلقائياً بقراءة محتوى ملف النص أو ملف PDF ودمجه في البصمة الرقمية والتعليمات المرجعية الأساسية لشخصية <span className="text-accent font-bold">"{activePersona}"</span>.
                  </p>
                  <div className="mt-4 px-3 py-1 bg-surface2 border border-border rounded-full text-xs text-muted flex items-center gap-1.5">
                    <Sparkles size={12} className="text-accent" />
                    يدعم ملفات النصوص (.txt) و PDF (.pdf) غير المشفرة
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isZenMode && (
            <PersonaSelector
              personas={personas}
              activePersona={activePersona}
              setActivePersona={setActivePersona}
              isLoading={isLoading}
              deletePersona={deletePersona}
              editPersona={(name, e) => { e.stopPropagation(); setPersonaToEdit(name); }}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              isAddingPersona={isAddingPersona}
              setIsAddingPersona={setIsAddingPersona}
              newPersonaName={newPersonaName}
              setNewPersonaName={setNewPersonaName}
              submitNewPersona={submitNewPersona}
              setShowDebateModal={setShowDebateModal}
              setShowGroupQuestionModal={setShowGroupQuestionModal}
              setShowPersonaExtractorModal={setShowPersonaExtractorModal}
              setShowOsintRoomModal={setShowOsintRoomModal}
              setShowTrendLiveRoomModal={setShowTrendLiveRoomModal}
              setShowChatSearchModal={setShowChatSearchModal}
            />
          )}
          
          <motion.div 
            layout
            className={isFullScreen 
              ? "fixed inset-0 z-[100] bg-bg flex flex-col w-full h-full overflow-hidden" 
              : `flex flex-col overflow-hidden relative z-10 transition-all duration-300 ${
                  isZenMode 
                    ? "h-screen w-full bg-transparent border-none rounded-none" 
                    : "bg-bg rounded-xl sm:rounded-2xl border border-border shadow-xl h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-6rem)] max-h-[100dvh]"
                }`}
          >
            {!isZenMode && (
              <ChatHeader
                activePersona={activePersona}
                personas={personas}
                theme={theme}
                setTheme={setTheme}
                showDebug={showDebug}
                setShowDebug={setShowDebug}
                setShowSettings={openSettingsSafely}
                handleCopyConversation={handleCopyConversation}
                handleShareConversation={handleShareConversation}
                handleExport={handleExport}
                onExportFullVideo={() => exportChatHistoryToVideo(messages, activePersona, activePersona === 'debate' ? 'المناظرة المعرفية الشاملة' : `محادثة ${personas[activePersona]?.label || activePersona}`)}
                onExportAllCachedAudio={exportAllCachedAudioFiles}
                onClearAudioCache={() => setShowClearAudioCacheConfirm(true)}
                isWebSearchEnabled={isWebSearchEnabled}
                setIsWebSearchEnabled={setIsWebSearchEnabled}
                isFullScreen={isFullScreen}
                setIsFullScreen={setIsFullScreen}
                isZenMode={isZenMode}
                setIsZenMode={setIsZenMode}
                onSearchClick={() => setShowChatSearchModal(true)}
                clearChat={requestClearChat}
                usedModelName={usedModelName}
                newsRadarActive={activePersona === 'group_question' ? groupQuestionConfig.newsRadar : undefined}
                isAcademyMode={isAcademyMode}
                setIsAcademyMode={setIsAcademyMode}
                onOpenAcademyVault={() => setIsAcademyVaultOpen(true)}
                onOpenLiveConversation={() => setShowLiveConversationModal(true)}
                onOpenUserProfiles={() => setShowUserProfilesModal(true)}
                onOpenPersonaComparison={() => setShowPersonaComparisonModal(true)}
                onOpenGroundedImageAssistant={() => setShowGroundedImageAssistantModal(true)}
                onOpenTrendLiveRoom={() => setShowTrendLiveRoomModal(true)}
                onOpenDeploymentCenter={() => setShowDeploymentCenterModal(true)}
                onOpenPodLiveStudio={() => setShowPodLiveStudioModal(true)}
              />
            )}

            {/* Chat Messages */}
            <div 
              ref={chatContainerRef}
              onScroll={handleScroll}
              className={`flex-1 overflow-y-auto space-y-6 sm:space-y-8 font-sans text-[15px] leading-[1.8] scrollbar-custom scroll-smooth relative transition-all duration-300 ${
                isZenMode ? 'p-0 px-2' : 'p-3 sm:p-4 md:p-8'
              }`}
            >
              <div className="max-w-4xl mx-auto w-full space-y-8">
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    msg={msg}
                    idx={idx}
                    activePersona={activePersona}
                    personas={personas}
                    isLoading={isLoading}
                    editingIndex={editingIndex}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    setEditingIndex={setEditingIndex}
                    saveEdit={saveEdit}
                    copiedIndex={copiedIndex}
                    handleCopy={handleCopy}
                    speakingIndex={speakingIndex}
                    isTTSLoading={isTTSLoading}
                    onExportVideo={(msg, p) => exportMessageToVideo(msg, p || activePersona)}
                    onExtractLesson={(text, pName, pLabel) => setExtractLessonModal({ isOpen: true, text, personaName: pName, personaLabel: pLabel })}
                    onOpenTextDissector={(text, speaker) => {
                      setDissectorInputText(text);
                      setDissectorSourceSpeaker(speaker || '');
                      setShowTextDissectorModal(true);
                    }}

                    handleSpeak={(text, idx, p) => {
                      if (speakingIndex === idx) {
                        stopAudio();
                      } else {
                        handleSequentialSpeak(
                           () => messagesRef.current,
                          idx,
                          p || activePersona,
                          activePersona
                        );
                      }
                    }}
                    handleRegenerate={handleRegenerate}
                    isLastMessage={idx === messages.length - 1}
                    getAvatarUrl={getAvatarUrl}
                    onConceptClick={(concept, baseExplanation, messageContext, personaName) => {
                      setExplainerData({
                        concept,
                        baseExplanation,
                        messageContext,
                        personaName
                      });
                    }}
                  />
                ))}
                {isLoading && messages.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center mt-8">
                      <div className="bg-surface2 border border-border px-6 py-4 rounded-xl text-center flex flex-col items-center shadow-lg">
                        <Loader2 className="animate-spin text-accent mb-3" size={32} />
                        <h4 className="text-text font-bold mb-1">يتم استخراج طبائع الشخصية...</h4>
                        <p className="text-muted text-sm">يقوم النظام بتحليل البصمة اللغوية وأسلوب تفكير {newPersonaName || activePersona}</p>
                      </div>
                  </motion.div>
                )}
                {isLoading && messages.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="w-full md:max-w-[85%] bg-transparent text-text px-2 py-4 flex gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-accent2 mt-1 shadow-sm overflow-hidden">
                        <img src={getAvatarUrl(activePersona)} alt={activePersona} className="w-full h-full object-cover opacity-70" />
                      </div>
                      <div className="flex-1 flex items-center gap-3 mt-2">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 bg-accent2 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-accent2 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-accent2 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-muted text-xs font-sans font-medium tracking-wide">يتم توليد الرد...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
            
            {/* Chat Input */}
            <div className={`z-20 flex flex-col transition-all duration-300 shrink-0 ${
              isZenMode 
                ? 'p-2 sm:p-3 bg-transparent border-none' 
                : 'p-2 sm:p-3 md:p-4 bg-surface/90 backdrop-blur-md border-t border-border'
            }`}>
              {draggedFile && (
                <div className="flex items-center justify-between gap-3 bg-accent/5 hover:bg-accent/10 border border-accent/20 px-3 py-2 rounded-xl mb-4 text-xs sm:text-sm text-text animate-fade-in shadow-inner transition-colors">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent shrink-0">
                      <FileText size={14} className="animate-pulse" />
                    </div>
                    <div className="flex flex-col overflow-hidden text-start">
                      <span className="text-muted text-[10px] font-medium">الملف الذي تم سحبه حالياً (سياق مؤقت)</span>
                      <span className="font-bold text-accent truncate max-w-[180px] sm:max-w-xs">{draggedFile.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setPersonas(prev => {
                          const updated = {
                            ...prev,
                            [activePersona]: {
                              ...prev[activePersona],
                              prompt: prev[activePersona].prompt + "\n\n--- [Context File: " + draggedFile.name + "] ---\n" + draggedFile.content + "\n--- [End Context File] ---\n"
                            }
                          };
                          safeSetItem('mindmirror_personas', JSON.stringify(updated));
                          return updated;
                        });
                        toast({
                          type: 'success',
                          title: 'تم دمج الملف في سياق المحاكاة',
                          message: `تم دمج محتوى "${draggedFile.name}" في البصمة اللغوية للشخصية "${activePersona}" بنجاح.`
                        });
                        setDraggedFile(null);
                      }}
                      className="px-3 py-1.5 bg-accent text-bg hover:bg-accent/90 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer"
                    >
                      <Check size={12} />
                      دمج نهائي بالسياق
                    </button>
                    <button
                      onClick={() => {
                        setDraggedFile(null);
                        toast({
                          type: 'info',
                          title: 'تم إلغاء سحب الملف',
                          message: 'تم إلغاء عملية دمج الملف في سياق المحاكاة.'
                        });
                      }}
                      className="p-1.5 hover:bg-red-500/15 text-red-400 hover:text-red-300 rounded-lg transition-all cursor-pointer"
                      title="إلغاء العملية (حذف)"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
              {messages.length === 1 && personas[activePersona]?.suggestions && !dynamicSuggestions.length && !isZenMode && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2 justify-center mb-4">
                  {personas[activePersona].suggestions.map((sug, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSendMessage(sug)} 
                      className="bg-surface2 border border-border hover:border-accent text-muted hover:text-accent px-4 py-2 rounded-full text-[13px] transition-all shadow-sm"
                    >
                      {sug}
                    </button>
                  ))}
                </motion.div>
              )}
              {dynamicSuggestions.length > 0 && !isLoading && !isZenMode && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2 justify-center mb-4">
                  {dynamicSuggestions.map((sug, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSendMessage(sug)} 
                      className="bg-surface2 border border-border hover:border-accent text-muted hover:text-accent px-4 py-2 rounded-full text-[13px] transition-all shadow-sm"
                    >
                      {sug}
                    </button>
                  ))}
                </motion.div>
              )}
              {activePersona === 'debate' && !isZenMode && (
                <div className="max-w-4xl mx-auto w-full flex justify-center py-2 mb-2">
                  {!isLoading ? (
                    <div className="flex gap-2 overflow-x-auto scrollbar-custom w-full max-w-full px-2 snap-x pb-1">
                      <button onClick={handleExtendDebate} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-accent/50 transition-all flex items-center gap-1 shrink-0" title="إطالة المناظرة (جولتين)"><Plus size={14} /> إطالة</button>
                      <button onClick={handleSummarizeDebate} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-accent/50 transition-all flex items-center gap-1 shrink-0" title="ملخص النتيجة"><FileText size={14} /> ملخص</button>
                      <button onClick={handleRegenerateDebate} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-accent/50 transition-all flex items-center gap-1 shrink-0" title="البدء من جديد"><RefreshCw size={14} /> من البداية</button>
                      <button onClick={() => handlePlayDebate(messages, activePersona)} className={`snap-start whitespace-nowrap shrink-0 border px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm transition-all flex items-center gap-1 ${debatePlaybackState === 'playing' ? 'bg-accent/20 border-accent text-accent animate-pulse' : 'bg-surface2 border-border text-text hover:border-accent/50'}`} title={debatePlaybackState === 'playing' ? "إيقاف الاستماع" : "استماع للمناظرة"}>
                        {debatePlaybackState === 'playing' ? <StopCircle size={14} /> : <Play size={14} />} 
                        {debatePlaybackState === 'playing' ? 'إيقاف' : 'استماع'}
                      </button>
                      <button onClick={() => handleDownloadDebateAudio(messages, activePersona)} disabled={isDownloadingAudio} className={`snap-start whitespace-nowrap shrink-0 border px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm transition-all flex items-center gap-1 ${isDownloadingAudio ? 'bg-accent/20 border-accent text-accent opacity-70 cursor-not-allowed' : 'bg-surface2 border-border text-text hover:border-accent/50'}`} title="تنزيل الصوت">
                        {isDownloadingAudio ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                        {isDownloadingAudio ? 'تجهيز...' : 'تنزيل'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {activePersona === 'group_question' && !isZenMode && (
                <div className="max-w-4xl mx-auto w-full flex justify-center py-2 mb-2">
                  {!isLoading ? (
                    <div className="flex gap-2 overflow-x-auto scrollbar-custom w-full max-w-full px-2 snap-x pb-1">
                      <button onClick={handleExtendGroupQuestion} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-emerald-500/50 transition-all flex items-center gap-1 shrink-0" title="إطالة الندوة الفكرية (جولة إضافية)"><Plus size={14} /> إطالة</button>
                      <button onClick={handleSummarizeGroupQuestion} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-emerald-500/50 transition-all flex items-center gap-1 shrink-0" title="خلاصة الندوة والفوائد"><FileText size={14} /> خلاصة وفوائد</button>
                      <button onClick={handleRegenerateGroupQuestion} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-emerald-500/50 transition-all flex items-center gap-1 shrink-0" title="إعادة الندوة من البداية"><RefreshCw size={14} /> من البداية</button>
                      <button onClick={() => handlePlayDebate(messages, activePersona)} className={`snap-start whitespace-nowrap shrink-0 border px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm transition-all flex items-center gap-1 ${debatePlaybackState === 'playing' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 animate-pulse' : 'bg-surface2 border-border text-text hover:border-emerald-500/50'}`} title={debatePlaybackState === 'playing' ? "إيقاف الاستماع" : "استماع للندوة"}>
                        {debatePlaybackState === 'playing' ? <StopCircle size={14} /> : <Play size={14} />} 
                        {debatePlaybackState === 'playing' ? 'إيقاف' : 'استماع'}
                      </button>
                      <button onClick={() => handleDownloadDebateAudio(messages, activePersona)} disabled={isDownloadingAudio} className={`snap-start whitespace-nowrap shrink-0 border px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm transition-all flex items-center gap-1 ${isDownloadingAudio ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 opacity-70 cursor-not-allowed' : 'bg-surface2 border-border text-text hover:border-emerald-500/50'}`} title="تنزيل الصوت">
                        {isDownloadingAudio ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                        {isDownloadingAudio ? 'تجهيز...' : 'تنزيل'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {activePersona === 'osint_room' && !isZenMode && (
                <div className="max-w-4xl mx-auto w-full flex justify-center py-2 mb-2">
                  {!isLoading ? (
                    <div className="flex gap-2 overflow-x-auto scrollbar-custom w-full max-w-full px-2 snap-x pb-1">
                      <button onClick={handleExtendOsintInvestigation} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-amber-500/50 transition-all flex items-center gap-1.5 shrink-0" title="استكمال التحقيق وتقاطع المعطيات (جولة إضافية)"><Plus size={14} className="text-amber-400" /> استكمال التحقيق</button>
                      <button onClick={handleSummarizeOsintInvestigation} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-amber-500/50 transition-all flex items-center gap-1.5 shrink-0" title="إصدار التقرير الاستخباراتي الختامي"><FileText size={14} className="text-amber-400" /> تقرير استخباراتي</button>
                      <button onClick={() => setShowOsintRoomModal(true)} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-amber-500/50 transition-all flex items-center gap-1.5 shrink-0" title="إعدادات غرفة الاستخبارات ودليل الأقمار"><Radar size={14} className="text-amber-400" /> إعدادات وغرفة جديدة</button>
                      <button onClick={handleRegenerateOsintInvestigation} className="snap-start whitespace-nowrap bg-surface2 border border-border text-text px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm hover:border-amber-500/50 transition-all flex items-center gap-1 shrink-0" title="إعادة التحقيق من البداية"><RefreshCw size={14} /> إعادة التحقيق</button>
                      <button onClick={() => handlePlayDebate(messages, activePersona)} className={`snap-start whitespace-nowrap shrink-0 border px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm transition-all flex items-center gap-1 ${debatePlaybackState === 'playing' ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse' : 'bg-surface2 border-border text-text hover:border-amber-500/50'}`} title={debatePlaybackState === 'playing' ? "إيقاف الاستماع" : "استماع للتقرير"}>
                        {debatePlaybackState === 'playing' ? <StopCircle size={14} /> : <Play size={14} />} 
                        {debatePlaybackState === 'playing' ? 'إيقاف' : 'استماع'}
                      </button>
                      <button onClick={() => handleDownloadDebateAudio(messages, activePersona)} disabled={isDownloadingAudio} className={`snap-start whitespace-nowrap shrink-0 border px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm transition-all flex items-center gap-1 ${isDownloadingAudio ? 'bg-amber-500/20 border-amber-500 text-amber-400 opacity-70 cursor-not-allowed' : 'bg-surface2 border-border text-text hover:border-amber-500/50'}`} title="تنزيل التقرير صوتياً">
                        {isDownloadingAudio ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                        {isDownloadingAudio ? 'تجهيز...' : 'تنزيل الصوت'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Floating Scroll to Bottom Button - Fixed position above ChatInputArea */}
            <AnimatePresence>
              {showScrollButton && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8, y: 10 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-[35] pointer-events-none"
                >
                  <Tooltip content="الانتقال لآخر الرسائل" subContent="النزول التلقائي لأسفل المحادثة">
                    <button 
                      onClick={() => {
                        autoScrollEnabled.current = true;
                        if (chatContainerRef.current) {
                          chatContainerRef.current.scrollTo({
                            top: chatContainerRef.current.scrollHeight,
                            behavior: 'smooth'
                          });
                        }
                      }}
                      className="bg-accent/95 hover:bg-accent border border-accent/20 text-bg p-2.5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all pointer-events-auto cursor-pointer flex items-center justify-center"
                    >
                      <ArrowDown size={18} />
                    </button>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sticky ChatInputArea at the bottom */}
            <div className={`sticky bottom-0 z-30 shrink-0 p-2 sm:p-4 ${isZenMode ? 'border-none bg-transparent shadow-none' : 'border-t border-border/30 bg-surface/90 backdrop-blur-lg shadow-lg'}`}>
              <ChatInputArea 
                onSendMessage={handleSendMessage} 
                isLoading={isLoading} 
                onStop={() => { stopGenerationRef.current = true; stopAudio(); }} 
                activePersona={activePersona} 
                isZenMode={isZenMode}
                onOpenGroundedImageAssistant={() => setShowGroundedImageAssistantModal(true)}
              />
            </div>
          </motion.div>
        </motion.div>

        {!isZenMode && (
          <AdvancedFeaturesSection 
            personas={personas}
            activePersonaId={activePersona}
            activePersonaData={personas[activePersona]}
            chatHistory={messages}
            launchGroupSession={(participants, question) => {
              if (!participants || participants.length === 0) return;

              // Ensure all participants exist in personas state with authentic prompts
              const updatedPersonas = { ...personas };
              let hasNewPersonas = false;
              const randomColors = ['#38bdf8', '#ef4444', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#60a5fa', '#ec4899'];

              participants.forEach(pName => {
                const trimmed = pName.trim();
                if (trimmed && !updatedPersonas[trimmed]) {
                  hasNewPersonas = true;
                  const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)];
                  updatedPersonas[trimmed] = {
                    label: trimmed,
                    prompt: `أنت ${trimmed}. أجب باللغة العربية بلسان وأسلوب ورؤية وقناعات ${trimmed} بالكامل. تقمص شخصيته وفلسفته بدقة، وأجب بناءً على أفكاره الحقيقية الموثقة. لا تذكر أبداً أنك نموذج ذكاء اصطناعي.`,
                    greeting: `أهلاً بك. أنا ${trimmed}، يسعدني الانضمام لهذه الندوة الحوارية والتدقيق في القضايا الجوهرية.`,
                    suggestions: [`ما هي أطروحتك الفلسفية يا ${trimmed}؟`, 'كيف ينطبق فكرك على العصر الرقمي؟', 'ما أهم نصيحة تقدمها للتلاميذ؟'],
                    color: randomColor,
                    avatarUrl: `/api/persona-portrait?name=${encodeURIComponent(trimmed)}`,
                    voice: 'Puck',
                    ttsTone: 'تلقائي'
                  };
                }
              });

              if (hasNewPersonas) {
                setPersonas(updatedPersonas);
                safeStorage.setItem('mindmirror_personas', JSON.stringify(updatedPersonas));
              }

              const finalQuestion = question && question.trim() ? question.trim() : 'ما هي الرؤية الفكرية والفلسفية والمنهجية الجوهرية التي تقدمها لمستقبل المعرفة والوعي؟';
              
              window.scrollTo({ top: 0, behavior: 'smooth' });
              toast({
                title: "تم إطلاق العقل الجمعي!",
                message: `بدأت الندوة المعرفية بين عقول: (${participants.join(' ، ')})`,
                type: "success"
              });

              startGroupQuestion(participants, finalQuestion, 'cooperative');
            }}
            handleSpeak={handleSpeak}
            stopAudio={stopAudio}
            isTTSLoading={isTTSLoading}
            isAudioPlaying={isAudioPlaying}
            activeSpeechText={activeSpeechText}
            activeSpeechPersona={activeSpeechPersona}
            speakText={speakText}
            onSelectPersona={(personaKey) => {
              stopAudio();
              setActivePersona(personaKey);
            }}
            speakingIndex={speakingIndex}
            onChatWithPerson={handleStartChatWithPerson}
          />
        )}

        {!isZenMode && (
          <div className="mt-12 mb-6">
            <PWAInstallButton 
              variant="full-banner" 
              onOpenDeploymentCenter={() => setShowDeploymentCenterModal(true)} 
            />
          </div>
        )}

      </div>
      </>
    )}
      
      {/* DEBATE MODAL */}
      <AnimatePresence>
        <DebateModal 
          show={showDebateModal}
          onClose={() => setShowDebateModal(false)}
          debateConfig={debateConfig}
          setDebateConfig={setDebateConfig}
          personas={personas}
          startDebate={startDebate}
          startLiveDebate={() => {
            setShowDebateModal(false);
            setGroupLiveConfig({ participants: debateConfig.participants, mode: 'debate', topic: debateConfig.topic });
            setShowGroupLiveModal(true);
          }}
        />
      </AnimatePresence>

      {/* GROUP QUESTION MODAL */}
      <GroupQuestionModal
        show={showGroupQuestionModal}
        onClose={() => setShowGroupQuestionModal(false)}
        personas={personas}
        isLoading={isLoading}
        startGroupQuestion={startGroupQuestion}
        initialParticipants={groupQuestionConfig?.participants}
        initialQuestion={groupQuestionConfig?.question}
        startLiveGroupQuestion={(participants, question, sessionStyle) => {
          setShowGroupQuestionModal(false);
          setGroupLiveConfig({ participants, mode: 'seminar', topic: question });
          setShowGroupLiveModal(true);
        }}
      />

      {/* OSINT INVESTIGATION ROOM MODAL */}
      <OsintRoomModal
        show={showOsintRoomModal}
        onClose={() => setShowOsintRoomModal(false)}
        personas={personas}
        isLoading={isLoading}
        startOsintInvestigation={startOsintInvestigation}
      />

      {/* PERSONA EXTRACTOR MODAL */}
      <PersonaExtractorModal
        show={showPersonaExtractorModal}
        onClose={() => setShowPersonaExtractorModal(false)}
        isLoadingApp={isLoading}
        model={model}
        onAddPersonas={handleAddPersonas}
        requireApiKey={requireApiKey}
      />

      {/* CHAT SEARCH MODAL */}
      <ChatSearchModal
        show={showChatSearchModal}
        onClose={() => setShowChatSearchModal(false)}
        chatHistory={chatHistory}
        personas={personas}
        onSelectResult={handleSelectSearchResult}
      />

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        viewMode={viewMode}
        setViewMode={(m) => {
          setViewMode(m);
          safeStorage.setItem('mindmirror_viewMode', m);
        }}
        theme={theme}
        setTheme={setTheme}
        apiKey={apiKey} 
        setApiKey={setApiKey} 
        provider={provider} 
        setProvider={setProvider} 
        model={model} 
        setModel={setModel} 
        audioModel={audioModel}
        setAudioModel={setAudioModel}
        ttsVolume={ttsVolume}
        setTtsVolume={setTtsVolume}
        ttsSpeed={ttsSpeed}
        setTtsSpeed={setTtsSpeed}
        personas={personas}
        updatePersonaTone={updatePersonaTone}
        updatePersonaVoice={updatePersonaVoice}
        fixLegacyPersonas={handleFixLegacyPersonas}
        openPersonaExtractor={() => setShowPersonaExtractorModal(true)}
        isFixingLegacy={isFixingLegacy}
        userInfo={userInfo}
        setUserInfo={setUserInfo}
        dynamicModels={dynamicModels}
        dynamicAudioModels={dynamicAudioModels}
        dynamicVoices={dynamicVoices}
        onVoiceAdded={(newVoice: string) => {
          const updated = Array.from(new Set([newVoice, ...dynamicVoices]));
          setDynamicVoices(updated);
          safeStorage.setItem('mindmirror_dynamicVoices', JSON.stringify(updated));
        }}
        onVoiceRemoved={(removedVoice: string) => {
          const updated = dynamicVoices.filter(v => v !== removedVoice);
          setDynamicVoices(updated);
          safeStorage.setItem('mindmirror_dynamicVoices', JSON.stringify(updated));
          setPersonas(prev => {
            let changed = false;
            const next = { ...prev };
            for (const [k, p] of Object.entries(next)) {
              if (p.voice === removedVoice) {
                next[k] = { ...p, voice: 'Puck' };
                changed = true;
              }
            }
            if (changed) {
              safeStorage.setItem('mindmirror_personas', JSON.stringify(next));
              return next;
            }
            return prev;
          });
        }}
        updateModelsAndVoices={updateModelsAndVoices}
        isUpdatingModels={isUpdatingModels}
        isApiKeyInvalid={isApiKeyInvalid}
        isApiKeyVerified={isApiKeyVerified}
        isQuotaExhausted={isQuotaExhausted}
        
        // Auto-Archive Props
        autoArchiveEnabled={autoArchiveEnabled}
        setAutoArchiveEnabled={setAutoArchiveEnabled}
        archiveThresholdDays={archiveThresholdDays}
        setArchiveThresholdDays={setArchiveThresholdDays}
        archivedChats={archivedChats}
        restoreChat={restoreChat}
        deleteArchivedChat={deleteArchivedChat}
        manuallyArchiveOldChats={manuallyArchiveOldChats}
        downloadArchiveFile={downloadArchiveFile}
        isStrictModelMode={isStrictModelMode}
        setIsStrictModelMode={setIsStrictModelMode}
        fontFamily={fontFamily}
        setFontFamily={setFontFamily}
        onFactoryReset={handleFactoryReset}
      />

      <ConfirmModal
        isOpen={showClearChatConfirm}
        title="بدء حوار جديد"
        message={`هل أنت متأكد من مسح سجل الحوار الحالي مع "${activePersona}" وبدء جلسة جديدة؟`}
        confirmText="نعم، ابدأ حواراً جديداً"
        cancelText="إلغاء الأمر"
        onConfirm={confirmClearChat}
        onCancel={() => setShowClearChatConfirm(false)}
      />

      <ConfirmModal
        isOpen={showClearAudioCacheConfirm}
        title="تصفير كاش الصوتيات"
        message="هل أنت متأكد من رغبتك في تصفير وحذف جميع ملفات الصوت المخزنة محلياً في الكاش؟ سيتم إعادة توليد مقاطع نظيفة ونقية من جديد عند الاستماع."
        confirmText="نعم، قم بتصفير الكاش الصوتي"
        cancelText="إلغاء الأمر"
        onConfirm={async () => {
          setShowClearAudioCacheConfirm(false);
          await clearAudioCache();
        }}
        onCancel={() => setShowClearAudioCacheConfirm(false)}
      />

      <ConfirmModal
        isOpen={!!personaToDelete}
        title="حذف الشخصية"
        message={`هل أنت متأكد من رغبتك في حذف البصمة الرقمية لشخصية "${personaToDelete}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف الشخصية"
        cancelText="إلغاء الأمر"
        onConfirm={confirmDeletePersona}
        onCancel={() => setPersonaToDelete(null)}
      />

      <EditPersonaModal
        isOpen={!!personaToEdit}
        personaName={personaToEdit || ''}
        personaData={personaToEdit ? personas[personaToEdit] : undefined}
        onClose={() => setPersonaToEdit(null)}
        onSave={handleEditPersonaSave}
        isLoading={isLoading}
      />

      <AnimatePresence>
        {explainerData && (
          <ExplainerModal
            isOpen={!!explainerData}
            onClose={() => setExplainerData(null)}
            concept={explainerData.concept}
            baseExplanation={explainerData.baseExplanation}
            messageContext={explainerData.messageContext}
            personaName={explainerData.personaName}
            apiKey={apiKey.trim()}
            model={model}
            themeColor={activeColor}
          />
        )}
      </AnimatePresence>

      <ExtractLessonModal
        isOpen={extractLessonModal.isOpen}
        onClose={() => setExtractLessonModal(prev => ({ ...prev, isOpen: false }))}
        messageText={extractLessonModal.text}
        personaName={extractLessonModal.personaName}
        personaLabel={extractLessonModal.personaLabel}
        apiKey={apiKey}
      />

      <AcademyLessonsModal
        isOpen={isAcademyVaultOpen}
        onClose={() => setIsAcademyVaultOpen(false)}
      />

       {showLiveConversationModal && (
        <LiveConversationModal
          onClose={() => {
            safeStorage.removeSessionItem('mindmirror_auto_open_live');
            setShowLiveConversationModal(false);
          }}
          activePersona={activePersona}
          personas={personas}
          history={messages}
        />
       )}
 
       {showGroupLiveModal && (
        <GroupLiveConversationModal
          onClose={() => setShowGroupLiveModal(false)}
          participants={groupLiveConfig.participants}
          mode={groupLiveConfig.mode}
          topic={groupLiveConfig.topic}
          personas={personas}
          history={messages}
        />
       )}

      <AgiAssistantModal
        isOpen={showAgiModal}
        onClose={() => setShowAgiModal(false)}
        currentEngine={currentEngine}
        onEngineChange={setCurrentEngine}
        isWebSearchEnabled={isWebSearchEnabled}
        setIsWebSearchEnabled={handleSetWebSearch}
        isDeepThinkingEnabled={isDeepThinkingEnabled}
        setIsDeepThinkingEnabled={setIsDeepThinkingEnabled}
        isMapsGroundingEnabled={isMapsGroundingEnabled}
        setIsMapsGroundingEnabled={handleSetMapsGrounding}
        onOpenDissectorWithText={(text) => {
          setDissectorInputText(text);
          setDissectorSourceSpeaker('المساعد الذكي');
          setShowTextDissectorModal(true);
        }}
        onExtractLesson={(text, pName, pLabel) => setExtractLessonModal({ isOpen: true, text, personaName: pName, personaLabel: pLabel })}
        requireApiKey={requireApiKey}
        isZenMode={isZenMode}
        setIsZenMode={setIsZenMode}
      />

      <TextDissectorModal
        isOpen={showTextDissectorModal && !showSettings}
        onClose={() => setShowTextDissectorModal(false)}
        inputText={dissectorInputText}
        sourceSpeaker={dissectorSourceSpeaker}
        apiKey={apiKey.trim()}
        onExtractAndChat={handleExtractAndChat}
        onExtractAll={handleExtractAll}
        requireApiKey={requireApiKey}
        isZenMode={isZenMode}
      />

      <UserProfilesModal
        isOpen={showUserProfilesModal}
        onClose={() => setShowUserProfilesModal(false)}
        profiles={userProfiles}
        personas={personas}
        onSaveProfile={handleSaveProfile}
        onDeleteProfile={handleDeleteProfile}
        onSelectActiveProfile={handleSelectActiveProfile}
        activeProfileId={activeProfileId}
        currentChatMessages={messages}
        activePersonaName={activePersona}
        dynamicVoices={dynamicVoices}
      />

      <PersonaComparisonModal
        isOpen={showPersonaComparisonModal}
        onClose={() => setShowPersonaComparisonModal(false)}
        personas={personas}
        apiKey={apiKey}
      />

      <GroundedImageAssistantModal
        isOpen={showGroundedImageAssistantModal}
        onClose={() => setShowGroundedImageAssistantModal(false)}
        activePersona={activePersona}
        discussionContext={messages.slice(-3).map(m => `${m.role}: ${m.text}`).join('\n')}
        onInsertImageToChat={(imageUrl, title, sourceUri) => {
          const imageMarkdown = `![${title}](${imageUrl})\n\n*[مصدر الصورة عبر Google Grounding: ${title}](${sourceUri})*`;
          handleSendMessage(`أرجو تحليل واستكشاف هذه الصورة المجلوبة من الويب والأرشيف لمناقشتها معك:\n${imageMarkdown}`);
          setShowGroundedImageAssistantModal(false);
        }}
        isStrictModelMode={isStrictModelMode}
      />

      <TrendLiveRoomModal
        show={showTrendLiveRoomModal}
        onClose={() => setShowTrendLiveRoomModal(false)}
        personas={personas}
        isLoading={isLoading}
        onStartTrendRoom={startTrendLiveRoom}
        isStrictModelMode={isStrictModelMode}
        model={model}
        apiKey={apiKey}
      />

      {/* PodLive Digital Audio & Podcast Studio Modal 2026 */}
      <PodLiveStudioModal
        show={showPodLiveStudioModal}
        onClose={() => setShowPodLiveStudioModal(false)}
        personas={personas}
        apiKey={apiKey}
        initialChatMessages={messages}
        currentActivePersona={activePersona}
      />

      {showDeploymentCenterModal && (
        <PWADeploymentCenterModal onClose={() => {
          setShowDeploymentCenterModal(false);
          // Comprehensive URL cleanup for both SearchParams and Hash
          try {
            if (typeof window !== 'undefined' && window.history.replaceState) {
              const url = new URL(window.location.href);
              let changed = false;
              if (url.searchParams.has('pwa') || url.searchParams.has('action')) {
                url.searchParams.delete('pwa');
                url.searchParams.delete('action');
                changed = true;
              }
              // Also check for parameters inside the hash if they were accidentally placed there
              if (url.hash.includes('pwa=') || url.hash.includes('action=')) {
                url.hash = url.hash.split('?')[0]; // Strip hash query if exists
                changed = true;
              }
              if (changed) {
                window.history.replaceState({}, '', url.toString());
              }
            }
          } catch (e) {
            console.warn('URL cleanup failed:', e);
          }
        }} />
      )}

      {/* Video Export Progress Banner / Overlay */}
      <AnimatePresence>
        {isExportingVideo && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 start-6 z-[9999] bg-surface/95 backdrop-blur-xl border border-sky-500/40 p-4 rounded-2xl shadow-2xl max-w-sm w-full space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl animate-pulse shrink-0">
                <Video size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-text truncate">جاري تصدير الفيديو والكلمات...</h4>
                <p className="text-xs text-muted truncate mt-0.5">{exportStatusText || 'معالجة الصوتيات وتوليد الإطارات...'}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-sky-400">
                <span>{exportProgress}%</span>
                <span>MP4 / WebM Video</span>
              </div>
              <div className="w-full bg-surface3 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(5, exportProgress)}%` }}
                ></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DebugConsole isOpen={showDebug} onClose={() => setShowDebug(false)} />
    </div>
  );
}

