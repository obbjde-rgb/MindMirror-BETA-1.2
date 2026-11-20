import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Mic, Volume2, Play, Pause, Square, 
  Sparkles, Sliders, Music, Radio, Download, Copy, Check,
  RefreshCw, Layers, Headphones, 
  Activity, Wand2, CloudRain, Zap, Bird, Car, Coffee, Hammer, Clapperboard,
  Feather, Smile, Wind
} from 'lucide-react';
import { PersonaData, Message } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import { 
  podLiveEngine, 
  DEFAULT_RACK_SETTINGS, 
  AudioRackSettings,
  AmbientSoundscapeType,
  PunctualSFXType
} from '../utils/podLiveAudioEngine';
import { getGeminiClient, withRetry, parseJsonSafely } from '../utils/gemini';
import { copyToClipboard } from '../utils/clipboard';
import { buildSpeechVoiceConfig } from '../utils/clonedVoices';
import { useToast } from './Toast';

export interface PodLiveTurn {
  id: string;
  speakerKey: string;
  speakerName: string;
  vocalExpression: string;
  sfxCue?: string;
  text: string;
  panPosition: number;
  base64Audio?: string;
}

interface PodLiveStudioModalProps {
  show: boolean;
  onClose: () => void;
  personas: Record<string, PersonaData>;
  apiKey: string;
  initialChatMessages?: Message[];
  currentActivePersona?: string;
}

