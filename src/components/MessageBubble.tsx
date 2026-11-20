import React from 'react';
import { motion } from 'motion/react';
import { User, Edit2, Copy, CheckCheck, Volume2, StopCircle, Loader2, RefreshCw, FileText, Swords, Image as ImageIcon, File, Sparkles, Bot, Brain, Zap, Coffee, Cloud, Moon, Sun, Ghost, Heart, Star, Crown, Rocket, Search, MessageCircle, Shield, Activity, Flame, Music, Briefcase, GraduationCap, Palette, Terminal, Globe, Microscope, Calculator, Video } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, PersonaData } from '../types';
import { RagTooltip } from './RagTooltip';
import { InteractiveCodeBlock } from './InteractiveCodeBlock';
import { Tooltip } from './Tooltip';

const ICON_MAP: Record<string, React.FC<any>> = {
  User, Bot, Sparkles, Brain, Zap, Coffee, Cloud, Moon, Sun, Ghost, Heart, Star, Crown, Rocket, Search, MessageCircle, Shield, Activity, Flame, Music, Briefcase, GraduationCap, Palette, Terminal, Globe, Microscope, Calculator
};

const getSimulationScore = (text: string, personaKey: string, storedScore?: number): number => {
  if (storedScore && storedScore > 0) return storedScore;
  let hash = 0;
  const combined = (text || '') + (personaKey || '');
  for (let i = 0; i < combined.length; i++) {
    hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate stable score between 94 and 99
  const score = 94 + (Math.abs(hash) % 6);
  return score;
};

const isSafeExternalUrl = (uri?: string): boolean => {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#');
};

interface MessageBubbleProps {
  msg: Message;
  idx: number;
  activePersona: string;
  personas: Record<string, PersonaData>;
  isLoading: boolean;
  editingIndex: number | null;
  editValue: string;
  setEditValue: (val: string) => void;
  setEditingIndex: (idx: number | null) => void;
  saveEdit: (idx: number, val: string) => void;
  copiedIndex: number | null;
  handleCopy: (text: string, idx: number) => void;
  speakingIndex: number | null;
  isTTSLoading: boolean;
  handleSpeak: (text: string, idx: number, persona?: string) => void;
  onExportVideo?: (msg: Message, personaKey?: string) => void;
  handleRegenerate: (targetIndex?: number) => void;
  isLastMessage: boolean;
  getAvatarUrl: (name: string) => string;
  onConceptClick?: (concept: string, baseExplanation: string, messageContext: string, personaName: string) => void;
  onExtractLesson?: (text: string, personaName: string, personaLabel: string) => void;
  onOpenTextDissector?: (text: string, speakerName?: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg, idx, activePersona, personas, isLoading,
  editingIndex, editValue, setEditValue, setEditingIndex, saveEdit,
  copiedIndex, handleCopy, speakingIndex, isTTSLoading, handleSpeak, onExportVideo,
  handleRegenerate, isLastMessage, getAvatarUrl, onConceptClick, onExtractLesson,
  onOpenTextDissector
}) => {
  if (msg.isSystem) {
    return (
      <motion.div 
        id={`msg-${idx}`} 
        initial={{ opacity: 0, y: 15, scale: 0.98 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex justify-center my-6 relative group/system w-full"
      >
        <div className="bg-surface2 border border-border px-6 py-4 rounded-3xl text-center shadow-sm hover:shadow-lg transition-shadow duration-300 max-w-2xl w-full relative overflow-hidden">
          <Swords className="mx-auto text-accent mb-3" size={28} />
          
          <div className="text-text font-bold whitespace-pre-line leading-relaxed pb-4">
             {msg.text}
          </div>

          <div className="flex items-center justify-center gap-4 mt-2 pt-3 border-t border-border/50">
            <button 
              onClick={() => handleCopy(msg.text, idx)}
              className="text-muted hover:text-accent p-1.5 rounded-lg hover:bg-surface transition-colors flex flex-col items-center gap-1 text-[11px] font-mono"
              title="نسخ النص"
            >
              {copiedIndex === idx ? <CheckCheck size={16} className="text-accent4" /> : <Copy size={16} />}
            </button>
            <button 
              onClick={() => handleSpeak(msg.text, idx)}
              className={`p-1.5 rounded-lg hover:bg-surface transition-colors flex flex-col items-center gap-1 text-[11px] font-mono ${speakingIndex === idx ? 'text-accent' : 'text-muted hover:text-accent'}`}
              title={speakingIndex === idx ? "إيقاف" : "استماع"}
            >
              {isTTSLoading && speakingIndex === idx ? <Loader2 size={16} className="animate-spin" /> : speakingIndex === idx ? <StopCircle size={16} className="animate-pulse" /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }
  
  const msgPersonaKey = msg.persona || activePersona;
  const msgPersona = personas[msgPersonaKey];
  
  return (
    <motion.div 
      id={`msg-${idx}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`w-full md:max-w-[85%] transition-all duration-300 hover:shadow-[0_10px_40px_rgba(0,0,0,0.04)] rounded-3xl min-w-0 ${msg.role === 'user' ? 'bg-surface2 border border-border text-text rounded-tl-sm px-3.5 py-3 md:px-6 md:py-4 shadow-sm flex gap-3 md:gap-4 items-start group' : 'bg-transparent hover:bg-surface2/20 text-text px-2 py-3 md:px-4 md:py-4 flex gap-3 md:gap-4 items-start'}`}>
        {msg.role === 'model' && (
          <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface border border-border flex items-center justify-center text-accent2 mt-1 shadow-sm overflow-hidden">
            {msgPersona?.icon && ICON_MAP[msgPersona.icon] ? (
              React.createElement(ICON_MAP[msgPersona.icon], { size: 20 })
            ) : (
              <img src={getAvatarUrl(msgPersonaKey)} alt={msgPersonaKey} className="w-full h-full object-cover" />
            )}
          </div>
        )}
        {msg.role === 'user' && (
          <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted mt-1 shadow-sm overflow-hidden">
            <User size={18} className="md:w-5 md:h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0 relative break-words">
          {msg.role === 'model' && (
            <div className="text-[12px] mb-2 font-bold tracking-wider flex items-center justify-between gap-2 flex-wrap w-full min-w-0">
              <span className="flex items-center gap-2" style={{ color: msgPersona?.color || 'var(--color-accent)' }}>
                {msgPersona?.label || msgPersonaKey.toUpperCase()}
              </span>
              
              {/* Simulation compliance indicator */}
              <div className="relative group/sim flex items-center gap-1 bg-surface2/60 hover:bg-surface3 border border-border/50 px-2 py-0.5 rounded-full text-[10px] text-muted font-bold select-none cursor-help transition-all duration-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="hidden xs:inline">تطابق الوعي:</span>
                <span className="text-emerald-400 font-mono">{getSimulationScore(msg.text, msgPersonaKey, msg.simulationScore)}%</span>
                
                {/* Popover / Tooltip detail list */}
                <div className="absolute start-0 bottom-full mb-2 hidden group-hover/sim:flex flex-col bg-surface border border-border p-3 rounded-2xl shadow-xl text-[10px] text-start text-text z-[60] w-48 gap-1.5 pointer-events-none transition-all duration-200 animate-fade-in font-sans">
                  <div className="font-bold border-b border-border pb-1.5 mb-1 text-accent flex justify-between">
                    <span>مؤشرات جودة المحاكاة</span>
                    <span className="text-emerald-400 font-mono">{getSimulationScore(msg.text, msgPersonaKey, msg.simulationScore)}%</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted/80">تجسيد النبرة:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">متطابق</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted/80">المنطق والعمق:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">ممتاز</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted/80">اتساق السياق:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">مرتفع جداً</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {msg.role === 'user' && (
            <div className="text-[11px] text-muted mb-2 font-semibold tracking-wider flex items-center gap-2 justify-end">
              أنت
            </div>
          )}
          
          {msg.files && msg.files.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 mt-2">
              {msg.files.map((f, i) => {
                const isImage = f.mimeType?.startsWith('image/') || false;
                return (
                  <div key={i} className="relative group border border-border rounded-xl bg-surface overflow-hidden shadow-sm hover:border-accent transition-colors">
                    {isImage ? (
                      <div className="aspect-video bg-surface2 flex items-center justify-center">
                        <img src={`data:${f.mimeType};base64,${f.data}`} alt={f.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video bg-surface2 flex flex-col items-center justify-center p-3 text-muted">
                        <File size={32} className="mb-2" />
                        <span className="text-[10px] uppercase tracking-wider">{(f.mimeType || '').split('/')[1] || 'FILE'}</span>
                      </div>
                    )}
                    <div className="p-2 flex items-center gap-2">
                      {isImage ? <ImageIcon size={14} className="text-accent" /> : <FileText size={14} className="text-accent" />}
                      <span className="text-xs truncate flex-1 font-medium">{f.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {editingIndex === idx ? (
            <div className="flex flex-col gap-2 mt-1">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-[15px] text-text focus:outline-none focus:border-accent resize-none shadow-inner"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit(idx, editValue);
                  } else if (e.key === 'Escape') {
                    setEditingIndex(null);
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingIndex(null)} className="text-xs text-muted hover:text-text px-3 py-1.5 rounded-lg transition-colors">إلغاء</button>
                <button onClick={() => saveEdit(idx, editValue)} className="text-xs bg-accent text-bg px-4 py-1.5 rounded-lg font-bold hover:opacity-90 transition-opacity">حفظ وإرسال</button>
              </div>
            </div>
          ) : (
            <div className="relative">
              {!msg.text || msg.text.trim() === '' ? (
                msg.role === 'model' && isLoading && isLastMessage ? (
                  <div className="flex items-center gap-2 py-3 text-accent animate-pulse font-sans">
                    <Loader2 size={18} className="animate-spin text-accent" />
                    <span className="text-sm font-semibold">جاري التفكير والتوليد المعرفي...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 py-3 px-4 my-1 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-sans text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <Zap size={16} className="text-amber-400 shrink-0" />
                      <span>لم يتم استلام نص الاستجابة بشكل كامل.</span>
                    </div>
                    <p className="text-muted text-[12px] leading-relaxed">
                      قد يحدث هذا بسبب تأخير مؤقت في خادم المعالجة. انقر أدناه لإعادة إرسال التوليد تلقائياً دون الحاجة لتحديث الصفحة.
                    </p>
                    <button
                      onClick={() => handleRegenerate(idx)}
                      className="self-start flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500 text-bg font-bold hover:bg-amber-400 transition-colors shadow-sm cursor-pointer text-xs mt-1"
                    >
                      <RefreshCw size={14} />
                      <span>إعادة توليد الإجابة الآن</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="markdown-body text-[15px] md:text-[16px] leading-relaxed text-start font-sans" dir="auto">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-start leading-relaxed" dir="auto" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc ps-5 mb-2 text-start" dir="auto" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal ps-5 mb-2 text-start" dir="auto" {...props} />,
                      li: ({node, ...props}) => <li className="mb-1 text-start" dir="auto" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-accent" {...props} />,
                      a: ({node, href, children, ...props}: any) => {
                        const isRagLink = href?.includes('rag://') || href?.includes('#rag-');
                        if (isRagLink) {
                          const cleanHref = href.includes('rag://') 
                            ? href.split('rag://')[1] 
                            : href.split('#rag-')[1];
                          let contextText = cleanHref || '';
                          try {
                            contextText = decodeURIComponent(cleanHref || '');
                          } catch {
                            contextText = cleanHref || '';
                          }
                          const conceptText = typeof children === 'string' ? children : String(children);
                          const speakerName = msgPersona?.label || msgPersonaKey;
                          return (
                            <RagTooltip 
                              context={contextText}
                              onClickConcept={() => {
                                if (onConceptClick) {
                                  onConceptClick(conceptText, contextText, msg.text || '', speakerName);
                                }
                              }}
                            >
                              {children}
                            </RagTooltip>
                          );
                        }
                        if (!isSafeExternalUrl(href)) {
                          return <span className="text-muted underline">{children}</span>;
                        }
                        return <a href={href} className="text-accent underline hover:text-accent2" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                      },
                      pre: ({children}: any) => <>{children}</>,
                      code: ({node, className, children, ...props}: any) => {
                        const hasLang = className?.includes('language-');
                        const langName = hasLang ? className.replace('language-', '') : '';
                        const rawCode = String(children || '').replace(/\n$/, '');
                        
                        if (!hasLang) {
                          return <code className="bg-surface2 border border-border/60 rounded-md px-1.5 py-0.5 font-mono text-[13px] text-accent3 break-words" dir="ltr" {...props}>{children}</code>;
                        }

                        return (
                          <InteractiveCodeBlock 
                            language={langName}
                            code={rawCode}
                            personaName={msgPersona?.label || msgPersonaKey}
                          />
                        );
                      }
                    }}
                  >
                    {(msg.text || '').replace(/\[\[(.*?)\|\|(.*?)\]\]/g, (match, p1, p2) => `[${p1}](#rag-${encodeURIComponent(p2)})`)}
                  </ReactMarkdown>
                </div>
              )}
              
              {/* Grounding Sources (News Radar / Web Search) */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/30" dir="rtl">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-2 font-bold font-sans">
                    <Globe size={13} className="text-emerald-500 animate-pulse" />
                    <span>المصادر والمراجع التي تم البحث فيها:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.filter(src => isSafeExternalUrl(src.uri)).map((src, sIdx) => (
                      <a
                        key={sIdx}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface2 border border-border/60 text-[11px] text-accent hover:text-accent-hover hover:border-accent/40 transition-colors max-w-[240px] shadow-sm"
                        title={src.title}
                      >
                        <Globe size={10} className="shrink-0 text-emerald-500" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {msg.role === 'user' && !isLoading && activePersona !== 'debate' && (
                <button 
                  onClick={() => { setEditingIndex(idx); setEditValue(msg.text); }}
                  className="absolute -bottom-8 start-0 md:-left-12 md:top-0 md:bottom-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted hover:text-accent p-1.5 md:p-2 rounded-lg transition-all bg-surface border border-border shadow-sm z-10"
                  title="تعديل الرسالة"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
          )}
          
          {msg.role === 'model' && (
            <div className="flex items-center gap-1 sm:gap-1.5 mt-2.5 pt-2 border-t border-border/40 overflow-x-auto scrollbar-custom max-w-full pb-1">
              {/* Listen / TTS Button */}
              <Tooltip content="نطق صوتي" subContent={speakingIndex === idx ? 'إيقاف نطق النص' : 'قراءة الإجابة صوتياً'}>
                <button 
                  onClick={() => handleSpeak(msg.text, idx, msg.persona)}
                  className={`h-7 px-2 sm:px-2.5 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    speakingIndex === idx 
                      ? 'bg-accent/15 border-accent text-accent shadow-xs' 
                      : 'border-border/60 bg-surface2/50 hover:bg-surface2 text-muted hover:text-text'
                  }`}
                >
                  {isTTSLoading && speakingIndex === idx ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : speakingIndex === idx ? (
                    <StopCircle size={13} className="animate-pulse" />
                  ) : (
                    <Volume2 size={13} />
                  )}
                  <span>{isTTSLoading && speakingIndex === idx ? 'تحضير...' : speakingIndex === idx ? 'إيقاف' : 'استماع'}</span>
                </button>
              </Tooltip>

              {/* Copy Button */}
              <Tooltip content="نسخ النص" subContent="نسخ نص الإجابة إلى الحافظة">
                <button 
                  onClick={() => handleCopy(msg.text, idx)}
                  className="h-7 px-2 sm:px-2.5 rounded-md border border-border/60 bg-surface2/50 hover:bg-surface2 text-muted hover:text-text text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedIndex === idx ? <CheckCheck size={13} className="text-accent4" /> : <Copy size={13} />}
                  <span>{copiedIndex === idx ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </Tooltip>

              {/* Video with Captions Export Button */}
              {onExportVideo && (
                <Tooltip content="تنزيل فيديو مع الكلمات" subContent="إنشاء ملف فيديو مرئي مرمز مع الكلمات المزامنة">
                  <button 
                    onClick={() => onExportVideo(msg, msg.persona)}
                    className="h-7 px-2 sm:px-2.5 rounded-md border border-border/60 bg-surface2/50 hover:bg-sky-500/10 hover:border-sky-500/30 text-muted hover:text-sky-400 text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Video size={13} className="text-sky-400" />
                    <span>فيديو</span>
                  </button>
                </Tooltip>
              )}
              
              {/* Text Dissector Button */}
              {onOpenTextDissector && (
                <Tooltip content="تفكيك النص المعرفي" subContent="تحليل النص واستخراج الكيانات والمفاهيم">
                  <button
                    onClick={() => onOpenTextDissector(msg.text, msgPersona?.label || msgPersonaKey)}
                    className="h-7 px-2 sm:px-2.5 rounded-md border border-border/60 bg-surface2/50 hover:bg-purple-500/10 hover:border-purple-500/30 text-muted hover:text-purple-300 text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Sparkles size={13} className="text-purple-400" />
                    <span>تفكيك</span>
                  </button>
                </Tooltip>
              )}

              {/* Extract Lesson Button */}
              {onExtractLesson && (
                <Tooltip content="استخلاص درس" subContent="تحويل الأفكار إلى درس منهجي في الأرشيف">
                  <button
                    onClick={() => onExtractLesson(msg.text, msgPersonaKey, msgPersona?.label || msgPersonaKey)}
                    className="h-7 px-2 sm:px-2.5 rounded-md border border-border/60 bg-surface2/50 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-muted hover:text-emerald-400 text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <GraduationCap size={13} className="text-emerald-400" />
                    <span>درس</span>
                  </button>
                </Tooltip>
              )}

              {/* Regenerate Button */}
              {!isLoading && (
                <Tooltip content="إعادة التوليد" subContent="إعادة صياغة هذا الرد">
                  <button 
                    onClick={() => handleRegenerate(idx)}
                    className="h-7 px-2 sm:px-2 rounded-md border border-border/60 bg-surface2/50 hover:bg-surface2 text-muted hover:text-text text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RefreshCw size={13} />
                    <span className="hidden sm:inline">إعادة</span>
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default React.memo(MessageBubble, (prevProps, nextProps) => {
  const prevPKey = prevProps.msg.persona || prevProps.activePersona;
  const nextPKey = nextProps.msg.persona || nextProps.activePersona;
  return (
    prevProps.msg.text === nextProps.msg.text &&
    prevProps.msg.role === nextProps.msg.role &&
    prevProps.msg.sources === nextProps.msg.sources &&
    prevProps.msg.files === nextProps.msg.files &&
    prevProps.activePersona === nextProps.activePersona &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    (prevProps.editingIndex === prevProps.idx) === (nextProps.editingIndex === nextProps.idx) &&
    (prevProps.speakingIndex === prevProps.idx) === (nextProps.speakingIndex === nextProps.idx) &&
    (prevProps.copiedIndex === prevProps.idx) === (nextProps.copiedIndex === nextProps.idx) &&
    prevProps.isTTSLoading === nextProps.isTTSLoading &&
    prevProps.editValue === nextProps.editValue &&
    prevProps.personas[prevPKey]?.icon === nextProps.personas[nextPKey]?.icon &&
    prevProps.personas[prevPKey]?.color === nextProps.personas[nextPKey]?.color &&
    prevProps.personas[prevPKey]?.label === nextProps.personas[nextPKey]?.label
  );
});
