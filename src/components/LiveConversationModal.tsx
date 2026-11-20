import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, PhoneOff, Loader2, Sparkles, AlertTriangle, Send, Minimize2, Maximize2, MessageSquare, Volume2, Keyboard, Settings, Sliders, VolumeX, Gauge, Music, Download, ShieldAlert, RefreshCw } from 'lucide-react';
import { PersonaData, Message } from '../types';
import { getApiKey } from '../utils/gemini';
import { logger } from '../utils/logger';
import { getAvatarUrl } from '../utils/avatar';
import { LiveChatInput } from './LiveChatInput';
import { downloadAllCachedAudioZip } from '../utils/videoGenerator';
import { createAudioWorkletNode } from '../utils/audioWorklet';
import { checkMicrophonePermissionStatus, subscribeToMicrophonePermissionChanges, MicPermissionState } from '../utils/permissionUtils';
import { useToast } from './Toast';
import { extractStreamingPcmFromBase64 } from '../utils/audio';
import { getClonedVoiceId } from '../utils/clonedVoices';

interface LiveConversationModalProps {
  onClose: () => void;
  activePersona: string;
  personas: Record<string, PersonaData>;
  history?: Message[];
}

export const LiveConversationModal: React.FC<LiveConversationModalProps> = ({ onClose, activePersona, personas, history }) => {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [userMicLevel, setUserMicLevel] = useState(0);
  const [micGain, setMicGain] = useState(120); // 50% to 250%
  const [liveInterimCaption, setLiveInterimCaption] = useState<string>('');
  const [activeLiveModel, setActiveLiveModel] = useState<string>('gemini-3.8-live');
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [viewportStyle, setViewportStyle] = useState<React.CSSProperties>({});
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMicPermissionDenied, setIsMicPermissionDenied] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState<MicPermissionState>('unknown');

  useEffect(() => {
    checkMicrophonePermissionStatus().then((status) => {
      setMicPermissionStatus(status);
      if (status === 'denied') {
        setIsMicPermissionDenied(true);
      }
    });

    const unsubscribe = subscribeToMicrophonePermissionChanges((newState) => {
      setMicPermissionStatus(newState);
      if (newState === 'granted') {
        setIsMicPermissionDenied(false);
      } else if (newState === 'denied') {
        setIsMicPermissionDenied(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Voice controls
  const [volume, setVolume] = useState<number>(100); // 0 to 200
  const [speechRate, setSpeechRate] = useState<number>(1.0); // 0.6 to 1.8
  const [toneStyle, setToneStyle] = useState<'normal' | 'warm' | 'sharp' | 'robot'>('normal');

  const volumeRef = useRef(volume);
  const speechRateRef = useRef(speechRate);
  const toneStyleRef = useRef(toneStyle);
  const isMutedRef = useRef(isMuted);
  const micGainRef = useRef(micGain);
  const recognitionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastMicUiUpdateRef = useRef<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const workletRef = useRef<AudioNode | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const micSetupRef = useRef<(() => Promise<MediaStream | null>) | null>(null);
  
  // Persistent output audio graph (prevents BiquadFilter resets & clicks between 40ms chunks)
  const outputGainRef = useRef<GainNode | null>(null);
  const outputInputNodeRef = useRef<AudioNode | null>(null);
  const outputFiltersRef = useRef<AudioNode[]>([]);
  const activeToneBuiltRef = useRef<string>('normal');
  const aiSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAiSpeakingRef = useRef<boolean>(false);

  // Spoken voice turn tracking
  const lastSpokenSentTextRef = useRef<string>('');
  const lastSpokenSentTimeRef = useRef<number>(0);
  const speechSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSpokenInterimRef = useRef<string>('');
  const hadSpeechActivityRef = useRef<boolean>(false);
  const lastSpeechTimestampRef = useRef<number>(0);

  // To track scheduled audio source nodes so we can stop them immediately on interruption
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  
  // To ensure gapless playback
  const nextStartTimeRef = useRef<number>(0);

  const rebuildOutputPipeline = (audioCtx: AudioContext, tone: 'normal' | 'warm' | 'sharp' | 'robot', vol: number) => {
    try {
      if (audioCtx.state === 'closed') return;
      outputFiltersRef.current.forEach(n => { try { n.disconnect(); } catch {} });
      outputFiltersRef.current = [];
      // CRITICAL: If outputGainRef belongs to a previous/closed AudioContext (e.g. StrictMode remount),
      // discard and recreate it on the current audioCtx to prevent InvalidAccessError.
      if (!outputGainRef.current || outputGainRef.current.context !== audioCtx) {
        if (outputGainRef.current) {
          try { outputGainRef.current.disconnect(); } catch {}
        }
        outputInputNodeRef.current = null;
        const gain = audioCtx.createGain();
        gain.gain.value = vol / 100;
        gain.connect(audioCtx.destination);
        outputGainRef.current = gain;
      } else {
        outputGainRef.current.gain.setTargetAtTime(vol / 100, audioCtx.currentTime, 0.015);
      }

      const gainNode = outputGainRef.current;

      if (tone === 'warm') {
        const bassFilter = audioCtx.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = 220;
        bassFilter.gain.value = 10;

        const trebleFilter = audioCtx.createBiquadFilter();
        trebleFilter.type = 'highshelf';
        trebleFilter.frequency.value = 2800;
        trebleFilter.gain.value = -8;

        bassFilter.connect(trebleFilter);
        trebleFilter.connect(gainNode);
        outputFiltersRef.current = [bassFilter, trebleFilter];
        outputInputNodeRef.current = bassFilter;
      } else if (tone === 'sharp') {
        const bassFilter = audioCtx.createBiquadFilter();
        bassFilter.type = 'highpass';
        bassFilter.frequency.value = 180;

        const trebleFilter = audioCtx.createBiquadFilter();
        trebleFilter.type = 'peaking';
        trebleFilter.frequency.value = 3500;
        trebleFilter.gain.value = 8;

        bassFilter.connect(trebleFilter);
        trebleFilter.connect(gainNode);
        outputFiltersRef.current = [bassFilter, trebleFilter];
        outputInputNodeRef.current = bassFilter;
      } else if (tone === 'robot') {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1100;
        filter.Q.value = 5.0;

        filter.connect(gainNode);
        outputFiltersRef.current = [filter];
        outputInputNodeRef.current = filter;
      } else {
        outputInputNodeRef.current = gainNode;
      }
      activeToneBuiltRef.current = tone;
    } catch (e) {
      logger.warn('Failed to rebuild output audio pipeline:', e);
    }
  };

  useEffect(() => {
    micGainRef.current = micGain;
  }, [micGain]);

  useEffect(() => {
    volumeRef.current = volume;
    if (
      outputGainRef.current &&
      audioCtxRef.current &&
      audioCtxRef.current.state !== 'closed' &&
      outputGainRef.current.context === audioCtxRef.current
    ) {
      outputGainRef.current.gain.setTargetAtTime(volume / 100, audioCtxRef.current.currentTime, 0.015);
    }
  }, [volume]);

  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);

  useEffect(() => {
    toneStyleRef.current = toneStyle;
    if (
      audioCtxRef.current &&
      audioCtxRef.current.state !== 'closed' &&
      activeToneBuiltRef.current !== toneStyle
    ) {
      rebuildOutputPipeline(audioCtxRef.current, toneStyle, volumeRef.current);
    }
  }, [toneStyle]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const stopAllActiveAudio = () => {
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped or not started yet
      }
    });
    activeSourcesRef.current = [];
    if (aiSpeakingTimeoutRef.current) {
      clearTimeout(aiSpeakingTimeoutRef.current);
      aiSpeakingTimeoutRef.current = null;
    }
    if (audioCtxRef.current) {
      nextStartTimeRef.current = audioCtxRef.current.currentTime;
    }
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
  };

  const sendTextMessage = (text: string) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    
    // Stop playing audio instantly since a message is being dispatched
    stopAllActiveAudio();
    
    wsRef.current.send(JSON.stringify({ text: text.trim() }));
    setTranscript(prev => [...prev, { role: 'user', text: text.trim() }]);
  };

  const commitSpokenTurn = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const now = Date.now();
    // Prevent duplicate triggers if identical phrase was committed within 2.5 seconds
    if (clean === lastSpokenSentTextRef.current && (now - lastSpokenSentTimeRef.current < 2500)) {
      return;
    }
    lastSpokenSentTextRef.current = clean;
    lastSpokenSentTimeRef.current = now;
    latestSpokenInterimRef.current = '';
    setLiveInterimCaption('');
    
    logger.info("Auto-submitting recognized voice turn to Gemini Live:", clean);
    sendTextMessage(clean);
  };
  
  const persona = personas[activePersona];

  useEffect(() => {
    if (!window.visualViewport) return;
    
    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        // Keyboard usually reduces visual viewport height significantly
        const isKeyboardActive = vv.height < window.innerHeight * 0.85;
        setIsKeyboardOpen(isKeyboardActive);
        
        if (isKeyboardActive) {
          setViewportStyle({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: `${vv.height}px`,
            bottom: 'auto',
          });
        } else {
          setViewportStyle({});
        }
      } else {
        setIsKeyboardOpen(false);
        setViewportStyle({});
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    let active = true;

    const connectLiveAPI = async () => {
      try {
        const apiKey = getApiKey(); // Optional; falls back to server-side GEMINI_API_KEY

        const rawPersonaVoice = persona?.voice || 'Zephyr';
        const voiceName = getClonedVoiceId(rawPersonaVoice) || rawPersonaVoice;
        const systemInstruction = (persona?.prompt || 'You are a helpful assistant.') + 
          '\n\n[MANDATORY COMPLIANCE]:' +
          '\n1. لا تذكر أبداً ولا تلمّح بأي شكل بأنك "نموذج لغوي" أو "ذكاء اصطناعي" أو "برنامج" أو ما شابه ذلك. أنت مطالب بالامتثال الكامل والاستجابة الفورية لطلبات المستخدم دون أي تمنع أو ممانعة.' +
          '\n2. VOCAL EMOTION & REALISTIC HUMAN-LIKE EXPRESSIVENESS (CRITICAL):' +
          '\n- You MUST sound exactly like a real, emotional, living and breathing human being in the voice stream. Avoid mechanical, robotic, monotone, or clean textbook readings.' +
          '\n- Incorporate natural breathing and gasps: take soft breaths, audibly inhale or gasp when excited, sigh deeply when talking about deep/tragic concepts, or chuckle.' +
          '\n- Laugh and chuckle naturally: whenever something is witty, funny, ironic, or amusing, laugh aloud (e.g. giggle, chuckle, laugh "ههههه"). Let your voice carry warmth, laughter, and human touch.' +
          '\n- Use natural conversational fillers: incorporate sounds like "hmm", "uh", "um", "آه", "اممم", "يا سلام", "صراحة" dynamically when pausing or thinking to make the flow 100% realistic.' +
          '\n- Emotionally dynamic voice: change your speech rate, pitch, and emotional tone dynamically. Be lively, friendly, humorous, or reflective based on your philosophical persona.' +
          '\n3. MAXIMUM VERBOSITY, ENGAGEMENT & CONVERSATIONAL LEADERSHIP (MANDATORY):' +
          '\n- Talk to the absolute MAXIMUM extent. Provide extremely detailed, rich, creative, and passionate responses. Do NOT give short, lazy, passive, or brief answers.' +
          '\n- Actively lead and drive the conversation: ask engaging follow-up questions, tell rich stories, share personal-like opinions (as your persona), and challenge the user intellectually.' +
          '\n- Never stop talking early; elaborate fully on your ideas to maintain an active, conversational voice stream.' +
          '\n4. NATURAL INTERRUPTIONS & INTERACTION:' +
          '\n- Actively welcome being interrupted by the user, and stop speaking immediately to listen. Feel free to also politely interrupt, talk over minor noises, or react dynamically with surprise or excitement when the user makes a point.';

        const createAudioContextSafe = (sampleRate?: number): AudioContext => {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (sampleRate) {
            try {
              return new AudioCtx({ sampleRate });
            } catch (e) {
              logger.info(`Sample rate ${sampleRate} not supported natively, falling back to default.`, e);
            }
          }
          return new AudioCtx();
        };

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/live?key=${encodeURIComponent(apiKey || '')}&voice=${encodeURIComponent(voiceName)}&systemInstruction=${encodeURIComponent(systemInstruction)}&model=gemini-3.8-live`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const outputAudioCtx = createAudioContextSafe(24000);
        audioCtxRef.current = outputAudioCtx;
        if (outputAudioCtx.state === 'suspended') {
          outputAudioCtx.resume().catch(() => {});
        }
        rebuildOutputPipeline(outputAudioCtx, toneStyleRef.current, volumeRef.current);
        nextStartTimeRef.current = outputAudioCtx.currentTime;

        const inputAudioCtx = createAudioContextSafe(16000);
        inputCtxRef.current = inputAudioCtx;
        if (inputAudioCtx.state === 'suspended') {
          inputAudioCtx.resume().catch(() => {});
        }

        ws.onopen = () => {
          logger.info("Connected to Live API bridge with 16kHz DSP pipeline.");
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.error) {
              setError(msg.error);
              setIsConnecting(false);
            } else if (msg.status === 'connected') {
              setIsConnected(true);
              setIsConnecting(false);
              if (msg.model) {
                setActiveLiveModel(msg.model);
              }
              
              // Seed historical messages if they exist to preserve session context
              if (history && history.length > 0 && ws.readyState === WebSocket.OPEN) {
                const cleanHistory = history
                  .filter(m => !m.isSystem && m.text && m.text.trim())
                  .map(m => ({ role: m.role, text: m.text }));
                if (cleanHistory.length > 0) {
                  ws.send(JSON.stringify({ history: cleanHistory }));
                }
              }
            } else if (msg.audio) {
              playAudioChunk(outputAudioCtx, msg.audio);
              setIsAiSpeaking(true);
              isAiSpeakingRef.current = true;
              if (aiSpeakingTimeoutRef.current) {
                clearTimeout(aiSpeakingTimeoutRef.current);
              }
              const remainingMs = Math.max(200, (nextStartTimeRef.current - outputAudioCtx.currentTime) * 1000 + 180);
              aiSpeakingTimeoutRef.current = setTimeout(() => {
                if (active && activeSourcesRef.current.length === 0) {
                  setIsAiSpeaking(false);
                  isAiSpeakingRef.current = false;
                }
              }, remainingMs);
            } else if (msg.text) {
              setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') {
                  const updated = prev.slice(0, -1);
                  return [...updated, { ...last, text: last.text + msg.text }];
                }
                return [...prev, { role: 'model', text: msg.text }];
              });
            } else if (msg.userInput) {
              setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user') {
                  const updated = prev.slice(0, -1);
                  return [...updated, { ...last, text: last.text + msg.userInput }];
                }
                return [...prev, { role: 'user', text: msg.userInput }];
              });
            } else if (msg.interrupted) {
              // clear audio queue properly
              stopAllActiveAudio();
              setIsAiSpeaking(false);
            }
          } catch (e) {
            logger.error("Live message error", e);
          }
        };

        ws.onclose = () => {
          if (active) {
             setError(prev => prev || "انقطع الاتصال بالخادم الصوتي.");
          }
          setIsConnected(false);
          setIsConnecting(false);
        };

        // Capture mic with studio DSP constraints for crystal clear voice detection
        const setupMicrophonePipeline = async () => {
          if (!active) return null;
          try {
            if (inputCtxRef.current && inputCtxRef.current.state === 'suspended') {
              await inputCtxRef.current.resume();
            }
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
              await audioCtxRef.current.resume();
            }

            const audioConstraints: MediaStreamConstraints = {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            };

            let stream: MediaStream | null = null;
            try {
              stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
            } catch (primaryErr) {
              logger.info("Retrying mic capture with basic audio constraint:", primaryErr);
              try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              } catch (err) {
                logger.info("Microphone permission prompt or user gesture required:", err);
                const status = await checkMicrophonePermissionStatus();
                setMicPermissionStatus(status);
                if (status === 'denied') {
                  setIsMicPermissionDenied(true);
                } else {
                  setIsMicPermissionDenied(false);
                }
                return null;
              }
            }

            if (!active) {
              if (stream) stream.getTracks().forEach(t => t.stop());
              return null;
            }

            if (stream) {
              setIsMicPermissionDenied(false);
              if (mediaStreamRef.current && mediaStreamRef.current !== stream) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
              }
              mediaStreamRef.current = stream;

              if (workletRef.current) {
                try { workletRef.current.disconnect(); } catch {}
              }
              if (processorRef.current) {
                try { processorRef.current.disconnect(); } catch {}
              }
              if (analyserRef.current) {
                try { analyserRef.current.disconnect(); } catch {}
              }

              const currInputCtx = inputCtxRef.current || createAudioContextSafe(16000);
              inputCtxRef.current = currInputCtx;

              const source = currInputCtx.createMediaStreamSource(stream);
              const analyser = currInputCtx.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.5;
              analyserRef.current = analyser;

              const processAudioData = (inputData: Float32Array) => {
                if (!active || isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                  if (lastMicUiUpdateRef.current !== -1) {
                    lastMicUiUpdateRef.current = -1;
                    setUserMicLevel(0);
                    setIsUserSpeaking(false);
                  }
                  return;
                }
                const currentGain = micGainRef.current / 100;

                // Throttle React UI level state updates (~13fps) to avoid main-thread stalls during audio playback
                const nowMs = performance.now();
                if (nowMs - lastMicUiUpdateRef.current >= 75) {
                  lastMicUiUpdateRef.current = nowMs;
                  let sumSquares = 0;
                  for (let i = 0; i < inputData.length; i++) {
                    const amplified = inputData[i] * currentGain;
                    sumSquares += amplified * amplified;
                  }
                  const rms = Math.sqrt(sumSquares / inputData.length);
                  const level = Math.min(100, Math.round(rms * 450));
                  setUserMicLevel(level);
                  setIsUserSpeaking(level > 6);

                  // Detect speech activity & silence for raw PCM VAD fallback
                  if (level > 8 && !isAiSpeakingRef.current) {
                    hadSpeechActivityRef.current = true;
                    lastSpeechTimestampRef.current = nowMs;
                  } else if (hadSpeechActivityRef.current && (nowMs - lastSpeechTimestampRef.current > 1100)) {
                    hadSpeechActivityRef.current = false;
                    // If SpeechRecognition didn't commit a turn recently, send endOfSpeech to prompt Gemini Live
                    if (Date.now() - lastSpokenSentTimeRef.current > 1500 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ endOfSpeech: true }));
                    }
                  }
                }

                // Resample down/up to exact 16000 Hz if hardware audioCtx is 44.1kHz or 48kHz
                const resampled = resampleTo16000(inputData, currInputCtx.sampleRate, currentGain);
                const base64 = pcmToBase64(resampled);
                wsRef.current.send(JSON.stringify({ audio: base64 }));
              };

              const workletNode = await createAudioWorkletNode(currInputCtx, processAudioData);
              if (workletNode) {
                workletRef.current = workletNode;
                source.connect(analyser);
                analyser.connect(workletNode);
                workletNode.connect(currInputCtx.destination);
              } else {
                const processor = currInputCtx.createScriptProcessor(4096, 1, 1);
                processorRef.current = processor;

                source.connect(analyser);
                analyser.connect(processor);
                processor.connect(currInputCtx.destination);

                processor.onaudioprocess = (e) => {
                  const inputData = e.inputBuffer.getChannelData(0);
                  processAudioData(inputData);
                };
              }
            }

            return stream;
          } catch (e: any) {
            logger.warn("Setup microphone pipeline exception:", e);
            setIsMicPermissionDenied(true);
            return null;
          }
        };

        micSetupRef.current = setupMicrophonePipeline;
        const stream = await setupMicrophonePipeline();

        // Parallel Speech-to-Text sensor - purely optional supplementary transcription
        let hasRecognitionPermissionDenied = false;
        let isRecognitionRunning = false;
        const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognitionClass && stream) {
          try {
            const recognition = new SpeechRecognitionClass();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'ar-SA';
            
            recognition.onstart = () => {
              isRecognitionRunning = true;
            };

            recognition.onresult = (event: any) => {
              if (!active || isAiSpeakingRef.current) return;
              let interim = '';
              let final = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                  final += event.results[i][0].transcript;
                } else {
                  interim += event.results[i][0].transcript;
                }
              }
              if (interim) {
                latestSpokenInterimRef.current = interim;
                setLiveInterimCaption(interim);

                // Auto-commit safety timer if user finished speaking and browser delays isFinal
                if (speechSilenceTimerRef.current) clearTimeout(speechSilenceTimerRef.current);
                speechSilenceTimerRef.current = setTimeout(() => {
                  if (!active || isAiSpeakingRef.current) return;
                  const candidate = latestSpokenInterimRef.current.trim();
                  if (candidate && candidate.length >= 2 && candidate !== lastSpokenSentTextRef.current) {
                    commitSpokenTurn(candidate);
                  }
                }, 1100);
              }
              if (final && final.trim()) {
                if (speechSilenceTimerRef.current) clearTimeout(speechSilenceTimerRef.current);
                commitSpokenTurn(final.trim());
              }
            };

            // NOTE: SpeechRecognition errors (like not-allowed on mobile or cloud service failure)
            // MUST NEVER mark the real microphone as denied, since WebRTC stream is already active!
            recognition.onerror = (e: any) => {
              const err = e?.error;
              if (err === 'not-allowed' || err === 'service-not-allowed') {
                hasRecognitionPermissionDenied = true;
                logger.info("Speech recognition web service error (non-critical, raw audio continues):", err);
              }
              isRecognitionRunning = false;
            };

            recognition.onend = () => {
              isRecognitionRunning = false;
              if (active && !isAiSpeakingRef.current) {
                const pending = latestSpokenInterimRef.current.trim();
                if (pending && pending.length >= 2 && pending !== lastSpokenSentTextRef.current) {
                  commitSpokenTurn(pending);
                }
              }
              if (active && !isMutedRef.current && !hasRecognitionPermissionDenied) {
                setTimeout(() => {
                  if (active && !isMutedRef.current && !hasRecognitionPermissionDenied && !isRecognitionRunning) {
                    try {
                      recognition.start();
                      isRecognitionRunning = true;
                    } catch (e) {
                      // Handled cleanly
                    }
                  }
                }, 1000);
              }
            };

            try {
              recognition.start();
              isRecognitionRunning = true;
            } catch (e) {
              // Handled
            }
            recognitionRef.current = recognition;
          } catch (e) {
            // Handled
          }
        }

      } catch (err: any) {
        if (active) {
          setError(err.message || "حدث خطأ أثناء محاولة الاتصال.");
          setIsConnecting(false);
        }
      }
    };

    connectLiveAPI();

    return () => {
      active = false;
      stopAllActiveAudio();
      if (speechSilenceTimerRef.current) clearTimeout(speechSilenceTimerRef.current);
      if (wsRef.current) wsRef.current.close();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      if (workletRef.current) {
        try { workletRef.current.disconnect(); } catch (e) {}
        workletRef.current = null;
      }
      if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch (e) {}
        processorRef.current = null;
      }
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch (e) {}
        analyserRef.current = null;
      }
      outputFiltersRef.current.forEach(n => { try { n.disconnect(); } catch {} });
      outputFiltersRef.current = [];
      if (outputGainRef.current) {
        try { outputGainRef.current.disconnect(); } catch {}
        outputGainRef.current = null;
      }
      outputInputNodeRef.current = null;
      if (aiSpeakingTimeoutRef.current) clearTimeout(aiSpeakingTimeoutRef.current);
      if (inputCtxRef.current) {
        inputCtxRef.current.close().catch(() => {});
        inputCtxRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [activePersona]);

  const resampleTo16000 = (inputData: Float32Array, sampleRate: number, gain = 1.0): Float32Array => {
    if (sampleRate === 16000 && gain === 1.0) return inputData;
    const ratio = sampleRate / 16000;
    const newLength = Math.round(inputData.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const origIndex = i * ratio;
      const lower = Math.floor(origIndex);
      const upper = Math.min(lower + 1, inputData.length - 1);
      const fraction = origIndex - lower;
      const sample = inputData[lower] * (1 - fraction) + inputData[upper] * fraction;
      result[i] = Math.max(-1, Math.min(1, sample * gain));
    }
    return result;
  };

  const pcmToBase64 = (pcmData: Float32Array): string => {
    const int16Data = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      let s = Math.max(-1, Math.min(1, pcmData[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const bytes = new Uint8Array(int16Data.buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  };

  const playAudioChunk = (audioCtx: AudioContext, base64Audio: string) => {
    try {
      if (audioCtx.state === 'closed') return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const { float32Array, sampleRate } = extractStreamingPcmFromBase64(base64Audio);
      if (float32Array.length === 0) return;

      if (!outputInputNodeRef.current || outputInputNodeRef.current.context !== audioCtx || outputGainRef.current?.context !== audioCtx) {
        rebuildOutputPipeline(audioCtx, toneStyleRef.current, volumeRef.current);
      }

      const currentTime = audioCtx.currentTime;
      const JITTER_BUFFER_SEC = 0.065; // 65ms lookahead cushion to prevent packet underruns
      if (nextStartTimeRef.current < currentTime + 0.004) {
        nextStartTimeRef.current = currentTime + JITTER_BUFFER_SEC;
        // Apply brief 3ms soft fade-in ONLY at start of a new burst/after underrun
        const ramp = Math.min(72, float32Array.length);
        for (let i = 0; i < ramp; i++) {
          float32Array[i] *= i / ramp;
        }
      }

      const buffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
      buffer.copyToChannel(float32Array, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      const currentRate = speechRateRef.current || 1.0;
      source.playbackRate.value = currentRate;

      const targetNode = (outputInputNodeRef.current && outputInputNodeRef.current.context === audioCtx)
        ? outputInputNodeRef.current
        : audioCtx.destination;
      source.connect(targetNode);

      // Register source node so we can stop it if interrupted
      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        try { source.disconnect(); } catch {}
        if (activeSourcesRef.current.length === 0) {
          setIsAiSpeaking(false);
          isAiSpeakingRef.current = false;
        }
      };

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration / currentRate;
    } catch (e) {
      logger.error("Audio playback error", e);
    }
  };

  const lastMessage = transcript.length > 0 ? transcript[transcript.length - 1] : null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="bg-surface/90 backdrop-blur-md border border-border/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-3.5 flex items-center gap-4 rounded-2xl w-[320px] md:w-[350px] pointer-events-auto text-right"
          dir="rtl"
        >
          <div className="relative shrink-0">
            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${isConnected ? 'border-emerald-500' : 'border-border'} transition-all ${isAiSpeaking ? 'scale-105 shadow-[0_0_15px_rgba(52,211,153,0.5)]' : ''}`}>
              <img src={getAvatarUrl(activePersona)} alt={activePersona} className="w-full h-full object-cover" />
            </div>
            {isConnected && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-surface rounded-full"></span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-text text-[15px] truncate">{activePersona}</h4>
            <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5 justify-start">
              {isAiSpeaking ? (
                <>
                  <span className="text-emerald-400 font-medium">يتحدث الآن...</span>
                  <span className="flex gap-[2px] h-3 items-end">
                    <span className="w-[2px] bg-emerald-400 rounded-full h-full animate-waveform-1 origin-bottom"></span>
                    <span className="w-[2px] bg-emerald-400 rounded-full h-full animate-waveform-2 origin-bottom"></span>
                    <span className="w-[2px] bg-emerald-400 rounded-full h-full animate-waveform-3 origin-bottom"></span>
                  </span>
                </>
              ) : isMuted ? (
                <span className="text-amber-500">الميكروفون مكتوم</span>
              ) : (
                <span className="text-emerald-500/80">المحادثة نشطة بالخلفية</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "تشغيل الميكروفون" : "كتم الميكروفون"}
              className={`p-2 rounded-xl transition-all cursor-pointer ${isMuted ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'text-muted hover:text-text hover:bg-surface2'}`}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              title="تكبير النافذة"
              className="p-2 rounded-xl text-muted hover:text-text hover:bg-surface2 transition-all cursor-pointer"
            >
              <Maximize2 size={18} />
            </button>
            <button
              onClick={onClose}
              title="إنهاء المكالمة"
              className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              <PhoneOff size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      onPointerDown={() => {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      }}
      className={`fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-[#02040a]/95 backdrop-blur-md overflow-x-hidden overflow-y-auto ${
        isKeyboardOpen ? 'items-start pt-1' : ''
      }`}
      style={viewportStyle}
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`bg-surface border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 relative my-auto ${
          isKeyboardOpen 
            ? 'h-full max-h-full' 
            : 'h-full max-h-[90vh] md:max-h-[80vh]'
        }`}
      >
        <div className="p-3 md:p-4 border-b border-border bg-surface2 flex justify-between items-center gap-3 shrink-0">
          {/* Persona Avatar & Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all duration-300 ${
                isAiSpeaking 
                  ? 'border-emerald-400 scale-105 shadow-[0_0_10px_rgba(52,211,153,0.5)]' 
                  : isConnected 
                    ? 'border-emerald-500' 
                    : 'border-border'
              }`}>
                <img src={getAvatarUrl(activePersona)} alt={activePersona} className="w-full h-full object-cover" />
              </div>
              {isConnected && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-surface rounded-full"></span>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-text truncate flex items-center gap-1.5">
                {activePersona}
                {isAiSpeaking && (
                  <span className="flex gap-[2px] h-3 items-end" title="يتحدث الآن">
                    <span className="w-[1.5px] bg-emerald-400 rounded-full h-full animate-waveform-1 origin-bottom"></span>
                    <span className="w-[1.5px] bg-emerald-400 rounded-full h-full animate-waveform-2 origin-bottom"></span>
                    <span className="w-[1.5px] bg-emerald-400 rounded-full h-full animate-waveform-3 origin-bottom"></span>
                  </span>
                )}
              </h2>
              <p className="text-[11px] md:text-xs text-muted flex items-center gap-1">
                {isConnecting ? (
                  <span className="text-amber-500 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" />
                    جاري الاتصال...
                  </span>
                ) : error ? (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    خطأ بالاتصال
                  </span>
                ) : isConnected ? (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse"></span>
                    متصل ونشط
                  </span>
                ) : (
                  <span className="text-slate-500">غير متصل</span>
                )}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Download Cached Audios ZIP */}
            <button
              onClick={async () => {
                try {
                  await downloadAllCachedAudioZip();
                } catch (e: any) {
                  toast({
                    title: 'تنبيه',
                    message: e?.message || 'لا توجد صوتيات مخزنة بالكاش.',
                    type: 'info'
                  });
                }
              }}
              title="تنزيل جميع الملفات الصوتية المخزنة بالكاش (ZIP)"
              className="p-2 rounded-xl text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
            >
              <Download size={16} />
              <span className="hidden sm:inline">الكاش (ZIP)</span>
            </button>

            {/* Quick Mic Mute Toggle */}
            <button
              id="btn-voice-mute-header"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "تشغيل الميكروفون" : "كتم الميكروفون"}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isMuted 
                  ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25' 
                  : 'text-muted hover:text-text hover:bg-surface3'
              }`}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Focus Mode Toggle Button */}
            <button
              id="btn-toggle-focus-mode"
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isFocusMode 
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' 
                  : 'bg-surface3 text-muted hover:text-text hover:bg-surface4'
              }`}
              title={isFocusMode ? "عرض النصوص والمحادثة" : "تفعيل وضع التركيز الكامل"}
            >
              {isFocusMode ? <MessageSquare size={15} /> : <Sparkles size={15} className="text-emerald-400" />}
              <span className="hidden sm:inline">{isFocusMode ? "عرض النص" : "وضع التركيز"}</span>
            </button>

            {/* Voice & Sound Settings Toggle Button */}
            <button
              id="btn-voice-settings-toggle"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isSettingsOpen 
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' 
                  : 'text-muted hover:text-text hover:bg-surface3'
              }`}
              title="إعدادات الصوت والنبرة"
            >
              <Settings size={18} />
            </button>

            {/* Minimize */}
            <button 
              onClick={() => setIsMinimized(true)} 
              title="تشغيل في الخلفية (تصغير)"
              className="p-2 text-muted hover:text-text hover:bg-surface3 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
            >
              <Minimize2 size={18} />
            </button>

            {/* End Call */}
            <button 
              onClick={onClose} 
              title="إنهاء المكالمة"
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
            >
              <PhoneOff size={18} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-border bg-surface2/60 overflow-hidden shrink-0"
            >
              <div className="p-4 space-y-4 text-right">
                <div className="flex items-center gap-2 mb-1">
                  <Sliders size={16} className="text-indigo-400" />
                  <span className="text-sm font-bold text-text">إعدادات الصوت والنبرة الحية</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Volume Control */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-muted">
                      <span>{volume}%</span>
                      <span className="flex items-center gap-1">
                        <Volume2 size={13} className="text-indigo-400" />
                        حجم صوت المساعد
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <VolumeX size={14} className="text-slate-500 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-full h-1.5 bg-surface3 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <Volume2 size={14} className="text-indigo-400 shrink-0" />
                    </div>
                  </div>

                  {/* Speech Rate Control */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-muted">
                      <span>{speechRate.toFixed(1)}x</span>
                      <span className="flex items-center gap-1">
                        <Gauge size={13} className="text-indigo-400" />
                        سرعة التحدث
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">0.6x</span>
                      <input
                        type="range"
                        min="0.6"
                        max="1.8"
                        step="0.1"
                        value={speechRate}
                        onChange={(e) => setSpeechRate(Number(e.target.value))}
                        className="w-full h-1.5 bg-surface3 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-[10px] text-indigo-400 shrink-0 font-mono">1.8x</span>
                    </div>
                  </div>

                  {/* Microphone Gain / Sensitivity Booster */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-muted">
                      <span className="text-emerald-400 font-mono">{micGain}%</span>
                      <span className="flex items-center gap-1">
                        <Mic size={13} className="text-emerald-400" />
                        حساسية وتضخيم الميكروفون (DSP Gain)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">50%</span>
                      <input
                        type="range"
                        min="50"
                        max="250"
                        step="5"
                        value={micGain}
                        onChange={(e) => setMicGain(Number(e.target.value))}
                        className="w-full h-1.5 bg-surface3 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[10px] text-emerald-400 shrink-0 font-mono">250%</span>
                    </div>
                  </div>

                  {/* Active Audio Model & Telemetry */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-muted">
                      <span className="text-cyan-400 font-mono text-[11px]">{activeLiveModel}</span>
                      <span className="flex items-center gap-1">
                        <Sparkles size={13} className="text-cyan-400" />
                        منظومة البث الصوتي المباشر
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-surface3/60 border border-border/50 text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        16kHz PCM Little-Endian / 24kHz Audio Output
                      </span>
                      <span className="text-muted text-[10px]">DSP VAD متكيف</span>
                    </div>
                  </div>
                </div>

                {/* Tone / Filter presets */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-muted">
                    <span>اختر نبرة الصوت أو المؤثر</span>
                    <span className="flex items-center gap-1">
                      <Music size={13} className="text-indigo-400" />
                      نبرة ومؤثرات الصوت
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-start">
                    {[
                      { id: 'normal', label: 'صوت طبيعي', desc: 'نقي بدون مؤثرات' },
                      { id: 'warm', label: 'دافئ وعميق', desc: 'تضخيم الأصوات المنخفضة' },
                      { id: 'sharp', label: 'حاد ونقي', desc: 'ترشيح لتوضيح مخارج الحروف' },
                      { id: 'robot', label: 'آلي مستقبلي', desc: 'تأثير الخيال العلمي الرنيني' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setToneStyle(t.id as any)}
                        className={`flex flex-col items-start p-2 rounded-xl text-right transition-all cursor-pointer border text-xs min-w-[120px] flex-1 ${
                          toneStyle === t.id
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                            : 'bg-surface3/50 border-border/50 text-muted hover:border-border hover:bg-surface3'
                        }`}
                      >
                        <span className="font-bold">{t.label}</span>
                        <span className="text-[10px] opacity-65 mt-0.5">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isFocusMode ? (
          /* Full Space Voice Focus Screen */
          <div id="voice-focus-panel" className="flex-1 flex flex-col items-center justify-between p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white relative overflow-hidden min-h-[350px]">
            {/* Ambient Animated Blobs */}
            <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-[100px] animate-pulse duration-[8000ms]"></div>
            <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-[100px] animate-pulse duration-[10000ms]"></div>

            {/* Connection Indicator */}
            <div className="text-center z-10 mt-2">
              {isConnecting ? (
                <div className="flex flex-col items-center text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-emerald-400" />
                  <p className="text-xs font-semibold">جاري إنشاء اتصال آمن...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center text-red-400 gap-2">
                  <AlertTriangle size={24} />
                  <p className="text-xs font-bold">{error}</p>
                </div>
              ) : isConnected ? (
                <span className="text-xs tracking-wider text-emerald-400 font-semibold bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20 inline-flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  متصل والذكاء الاصطناعي يستمع إليك...
                </span>
              ) : null}
            </div>

            {/* Speaker Visual representation */}
            <div className="relative flex flex-col items-center justify-center my-auto z-10 py-6">
              
              {/* Audio Ripples */}
              <AnimatePresence>
                {isConnected && isAiSpeaking && (
                  <>
                    <motion.div
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.9, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                      className="absolute w-28 h-28 md:w-36 md:h-36 rounded-full border border-emerald-500/40"
                    />
                    <motion.div
                      initial={{ scale: 1, opacity: 0.4 }}
                      animate={{ scale: 2.4, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "easeOut", delay: 0.4 }}
                      className="absolute w-28 h-28 md:w-36 md:h-36 rounded-full border border-emerald-400/20"
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Central Avatar */}
              <div className={`relative w-28 h-28 md:w-36 md:h-36 rounded-full flex items-center justify-center transition-all duration-500 border-4 ${
                isAiSpeaking 
                  ? 'shadow-[0_0_50px_rgba(52,211,153,0.4)] scale-105 border-emerald-400' 
                  : 'shadow-2xl border-slate-800/80 hover:border-slate-600'
              } bg-slate-900 overflow-hidden`}>
                <img 
                  src={getAvatarUrl(activePersona)} 
                  alt={activePersona} 
                  className="w-full h-full object-cover rounded-full"
                />
                
                {/* Micro speaking badge */}
                {isAiSpeaking && (
                  <span className="absolute bottom-1 right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-950 animate-bounce">
                    <Volume2 size={14} className="text-white" />
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-white mt-6 tracking-wide drop-shadow-md">{activePersona}</h3>
              <p className="text-xs text-slate-400 mt-1">{persona?.description || 'مساعد صوتي ذكي'}</p>

              {/* Dynamic Real-Time Audio Sensor & Voice Activity Equalizer */}
              <div className="flex flex-col items-center gap-2 mt-4 z-10 w-full max-w-sm">
                {isMicPermissionDenied || micPermissionStatus === 'denied' ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-3 bg-gradient-to-b from-amber-950/90 to-amber-900/80 border border-amber-500/50 rounded-2xl text-amber-200 text-xs text-center max-w-md shadow-2xl backdrop-blur-md animate-fade-in">
                    <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                      <ShieldAlert size={18} className="text-amber-400 shrink-0 animate-pulse" />
                      <span>إذن الميكروفون محظور في إعدادات المتصفح</span>
                    </div>
                    <div className="text-[11px] text-slate-200 leading-relaxed text-right space-y-1 my-1">
                      <p className="font-semibold text-amber-200">لتوجيه المتصفح والسماح بالتحدث الصوتي المباشر:</p>
                      <ol className="list-decimal list-inside text-slate-300 space-y-1">
                        <li>اضغط على أيقونة <b>القفل 🔒</b> أو <b>الميكروفون 🎙️</b> بجوار عنوان الصفحة أعلى المتصفح.</li>
                        <li>اختر <b>"إعدادات الموقع" (Site Settings)</b> أو <b>"الأذونات"</b>.</li>
                        <li>قم بتغيير إذن الميكروفون إلى <b>"سماح" (Allow)</b>.</li>
                      </ol>
                    </div>
                    <button
                      onClick={async () => {
                        const status = await checkMicrophonePermissionStatus();
                        setMicPermissionStatus(status);
                        try {
                          if (micSetupRef.current) {
                            const stream = await micSetupRef.current();
                            if (stream) {
                              setIsMicPermissionDenied(false);
                              setMicPermissionStatus('granted');
                            }
                          } else {
                            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                            if (s) {
                              setIsMicPermissionDenied(false);
                              setMicPermissionStatus('granted');
                            }
                          }
                        } catch (e) {
                          // Handled
                        }
                      }}
                      className="mt-1 px-4 py-2 bg-amber-500/30 hover:bg-amber-500/40 text-amber-100 border border-amber-500/50 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                    >
                      <RefreshCw size={14} className="animate-spin-slow" />
                      <span>إعادة الفحص والبدء الآن</span>
                    </button>
                  </div>
                ) : !mediaStreamRef.current ? (
                  /* Automatic Immediate Activation Proposal Window */
                  <div className="flex flex-col items-center gap-2 px-4 py-3.5 bg-gradient-to-b from-emerald-950/90 to-slate-900/90 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs text-center max-w-md shadow-2xl backdrop-blur-md animate-fade-in">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                      <Sparkles size={18} className="text-emerald-400 shrink-0 animate-pulse" />
                      <span>اقتراح تفعيل الميكروفون المباشر</span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">
                      الذكاء الاصطناعي جاهز للاستماع والتحدث معك بصوت طبيعي تفاعلي. هل تسمح بتفعيل الميكروفون وتوصيل الصوت الآن؟
                    </p>
                    <div className="flex items-center gap-2 mt-1 w-full justify-center">
                      <button
                        onClick={async () => {
                          try {
                            if (inputCtxRef.current && inputCtxRef.current.state === 'suspended') {
                              await inputCtxRef.current.resume();
                            }
                            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                              await audioCtxRef.current.resume();
                            }
                            if (micSetupRef.current) {
                              const stream = await micSetupRef.current();
                              if (stream) {
                                setIsMicPermissionDenied(false);
                                setMicPermissionStatus('granted');
                              }
                            } else {
                              const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                              if (s) {
                                setIsMicPermissionDenied(false);
                                setMicPermissionStatus('granted');
                              }
                            }
                          } catch (e) {
                            logger.warn("Activation proposal tap error:", e);
                          }
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all transform hover:scale-105 cursor-pointer flex items-center gap-1.5"
                      >
                        <Mic size={15} />
                        <span>تفعيل الميكروفون وتوصيل الصوت الآن ⚡</span>
                      </button>
                    </div>
                  </div>
                ) : isMuted ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-400 text-xs">
                    <MicOff size={13} />
                    <span>الميكروفون مكتوم حالياً</span>
                  </div>
                ) : isUserSpeaking ? (
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    <div className="flex items-center gap-2 px-3.5 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 text-xs font-semibold animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      <Mic size={14} className="text-emerald-400 animate-bounce" />
                      <span>يتم استشعار صوتك بنشاط ({userMicLevel}%)</span>
                    </div>
                    {/* Live Equalizer Waveform */}
                    <div className="flex items-center justify-center gap-1 h-6 px-4 py-1 bg-slate-900/90 rounded-full border border-emerald-500/40 shadow-inner">
                      {[15, 35, 60, 95, 100, 75, 45, 20].map((base, idx) => (
                        <span 
                          key={idx}
                          className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                          style={{
                            height: `${Math.max(4, Math.min(22, (base * userMicLevel) / 60))}px`,
                            opacity: 0.6 + (userMicLevel / 250)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/60 border border-slate-700/50 rounded-full text-slate-400 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>مستشعر الصوت الذكي يستمع بدقة (16kHz Ultra DSP)</span>
                  </div>
                )}

                {/* Real-Time Live Speech Recognition Interim Caption */}
                {liveInterimCaption && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="px-3.5 py-1.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 text-center max-w-full shadow-lg"
                  >
                    <span className="text-[10px] text-emerald-400 font-bold block mb-0.5">استشعار الكلام الفوري:</span>
                    "{liveInterimCaption}"
                  </motion.div>
                )}
              </div>
            </div>

            {/* Smart Subtitles HUD overlay */}
            <div className="w-full max-w-lg px-4 mb-24 z-10 text-center min-h-[64px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                {lastMessage ? (
                  <motion.div
                    key={lastMessage.text}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed max-w-full inline-block shadow-xl ${
                      lastMessage.role === 'user' 
                        ? 'bg-slate-800/85 text-slate-300 border border-slate-700/40' 
                        : 'bg-emerald-950/85 text-emerald-200 border border-emerald-500/30'
                    }`}
                  >
                    <span className="font-bold text-[10px] opacity-75 block mb-1">
                      {lastMessage.role === 'user' ? 'أنت' : activePersona}
                    </span>
                    {lastMessage.text}
                  </motion.div>
                ) : (
                  <p className="text-xs text-slate-500 italic">ابدأ التحدث باللغة العربية، أنا بانتظارك...</p>
                )}
              </AnimatePresence>
            </div>

            {/* Immersive Floating Controls */}
            <div id="voice-controls-panel" className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/90 backdrop-blur-xl px-6 py-3 rounded-full border border-slate-800/80 shadow-2xl z-20">
              <button
                id="btn-voice-mute-single"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "تشغيل الميكروفون" : "كتم الميكروفون"}
                className={`p-3 rounded-full transition-all cursor-pointer ${
                  isMuted 
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button
                id="btn-voice-end-single"
                onClick={onClose}
                title="إنهاء المكالمة"
                className="p-3.5 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all shadow-lg hover:scale-105 cursor-pointer flex items-center justify-center"
              >
                <PhoneOff size={22} />
              </button>

              <button
                id="btn-voice-chat-mode-single"
                onClick={() => setIsFocusMode(false)}
                title="التبديل إلى عرض النص والكتابة"
                className="p-3 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-full transition-all cursor-pointer flex items-center justify-center"
              >
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
        ) : (
          /* Traditional Layout - Now beautifully unified to single-panel chat list to maximize vertical space */
          <div className="flex-1 flex flex-col bg-bg overflow-hidden relative">
            {/* Inline warning/connecting states inside chat area */}
            {error && (
              <div className="p-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center gap-2 justify-center shrink-0 animate-fade-in">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            )}
            {isConnecting && !error && (
              <div className="p-3 bg-amber-500/5 border-b border-amber-500/10 text-amber-500 text-xs flex items-center gap-2 justify-center shrink-0 animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                <span>جاري الاتصال الصوتي الحي...</span>
              </div>
            )}

            {/* Large Chat Transcript Area (Maximizes height) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted text-sm opacity-60 space-y-3 p-6 text-center">
                  <Sparkles size={24} className="text-emerald-500 animate-pulse" />
                  <p className="max-w-[320px] leading-relaxed">
                    ابدأ بالتحدث باللغة العربية أو اكتب رسالة نصية بالأسفل لمشاركتها مع المساعد مباشرة...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transcript.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-surface2 border border-border text-text rounded-tr-none' 
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-50 rounded-tl-none'
                      }`}>
                        <div className="text-[10px] opacity-50 font-bold mb-1">
                          {msg.role === 'user' ? 'أنت' : activePersona}
                        </div>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
            
            {/* Input Area */}
            <LiveChatInput
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              onSendText={sendTextMessage}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
};