export const PodLiveStudioModal: React.FC<PodLiveStudioModalProps> = ({
  show,
  onClose,
  personas,
  apiKey,
  initialChatMessages = [],
  currentActivePersona = 'سقراط'
}) => {
  const { toast } = useToast();

  // Active Studio State
  const [activeTab, setActiveTab] = useState<'director' | 'lyria_sfx' | 'rack' | 'cast' | 'ambient'>('director');
  const [rackTab, setRackTab] = useState<'eq' | 'comp' | 'reverb' | 'voice_profile'>('eq');
  const [audioSettings, setAudioSettings] = useState<AudioRackSettings>(DEFAULT_RACK_SETTINGS);
  const [ambientTrack, setAmbientTrack] = useState<AmbientSoundscapeType>('lofi_thought');

  // Lyria AI Soundscape Generator State
  const [lyriaPrompt, setLyriaPrompt] = useState<string>('Ambient, calm sound of rain and distant thunder, birds chirping, lofi music');
  const [isGeneratingLyria, setIsGeneratingLyria] = useState<boolean>(false);

  // Cast Selection
  const personaKeys = Object.keys(personas).filter(k => k !== 'debate' && k !== 'group_question');
  const [hostKey, setHostKey] = useState<string>(currentActivePersona || personaKeys[0] || 'سقراط');
  const [guest1Key, setGuest1Key] = useState<string>(personaKeys.find(k => k !== hostKey) || 'ألبرت أينشتاين');
  const [guest2Key, setGuest2Key] = useState<string>(personaKeys.find(k => k !== hostKey && k !== guest1Key) || 'ليوناردو دافنشي');
  const [includeGuest2, setIncludeGuest2] = useState<boolean>(true);

  // Episode Configuration & Script
  const [episodeTopic, setEpisodeTopic] = useState<string>('هل الوعي الاصطناعي امتداد للعقل البشري أم طفرة جديدة؟');
  const [episodeStyle, setEpisodeStyle] = useState<'philosophical' | 'scientific_debate' | 'creative_salon' | 'witty_casual'>('philosophical');
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [scriptTurns, setScriptTurns] = useState<PodLiveTurn[]>([]);

  // Audio Playback & Master State
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
  const [isSynthesizingTurn, setIsSynthesizingTurn] = useState<boolean>(false);
  const [isRecordingMaster, setIsRecordingMaster] = useState<boolean>(false);
  const [recordedMasterBlob, setRecordedMasterBlob] = useState<Blob | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Canvas Visualizer Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize Audio Engine & Visualizer loop
  useEffect(() => {
    if (!show) {
      podLiveEngine.stopSpeech();
      podLiveEngine.stopAmbient();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const analyser = podLiveEngine.initRack();
    podLiveEngine.updateRackSettings(audioSettings);
    if (ambientTrack !== 'none') {
      podLiveEngine.setAmbientSoundscape(ambientTrack);
    }

    // Canvas visualizer loop
    const canvas = canvasRef.current;
    if (canvas && analyser) {
      const canvasCtx = canvas.getContext('2d');
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const timeData = new Uint8Array(bufferLength);

      const renderFrame = () => {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
        analyser.getByteFrequencyData(dataArray);
        analyser.getByteTimeDomainData(timeData);

        if (!canvasCtx) return;
        const width = canvas.width;
        const height = canvas.height;

        canvasCtx.fillStyle = 'rgba(4, 8, 18, 0.45)';
        canvasCtx.fillRect(0, 0, width, height);

        // Draw frequency spectrum bars (compact)
        const barWidth = (width / (bufferLength / 3)) * 1.8;
        let x = 0;

        for (let i = 0; i < bufferLength / 3; i++) {
          const barHeight = (dataArray[i] / 255) * (height * 0.8);
          const hue = 180 + (i / (bufferLength / 3)) * 60;
          canvasCtx.fillStyle = `hsla(${hue}, 90%, 55%, 0.85)`;
          canvasCtx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }

        // Draw center waveform line
        canvasCtx.lineWidth = 1.5;
        canvasCtx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        canvasCtx.beginPath();

        const sliceWidth = width / bufferLength;
        let waveX = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            canvasCtx.moveTo(waveX, y);
          } else {
            canvasCtx.lineTo(waveX, y);
          }
          waveX += sliceWidth;
        }

        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
      };

      renderFrame();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      podLiveEngine.stopSpeech();
      podLiveEngine.stopAmbient();
      podLiveEngine.stopMasterRecording().catch(() => {});
    };
  }, [show]);

  // Sync ambient soundscape
  const handleAmbientChange = (type: AmbientSoundscapeType) => {
    setAmbientTrack(type);
    podLiveEngine.setAmbientSoundscape(type);
  };

  // Trigger Isolated SFX Pad
  const handleTriggerSFX = (type: PunctualSFXType, label: string) => {
    podLiveEngine.playPunctualSFX(type, audioSettings.sfxVolume);
    toast({ title: 'مؤثر صوتی', message: `تم إطلاق: ${label}`, type: 'info' });
  };

  // Sync Rack settings
  const handleRackSettingChange = <K extends keyof AudioRackSettings>(key: K, value: AudioRackSettings[K]) => {
    const updated = { ...audioSettings, [key]: value };
    setAudioSettings(updated);
    podLiveEngine.updateRackSettings(updated);
    if (key === 'roomType') {
      podLiveEngine.setReverbImpulse(value as AudioRackSettings['roomType']);
    }
  };

  // Import chat messages
  const handleImportChat = () => {
    if (!initialChatMessages || initialChatMessages.length === 0) {
      toast({ title: 'تنبيه', message: 'لا توجد رسائل سابقة لاستيرادها.', type: 'info' });
      return;
    }

    const turns: PodLiveTurn[] = initialChatMessages
      .filter(m => !m.isSystem && m.text.trim().length > 0)
      .slice(-8)
      .map((m, idx) => {
        const isUser = m.role === 'user';
        const speakerKey = isUser ? hostKey : (m.persona || guest1Key);
        const speakerName = isUser ? 'المضيف' : (personas[speakerKey]?.label || speakerKey);

        return {
          id: `turn_import_${idx}_${Date.now()}`,
          speakerKey,
          speakerName,
          vocalExpression: idx % 3 === 0 ? '<short pause>' : 'طبيعي',
          sfxCue: idx === 1 ? '[مطر]' : idx === 3 ? '[عصافير]' : undefined,
          text: m.text,
          panPosition: idx % 2 === 0 ? -0.3 : 0.3
        };
      });

    setScriptTurns(turns);
    toast({ title: 'تم الاستيراد', message: `تم جلب ${turns.length} مقاطع حوارية!`, type: 'success' });
  };

  // Generate Lyria AI Soundscape Track
  const handleGenerateLyriaTrack = async () => {
    if (!lyriaPrompt.trim()) return;
    setIsGeneratingLyria(true);

    try {
      const ai = getGeminiClient(apiKey);
      const prompt = `You are Lyria AI Music Generator. Soundscape: "${lyriaPrompt}". Synthesize ambient texture profile.`;

      await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      }));

      setAmbientTrack('lyria_ai_music');
      podLiveEngine.setAmbientSoundscape('lyria_ai_music');

      toast({ 
        title: 'تم توليد نسيج Lyria AI', 
        message: 'تم ربط البث الصوتي التفاعلي بنجاح.', 
        type: 'success' 
      });
    } catch (e: any) {
      console.error('[Lyria AI] Error:', e);
      toast({ title: 'خطأ Lyria AI', message: 'تعذر توليد المسار من Lyria.', type: 'error' });
    } finally {
      setIsGeneratingLyria(false);
    }
  };

  // Generate Script via Gemini
  const handleGenerateScript = async () => {
    if (!episodeTopic.trim()) {
      toast({ title: 'تنبيه', message: 'يرجى كتابة موضوع الحلقة.', type: 'info' });
      return;
    }

    setIsGeneratingScript(true);
    abortControllerRef.current = new AbortController();

    try {
      const ai = getGeminiClient(apiKey);
      const host = personas[hostKey]?.label || hostKey;
      const g1 = personas[guest1Key]?.label || guest1Key;
      const g2 = includeGuest2 ? (personas[guest2Key]?.label || guest2Key) : null;

      const prompt = `أنت المخرج الصوتي لأستوديو البودلايف (PodLive Studio 2026).
قم بتوليد سيناريو حلقة بودكاست صوتية احترافية مدعومة بتوجيهات التمثيل الصوتي والمؤثرات البيئية.
المشاركون:
1. المضيف: "${host}" (المفتاح: "${hostKey}")
2. الضيف الأول: "${g1}" (المفتاح: "${guest1Key}")
${g2 ? `3. الضيف الثاني: "${g2}" (المفتاح: "${guest2Key}")` : ''}

الموضوع: "${episodeTopic}"
الأسلوب: ${episodeStyle}

التعبيرات المتاحة: <laugh>, <sigh>, <gasp>, <short pause>, <dramatic pause>.
المؤثرات المتاحة: [مطر]، [رعد]، [عصافير]، [سيارة]، [قهوة]، [تصفيق].

قم بتوليد 6 إلى 8 أدوار حوارية بتنسيق JSON array:
[
  {
    "speakerKey": "${hostKey}",
    "speakerName": "${host}",
    "vocalExpression": "<short pause>",
    "sfxCue": "[مطر بعيد]",
    "text": "نص الكلام هنا...",
    "panPosition": 0.0
  }
]`;

      const response: any = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      }));

      const rawText = response?.text || '[]';
      const parsed: any[] = parseJsonSafely<any[]>(rawText) || [];

      if (Array.isArray(parsed) && parsed.length > 0) {
        const formatted: PodLiveTurn[] = parsed.map((item, idx) => ({
          id: `turn_${idx}_${Date.now()}`,
          speakerKey: item.speakerKey || hostKey,
          speakerName: item.speakerName || host,
          vocalExpression: item.vocalExpression || 'طبيعي',
          sfxCue: item.sfxCue || undefined,
          text: item.text || '',
          panPosition: typeof item.panPosition === 'number' ? item.panPosition : (idx % 2 === 0 ? -0.3 : 0.3)
        }));

        setScriptTurns(formatted);
        toast({ title: 'تم إنتاج السيناريو!', message: `تجهيز ${formatted.length} أدوار حوارية مع المؤثرات.`, type: 'success' });
      } else {
        throw new Error('تعذر هيكلة السيناريو.');
      }
    } catch (err: any) {
      console.error('[PodLive] Script error:', err);
      toast({ title: 'خطأ', message: err?.message || 'حدث خطأ أثناء صياغة الحلقة.', type: 'error' });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Synthesize single turn audio
  const synthesizeTurnAudio = async (turn: PodLiveTurn): Promise<string | null> => {
    if (turn.base64Audio) return turn.base64Audio;

    try {
      const ai = getGeminiClient(apiKey);
      const persona = personas[turn.speakerKey];
      const personaVoice = persona?.voice || 'Puck';
      const voiceConfigPayload = buildSpeechVoiceConfig(personaVoice);

      // Clean text for speech synthesis by stripping bracketed and angled SFX tags so TTS speaks naturally
      const speechText = turn.text
        .replace(/\[.*?\]/g, '')
        .replace(/<.*?>/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[*#_`]/g, '')
        .trim();

      const candidateModels = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];

      for (const m of candidateModels) {
        try {
          const res: any = await withRetry(() => ai.models.generateContent({
            model: m,
            contents: speechText || 'مرحباً',
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: voiceConfigPayload }
            }
          }), 2, 1000);

          const b64 = res?.data || res?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (b64) {
            setScriptTurns(prev => prev.map(t => (t.id === turn.id ? { ...t, base64Audio: b64 } : t)));
            return b64;
          }
        } catch (e) {
          console.warn(`[PodLive] Model attempt ${m} failed:`, e);
        }
      }
    } catch (e) {
      console.error('[PodLive] TTS error:', e);
    }
    return null;
  };

  // Play single turn
  const handlePlaySingleTurn = async (index: number) => {
    if (playbackState === 'playing' && currentPlayingIndex === index) {
      podLiveEngine.stopSpeech();
      setPlaybackState('idle');
      setCurrentPlayingIndex(null);
      return;
    }

    podLiveEngine.stopSpeech();
    const turn = scriptTurns[index];
    if (!turn) return;

    setPlaybackState('playing');
    setCurrentPlayingIndex(index);
    setIsSynthesizingTurn(true);

    const base64 = await synthesizeTurnAudio(turn);
    setIsSynthesizingTurn(false);

    if (base64) {
      const fullTag = [turn.vocalExpression, turn.sfxCue, turn.text].filter(Boolean).join(' ');
      await podLiveEngine.playSpeechChunk(
        base64,
        audioSettings,
        turn.panPosition,
        fullTag,
        () => {
          setPlaybackState('idle');
          setCurrentPlayingIndex(null);
        }
      );
    } else {
      toast({ title: 'تنبيه', message: 'تعذر توليد الصوت لهذا الدور.', type: 'info' });
      setPlaybackState('idle');
      setCurrentPlayingIndex(null);
    }
  };

  // Play Full Episode
  const handlePlayFullEpisode = async () => {
    if (playbackState === 'playing') {
      podLiveEngine.stopSpeech();
      setPlaybackState('idle');
      setCurrentPlayingIndex(null);
      return;
    }

    if (scriptTurns.length === 0) {
      toast({ title: 'تنبيه', message: 'قم بتوليد سيناريو الحلقة أولاً.', type: 'info' });
      return;
    }

    setPlaybackState('playing');
    abortControllerRef.current = new AbortController();

    if (isRecordingMaster) {
      podLiveEngine.startMasterRecording();
    }

    for (let i = 0; i < scriptTurns.length; i++) {
      if (abortControllerRef.current.signal.aborted) break;

      setCurrentPlayingIndex(i);
      setIsSynthesizingTurn(true);

      const turn = scriptTurns[i];
      const base64 = await synthesizeTurnAudio(turn);
      setIsSynthesizingTurn(false);

      if (abortControllerRef.current.signal.aborted) break;

      if (base64) {
        const fullTag = [turn.vocalExpression, turn.sfxCue, turn.text].filter(Boolean).join(' ');
        await podLiveEngine.playSpeechChunk(
          base64,
          audioSettings,
          turn.panPosition,
          fullTag
        );
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (isRecordingMaster) {
      const recordedBlob = await podLiveEngine.stopMasterRecording();
      if (recordedBlob) {
        setRecordedMasterBlob(recordedBlob);
        toast({ title: 'اكتمل التسجيل!', message: 'تم حفظ ماستر الحلقة بالكامل.', type: 'success' });
      }
    }

    setPlaybackState('idle');
    setCurrentPlayingIndex(null);
  };

  const handleStopAll = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    podLiveEngine.stopSpeech();
    setPlaybackState('idle');
    setCurrentPlayingIndex(null);
  };

  const handleCopyScript = async () => {
    if (scriptTurns.length === 0) return;
    const text = scriptTurns.map(t => `[${t.speakerName} (${t.vocalExpression}${t.sfxCue ? ' | ' + t.sfxCue : ''})]:\n${t.text}\n`).join('\n');
    const ok = await copyToClipboard(text);
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      toast({ title: 'تم النسخ', message: 'تم نسخ السيناريو إلى الحافظة.', type: 'success' });
    }
  };

  const handleDownloadMaster = () => {
    if (!recordedMasterBlob) {
      toast({ title: 'تنبيه', message: 'فعّل "تسجيل الماستر" ثم شغّل الحلقة لتسجيلها.', type: 'info' });
      return;
    }
    const ext = recordedMasterBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(recordedMasterBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `podlive_master_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-1.5 sm:p-3 bg-black/90 backdrop-blur-md overflow-hidden font-sans" dir="rtl">
      {/* DAW-Style Compact Modal Window */}
      <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl w-full max-w-6xl max-h-[96vh] flex flex-col shadow-[0_0_40px_rgba(6,182,212,0.2)] relative text-right overflow-hidden">
        
        {/* Sleek Ultra-Compact Top Header Bar */}
        <div className="flex items-center justify-between border-b border-cyan-500/25 px-3 py-2 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 select-none">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Headphones size={15} className="animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                <span>استوديو البودلايف الرقمي (PodLive DAW 2026) 🎙️</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-mono font-semibold hidden sm:inline">
                  Lyria AI + Flash 3.8
                </span>
              </h3>
              {playbackState === 'playing' ? (
                <span className="flex items-center gap-1 text-[10px] bg-red-600/20 border border-red-500/40 text-red-400 px-2 py-0.5 rounded font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  ON AIR
                </span>
              ) : (
                <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono">
                  STANDBY
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Record Master Toggle */}
            <button
              onClick={() => setIsRecordingMaster(!isRecordingMaster)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isRecordingMaster
                  ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isRecordingMaster ? 'bg-red-500' : 'bg-slate-600'}`} />
              <span>تسجيل الماستر</span>
            </button>

            <button 
              onClick={() => {
                handleStopAll();
                onClose();
              }} 
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Master Studio Rack & Oscilloscope Strip (High-Density) */}
        <div className="bg-slate-900/90 border-b border-cyan-500/20 px-3 py-1.5 flex flex-col sm:flex-row items-center justify-between gap-2 select-none">
          {/* Slim Waveform & Spectrum */}
          <div className="w-full sm:w-1/2 h-12 bg-[#02050e] rounded-xl border border-cyan-500/30 overflow-hidden relative shadow-inner flex items-center">
            <canvas 
              ref={canvasRef} 
              width={500} 
              height={48} 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1 left-1.5 flex items-center gap-1 text-[9px] font-mono text-cyan-400/80 bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/20">
              <Activity size={10} className="text-cyan-400" />
              <span>24KHZ DSP MASTER</span>
            </div>
            {isSynthesizingTurn && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs text-[11px] text-cyan-300 font-bold gap-1.5">
                <RefreshCw size={12} className="animate-spin text-cyan-400" />
                <span>Flash TTS 3.8 DSP...</span>
              </div>
            )}
          </div>

          {/* Master Transport & Controls */}
          <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePlayFullEpisode}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow border border-cyan-400/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                {playbackState === 'playing' ? (
                  <>
                    <Pause size={13} />
                    <span>إيقاف مؤقت</span>
                  </>
                ) : (
                  <>
                    <Play size={13} className="fill-white" />
                    <span>تشغيل الحلقة 🎙️</span>
                  </>
                )}
              </button>

              <button
                onClick={handleStopAll}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                title="إيقاف كلي"
              >
                <Square size={12} />
              </button>
            </div>

            {/* Master Volume Slider */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <Volume2 size={13} className="text-cyan-400 shrink-0" />
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={audioSettings.masterVolume}
                onChange={(e) => handleRackSettingChange('masterVolume', parseFloat(e.target.value))}
                className="w-16 accent-cyan-400 cursor-pointer"
                title="مستوى الصوت العام"
              />
              <span className="font-mono text-[10px] text-slate-400 w-7 text-left">
                {Math.round(audioSettings.masterVolume * 100)}%
              </span>
            </div>

            {recordedMasterBlob && (
              <button
                onClick={handleDownloadMaster}
                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
              >
                <Download size={12} />
                <span>تنزيل الماستر</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact Tab Navigation Strip */}
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-950 border-b border-slate-800 overflow-x-auto text-[11px] font-bold select-none">
          <button
            onClick={() => setActiveTab('director')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
              activeTab === 'director'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Mic size={13} />
            <span>🎙️ المخرج والسيناريو</span>
          </button>

          <button
            onClick={() => setActiveTab('lyria_sfx')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
              activeTab === 'lyria_sfx'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sparkles size={13} className="text-amber-400" />
            <span>✨ Lyria & SFX Pad</span>
          </button>

          <button
            onClick={() => setActiveTab('rack')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
              activeTab === 'rack'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sliders size={13} />
            <span>🎛️ الراك الصوتي (EQ & Reverb)</span>
          </button>

          <button
            onClick={() => setActiveTab('cast')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
              activeTab === 'cast'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Headphones size={13} />
            <span>🎧 الطاقم والتوزيع Spatial</span>
          </button>

          <button
            onClick={() => setActiveTab('ambient')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
              activeTab === 'ambient'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Music size={13} />
            <span>🎵 الموسيقى و Auto-Ducking</span>
          </button>
        </div>

        {/* Vast High-Density Studio Body Workspace */}
        <div className="p-3 sm:p-4 overflow-y-auto max-h-[70vh] flex-1 space-y-4 text-xs font-sans">
          
          {/* TAB 1: Episode Director & Script */}
          {activeTab === 'director' && (
            <div className="space-y-4">
              {/* Episode Setup Bar */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                    <Wand2 size={14} className="text-cyan-400" />
                    إعداد موضوع الحلقة والسيناريو التفاعلي
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleImportChat}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Layers size={12} />
                      <span>استيراد الشات</span>
                    </button>
                    {scriptTurns.length > 0 && (
                      <button
                        onClick={handleCopyScript}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{isCopied ? 'تم النسخ!' : 'نسخ النص'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Topic Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={episodeTopic}
                    onChange={(e) => setEpisodeTopic(e.target.value)}
                    placeholder="اكتب موضوع الحلقة هنا..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-medium"
                  />
                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isGeneratingScript ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>جارِ التوليد...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 size={13} />
                        <span>توليد السيناريو بـ Flash 3.8 🎙️</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Style Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                  {[
                    { id: 'philosophical', label: '🏛️ فلسفي متأمل' },
                    { id: 'scientific_debate', label: '⚡ مناظرة علمية' },
                    { id: 'creative_salon', label: '🎨 صالون إبداعي' },
                    { id: 'witty_casual', label: '☕ حواري ذكي' }
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setEpisodeStyle(style.id as any)}
                      className={`py-1 px-2 rounded-lg border text-center transition-all cursor-pointer font-bold ${
                        episodeStyle === style.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Script Turns High-Density List */}
              {scriptTurns.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                    <span>جدول أدوار الحلقة ({scriptTurns.length} أدوار حوارية):</span>
                    <span className="text-slate-500 font-mono text-[10px]">انقر على الأيقونة للاستماع المنفصل</span>
                  </div>

                  <div className="space-y-1.5">
                    {scriptTurns.map((turn, idx) => {
                      const isCurrent = currentPlayingIndex === idx;
                      return (
                        <div
                          key={turn.id}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                            isCurrent
                              ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                              : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                              <img 
                                src={getAvatarUrl(turn.speakerKey)} 
                                alt={turn.speakerName} 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-xs">{turn.speakerName}</span>
                                {turn.vocalExpression && turn.vocalExpression !== 'طبيعي' && (
                                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30 font-mono">
                                    {turn.vocalExpression}
                                  </span>
                                )}
                                {turn.sfxCue && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-mono flex items-center gap-1">
                                    <CloudRain size={9} />
                                    {turn.sfxCue}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-300 truncate mt-0.5">{turn.text}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handlePlaySingleTurn(idx)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
                              isCurrent
                                ? 'bg-cyan-400 text-black font-bold'
                                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {isCurrent ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Lyria AI + SFX Environmental Soundboard */}
          {activeTab === 'lyria_sfx' && (
            <div className="space-y-4">
              {/* Lyria AI Prompter Box */}
              <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-extrabold text-white text-xs">مولد الأجواء الموسيقية النسيجية (Lyria AI RealTime)</span>
                  </div>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                    Lyria Engine
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={lyriaPrompt}
                    onChange={(e) => setLyriaPrompt(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={handleGenerateLyriaTrack}
                    disabled={isGeneratingLyria}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isGeneratingLyria ? <RefreshCw size={13} className="animate-spin" /> : <Music size={13} />}
                    <span>{isGeneratingLyria ? 'جارِ التوصيل...' : 'ربط Lyria AI 🎵'}</span>
                  </button>
                </div>
              </div>

              {/* Punctual Environmental SFX Soundboard Grid */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="font-extrabold text-white text-xs">لوحة المؤثرات البيئية الفورية (Punctual SFX Sampler)</span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Volume2 size={12} className="text-cyan-400" />
                    <span>مستوى: {Math.round(audioSettings.sfxVolume * 100)}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { type: 'thunder_clap', label: 'رعد مدوٍ ⚡', icon: Zap, color: 'border-amber-500/40 text-amber-300 bg-amber-500/10' },
                    { type: 'rain_shower', label: 'هطول مطر 🌧️', icon: CloudRain, color: 'border-blue-500/40 text-blue-300 bg-blue-500/10' },
                    { type: 'birds_chirp', label: 'تغريد عصافير 🐦', icon: Bird, color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' },
                    { type: 'car_passing', label: 'مرور سيارة 🚗', icon: Car, color: 'border-purple-500/40 text-purple-300 bg-purple-500/10' },
                    { type: 'coffee_cup', label: 'فنجان قهوة ☕', icon: Coffee, color: 'border-orange-500/40 text-orange-300 bg-orange-500/10' },
                    { type: 'feather_quill', label: 'ريشة وقرطاس 🪶', icon: Feather, color: 'border-yellow-500/40 text-yellow-300 bg-yellow-500/10' },
                    { type: 'laughter_burst', label: 'ضحك / ضحكة 😄', icon: Smile, color: 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10' },
                    { type: 'gasp_sigh', label: 'تنهيدة / شهقة 💨', icon: Wind, color: 'border-sky-500/40 text-sky-300 bg-sky-500/10' },
                    { type: 'gavel_strike', label: 'طرقة مطرقة 🔨', icon: Hammer, color: 'border-rose-500/40 text-rose-300 bg-rose-500/10' },
                    { type: 'applause', label: 'تصفيق الجمهور 👏', icon: Clapperboard, color: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10' }
                  ].map((sfx) => {
                    const IconComp = sfx.icon;
                    return (
                      <button
                        key={sfx.type}
                        onClick={() => handleTriggerSFX(sfx.type as PunctualSFXType, sfx.label)}
                        className={`p-2 rounded-xl border ${sfx.color} hover:scale-102 active:scale-95 transition-all flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer shadow-sm`}
                      >
                        <IconComp size={14} />
                        <span>{sfx.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Audio Engineering Rack */}
          {activeTab === 'rack' && (
            <div className="space-y-3">
              {/* Rack Sub-Nav */}
              <div className="flex items-center gap-1 border-b border-slate-800 pb-1.5 text-xs font-bold">
                {[
                  { id: 'eq', label: 'معادل الصوت 3-Band EQ' },
                  { id: 'comp', label: 'الضاغط Compressor' },
                  { id: 'reverb', label: 'الصدى المكاني Reverb' },
                  { id: 'voice_profile', label: 'بروفايل الصوت Voice Profile' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setRackTab(sub.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                      rackTab === sub.id 
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {/* EQ */}
              {rackTab === 'eq' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-extrabold text-white text-xs">المعادل الصوتي (3-Band Parametric EQ)</span>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={audioSettings.lowCut}
                        onChange={(e) => handleRackSettingChange('lowCut', e.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      <span>قطع الترددات الخانقة (Low-Cut 80Hz)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-slate-300">Bass (Low 220Hz)</span>
                        <span className="font-mono text-cyan-400">{audioSettings.lowGain} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={audioSettings.lowGain}
                        onChange={(e) => handleRackSettingChange('lowGain', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-slate-300">Mid (1.4kHz)</span>
                        <span className="font-mono text-cyan-400">{audioSettings.midGain} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={audioSettings.midGain}
                        onChange={(e) => handleRackSettingChange('midGain', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-slate-300">Air (High 4.5kHz)</span>
                        <span className="font-mono text-cyan-400">{audioSettings.highGain} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={audioSettings.highGain}
                        onChange={(e) => handleRackSettingChange('highGain', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Compressor */}
              {rackTab === 'comp' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3">
                  <span className="font-extrabold text-white text-xs block border-b border-slate-800 pb-2">
                    الضاغط الإذاعي (Broadcast Compressor)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-300">Threshold</span>
                        <span className="font-mono text-cyan-400">{audioSettings.compThreshold} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-45"
                        max="0"
                        step="1"
                        value={audioSettings.compThreshold}
                        onChange={(e) => handleRackSettingChange('compThreshold', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-300">Ratio</span>
                        <span className="font-mono text-cyan-400">{audioSettings.compRatio}:1</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="0.5"
                        value={audioSettings.compRatio}
                        onChange={(e) => handleRackSettingChange('compRatio', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Reverb */}
              {rackTab === 'reverb' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3">
                  <span className="font-extrabold text-white text-xs block border-b border-slate-800 pb-2">
                    المحاكاة المكانية (Spatial Reverb)
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'podcast_booth', label: '🎙️ كابينة بودكاست' },
                      { id: 'athenian_hall', label: '🏛️ أكاديمية أثينا' },
                      { id: 'vintage_radio', label: '📻 راديو عتيق' },
                      { id: 'cosmic_space', label: '🌌 صدى كوني' },
                      { id: 'fireside_salon', label: '☕ صالون حواري' }
                    ].map(room => (
                      <button
                        key={room.id}
                        onClick={() => handleRackSettingChange('roomType', room.id as any)}
                        className={`p-2 rounded-lg border text-right transition-all cursor-pointer font-bold ${
                          audioSettings.roomType === room.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {room.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-300">Wet Mix</span>
                      <span className="font-mono text-cyan-400">{Math.round(audioSettings.reverbMix * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.01"
                      value={audioSettings.reverbMix}
                      onChange={(e) => handleRackSettingChange('reverbMix', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Voice Profiler */}
              {rackTab === 'voice_profile' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3">
                  <span className="font-extrabold text-white text-xs block border-b border-slate-800 pb-2">
                    مخصص النبرة الصوتیة (Voice Profiler)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'natural_human', label: '👤 بشري إذاعي طبيعي' },
                      { id: 'bionic_synth', label: '🤖 بايونية وسبرانية' },
                      { id: 'historical_scholar', label: '📜 مفكر تاريخي عتيق' },
                      { id: 'broadcast_warmth', label: '📻 إذاعي عريض FM' }
                    ].map(prof => (
                      <button
                        key={prof.id}
                        onClick={() => handleRackSettingChange('voiceProfile', prof.id as any)}
                        className={`p-2 rounded-lg border text-right transition-all cursor-pointer font-bold ${
                          audioSettings.voiceProfile === prof.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {prof.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-300">Pitch Shift</span>
                      <span className="font-mono text-cyan-400">{audioSettings.pitchShift}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.85"
                      max="1.2"
                      step="0.01"
                      value={audioSettings.pitchShift}
                      onChange={(e) => handleRackSettingChange('pitchShift', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Cast & Spatial Panning */}
          {activeTab === 'cast' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3">
              <span className="font-extrabold text-white text-xs block border-b border-slate-800 pb-2">
                اختيار طاقم البودكاست وتوزيع الاستيريو (Spatial Panning)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Host */}
                <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400">المضيف الرئيسي</span>
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono">Center 0.0</span>
                  </div>
                  <select
                    value={hostKey}
                    onChange={(e) => setHostKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold"
                  >
                    {personaKeys.map(k => (
                      <option key={k} value={k}>{personas[k]?.label || k}</option>
                    ))}
                  </select>
                </div>

                {/* Guest 1 */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">الضيف الأول</span>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">Left -0.4</span>
                  </div>
                  <select
                    value={guest1Key}
                    onChange={(e) => setGuest1Key(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold"
                  >
                    {personaKeys.map(k => (
                      <option key={k} value={k}>{personas[k]?.label || k}</option>
                    ))}
                  </select>
                </div>

                {/* Guest 2 */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">الضيف الثاني</span>
                    <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeGuest2}
                        onChange={(e) => setIncludeGuest2(e.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      <span>تفعيل</span>
                    </label>
                  </div>
                  <select
                    value={guest2Key}
                    disabled={!includeGuest2}
                    onChange={(e) => setGuest2Key(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold disabled:opacity-40"
                  >
                    {personaKeys.map(k => (
                      <option key={k} value={k}>{personas[k]?.label || k}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Ambient Soundscapes */}
          {activeTab === 'ambient' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <span className="font-extrabold text-white text-xs">الموسيقى وخفض الصوت الذكي (Smart Auto-Ducking)</span>
                <label className="flex items-center gap-1.5 text-xs text-cyan-300 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioSettings.autoDucking}
                    onChange={(e) => handleRackSettingChange('autoDucking', e.target.checked)}
                    className="rounded accent-cyan-400"
                  />
                  <span>Auto-Ducking</span>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  { id: 'none', label: '🔇 بدون موسيقى' },
                  { id: 'lofi_thought', label: '🎵 Lo-Fi Chill' },
                  { id: 'cosmic_drone', label: '🌌 Cosmic Drone' },
                  { id: 'classical_strings', label: '🎻 وتريات باروكية' },
                  { id: 'vinyl_warmth', label: '☕ أسطوانات الفينيل' },
                  { id: 'rain_and_thunder', label: '🌧️ مطر ورعد' },
                  { id: 'forest_birds', label: '🐦 عصافير الغابة' },
                  { id: 'city_traffic', label: '🚗 حركة المدينة' }
                ].map(track => (
                  <button
                    key={track.id}
                    onClick={() => handleAmbientChange(track.id as any)}
                    className={`p-2 rounded-lg border text-right transition-all cursor-pointer font-bold ${
                      ambientTrack === track.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {track.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-300">مستوى صوت الموسيقى</span>
                  <span className="font-mono text-cyan-400">{Math.round(audioSettings.ambientVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.02"
                  value={audioSettings.ambientVolume}
                  onChange={(e) => handleRackSettingChange('ambientVolume', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] select-none">
          <div className="flex items-center gap-1.5 text-slate-500 font-mono">
            <Radio size={13} className="text-cyan-400" />
            <span>PODLIVE STUDIO 2026 • HIGH DENSITY DSP WORKSPACE</span>
          </div>

          <button
            onClick={() => {
              handleStopAll();
              onClose();
            }}
            className="px-4 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
          >
            إغلاق الاستوديو
          </button>
        </div>

      </div>
    </div>
  );
};
