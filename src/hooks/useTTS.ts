import { useRef, useCallback, useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { PersonaData, Message } from '../types';
import { playAudioBase64, base64ToPCM16, downloadBlob, AudioPlaybackContext, clearAudioCacheFromStorage, unlockAudioContext, subscribeTtsPlayback } from '../utils/audio';
import { withRetry, checkIsRateLimited, checkIsQuotaExceeded, sanitizeApiKey, getGeminiClient } from '../utils/gemini';
import { logger } from '../utils/logger';
import { useToast } from '../components/Toast';
import { buildSpeechVoiceConfig, getClonedVoiceId } from '../utils/clonedVoices';

interface UseTTSProps {
  apiKey: string;
  personas: Record<string, PersonaData>;
  ttsVolume: number;
  ttsSpeed: number;
  audioModel: string;
}

export const useTTS = ({ apiKey, personas, ttsVolume, ttsSpeed, audioModel }: UseTTSProps) => {
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [activeSpeechText, setActiveSpeechText] = useState<string | null>(null);
  const [activeSpeechPersona, setActiveSpeechPersona] = useState<string | null>(null);
  const [debatePlaybackState, setDebatePlaybackState] = useState<'idle' | 'playing'>('idle');
  const [debateAudioSegments, setDebateAudioSegments] = useState<string[]>([]);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  const { toast } = useToast();
  const hasShownToastRef = useRef(false);

  const playbackAbortController = useRef<AbortController | null>(null);
  const lastPlayedIndexRef = useRef<number | null>(null);
  const audioPlaybackRef = useRef<AudioPlaybackContext>({
    audioCtx: null,
    gainNode: null,
    sourceNode: null
  });
  const audioCacheRef = useRef<Record<string, string>>({});
  
  // Track active promises to completely prevent duplicate API calls
  const activePromisesRef = useRef<Record<string, Promise<string | null>>>({});

  useEffect(() => {
    return subscribeTtsPlayback((playing) => {
      setIsAudioPlaying(playing);
    });
  }, []);

  useEffect(() => {
    if (audioPlaybackRef.current.gainNode) {
      audioPlaybackRef.current.gainNode.gain.value = ttsVolume;
    }
  }, [ttsVolume]);

  useEffect(() => {
    if (audioPlaybackRef.current.sourceNode) {
      audioPlaybackRef.current.sourceNode.playbackRate.value = ttsSpeed;
    }
  }, [ttsSpeed]);

  const stopAudio = useCallback(() => {
    if (playbackAbortController.current) {
      playbackAbortController.current.abort();
      playbackAbortController.current = null;
    }

    const ctx = audioPlaybackRef.current.audioCtx;
    const gain = audioPlaybackRef.current.gainNode;
    const src = audioPlaybackRef.current.sourceNode;

    audioPlaybackRef.current.audioCtx = null;
    audioPlaybackRef.current.gainNode = null;
    audioPlaybackRef.current.sourceNode = null;

    try {
      if (gain && ctx && ctx.state !== 'closed') {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.015);
      }
      if (src) {
        setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
          } catch (e) {}
        }, 16);
      }
      if (gain) {
        setTimeout(() => {
          try {
            gain.disconnect();
          } catch (e) {}
        }, 20);
      }
    } catch (e) {
      // Ignore errors on cleanup
    }
    
    setDebatePlaybackState('idle');
    setIsTTSLoading(false);
    setSpeakingIndex(null);
    setActiveSpeechText(null);
    setActiveSpeechPersona(null);
  }, []);

  const clearAudioCache = useCallback(async () => {
    audioCacheRef.current = {};
    const count = await clearAudioCacheFromStorage();
    toast({
      type: 'success',
      title: 'تم تصفير كاش الصوتيات',
      message: count > 0 ? `تم مسح ${count} ملف صوتي من الكاش بنجاح. سيتم توليد مقاطع نظيفة وجديدة عند الاستماع.` : 'كاش الصوتيات نظيف وفارغ حالياً.'
    });
  }, [toast]);

  const generateTTS = useCallback(async (text: string, personaKey: string, signal: AbortSignal): Promise<string | null> => {
    const persona = personas[personaKey];
    const voiceNameRaw = persona?.voice || 'Puck';
    const clonedVoiceId = getClonedVoiceId(voiceNameRaw);
    const voiceCacheTag = clonedVoiceId || voiceNameRaw;

    // Versioned cache key (tts_v4) includes active voice so switching voices never serves stale audio
    const cacheKey = `tts_v4_${personaKey}_${voiceCacheTag}_${text.substring(0, 50)}_${text.length}`;
    
    // Check Memory Cache first
    if (audioCacheRef.current[cacheKey]) {
      return audioCacheRef.current[cacheKey];
    }
    
    // IndexedDB Cache
    try {
      const cached = await get<string>(cacheKey);
      if (cached) {
        audioCacheRef.current[cacheKey] = cached;
        return cached;
      }
    } catch (e) {
      logger.warn("IDB read error", e);
    }

    // Active Promise Deduplicator
    if (activePromisesRef.current[cacheKey]) {
      logger.info(`Awaiting existing active generation promise for key: ${cacheKey}`);
      return activePromisesRef.current[cacheKey];
    }

    const promise = (async () => {
      try {
        const ai = getGeminiClient(apiKey);
        logger.info(`Initializing TTS request for persona: ${personaKey}`, { model: audioModel, voice: voiceNameRaw, clonedVoiceId });
        const voiceConfigPayload = buildSpeechVoiceConfig(voiceNameRaw);
        
        const cleanText = text
          .replace(/```[\s\S]*?```/g, '') // Remove code blocks
          .replace(/[*#_`]/g, '')        // Remove markdown formatting
          .replace(/^(تعليمات|ملاحظة|تنبيه|prompt|system):.*/gmi, '')
          .trim();

        if (!cleanText) {
          return null;
        }

        let response: any;
        const candidateAudioModels = clonedVoiceId
          ? Array.from(new Set([
              ...((audioModel === 'gemini-3.8-flash-tts' || audioModel === 'gemini-3.8-flash-lite-tts') ? [audioModel] : []),
              'gemini-3.8-flash-tts',
              'gemini-3.8-flash-lite-tts'
            ]))
          : Array.from(new Set([
              audioModel || 'gemini-3.8-flash-tts',
              'gemini-3.8-flash-tts',
              'gemini-3.8-flash-lite-tts',
              'gemini-3.1-flash-tts-preview'
            ]));

        let lastTTSModelError: any = null;
        for (const modelCandidate of candidateAudioModels) {
          try {
            logger.info(`Attempting TTS generation with model: ${modelCandidate}`);
            response = await withRetry(() => ai.models.generateContent({
              model: modelCandidate,
              contents: cleanText,
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: voiceConfigPayload,
                },
              },
            }), 2, 1500);
            
            if (response?.data || response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
              break;
            }
          } catch (error: any) {
            lastTTSModelError = error;
            logger.warn(`Failed TTS model attempt ${modelCandidate}:`, error?.message || error);
          }
        }

        if (!response?.data && !response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
          throw lastTTSModelError || new Error("لم يتم الحصول على بيانات صوتية من الخادم.");
        }

        if (signal?.aborted) return null;

        const base64Audio = response.data || response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        if (base64Audio) {
          audioCacheRef.current[cacheKey] = base64Audio;
          set(cacheKey, base64Audio).catch((e: unknown) => logger.warn("IDB write error", e));
          return base64Audio;
        } else {
          throw new Error("لم يتم الحصول على بيانات صوتية من الخادم.");
        }
      } catch (error: any) {
        logger.warn("TTS Generation Notice:", error?.message || error);
        return null;
      } finally {
        delete activePromisesRef.current[cacheKey];
      }
    })();

    activePromisesRef.current[cacheKey] = promise;
    return promise;
  }, [apiKey, personas, audioModel, toast]);

  const playTTS = useCallback(async (base64Audio: string, signal: AbortSignal) => {
    try {
      await playAudioBase64(base64Audio, signal, ttsVolume, ttsSpeed, audioPlaybackRef);
    } catch (err) {
      logger.warn("Audio playback error:", err);
    }
  }, [ttsVolume, ttsSpeed]);

  const handleSpeak = useCallback(async (
    text: string, 
    index: number, 
    personaKey: string, 
    currentActivePersona: string,
    nextText?: string,
    nextPersonaKey?: string
  ) => {
    if (speakingIndex === index || debatePlaybackState !== 'idle') {
      stopAudio();
      return;
    }

    unlockAudioContext();
    stopAudio();
    playbackAbortController.current = new AbortController();
    const signal = playbackAbortController.current.signal;
    const pKey = personaKey || currentActivePersona;

    setIsTTSLoading(true);
    setSpeakingIndex(index);
    setActiveSpeechText(text);
    setActiveSpeechPersona(pKey);
    
    const audio = await generateTTS(text, pKey, signal);
    setIsTTSLoading(false);
    
    // Pre-generate the next one immediately as listening starts
    if (nextText && nextPersonaKey && !signal.aborted) {
      generateTTS(nextText, nextPersonaKey, signal).catch(() => {});
    }

    if (!signal.aborted) {
      if (audio) {
        await playTTS(audio, signal);
      } else {
        logger.warn('TTS Audio generation returned no data, skipping playback.');
        toast({
          type: 'error',
          title: 'تعذر تشغيل القارئ الصوتي',
          message: 'لم يرجع الخادم بيانات صوتية صالحة لهذا النص. حاول مجدداً.'
        });
      }
    }
    
    if (!signal.aborted) {
      lastPlayedIndexRef.current = index;
      setSpeakingIndex(null);
      setActiveSpeechText(null);
      setActiveSpeechPersona(null);
    }
  }, [speakingIndex, debatePlaybackState, stopAudio, generateTTS, playTTS, toast]);

  const speakText = useCallback(async (text: string, personaKey: string): Promise<boolean> => {
    const cleanInput = (text || '').trim();
    if (!cleanInput) return false;

    unlockAudioContext();
    stopAudio();
    playbackAbortController.current = new AbortController();
    const signal = playbackAbortController.current.signal;

    setIsTTSLoading(true);
    setSpeakingIndex(-999);
    setActiveSpeechText(cleanInput);
    setActiveSpeechPersona(personaKey);

    try {
      const audio = await generateTTS(cleanInput, personaKey, signal);
      setIsTTSLoading(false);

      if (signal.aborted) return false;

      if (!audio) {
        setSpeakingIndex(null);
        setActiveSpeechText(null);
        setActiveSpeechPersona(null);
        toast({
          type: 'error',
          title: 'تعذر توليد الصوت',
          message: 'لم يتم استلام بيانات صوتية من محرك TTS.'
        });
        return false;
      }

      await playTTS(audio, signal);
      if (!signal.aborted) {
        setSpeakingIndex(null);
        setActiveSpeechText(null);
        setActiveSpeechPersona(null);
      }
      return true;
    } catch (err: any) {
      if (!signal.aborted) {
        setIsTTSLoading(false);
        setSpeakingIndex(null);
        setActiveSpeechText(null);
        setActiveSpeechPersona(null);
      }
      return false;
    }
  }, [stopAudio, generateTTS, playTTS, toast]);

  const handleSequentialSpeak = useCallback(async (
    getMessages: () => Message[],
    startIndex: number,
    personaKey: string,
    currentActivePersona: string,
    onReachEnd?: () => void
  ) => {
    unlockAudioContext();
    stopAudio();
    playbackAbortController.current = new AbortController();
    const signal = playbackAbortController.current.signal;
    
    let currentIndex = startIndex;
    let reachEndTriggered = false;
    
    // Find the first valid message starting from startIndex
    const initialMessages = getMessages();
    while (currentIndex < initialMessages.length) {
      const m = initialMessages[currentIndex];
      if (!m.isSystem && m.role === 'model') {
        break;
      }
      currentIndex++;
    }

    if (currentIndex >= initialMessages.length) {
      if (onReachEnd) onReachEnd();
      return;
    }

    // Locate the index of next valid model message
    const findNextValidIndex = (fromIdx: number, msgs: Message[]): number => {
      let idx = fromIdx;
      while (idx < msgs.length) {
        const m = msgs[idx];
        if (!m.isSystem && m.role === 'model') {
          return idx;
        }
        idx++;
      }
      return -1;
    };

    let firstMsg = initialMessages[currentIndex];
    let nextAudioPromise = generateTTS(
      firstMsg.text, 
      firstMsg.persona || personaKey || currentActivePersona, 
      signal
    );

    let idleWaitCount = 0;
    while (!signal.aborted) {
      const currentMsgs = getMessages();
      if (currentIndex >= currentMsgs.length) {
        if (!onReachEnd) {
          break;
        }
        if (!reachEndTriggered) {
          reachEndTriggered = true;
          onReachEnd();
        }
        if (++idleWaitCount > 20) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      idleWaitCount = 0;
      reachEndTriggered = false;

      const msg = currentMsgs[currentIndex];
      if (msg.isSystem || msg.role !== 'model') {
        currentIndex++;
        const nextValidIdx = findNextValidIndex(currentIndex, currentMsgs);
        if (nextValidIdx !== -1) {
          const nextMsg = currentMsgs[nextValidIdx];
          nextAudioPromise = generateTTS(
            nextMsg.text, 
            nextMsg.persona || personaKey || currentActivePersona, 
            signal
          );
        }
        continue;
      }

      const pKey = msg.persona || personaKey || currentActivePersona;
      
      setSpeakingIndex(msg.originalIndex || currentIndex);
      setActiveSpeechText(msg.text);
      setActiveSpeechPersona(pKey);
      setIsTTSLoading(true);
      
      // Await cached/active nextAudioPromise
      const audio = await nextAudioPromise;
      setIsTTSLoading(false);
      
      if (signal.aborted) break;

      // At the exact moment preparation finishes and listening starts, prefetch next content
      const nextValidIdx = findNextValidIndex(currentIndex + 1, currentMsgs);
      if (nextValidIdx !== -1) {
        const nextMsg = currentMsgs[nextValidIdx];
        nextAudioPromise = generateTTS(
          nextMsg.text, 
          nextMsg.persona || personaKey || currentActivePersona, 
          signal
        );
      } else {
        if (onReachEnd && !reachEndTriggered) {
          reachEndTriggered = true;
          onReachEnd();
        }
      }

      if (audio) {
        await playTTS(audio, signal);
      } else {
        logger.warn('Sequential TTS returned no data for turn', currentIndex);
      }

      if (signal.aborted) break;

      lastPlayedIndexRef.current = msg.originalIndex || currentIndex;
      currentIndex++;
    }
    
    setSpeakingIndex(null);
    setActiveSpeechText(null);
    setActiveSpeechPersona(null);
  }, [generateTTS, playTTS, stopAudio]);

  const handlePlayDebate = useCallback(async (messages: Message[], currentActivePersona: string) => {
    if (debatePlaybackState === 'playing') {
      stopAudio();
      return;
    }

    unlockAudioContext();
    setDebatePlaybackState('playing');
    playbackAbortController.current = new AbortController();
    const signal = playbackAbortController.current.signal;

    const debateMsgs = messages.map((m, i) => ({...m, originalIndex: i})).filter(m => !m.isSystem);

    let startIndex = 0;
    
    if (lastPlayedIndexRef.current !== null && lastPlayedIndexRef.current >= debateMsgs.length - 1) {
       startIndex = 0;
    } else if (speakingIndex !== null) {
      const currentIndex = debateMsgs.findIndex(m => m.originalIndex === speakingIndex);
      startIndex = currentIndex !== -1 ? currentIndex : 0;
    } else if (lastPlayedIndexRef.current !== null) {
      const currentIndex = debateMsgs.findIndex(m => m.originalIndex === lastPlayedIndexRef.current);
      startIndex = currentIndex !== -1 ? currentIndex + 1 : 0;
    }

    const newSegments = [...debateAudioSegments];
    
    if (startIndex < debateMsgs.length) {
      let nextAudioPromise = generateTTS(debateMsgs[startIndex].text, debateMsgs[startIndex].persona || currentActivePersona, signal);
      
      for (let i = startIndex; i < debateMsgs.length; i++) {
        const msg = debateMsgs[i];
        if (signal.aborted) break;
        
        const pKey = msg.persona || currentActivePersona;
        setSpeakingIndex(msg.originalIndex!);
        setActiveSpeechText(msg.text);
        setActiveSpeechPersona(pKey);
        setIsTTSLoading(true);
        
        const audio = await nextAudioPromise;
        setIsTTSLoading(false);
        
        if (signal.aborted) break;

        if (audio) {
          newSegments.push(audio);
        }
        
        // At the exact moment preparation finishes and listening starts, pre-generate the next one
        if (i + 1 < debateMsgs.length) {
          const nextMsg = debateMsgs[i + 1];
          nextAudioPromise = generateTTS(nextMsg.text, nextMsg.persona || currentActivePersona, signal);
        }
        
        if (!signal.aborted) {
          if (audio) {
            await playTTS(audio, signal);
          } else {
            logger.warn('Debate TTS returned no audio data for turn', i);
          }
          if (!signal.aborted) {
            lastPlayedIndexRef.current = msg.originalIndex!;
          }
        }
      }
    }
    
    setDebateAudioSegments(newSegments);

    if (!signal.aborted) {
      setDebatePlaybackState('idle');
      setSpeakingIndex(null);
      setActiveSpeechText(null);
      setActiveSpeechPersona(null);
    }
  }, [debatePlaybackState, stopAudio, debateAudioSegments, speakingIndex, generateTTS, playTTS]);

  const handleDownloadDebateAudio = useCallback(async (messages: Message[], currentActivePersona: string) => {
    setIsDownloadingAudio(true);
    try {
      const debateMsgs = messages.map((m, i) => ({...m, originalIndex: i})).filter(m => !m.isSystem);
      const base64Audios: string[] = [];
      
      const abortController = new AbortController();
      for (const msg of debateMsgs) {
        const audioBase64 = await generateTTS(msg.text, msg.persona || currentActivePersona, abortController.signal);
        if (audioBase64) {
          base64Audios.push(audioBase64);
        }
      }
      
      if (base64Audios.length > 0) {
        const blob = base64ToPCM16(base64Audios);
        if (blob) {
          downloadBlob(blob, 'debate_full.wav');
        }
      } else {
        toast({ title: 'تنبيه', message: 'لم يتم العثور على صوتيات لتنزيلها.', type: 'info' });
      }
    } catch (e) {
      logger.error("Audio download error", e);
      toast({ title: 'خطأ', message: 'حدث خطأ أثناء تنزيل الصوتيات.', type: 'error' });
    } finally {
      setIsDownloadingAudio(false);
    }
  }, [generateTTS, toast]);

  return {
    isTTSLoading,
    isAudioPlaying,
    activeSpeechText,
    activeSpeechPersona,
    debatePlaybackState,
    speakingIndex,
    isDownloadingAudio,
    handleSpeak,
    handleSequentialSpeak,
    handlePlayDebate,
    speakText,
    stopAudio,
    handleDownloadDebateAudio,
    generateTTS,
    clearAudioCache
  };
};
