import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Eye, EyeOff, Play, Pause, RotateCcw, Clock, Volume2, VolumeX, Sparkles, 
  X, Check, Flame, Award, Heart, Shield, Bell, ChevronUp, ChevronDown, Plus,
  Users, UserPlus, Brain, User
} from 'lucide-react';
import { useToast } from './Toast';
import { Tooltip } from './Tooltip';
import { PersonaData } from '../types';

interface FocusModeOverlayProps {
  isZenMode: boolean;
  setIsZenMode: (val: boolean) => void;
  onOpenAgiWorkspace?: () => void;
  personas?: Record<string, PersonaData>;
  activePersona?: string;
  setActivePersona?: (name: string) => void;
  onAddNewPersona?: (name: string) => void;
}

export const FocusModeOverlay: React.FC<FocusModeOverlayProps> = ({
  isZenMode,
  setIsZenMode,
  onOpenAgiWorkspace,
  personas,
  activePersona,
  setActivePersona,
  onAddNewPersona
}) => {
  const { toast } = useToast();
  
  // Zen Mode Persona Management States
  const [showPersonaMenu, setShowPersonaMenu] = useState<boolean>(false);
  const [showAddPersonaModal, setShowAddPersonaModal] = useState<boolean>(false);
  const [newPersonaInput, setNewPersonaInput] = useState<string>('');

  // Focus Timer States
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [timerPaused, setTimerPaused] = useState<boolean>(false);
  const [initialDurationMinutes, setInitialDurationMinutes] = useState<number>(25);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('25');
  const [showTimerConfig, setShowTimerConfig] = useState<boolean>(false);
  const [showCompletionModal, setShowCompletionModal] = useState<boolean>(false);

  // Ambient Audio Generator (Web Audio API)
  const [ambientSound, setAmbientSound] = useState<'none' | 'binaural' | 'whitenoise' | 'rain'>('none');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  // Timer interval effect
  useEffect(() => {
    let interval: any = null;
    if (timerActive && !timerPaused && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerActive && secondsLeft === 0) {
      // Timer finished!
      setTimerActive(false);
      setTimerPaused(false);
      stopAmbientSound();
      playGentleBell();
      setShowCompletionModal(true);
      toast({
        title: 'أحسنت! اكتملت جلسة التركيز العميق 🎯',
        message: `لقد أتممت ${initialDurationMinutes} دقيقة من الانغماس القرائي والمعرفي.`,
        type: 'success'
      });
    }
    return () => clearInterval(interval);
  }, [timerActive, timerPaused, secondsLeft, initialDurationMinutes]);

  // Audio cleanup on unmount to preserve battery and prevent audio leaks
  useEffect(() => {
    return () => {
      stopAmbientSound();
    };
  }, []);

  // Handle start timer
  const handleStartTimer = (mins: number) => {
    setInitialDurationMinutes(mins);
    setSecondsLeft(mins * 60);
    setTimerActive(true);
    setTimerPaused(false);
    setShowTimerConfig(false);
    setIsZenMode(true); // Automatically hide sidebars when timer starts

    toast({
      title: `تم بدء مؤقت التركيز (${mins} دقيقة)`,
      message: 'تم إخفاء التشويش وتفعيل مساحة الانغماس المباشرة.',
      type: 'info'
    });
  };

  const handlePauseResume = () => {
    setTimerPaused(!timerPaused);
  };

  const handleStopTimer = () => {
    setTimerActive(false);
    setTimerPaused(false);
    setSecondsLeft(initialDurationMinutes * 60);
    stopAmbientSound();
  };

  const handleAddFiveMinutes = () => {
    setSecondsLeft((prev) => prev + 300);
    toast({
      title: 'تمت إضافة 5 دقائق',
      message: 'واصل تركيزك العميق.',
      type: 'info'
    });
  };

  // Web Audio API Gentle Chime
  const playGentleBell = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major Chord
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.15 + 2.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 2.6);
      });
      setTimeout(() => {
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      }, 3300);
    } catch (e) {
      // AudioContext may be restricted by autoplay policy until user gesture
    }
  };

  // Ambient Sound Synthesizer (Binaural / Noise / Rain)
  const toggleAmbientSound = (type: 'none' | 'binaural' | 'whitenoise' | 'rain') => {
    stopAmbientSound();
    if (type === 'none') {
      setAmbientSound('none');
      return;
    }

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      if (type === 'binaural') {
        // Alpha binaural beats (200Hz & 210Hz)
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);
        const gain = ctx.createGain();

        oscL.frequency.value = 200;
        oscR.frequency.value = 210;
        gain.gain.value = 0.08;

        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(gain);
        gain.connect(ctx.destination);

        oscL.start();
        oscR.start();
        noiseNodeRef.current = merger;
      } else if (type === 'whitenoise' || type === 'rain') {
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
        filter.frequency.value = type === 'rain' ? 800 : 1200;

        const gain = ctx.createGain();
        gain.gain.value = 0.05;

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        whiteNoise.start();
        noiseNodeRef.current = whiteNoise;
      }

      setAmbientSound(type);
    } catch (e) {
      console.error('Ambient audio error:', e);
    }
  };

  const stopAmbientSound = () => {
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;
    }
    setAmbientSound('none');
  };

  // Format time display MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Zen Mode Floating Control Bar - Positioned at Top Left to NEVER overlap ChatInputArea */}
      {isZenMode && (
        <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-[100] flex items-center gap-2 dir-rtl">
          {/* Main Zen Mode Toggle Button */}
          <Tooltip content="خروج من وضع التركيز" subContent="تعطيل وضع التركيز واستعادة القوائم الجانبية">
            <button
              onClick={() => setIsZenMode(false)}
              className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-purple-600/90 hover:bg-purple-600 border border-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] backdrop-blur-xl transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 active:scale-95"
            >
              <Eye size={15} className="text-purple-200 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">خروج من وضع التركيز</span>
            </button>
          </Tooltip>

          {/* Timer Config Trigger Button */}
          {!timerActive && (
            <Tooltip content="مؤقت التركيز" subContent="مؤقت زمني ذكي لمساعدتك على الانغماس المعرفي">
              <button
                onClick={() => {
                  setShowTimerConfig(!showTimerConfig);
                  setShowPersonaMenu(false);
                  setShowAddPersonaModal(false);
                }}
                className="p-2 rounded-xl bg-surface/90 border border-border/80 text-purple-400 hover:text-purple-300 hover:border-purple-500/80 transition-all shadow-lg cursor-pointer flex items-center justify-center backdrop-blur-xl"
              >
                <Clock size={15} />
              </button>
            </Tooltip>
          )}

          {/* Button 1: Browse/Switch Personas from within Zen Mode */}
          {personas && (
            <div className="relative">
              <Tooltip content="تصفح الشخصيات" subContent="التبديل بين الشخصيات المعرفية مباشرة دون الخروج من وضع التركيز">
                <button
                  type="button"
                  onClick={() => {
                    setShowPersonaMenu(!showPersonaMenu);
                    setShowTimerConfig(false);
                    setShowAddPersonaModal(false);
                  }}
                  className={`p-2 rounded-xl border transition-all shadow-lg cursor-pointer flex items-center justify-center backdrop-blur-xl ${
                    showPersonaMenu 
                      ? 'bg-accent/20 border-accent text-accent shadow-[0_0_15px_rgba(0,212,255,0.3)]' 
                      : 'bg-surface/90 border-border/80 text-muted hover:text-accent hover:border-accent/60'
                  }`}
                >
                  <Users size={15} />
                </button>
              </Tooltip>

              {showPersonaMenu && (
                <div className="absolute top-11 left-0 z-[110] w-64 bg-surface/95 backdrop-blur-2xl border border-border shadow-2xl rounded-2xl p-2 max-h-72 overflow-y-auto scrollbar-custom dir-rtl animate-in fade-in slide-in-from-top-2">
                  <div className="px-2 py-1 text-[10px] font-bold text-accent tracking-wider border-b border-border/40 pb-1.5 mb-1.5 flex items-center gap-1">
                    <Sparkles size={11} />
                    <span>تصفح الشخصيات المعرفية</span>
                  </div>
                  {Object.keys(personas).filter(p => p !== 'debate' && p !== 'group_question' && p !== 'osint_room' && p !== 'trend_live').map((name) => {
                    const isActive = activePersona === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          if (setActivePersona) {
                            setActivePersona(name);
                            setShowPersonaMenu(false);
                            toast({
                              title: `تم التبديل لشخصية "${name}"`,
                              message: 'أنت تتحدث الآن مع هذه الشخصية داخل وضع التركيز.',
                              type: 'success'
                            });
                          }
                        }}
                        className={`w-full text-start px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between hover:bg-surface2 cursor-pointer ${
                          isActive ? 'text-accent font-bold bg-accent/10 border border-accent/30' : 'text-text hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden truncate">
                          <Brain size={13} className={isActive ? 'text-accent' : 'text-muted'} />
                          <span className="truncate">{name}</span>
                        </div>
                        {isActive && <Check size={13} className="text-accent shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Button 2: Add New Persona from within Zen Mode */}
          {onAddNewPersona && (
            <div className="relative">
              <Tooltip content="إضافة شخصية جديدة" subContent="إنشاء عقل جديد مباشرة من داخل وضع التركيز">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPersonaModal(!showAddPersonaModal);
                    setShowPersonaMenu(false);
                    setShowTimerConfig(false);
                  }}
                  className={`p-2 rounded-xl border transition-all shadow-lg cursor-pointer flex items-center justify-center backdrop-blur-xl ${
                    showAddPersonaModal 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                      : 'bg-surface/90 border-border/80 text-muted hover:text-emerald-400 hover:border-emerald-500/60'
                  }`}
                >
                  <UserPlus size={15} />
                </button>
              </Tooltip>

              {showAddPersonaModal && (
                <div className="absolute top-11 left-0 z-[110] w-72 bg-surface/95 backdrop-blur-2xl border border-emerald-500/40 shadow-2xl rounded-2xl p-3.5 dir-rtl animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 mb-3">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                      <UserPlus size={14} />
                      <span>إضافة شخصية جديدة</span>
                    </div>
                    <button onClick={() => setShowAddPersonaModal(false)} className="text-muted hover:text-text p-0.5">
                      <X size={14} />
                    </button>
                  </div>

                  <input
                    autoFocus
                    type="text"
                    value={newPersonaInput}
                    onChange={(e) => setNewPersonaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPersonaInput.trim()) {
                        onAddNewPersona(newPersonaInput.trim());
                        toast({
                          title: `تمت إضافة الشخصية: "${newPersonaInput.trim()}"`,
                          message: 'تحدث معها الآن مباشرة داخل وضع التركيز.',
                          type: 'success'
                        });
                        setNewPersonaInput('');
                        setShowAddPersonaModal(false);
                      }
                    }}
                    placeholder="أدخل اسم الشخصية..."
                    className="w-full bg-surface2 border border-border/80 rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-emerald-500 mb-3"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddPersonaModal(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-text bg-surface2 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (newPersonaInput.trim()) {
                          onAddNewPersona(newPersonaInput.trim());
                          toast({
                            title: `تمت إضافة الشخصية: "${newPersonaInput.trim()}"`,
                            message: 'تحدث معها الآن مباشرة داخل وضع التركيز.',
                            type: 'success'
                          });
                          setNewPersonaInput('');
                          setShowAddPersonaModal(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-bg bg-emerald-400 hover:bg-emerald-300 cursor-pointer transition-all"
                    >
                      إضافة الشخصية
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Timer Pill when Active */}
          {timerActive && (
            <motion.div
              layout
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-surface/95 border border-purple-500/60 backdrop-blur-xl rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-2xl text-xs"
            >
              <Clock size={14} className="text-purple-400 animate-spin-slow shrink-0" />
              <span className="font-mono font-bold text-text text-xs tracking-wider">
                {formatTime(secondsLeft)}
              </span>

              <button
                onClick={handlePauseResume}
                className="p-1 rounded-lg hover:bg-surface2 text-muted hover:text-text cursor-pointer transition-colors"
                title={timerPaused ? 'استئناف' : 'إيقاف مؤقت'}
              >
                {timerPaused ? <Play size={12} className="text-emerald-400" /> : <Pause size={12} />}
              </button>

              <button
                onClick={handleAddFiveMinutes}
                className="p-1 rounded-lg hover:bg-surface2 text-muted hover:text-accent font-mono text-[10px] cursor-pointer transition-colors"
                title="إضافة 5 دقائق"
              >
                +5m
              </button>

              <button
                onClick={handleStopTimer}
                className="p-1 rounded-lg hover:bg-surface2 text-muted hover:text-rose-400 cursor-pointer transition-colors"
                title="إنهاء المؤقت"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Floating Timer Pill in Normal Mode if Timer is running */}
      {!isZenMode && timerActive && (
        <div className="fixed top-14 left-4 z-[90] flex items-center gap-2 dir-rtl">
          <motion.div
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface/95 border border-purple-500/60 backdrop-blur-xl rounded-xl px-3 py-1 flex items-center gap-2 shadow-xl text-xs"
          >
            <Clock size={13} className="text-purple-400 animate-spin-slow shrink-0" />
            <span className="font-mono font-bold text-text text-xs tracking-wider">
              {formatTime(secondsLeft)}
            </span>
            <button
              onClick={handleStopTimer}
              className="p-0.5 rounded hover:bg-surface2 text-muted hover:text-rose-400 cursor-pointer transition-colors"
              title="إنهاء المؤقت"
            >
              <X size={12} />
            </button>
          </motion.div>
        </div>
      )}

      {/* Timer Configuration Popup - Top-aligned below controls */}
      <AnimatePresence>
        {showTimerConfig && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="fixed top-14 left-3 sm:top-16 sm:left-4 z-[101] bg-surface border border-purple-500/40 rounded-3xl p-5 shadow-2xl max-w-sm w-[calc(100vw-2rem)] sm:w-96 backdrop-blur-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 mb-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Clock size={20} />
                <h3 className="font-bold text-sm text-text">إعداد مؤقت التركيز والانغماس</h3>
              </div>
              <button onClick={() => setShowTimerConfig(false)} className="text-muted hover:text-text p-1">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-muted mb-4 leading-relaxed">
              اختر المدى الزمني الذي ترغب بالانغماس خلاله في القراءة والكتابة. سيتم إخفاء التشويش تلقائياً.
            </p>

            {/* Quick Mins Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[15, 25, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleStartTimer(mins)}
                  className="py-2.5 px-3 rounded-2xl bg-surface2/60 border border-border hover:border-purple-500 text-text text-xs font-bold transition-all hover:bg-purple-500/10 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                >
                  <span className="font-mono text-sm text-purple-400">{mins}m</span>
                  <span className="text-[10px] text-muted">
                    {mins === 15 ? 'خاطف' : mins === 25 ? 'بومودورو' : mins === 45 ? 'عميق' : 'مطلق'}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom Minutes Input */}
            <div className="flex items-center gap-2 mb-4 bg-surface2/40 border border-border/70 p-2 rounded-2xl">
              <span className="text-xs font-bold text-muted px-2">مخصص (دقائق):</span>
              <input
                type="number"
                min="1"
                max="180"
                value={customMinutesInput}
                onChange={(e) => setCustomMinutesInput(e.target.value)}
                className="w-16 bg-surface border border-border rounded-xl px-2 py-1 text-xs text-center font-mono font-bold text-text focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => {
                  const val = parseInt(customMinutesInput, 10);
                  if (val > 0) handleStartTimer(val);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-1.5 rounded-xl transition-all shadow-sm"
              >
                بدء المؤقت
              </button>
            </div>

            {/* Ambient Sound Generators */}
            <div className="pt-3 border-t border-border/50">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Volume2 size={14} className="text-purple-400" />
                  <span>الصوت الخلفي المحفز للتركيز:</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                <button
                  onClick={() => toggleAmbientSound('none')}
                  className={`py-1.5 px-2 rounded-xl border transition-all ${ambientSound === 'none' ? 'bg-surface2 border-purple-500 text-purple-300' : 'bg-surface/50 border-border/50 text-muted'}`}
                >
                  صامت
                </button>

                <button
                  onClick={() => toggleAmbientSound('binaural')}
                  className={`py-1.5 px-2 rounded-xl border transition-all ${ambientSound === 'binaural' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-surface/50 border-border/50 text-muted'}`}
                >
                  موجات بيتا 🧠
                </button>

                <button
                  onClick={() => toggleAmbientSound('whitenoise')}
                  className={`py-1.5 px-2 rounded-xl border transition-all ${ambientSound === 'whitenoise' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-surface/50 border-border/50 text-muted'}`}
                >
                  ضوضاء بيضاء 📻
                </button>

                <button
                  onClick={() => toggleAmbientSound('rain')}
                  className={`py-1.5 px-2 rounded-xl border transition-all ${ambientSound === 'rain' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-surface/50 border-border/50 text-muted'}`}
                >
                  صوت المطر 🌧️
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Accomplishment Modal */}
      <AnimatePresence>
        {showCompletionModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              className="bg-surface border border-purple-500/60 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
              dir="rtl"
            >
              <div className="w-16 h-16 rounded-3xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center mx-auto mb-4 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
                <Award size={36} className="animate-bounce" />
              </div>

              <h2 className="text-xl font-bold text-text mb-2">إنجاز معرفي مكتمل! 🎯</h2>
              <p className="text-xs sm:text-sm text-muted mb-6 leading-relaxed">
                تهانينا! أتممت <span className="font-bold text-purple-400">{initialDurationMinutes} دقيقة</span> كاملة من التركيز والانغماس المعرفي العميق دون أي مشتتات.
              </p>

              <div className="bg-surface2/60 border border-border/60 rounded-2xl p-4 mb-6 text-xs text-text space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted">المدة الإجمالية:</span>
                  <span className="font-mono font-bold text-purple-300">{initialDurationMinutes} دقيقة</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">حالة الذهن:</span>
                  <span className="font-bold text-emerald-400">انغماس عالي الوعي 🧠</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    handleStartTimer(initialDurationMinutes);
                  }}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={15} />
                  <span>بدء دورة أخرى</span>
                </button>

                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    setIsZenMode(false);
                  }}
                  className="flex-1 bg-surface2 hover:bg-surface2/80 border border-border text-text font-bold py-3 px-4 rounded-2xl text-xs transition-all"
                >
                  استعادة القوائم الكاملة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
