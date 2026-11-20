import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Send, Volume2, StopCircle, Loader2, Maximize2, Minimize2, Sparkles, Radio, MessageSquare, Eye } from 'lucide-react';
import { PersonaData, Message } from '../types';
import { HolographicAvatarCanvas, HologramRenderMode, PortraitLandmarkMeta } from './HolographicAvatarCanvas';
import { getHologramPortraitUrl } from '../utils/avatar';
import { getGeminiClient, withRetry } from '../utils/gemini';
import { TtsLipSyncSnapshot, unlockAudioContext } from '../utils/audio';
import { logger } from '../utils/logger';

const SYSTEM_ROOM_KEYS = new Set(['group_question', 'debate', 'osint_room', 'trend_live']);

interface HolographicAvatarStudioProps {
  personas: Record<string, PersonaData>;
  activePersonaKey: string;
  activePersonaData?: PersonaData;
  chatHistory: Message[];
  isTTSLoading: boolean;
  isAudioPlaying: boolean;
  activeSpeechText: string | null;
  activeSpeechPersona: string | null;
  speakText: (text: string, personaKey: string) => Promise<boolean>;
  stopAudio: () => void;
  onSelectPersona?: (personaKey: string) => void;
}

interface AvatarTurn {
  role: 'user' | 'model';
  text: string;
}

