/**
 * @license
 * MindMirror Sanctuary of Minds (حرم العقول والحوار الفلسفي النقي)
 * 
 * An invisible UI designed for profound human contemplation and intimate dialogue
 * with humanity's greatest minds: Socrates, Da Vinci, Einstein, Nietzsche, Ibn Khaldun, Jobs.
 * Fully supports default dark theme and calculator-gray theme with pure WCAG-compliant contrast.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mic, Send, Volume2, Square, Settings as SettingsIcon, RotateCcw } from 'lucide-react';
import { Message, PersonaData } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from './Toast';

interface SanctuaryViewProps {
  activePersona: string;
  setActivePersona: (name: string) => void;
  personas: Record<string, PersonaData>;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onSpeak: (text: string, personaName: string) => void;
  isSpeaking: boolean;
  onStopAudio: () => void;
  onOpenSettings: () => void;
  theme?: 'light' | 'dark' | 'system' | 'calculator-gray' | 'plain-text';
}

// Curated list of timeless minds for the top presence line
const PRIMARY_MINDS = [
  'سقراط',
  'ليوناردو دا فينشي',
  'ألبرت آينشتاين',
  'نيتشه',
  'ابن خلدون',
  'ستيف جوبز'
];

export const SanctuaryView: React.FC<SanctuaryViewProps> = ({
  activePersona,
  setActivePersona,
  personas,
  messages,
  isLoading,
  onSendMessage,
  onClearChat,
  onSpeak,
  isSpeaking,
  onStopAudio,
  onOpenSettings,
  theme
}) => {
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  const isPlainText = theme === 'plain-text';
  const isCalculator = theme === 'calculator-gray';

  const currentPersona: PersonaData = personas[activePersona] || personas['سقراط'] || {
    label: 'سقراط',
    prompt: '',
    title: 'فيلسوف التساؤل واليقظة',
    era: 'أثينا، القرن الخامس قبل الميلاد',
    greeting: 'أنا لا أعلم إلا أمراً واحداً: وهو أنني لا أعلم شيئاً. ما هو التساؤل الذي يُقلق روحك وتبحث عن نوره اليوم؟',
    suggestions: ['ما هي الفضيلة الحقيقية؟', 'كيف يعرف الإنسان ذاته؟', 'ما حقيقة الزمان؟'],
    color: '#D4AF37',
    avatarUrl: '/portraits/socrates.jpg',
    voice: 'Charon',
    ttsTone: 'تأملي'
  };

  // Scroll smoothly when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle textarea auto-height
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Speech Recognition (Microphone) with seamless native support
  const handleToggleVoiceInput = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: 'الإدخال الصوتي غير مدعوم',
        message: 'المتصفح لا يدعم ميزة الإدخال الصوتي المباشر. يرجى استخدام متصفح Chrome أو كتابة تساؤلك.',
        type: 'info'
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setInputText(transcript);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      setIsRecording(false);
    }
  };

  const avatar = getAvatarUrl(activePersona, currentPersona.avatarUrl);

  return (
    <div 
      className={`min-h-screen font-sans flex flex-col relative overflow-x-hidden transition-colors duration-200 ${
        isPlainText
          ? 'bg-white text-black'
          : isCalculator 
            ? 'bg-[#F7F7F7] text-[#333333] selection:bg-[#C9C9C9]/50' 
            : 'bg-[#090A0D] text-[#EBE7DF] selection:bg-[#D4AF37]/20'
      }`} 
      dir="rtl"
    >
      
      {/* 1. Ambient Background (Only in Sanctuary default dark mode) */}
      {!isCalculator && !isPlainText && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div 
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-10 transition-colors duration-1000"
            style={{ backgroundColor: currentPersona.color || '#D4AF37' }}
          />
          <div className="absolute inset-0 bg-radial from-transparent via-[#090A0D]/60 to-[#090A0D]" />
        </div>
      )}

      {/* 2. Top Sanctuary Ribbon: The Quiet Presence of Great Minds */}
      <header className={`relative z-20 w-full px-4 sm:px-6 py-3 sm:py-4 border-b transition-colors ${
        isPlainText
          ? 'bg-white border-black text-black'
          : isCalculator 
            ? 'bg-[#E6E6E6] border-[#CFCFCF] text-[#333333]' 
            : 'border-stone-800/40 text-stone-300 backdrop-blur-sm'
      }`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          
          {/* Subtle Brand & Philosophy Mark */}
          <div className="flex items-center gap-2">
            <span className={`text-base sm:text-lg tracking-wider font-bold ${
              isPlainText ? 'text-black font-sans' : isCalculator ? 'text-[#333333] font-sans' : 'font-serif text-stone-300'
            }`}>
              {isPlainText ? 'حرم العقول (نص صافٍ)' : 'حرم العقول'}
            </span>
            {!isPlainText && (
              <>
                <span className={isCalculator ? 'text-[#999999]' : 'text-stone-600 font-serif text-xs'}>·</span>
                <span className={`text-xs tracking-widest hidden sm:inline ${
                  isCalculator ? 'text-[#666666] font-sans' : 'text-stone-500 font-serif'
                }`}>
                  الحوار الإنساني الخالد
                </span>
              </>
            )}
          </div>

          {/* Celestial Minds Navigation */}
          <nav className="flex items-center gap-2 overflow-x-auto scrollbar-custom py-1 px-1">
            {PRIMARY_MINDS.map((mindName) => {
              const isActive = activePersona === mindName;
              if (isPlainText) {
                return (
                  <button
                    key={mindName}
                    onClick={() => setActivePersona(mindName)}
                    className={`text-xs px-2.5 py-1 cursor-pointer border border-black ${
                      isActive ? 'bg-black text-white font-bold' : 'bg-white text-black hover:bg-neutral-100'
                    }`}
                  >
                    [ {mindName} ]
                  </button>
                );
              }
              if (isCalculator) {
                return (
                  <button
                    key={mindName}
                    onClick={() => setActivePersona(mindName)}
                    className={`text-xs sm:text-sm whitespace-nowrap transition-all duration-150 cursor-pointer px-3 py-1.5 rounded-[14px] font-sans ${
                      isActive
                        ? 'bg-[#C9C9C9] text-[#333333] font-bold border border-[#CFCFCF] shadow-[0_2px_4px_rgba(0,0,0,0.08)]'
                        : 'bg-[#F2F2F2] text-[#666666] hover:bg-[#E0E0E0] hover:text-[#333333] border border-transparent'
                    }`}
                  >
                    {mindName}
                  </button>
                );
              }
              return (
                <button
                  key={mindName}
                  onClick={() => setActivePersona(mindName)}
                  className={`text-sm whitespace-nowrap transition-all duration-300 font-serif cursor-pointer ${
                    isActive
                      ? 'text-[#E5C158] font-bold border-b border-[#E5C158]/60 pb-1'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {mindName}
                </button>
              );
            })}
          </nav>

          {/* Quiet Utility Affordances (Clear conversation & Settings) */}
          <div className={`flex items-center gap-2 ${isPlainText ? 'text-black' : isCalculator ? 'text-[#666666]' : 'text-stone-500'}`}>
            {messages.length > 0 && (
              <button
                onClick={onClearChat}
                title="بدء حوار جديد"
                className={`cursor-pointer ${
                  isPlainText
                    ? 'border border-black px-2.5 py-1 text-xs bg-white text-black hover:bg-neutral-100 flex items-center gap-1.5'
                    : isCalculator 
                      ? 'p-2 rounded-[14px] bg-[#F2F2F2] hover:bg-[#E0E0E0] text-[#333333] border border-[#CFCFCF]' 
                      : 'p-2 rounded-[14px] hover:text-stone-300'
                }`}
              >
                <RotateCcw size={isPlainText ? 13 : 15} />
                {isPlainText && <span>[حوار جديد]</span>}
              </button>
            )}
            <button
              onClick={onOpenSettings}
              title="الإعدادات المتقدمة"
              className={`cursor-pointer ${
                isPlainText
                  ? 'border border-black px-2.5 py-1 text-xs bg-white text-black hover:bg-neutral-100 flex items-center gap-1.5'
                  : isCalculator 
                    ? 'p-2 rounded-[14px] bg-[#F2F2F2] hover:bg-[#E0E0E0] text-[#333333] border border-[#CFCFCF]' 
                    : 'p-2 rounded-[14px] hover:text-stone-300'
              }`}
            >
              <SettingsIcon size={isPlainText ? 13 : 15} />
              {isPlainText && <span>[الإعدادات]</span>}
            </button>
          </div>
        </div>
      </header>

      {/* 3. Central Canvas: Pure Dialogue & Intimate Presence */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-36 flex flex-col justify-start">
        
        {/* Initial Welcome & Thinker Presence Screen */}
        {messages.length === 0 ? (
          <motion.div
            key={activePersona}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8 sm:py-12"
          >
            {/* Thinker Fine-Art Portrait */}
            <div className="relative mb-6 group">
              <div 
                className={`w-36 h-36 md:w-44 md:h-44 overflow-hidden border relative z-10 ${
                  isPlainText
                    ? 'border-black bg-white rounded-none'
                    : isCalculator 
                      ? 'border-[#CFCFCF] shadow-[0_2px_4px_rgba(0,0,0,0.08)] bg-[#E6E6E6] rounded-full' 
                      : 'border-stone-700/60 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-full'
                }`}
              >
                <img
                  src={avatar}
                  alt={activePersona}
                  className={`w-full h-full object-cover transition-all ${
                    isPlainText
                      ? 'grayscale contrast-125'
                      : 'grayscale contrast-110 group-hover:grayscale-0 duration-700'
                  }`}
                />
              </div>
              {!isCalculator && !isPlainText && (
                <div 
                  className="absolute inset-0 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"
                  style={{ backgroundColor: currentPersona.color || '#D4AF37' }}
                />
              )}
            </div>

            {/* Thinker Name, Title, and Era */}
            <h1 className={`text-3xl md:text-5xl font-bold tracking-tight mb-2 ${
              isPlainText ? 'text-black font-sans' : isCalculator ? 'text-[#333333] font-sans' : 'text-stone-100 font-serif'
            }`}>
              {activePersona}
            </h1>
            <div className={`flex items-center justify-center gap-2 text-sm md:text-base mb-6 ${
              isPlainText ? 'text-black font-sans font-bold' : isCalculator ? 'text-[#666666] font-sans' : 'text-stone-400 font-serif'
            }`}>
              <span>{currentPersona.title || currentPersona.label}</span>
              {currentPersona.era && (
                <>
                  <span className={isPlainText ? 'text-black' : isCalculator ? 'text-[#999999]' : 'text-stone-600'}>·</span>
                  <span>{currentPersona.era}</span>
                </>
              )}
            </div>

            {/* Opening Philosophical Inscription */}
            <div className={`max-w-xl mx-auto px-4 mb-8 ${
              isPlainText 
                ? 'border-y border-black py-4 bg-white' 
                : isCalculator 
                  ? 'bg-[#E6E6E6] border border-[#CFCFCF] rounded-[14px] p-5 shadow-[0_2px_4px_rgba(0,0,0,0.08)]' 
                  : ''
            }`}>
              <p 
                className={`text-lg md:text-xl leading-[2] md:leading-[2.2] tracking-wide ${
                  isPlainText ? 'text-black font-sans' : isCalculator ? 'text-[#333333] font-sans italic' : 'text-stone-200 font-serif italic'
                }`}
                style={{ fontFamily: isPlainText ? 'system-ui, sans-serif' : isCalculator ? 'inherit' : "'Amiri', serif" }}
              >
                "{currentPersona.greeting}"
              </p>
            </div>

            {/* Suggested Reflection Seeds */}
            {currentPersona.suggestions && currentPersona.suggestions.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl mx-auto">
                <span className={`text-xs font-bold w-full text-center mb-1 ${
                  isPlainText ? 'text-black' : isCalculator ? 'text-[#666666]' : 'text-stone-500'
                }`}>
                  تأملات مقترحة:
                </span>
                {currentPersona.suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(suggestion)}
                    className={`transition-all cursor-pointer py-1.5 px-3 text-xs md:text-sm ${
                      isPlainText
                        ? 'border border-black bg-white text-black hover:bg-neutral-100 font-sans'
                        : isCalculator 
                          ? 'bg-[#F2F2F2] hover:bg-[#E0E0E0] active:scale-[0.96] text-[#333333] border border-[#CFCFCF] rounded-[14px] shadow-[0_2px_4px_rgba(0,0,0,0.08)]' 
                          : 'text-stone-400 hover:text-[#E5C158] border-b border-stone-800 hover:border-[#E5C158]/50'
                    }`}
                  >
                    {isPlainText ? `[ ${suggestion} ]` : `«${suggestion}»`}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* Active Dialogue Canvas */
          <div className="space-y-8 sm:space-y-10 pt-2">
            
            {/* Top Anchor of Mind during ongoing dialogue */}
            <div className={`flex items-center justify-center gap-3 pb-3 border-b text-sm ${
              isPlainText
                ? 'border-black text-black font-sans font-bold'
                : isCalculator 
                  ? 'border-[#CFCFCF] text-[#666666] font-sans' 
                  : 'border-stone-800/40 text-stone-400 font-serif'
            }`}>
              <img src={avatar} alt={activePersona} className={`w-8 h-8 object-cover border ${
                isPlainText ? 'border-black rounded-none grayscale contrast-125' : isCalculator ? 'rounded-full border-[#CFCFCF]' : 'rounded-full border-stone-700'
              }`} />
              <span className={`font-bold ${isPlainText ? 'text-black' : isCalculator ? 'text-[#333333]' : 'text-stone-200'}`}>{activePersona}</span>
              <span className={isPlainText ? 'text-black' : isCalculator ? 'text-[#999999]' : 'text-stone-600'}>·</span>
              <span className="text-xs">{currentPersona.title || currentPersona.label}</span>
            </div>

            {/* Dialogue Turns */}
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: isPlainText ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: isPlainText ? 0 : 0.35, ease: 'easeOut' }}
                  className={`flex flex-col ${isUser ? 'items-start' : 'items-stretch'}`}
                >
                  {isUser ? (
                    /* User Reflection */
                    <div className={`w-full p-4 sm:p-5 text-base md:text-lg leading-relaxed ${
                      isPlainText
                        ? 'border border-black bg-white text-black font-sans'
                        : isCalculator 
                          ? 'bg-[#D8D8D8] border border-[#CFCFCF] rounded-[14px] text-[#333333] shadow-[0_2px_4px_rgba(0,0,0,0.08)] font-sans' 
                          : 'bg-stone-900/40 border border-stone-800/60 rounded-[14px] text-stone-300 font-serif'
                    }`}>
                      <span className={`text-xs block mb-1 font-bold ${
                        isPlainText ? 'text-black' : isCalculator ? 'text-[#666666] font-mono' : 'text-stone-500 font-mono'
                      }`}>
                        تساؤلك:
                      </span>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  ) : (
                    /* The Thinker's Presence & Words */
                    <div className={`space-y-4 p-4 sm:p-5 border ${
                      isPlainText
                        ? 'border border-black bg-white text-black font-sans'
                        : isCalculator 
                          ? 'bg-[#E6E6E6] border-[#CFCFCF] rounded-[14px] text-[#333333] shadow-[0_2px_4px_rgba(0,0,0,0.08)]' 
                          : 'bg-transparent border-transparent rounded-[14px] text-stone-100'
                    }`}>
                      <div className={`flex items-center justify-between ${isPlainText ? 'border-b border-black pb-2' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-base ${
                            isPlainText ? 'text-black font-sans' : isCalculator ? 'text-[#333333] font-sans' : 'font-serif text-stone-100'
                          }`}>
                            {msg.persona || activePersona}
                          </span>
                        </div>
                        
                        {/* Audio Contemplation Button */}
                        {msg.text && (
                          <button
                            onClick={() => {
                              if (isSpeaking) {
                                onStopAudio();
                              } else {
                                onSpeak(msg.text, msg.persona || activePersona);
                              }
                            }}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 transition-colors cursor-pointer ${
                              isPlainText
                                ? 'border border-black bg-white text-black hover:bg-neutral-100 font-sans'
                                : isCalculator 
                                  ? 'bg-[#F2F2F2] hover:bg-[#E0E0E0] active:scale-[0.96] text-[#333333] border border-[#CFCFCF] rounded-[14px]' 
                                  : 'font-serif text-stone-400 hover:text-[#E5C158]'
                            }`}
                            title="الاستماع بنبرة المتحدث"
                          >
                            {isSpeaking ? (
                              <>
                                <Square size={13} className={isPlainText ? 'text-black' : isCalculator ? 'text-[#333333]' : 'text-[#E5C158] animate-pulse'} />
                                <span>{isPlainText ? '[إيقاف الصوت]' : 'إيقاف الصوت'}</span>
                              </>
                            ) : (
                              <>
                                <Volume2 size={13} className={isPlainText ? 'text-black' : ''} />
                                <span>{isPlainText ? '[استماع للنص]' : 'استماع للنبرة'}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* The Words */}
                      <div 
                        className={`text-base md:text-lg leading-[2.2] md:leading-[2.4] space-y-4 ${
                          isPlainText 
                            ? 'text-black font-sans' 
                            : isCalculator 
                              ? 'text-[#333333] font-sans' 
                              : 'font-serif text-stone-100 selection:bg-[#D4AF37]/20 sanctuary-prose'
                        }`}
                        style={{ fontFamily: isPlainText ? 'system-ui, sans-serif' : isCalculator ? 'inherit' : "'Amiri', serif" }}
                      >
                        {msg.text ? (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className={`mb-4 leading-[2.2] ${isPlainText ? 'text-black' : isCalculator ? 'text-[#333333]' : 'text-stone-200'}`}>{children}</p>,
                              strong: ({ children }) => <strong className={`font-bold ${isPlainText ? 'text-black' : isCalculator ? 'text-[#111111]' : 'text-[#E5C158] font-serif'}`}>{children}</strong>,
                              blockquote: ({ children }) => (
                                <blockquote className={`border-r-2 pr-4 my-3 italic ${
                                  isPlainText 
                                    ? 'border-black text-black pl-2' 
                                    : isCalculator 
                                      ? 'border-[#999999] text-[#555555] bg-[#D8D8D8]/50 p-2 rounded-r-[14px]' 
                                      : 'border-[#E5C158]/60 text-stone-300 font-serif'
                                }`}>
                                  {children}
                                </blockquote>
                              ),
                              ul: ({ children }) => <ul className="list-disc list-inside space-y-2 my-3 pr-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside space-y-2 my-3 pr-2">{children}</ol>,
                              li: ({ children }) => <li className="leading-[2.1]">{children}</li>,
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        ) : (
                          /* Single dignified thinking indicator while streaming initial token */
                          <div className={`flex items-center gap-3 text-sm py-2 ${
                            isPlainText ? 'text-black font-sans' : isCalculator ? 'text-[#666666]' : 'text-stone-400 font-serif'
                          }`}>
                            {!isPlainText && <div className={`w-2 h-2 rounded-full animate-ping ${isCalculator ? 'bg-[#666666]' : 'bg-[#D4AF37]'}`} />}
                            <span className="italic">
                              {isPlainText ? `[جارٍ التحميل والتفكير من قِبل ${activePersona}...]` : `${activePersona} يتأمل في صميم تساؤلك...`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* 4. The Sanctuary Input */}
      <footer className={`fixed bottom-0 left-0 right-0 z-30 p-3 sm:p-4 ${
        isPlainText 
          ? 'bg-white border-t border-black pointer-events-auto' 
          : isCalculator 
            ? 'pointer-events-none bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 to-transparent' 
            : 'pointer-events-none bg-gradient-to-t from-[#090A0D] via-[#090A0D]/90 to-transparent'
      }`}>
        <div className="max-w-2xl mx-auto w-full pointer-events-auto">
          {isPlainText && (
            <label htmlFor="sanctuary-plain-textarea" className="block text-xs font-bold mb-1 text-black">
              اكتب تساؤلك أو رسالتك لـ {activePersona}:
            </label>
          )}
          <div className={`relative border flex items-end p-2 transition-all ${
            isPlainText
              ? 'bg-white border-black'
              : isCalculator 
                ? 'bg-[#E6E6E6] border-[#CFCFCF] rounded-[14px] shadow-[0_2px_4px_rgba(0,0,0,0.08)] focus-within:border-[#999999]' 
                : 'bg-[#14151A]/95 border-stone-800/80 rounded-[14px] shadow-2xl backdrop-blur-xl focus-within:border-[#D4AF37]/50 focus-within:ring-1 focus-within:ring-[#D4AF37]/20'
          }`}>
            
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              title={isRecording ? "إيقاف التسجيل الصوتي" : "تحدث بصوتك مباشرة"}
              className={`p-2.5 sm:p-3 transition-all cursor-pointer ${
                isPlainText
                  ? 'border border-black bg-white text-black hover:bg-neutral-100 text-xs font-sans flex items-center gap-1.5'
                  : isRecording 
                    ? 'bg-red-500/20 text-red-500 animate-pulse rounded-[14px]' 
                    : isCalculator 
                      ? 'bg-[#F2F2F2] hover:bg-[#E0E0E0] active:scale-[0.96] text-[#333333] border border-[#CFCFCF] rounded-[14px]' 
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 rounded-[14px]'
              }`}
            >
              <Mic size={18} />
              {isPlainText && <span>{isRecording ? '[إيقاف]' : '[تحدث]'}</span>}
            </button>

            {/* Reflection Textarea */}
            <textarea
              id={isPlainText ? "sanctuary-plain-textarea" : undefined}
              ref={textareaRef}
              value={inputText}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={`حاور ${activePersona}... اطرح تساؤلك الفلسفي أو تأملك`}
              className={`flex-1 border-none px-3 py-2.5 text-base resize-none outline-none leading-relaxed max-h-44 scrollbar-hide ${
                isPlainText
                  ? 'bg-white text-black placeholder-neutral-500 font-sans'
                  : isCalculator 
                    ? 'bg-[#D8D8D8] border border-[#CFCFCF] text-[#333333] placeholder-[#777777] rounded-[14px] mx-1.5 font-sans' 
                    : 'bg-transparent text-stone-100 placeholder-stone-500 font-serif'
              }`}
              style={{ fontFamily: isPlainText ? 'system-ui, sans-serif' : isCalculator ? 'inherit' : "'Amiri', serif" }}
            />

            {/* Send Reflection Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              title="إرسال التساؤل"
              className={`p-2.5 sm:p-3 transition-all cursor-pointer ${
                isPlainText
                  ? 'border border-black bg-black text-white hover:bg-neutral-800 text-xs font-bold font-sans disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5'
                  : inputText.trim() && !isLoading
                    ? isCalculator
                      ? 'bg-[#C9C9C9] hover:bg-[#BFBFBF] active:scale-[0.96] text-[#333333] border border-[#CFCFCF] rounded-[14px]'
                      : 'text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-[14px]'
                    : isCalculator
                      ? 'bg-[#E0E0E0] text-[#999999] opacity-60 cursor-not-allowed border border-[#CFCFCF] rounded-[14px]'
                      : 'text-stone-600 opacity-40 cursor-not-allowed rounded-[14px]'
              }`}
            >
              <Send size={18} className="transform rotate-180" />
              {isPlainText && <span>[إرسال]</span>}
            </button>
          </div>

          <p className={`text-center text-[11px] mt-2 ${
            isPlainText ? 'text-neutral-600 font-sans' : isCalculator ? 'text-[#666666] font-sans' : 'text-stone-600 font-serif'
          }`}>
            {isPlainText 
              ? 'واجهة نصية نقية (Plain Text) · اضغط Enter للإرسال · Shift+Enter لسطر جديد' 
              : 'حوار حر ومباشر مع روح المعرفة الإنسانية · تكنولوجيا غير مرئية'}
          </p>
        </div>
      </footer>
    </div>
  );
};
