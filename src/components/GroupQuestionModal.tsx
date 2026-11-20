import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle, Users, Check, Sparkles, BookOpen, GraduationCap, Globe } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';

interface GroupQuestionModalProps {
  show: boolean;
  onClose: () => void;
  personas: Record<string, any>;
  isLoading: boolean;
  initialParticipants?: string[];
  initialQuestion?: string;
  startGroupQuestion: (
    participants: string[], 
    question: string, 
    sessionStyle: string,
    newsRadar?: { enabled: boolean; mode: 'realtime' | 'archival' }
  ) => void;
  startLiveGroupQuestion?: (
    participants: string[],
    question: string,
    sessionStyle: string
  ) => void;
}

export default function GroupQuestionModal({
  show,
  onClose,
  personas,
  isLoading,
  initialParticipants,
  initialQuestion,
  startGroupQuestion,
  startLiveGroupQuestion
}: GroupQuestionModalProps) {
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [sessionStyle, setSessionStyle] = useState('sequential'); // 'sequential', 'cooperative', 'lecture'
  const [newsRadarEnabled, setNewsRadarEnabled] = useState(false);
  const [newsRadarMode, setNewsRadarMode] = useState<'realtime' | 'archival'>('realtime');

  useEffect(() => {
    if (show) {
      if (initialParticipants && initialParticipants.length > 0) {
        setSelectedPersonas(initialParticipants);
      } else {
        // By default, select first 3 personas
        const allKeys = Object.keys(personas).filter(p => p !== 'debate' && p !== 'group_question');
        setSelectedPersonas(allKeys.slice(0, 3));
      }
      setQuestion(initialQuestion || '');
    }
  }, [show, personas, initialParticipants, initialQuestion]);

  if (!show) return null;

  const allKeys = Object.keys(personas).filter(p => p !== 'debate' && p !== 'group_question');

  const togglePersona = (name: string) => {
    if (selectedPersonas.includes(name)) {
      if (selectedPersonas.length > 1) {
        setSelectedPersonas(selectedPersonas.filter(p => p !== name));
      }
    } else {
      setSelectedPersonas([...selectedPersonas, name]);
    }
  };

  const selectAll = () => {
    setSelectedPersonas(allKeys);
  };

  const selectNone = () => {
    if (allKeys.length > 0) {
      setSelectedPersonas([allKeys[0]]);
    }
  };

  const handleSubmit = () => {
    if (!question.trim() || selectedPersonas.length === 0) return;
    startGroupQuestion(selectedPersonas, question, sessionStyle, {
      enabled: newsRadarEnabled,
      mode: newsRadarMode
    });
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.95, y: 20 }}
          className="bg-surface border border-border rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl relative my-auto custom-scrollbar"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-muted hover:text-text transition-colors bg-bg/50 rounded-full p-1.5 cursor-pointer"
          >
            <X size={20} />
          </button>
          
          {/* Header */}
          <div className="flex items-center gap-4 mb-6 md:mb-8 mt-2 md:mt-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <GraduationCap size={24} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-text flex items-center gap-2">
                ندوة المعرفة <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">سؤال جماعي</span>
              </h3>
              <p className="text-xs md:text-sm text-muted mt-1">اطرح سؤالاً فكرياً أو موضوعاً معرفياً لتقوم نخبة من الشخصيات بإلقاء محاضرات ورؤى متعاقبة تخدم فكرتك بانسجام وتكامل.</p>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Personas Selector */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-muted flex items-center gap-2">
                  <Users size={16} className="text-accent" />
                  اختر الشخصيات المشاركة ({selectedPersonas.length})
                </label>
                <div className="flex gap-2 text-xs">
                  <button 
                    onClick={selectAll} 
                    className="text-accent hover:underline font-semibold cursor-pointer"
                  >
                    اختيار الكل
                  </button>
                  <span className="text-muted/30">|</span>
                  <button 
                    onClick={selectNone} 
                    className="text-muted hover:text-text font-semibold cursor-pointer"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[180px] overflow-y-auto p-1 custom-scrollbar">
                {allKeys.map((name) => {
                  const isSelected = selectedPersonas.includes(name);
                  const persona = personas[name];
                  return (
                    <button
                      key={name}
                      onClick={() => togglePersona(name)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-start transition-all duration-200 cursor-pointer relative ${
                        isSelected 
                          ? 'bg-emerald-500/5 border-emerald-500/40 text-text shadow-[0_0_10px_rgba(16,185,129,0.05)]' 
                          : 'bg-surface2 border-border text-muted hover:border-muted/50 hover:text-text'
                      }`}
                    >
                      <img 
                        src={getAvatarUrl(name)} 
                        alt={name} 
                        className="w-8 h-8 rounded-full border border-border object-cover shrink-0" 
                      />
                      <span className="text-xs font-bold truncate pe-1">{persona.label || name}</span>
                      
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 bg-emerald-500 text-bg rounded-full p-0.5 shadow-sm">
                          <Check size={8} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Session style selection */}
            <div>
              <label className="block text-sm font-bold text-muted mb-3 flex items-center gap-2">
                <BookOpen size={16} className="text-accent" />
                نمط الجلسة المعرفية
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'sequential',
                    title: 'محاضرات متعاقبة رصينة',
                    desc: 'تقدم كل شخصية رؤيتها بشكل مستقل ومستفيض تلو الأخرى.'
                  },
                  {
                    id: 'cooperative',
                    title: 'ندوة تكاملية تفاعلية',
                    desc: 'تبني كل شخصية على إجابة من سبقتها لإثراء المعرفة بصورة تراكمية.'
                  },
                  {
                    id: 'lecture',
                    title: 'تفسيرات وبحوث مكثفة',
                    desc: 'إجابات مركزة ومختصرة تهتم بالأدلة والشواهد المنطقية المباشرة.'
                  }
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSessionStyle(style.id)}
                    className={`p-3 rounded-2xl border text-start transition-all duration-200 cursor-pointer flex flex-col gap-1.5 ${
                      sessionStyle === style.id
                        ? 'bg-accent/5 border-accent text-accent shadow-md'
                        : 'bg-surface2 border-border text-muted hover:border-muted/50'
                    }`}
                  >
                    <span className="text-xs font-extrabold flex items-center gap-1.5">
                      {sessionStyle === style.id && <Sparkles size={12} className="text-accent animate-pulse" />}
                      {style.title}
                    </span>
                    <span className="text-[10px] leading-relaxed text-muted/80">{style.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* News Radar Feature */}
            <div className="bg-surface2/40 border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${newsRadarEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-bg text-muted border border-border/50'}`}>
                    <Globe size={18} className={newsRadarEnabled ? "animate-spin-slow" : ""} />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-xs md:text-sm font-bold text-text truncate">رادار الأخبار الذكي والتقصي الرقمي</h4>
                    <p className="text-[10px] md:text-[11px] text-muted leading-relaxed truncate">ربط نقاشات الندوة بمصادر ويب حية وبحوث عاجلة أو أرشيفية</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewsRadarEnabled(!newsRadarEnabled)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${newsRadarEnabled ? 'bg-emerald-500' : 'bg-bg border-border'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${newsRadarEnabled ? 'translate-x-0' : 'translate-x-5'}`}
                  />
                </button>
              </div>

              {newsRadarEnabled && (
                <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewsRadarMode('realtime')}
                    className={`p-2.5 rounded-xl border text-start transition-all duration-200 cursor-pointer flex flex-col gap-1 ${
                      newsRadarMode === 'realtime'
                        ? 'bg-emerald-500/5 border-emerald-500/40 text-emerald-400'
                        : 'bg-bg border-border text-muted hover:border-muted/30'
                    }`}
                  >
                    <span className="text-[11px] font-bold flex items-center gap-1.5">
                      ⏱️ رادار اللحظة (الآن)
                    </span>
                    <span className="text-[9px] leading-normal text-muted/80">رصد آخر الأنباء والمستجدات العاجلة بربط تاريخ ووقت اليوم في البحث.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewsRadarMode('archival')}
                    className={`p-2.5 rounded-xl border text-start transition-all duration-200 cursor-pointer flex flex-col gap-1 ${
                      newsRadarMode === 'archival'
                        ? 'bg-emerald-500/5 border-emerald-500/40 text-emerald-400'
                        : 'bg-bg border-border text-muted hover:border-muted/30'
                    }`}
                  >
                    <span className="text-[11px] font-bold flex items-center gap-1.5">
                      📚 تقصي أرشيفي عمومي
                    </span>
                    <span className="text-[9px] leading-normal text-muted/80">البحث في أعماق الويب طوال العصور الرقمية والأرشيفية لتتبع تاريخية القضايا.</span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Question Textarea */}
            <div>
              <label className="block text-sm font-bold text-muted mb-2 flex items-center gap-2">
                <HelpCircle size={16} className="text-accent" />
                سؤالك المعرفي أو قضية البحث
              </label>
              <textarea 
                value={question} 
                onChange={e => setQuestion(e.target.value)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (question.trim() && selectedPersonas.length > 0) {
                      handleSubmit();
                    }
                  }
                }}
                placeholder="مثال: كيف يمكن للفلسفة والتقنية المعاصرة مساعدة الإنسان في العثور على المعنى والسلام الداخلي في عصر الضوضاء الرقمية المفرطة؟" 
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-text text-sm focus:border-accent outline-none resize-none h-28 transition-colors shadow-inner placeholder:text-muted/40"
              />
              <p className="text-[10px] text-muted mt-2 text-start">اضغط Enter للبدء، أو Shift+Enter لسطر جديد</p>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8 border-t border-border/50 pt-6">
            <button 
              onClick={onClose} 
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border text-text hover:bg-surface2 transition-colors font-bold text-sm cursor-pointer"
            >
              إلغاء
            </button>
            {startLiveGroupQuestion && (
              <button 
                onClick={() => {
                  if (question.trim() && selectedPersonas.length > 0) {
                    startLiveGroupQuestion(selectedPersonas, question, sessionStyle);
                  }
                }}
                disabled={!question.trim() || selectedPersonas.length === 0} 
                className="flex-1 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.1)] flex items-center justify-center gap-2 text-sm"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                ندوة حية (صوتية)
              </button>
            )}
            <button 
              onClick={handleSubmit} 
              disabled={!question.trim() || selectedPersonas.length === 0} 
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-bg font-extrabold hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <GraduationCap size={16} />
              بدء ندوة (نصياً)
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