export const HolographicAvatarStudio: React.FC<HolographicAvatarStudioProps> = ({
  personas,
  activePersonaKey,
  activePersonaData,
  chatHistory,
  isTTSLoading,
  isAudioPlaying,
  activeSpeechText,
  activeSpeechPersona,
  speakText,
  stopAudio,
  onSelectPersona,
}) => {
  const personaKeys = Object.keys(personas || {}).filter((k) => !SYSTEM_ROOM_KEYS.has(k));
  const resolvedKey =
    (activePersonaKey && !SYSTEM_ROOM_KEYS.has(activePersonaKey) && personas[activePersonaKey]
      ? activePersonaKey
      : personaKeys[0]) || 'سقراط';
  const persona = (activePersonaKey && !SYSTEM_ROOM_KEYS.has(activePersonaKey) ? activePersonaData : undefined) || personas[resolvedKey];
  const displayName = resolvedKey;

  const [inputText, setInputText] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [userMicLevel, setUserMicLevel] = useState(0);
  const [portraitBroken, setPortraitBroken] = useState(false);
  const [renderMode, setRenderMode] = useState<HologramRenderMode>('hologram');
  const [portraitMeta, setPortraitMeta] = useState<PortraitLandmarkMeta | null>(null);

  const [dialogue, setDialogue] = useState<AvatarTurn[]>([]);
  const [telemetry, setTelemetry] = useState<TtsLipSyncSnapshot>({
    isActive: false,
    openness: 0,
    wide: 0,
    round: 0,
    teeth: 0,
    energy: 0,
    fundamentalHz: 0,
    progress: 0,
  });

  const recognitionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimLatestRef = useRef<string>('');
  const committedRef = useRef<boolean>(false);
  const dialogueEndRef = useRef<HTMLDivElement | null>(null);
  const wasPlayingRef = useRef<boolean>(false);
  const handsFreeRef = useRef<boolean>(handsFreeMode);
  const isMountedRef = useRef<boolean>(true);

  handsFreeRef.current = handsFreeMode;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopVoiceInput();
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    setPortraitBroken(false);
    setPortraitMeta(null);
    setErrorMsg(null);
  }, [resolvedKey]);

  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [dialogue, interimTranscript]);

  const stopVoiceInput = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = 0;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    if (isMountedRef.current) {
      setIsListening(false);
      setUserMicLevel(0);
      setInterimTranscript('');
    }
  }, []);

  const askAvatarAndSpeak = useCallback(
    async (question: string) => {
      const cleanQuestion = question.trim();
      if (!cleanQuestion || isGeneratingReply) return;

      unlockAudioContext();
      stopVoiceInput();
      stopAudio();
      setErrorMsg(null);
      setInputText('');

      setDialogue((prev) => [...prev.slice(-10), { role: 'user', text: cleanQuestion }]);
      setIsGeneratingReply(true);

      try {
        const ai = getGeminiClient();
        const recentHistory = dialogue.slice(-4).map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }));

        const systemInstruction = `أنت تجسد الشخصية الحية "${displayName}" (${persona?.title || persona?.label || ''}) داخل حضور بصري هولوغرافي ناطق.
تعليمات الشخصية الأصيلة:
${persona?.prompt || `أنت ${displayName} تتحدث بلسانك وفكرك الحقيقي.`}

قواعد الحديث الهولوغرافي المباشر (مهم جداً):
- أجب بصوت ${displayName} بضمير المتكلم، بأسلوب بليغ، دافئ، طبيعي، وحواري يصلح للإلقاء الشفهي المباشر.
- اجعل ردك مركزاً ومتدفقاً (بين 2 إلى 4 جمل واضحة مترابطة دون تنسيق Markdown أو رموز نجوم * أو نقاط نقطية).
- لا تخرج عن الشخصية أبداً ولا تقل إنك ذكاء اصطناعي.`;

        const response = await withRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
              ...recentHistory,
              { role: 'user', parts: [{ text: cleanQuestion }] },
            ],
            config: {
              systemInstruction,
            },
          })
        );

        if (!isMountedRef.current) return;

        const rawReply = (response.text || '').trim();
        const spokenReply = rawReply
          .replace(/[*#_`~]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!spokenReply) {
          throw new Error('لم يرد النموذج بنص يمكن نطقه.');
        }

        setDialogue((prev) => [...prev, { role: 'model', text: spokenReply }]);
        setIsGeneratingReply(false);

        await speakText(spokenReply, resolvedKey);
      } catch (err: any) {
        logger.error('[HolographicAvatarStudio] Interaction error:', err);
        if (isMountedRef.current) {
          setIsGeneratingReply(false);
          setErrorMsg(err?.message || 'تعذر توليد استجابة الشخصية في الوقت الحالي.');
        }
      }
    },
    [displayName, persona, dialogue, isGeneratingReply, resolvedKey, speakText, stopAudio, stopVoiceInput]
  );

  const startVoiceInput = useCallback(async () => {
    unlockAudioContext();
    stopAudio();
    setErrorMsg(null);

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setErrorMsg('المتصفح لا يدعم التعرف التلقائي على الكلام؛ يمكنك الكتابة مباشرة في الحقل أدناه.');
      return;
    }

    stopVoiceInput();
    committedRef.current = false;
    interimLatestRef.current = '';

    try {
      // Optional mic stream purely to animate listening energy ring cleanly
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          micStreamRef.current = stream;
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtx();
          micCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const dataArr = new Uint8Array(analyser.frequencyBinCount);

          const pollMic = () => {
            if (!micCtxRef.current || micCtxRef.current.state === 'closed') return;
            analyser.getByteTimeDomainData(dataArr);
            let sum = 0;
            for (let i = 0; i < dataArr.length; i++) {
              const v = (dataArr[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArr.length);
            setUserMicLevel(Math.min(100, Math.round(rms * 420)));
            micRafRef.current = requestAnimationFrame(pollMic);
          };
          micRafRef.current = requestAnimationFrame(pollMic);
        } catch {
          // Non-fatal: SpeechRecognition may still work without extra meter
        }
      }

      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
      setIsListening(true);

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interim += transcript;
          }
        }

        if (interim.trim()) {
          interimLatestRef.current = interim.trim();
          setInterimTranscript(interim.trim());
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (!committedRef.current && interimLatestRef.current.length >= 2) {
              committedRef.current = true;
              const spoken = interimLatestRef.current;
              askAvatarAndSpeak(spoken);
            }
          }, 1250);
        }

        if (finalText.trim() && !committedRef.current) {
          committedRef.current = true;
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          askAvatarAndSpeak(finalText.trim());
        }
      };

      recognition.onerror = (e: any) => {
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setErrorMsg('يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح للتحدث مباشرة.');
        }
        stopVoiceInput();
      };

      recognition.onend = () => {
        const pending = interimLatestRef.current.trim();
        stopVoiceInput();
        if (!committedRef.current && pending.length >= 2) {
          committedRef.current = true;
          askAvatarAndSpeak(pending);
        }
      };

      recognition.start();
    } catch (err: any) {
      logger.warn('[HolographicAvatarStudio] Mic start error:', err);
      stopVoiceInput();
      setErrorMsg('تعذر تشغيل الميكروفون. جرب كتابة سؤالك مباشرة.');
    }
  }, [askAvatarAndSpeak, stopAudio, stopVoiceInput]);

  // Hands-free loop: automatically resume listening once TTS playback finishes
  useEffect(() => {
    if (wasPlayingRef.current && !isAudioPlaying && !isTTSLoading && !isGeneratingReply && handsFreeRef.current) {
      const timer = setTimeout(() => {
        if (isMountedRef.current && handsFreeRef.current && !isAudioPlaying && !isListening) {
          startVoiceInput();
        }
      }, 380);
      return () => clearTimeout(timer);
    }
    wasPlayingRef.current = isAudioPlaying;
  }, [isAudioPlaying, isTTSLoading, isGeneratingReply, isListening, startVoiceInput]);

  const handleReadLatestOrGreeting = async () => {
    unlockAudioContext();
    setErrorMsg(null);
    if (isAudioPlaying || isTTSLoading) {
      stopAudio();
      return;
    }

    // Prefer the latest model message from Hologram dialogue or main chatHistory
    const latestHoloModel = [...dialogue].reverse().find((m) => m.role === 'model');
    const latestChatModel = [...chatHistory]
      .reverse()
      .find((m) => !m.isSystem && m.role === 'model' && m.text?.trim());

    const textToSpeak =
      latestHoloModel?.text ||
      latestChatModel?.text ||
      persona?.greeting ||
      `أهلاً بك، أنا ${displayName}. يسعدني أن أتحاور معك مباشرة عبر هذا التجسيد التفاعلي.`;

    const speakerKey =
      (latestHoloModel ? resolvedKey : latestChatModel?.persona) || resolvedKey;

    if (!latestHoloModel && !latestChatModel) {
      setDialogue((prev) => [...prev, { role: 'model', text: textToSpeak }]);
    }

    await speakText(textToSpeak, speakerKey);
  };

  const handleIntroducePersona = async () => {
    await askAvatarAndSpeak(
      `عرّف عن نفسك وفلسفتك الجوهرية بإيجاز حيّ ومباشر كأنك تقف أمامي الآن.`
    );
  };

  const isSpeakingNow = isAudioPlaying || telemetry.isActive;
  const isThinkingNow = isGeneratingReply || isTTSLoading;
  const activeAvatarPortrait = getHologramPortraitUrl(resolvedKey, persona?.avatarUrl);

  const stageLabel = isSpeakingNow
    ? `يتحدث الآن`
    : isThinkingNow
      ? `جاري تحضير الصوت...`
      : isListening
        ? `يستمع لصوتك الآن`
        : `جاهز للحوار`;

  const currentSubtitle =
    isSpeakingNow && activeSpeechText
      ? activeSpeechText
      : interimTranscript
        ? `أنت: "${interimTranscript}"`
        : null;

  const aperturePct = Math.round(telemetry.openness * 100);
  const energyPct = Math.round(telemetry.energy * 100);

  const studioContent = (
    <div
      className={`grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch ${
        isFullscreen ? 'w-full max-w-[1440px] mx-auto min-h-full p-3 sm:p-6' : ''
      }`}
      dir="rtl"
    >
      {/* Optical Hologram Stage */}
      <div className={`lg:col-span-6 flex flex-col bg-[#07090E] border border-slate-800 rounded-2xl overflow-hidden ${
        isFullscreen ? 'min-h-[460px] lg:min-h-[calc(100vh-3rem)]' : ''
      }`}>
        {/* Top Stage Header */}
        <div className="px-4 py-3 border-b border-slate-800/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-cyan-500/40 bg-slate-900 shrink-0 flex items-center justify-center text-sm font-bold text-cyan-300">
              {!portraitBroken ? (
                <img
                  src={activeAvatarPortrait}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setPortraitBroken(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{displayName.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-100 truncate">{displayName}</div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                <span>{portraitMeta?.depictionLabelAr || persona?.era || 'تجسيد موثّق'}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    isSpeakingNow
                      ? 'text-cyan-400 font-medium'
                      : isThinkingNow
                        ? 'text-amber-400'
                        : isListening
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                  }
                >
                  {stageLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setRenderMode(renderMode === 'hologram' ? 'hybrid' : 'hologram')}
              aria-label="تبديل نمط العرض الهولوغرافي"
              className="min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 text-cyan-300 hover:text-white hover:border-cyan-500/50 transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <Eye size={14} />
              <span className="hidden sm:inline">{renderMode === 'hologram' ? 'طيف ذهبي' : 'طيف سماوي'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              aria-label={isFullscreen ? 'تصغير عرض الهولوغرام' : 'تكبير عرض الهولوغرام'}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:text-white hover:border-cyan-500/50 transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
            </button>
          </div>
        </div>

        {/* 3D Volumetric Hologram Canvas */}
        <div className={`relative w-full ${isFullscreen ? 'flex-1 min-h-[380px]' : 'h-[360px] sm:h-[410px]'}`}>
          <HolographicAvatarCanvas
            personaName={activeSpeechPersona || resolvedKey}
            personaData={personas[activeSpeechPersona || resolvedKey] || persona}
            isSpeaking={isSpeakingNow}
            isThinking={isThinkingNow}
            isListening={isListening}
            userMicLevel={userMicLevel}
            renderMode={renderMode}
            onTelemetryFrame={setTelemetry}
            onMetaLoaded={setPortraitMeta}
          />

          {/* Live Synchronized Subtitle Overlay */}
          {currentSubtitle && (
            <div className="pointer-events-none absolute inset-x-4 bottom-3 flex justify-center">
              <div className="bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 rounded-xl px-4 py-2.5 max-w-lg text-center">
                <p className="text-xs sm:text-sm text-slate-100 leading-relaxed line-clamp-3">
                  {currentSubtitle}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Acoustic & Lip-Sync Readout Strip (clean unboxed tabular telemetry) */}
        <div className="px-4 py-2.5 border-t border-slate-800/90 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono tabular-nums">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="whitespace-nowrap">انفتاح الشفاه {aperturePct}%</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">طاقة الصوت {energyPct}%</span>
            <span aria-hidden="true">·</span>
            <span dir="ltr" className="whitespace-nowrap">{telemetry.fundamentalHz > 0 ? `${telemetry.fundamentalHz} Hz` : '0 Hz'}</span>
          </div>
          <span className={isSpeakingNow ? 'text-cyan-400' : 'text-slate-500'}>
            {isSpeakingNow ? 'مزامنة الشفاه نشطة' : 'في وضع الاستعداد'}
          </span>
        </div>
      </div>

      {/* Interactive Conversation & Voice Control Column */}
      <div className="lg:col-span-6 flex flex-col justify-between gap-4 bg-surface/60 border border-border/80 rounded-2xl p-4 sm:p-5">
        <div className="space-y-4">
          {/* Header & Persona Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <h3 className="text-lg font-bold text-text">الحوار الهولوغرافي المباشر</h3>
              <p className="text-xs text-muted mt-0.5">
                تحدث صوتياً أو اكتب أي سؤال ليجيبك <strong className="text-text">{displayName}</strong> بصوته وتحريك شفاه متزامن.
              </p>
            </div>
            {personaKeys.length > 1 && onSelectPersona && (
              <select
                value={resolvedKey}
                onChange={(e) => onSelectPersona(e.target.value)}
                aria-label="اختيار الشخصية المتجسدة"
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-surface2 border border-border text-xs font-medium text-text focus:outline-none focus:border-accent shrink-0 cursor-pointer"
              >
                {personaKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Primary Speech & Hands-Free Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleReadLatestOrGreeting}
              disabled={isGeneratingReply}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                isAudioPlaying || isTTSLoading
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-accent hover:bg-accent/90 text-white'
              } disabled:opacity-50`}
            >
              {isTTSLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isAudioPlaying ? (
                <StopCircle size={16} />
              ) : (
                <Volume2 size={16} />
              )}
              <span>
                {isTTSLoading
                  ? 'جاري تجهيز الصوت...'
                  : isAudioPlaying
                    ? 'إيقاف القارئ'
                    : chatHistory.some((m) => !m.isSystem && m.role === 'model')
                      ? 'قراءة آخر رد بصوت الأفاتار'
                      : 'استماع لتحية الشخصية'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleIntroducePersona}
              disabled={isGeneratingReply || isTTSLoading}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-border bg-surface2/70 hover:bg-surface2 text-text text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={15} className="text-accent" />
              <span>نبذة حية بصوت الشخصية</span>
            </button>

            <button
              type="button"
              onClick={() => setHandsFreeMode(!handsFreeMode)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                handsFreeMode
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-border bg-surface2/40 text-muted hover:text-text'
              }`}
            >
              <Radio size={15} />
              <span>حوار صوتي مستمر</span>
            </button>
          </div>

          {/* Live Transcript Thread */}
          <div className="bg-bg/50 border border-border/60 rounded-xl p-3.5 h-[190px] sm:h-[210px] overflow-y-auto space-y-3 scrollbar-custom">
            {dialogue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-3">
                <MessageSquare size={22} className="text-muted/60 mb-2" />
                <p className="text-xs text-muted leading-relaxed max-w-sm">
                  ابدأ بطرح سؤال بصوتك أو كتابةً، أو اضغط على أحد المقترحات أدناه ليبدأ <strong className="text-text">{displayName}</strong> بالحديث الفوري وتحريك شفتيه بتزامن كامل مع القارئ الصوتي.
                </p>
              </div>
            ) : (
              dialogue.map((turn, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    turn.role === 'user' ? 'items-start' : 'items-end'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed ${
                      turn.role === 'user'
                        ? 'bg-surface2 text-text border border-border/70'
                        : 'bg-accent/10 text-text border border-accent/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[11px] font-bold text-muted">
                        {turn.role === 'user' ? 'أنت' : displayName}
                      </span>
                      {turn.role === 'model' && (
                        <button
                          type="button"
                          onClick={() => {
                            unlockAudioContext();
                            speakText(turn.text, resolvedKey);
                          }}
                          className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 size={12} />
                          <span>نطق</span>
                        </button>
                      )}
                    </div>
                    <p>{turn.text}</p>
                  </div>
                </div>
              ))
            )}
            {isGeneratingReply && (
              <div className="flex items-center gap-2 text-xs text-accent px-2">
                <Loader2 size={14} className="animate-spin" />
                <span>يصوغ {displayName} رده الصوتي...</span>
              </div>
            )}
            <div ref={dialogueEndRef} />
          </div>

          {/* Suggested Prompts for Immediate Interaction */}
          {(persona?.suggestions?.length || 0) > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {persona!.suggestions.slice(0, 3).map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isGeneratingReply}
                  onClick={() => askAvatarAndSpeak(sug)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-border/70 bg-surface2/50 hover:border-accent/50 hover:text-text text-muted text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error notice (never silent) */}
        {errorMsg && (
          <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        {/* Voice + Text Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askAvatarAndSpeak(inputText);
          }}
          className="flex items-center gap-2 pt-1"
        >
          <button
            type="button"
            onClick={() => (isListening ? stopVoiceInput() : startVoiceInput())}
            disabled={isGeneratingReply}
            aria-label={isListening ? 'إيقاف الميكروفون' : 'التحدث بالميكروفون'}
            className={`min-h-[44px] min-w-[44px] px-3 rounded-xl border transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              isListening
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-surface2 border-border text-text hover:border-accent'
            }`}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            <span className="text-xs font-semibold hidden sm:inline whitespace-nowrap">
              {isListening ? 'أستمع...' : 'تحدث'}
            </span>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`اسأل ${displayName} مباشرة...`}
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-surface2 border border-border text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isGeneratingReply}
            aria-label="إرسال السؤال للأفاتار"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
          >
            {isGeneratingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            <span>إرسال</span>
          </button>
        </form>
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`استوديو الأفاتار التفاعلي - ${displayName}`}
        className="fixed inset-0 z-[10000] bg-[#04060b]/98 backdrop-blur-md overflow-y-auto"
      >
        {studioContent}
      </div>,
      document.body
    );
  }

  return studioContent;
};
