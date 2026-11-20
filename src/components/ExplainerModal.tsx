import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Loader2, 
  Volume2, 
  VolumeX, 
  Copy, 
  CheckCheck, 
  RefreshCw, 
  BookOpen, 
  MessageSquare,
  AlertTriangle,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { withRetry, getGeminiClient, normalizeGeminiModel } from '../utils/gemini';
import { copyToClipboard } from '../utils/clipboard';
import { safeStorage } from '../utils/storage';
import { useToast } from './Toast';
import { SavedConcept } from '../types';

interface ExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  concept: string;
  baseExplanation: string;
  messageContext: string;
  personaName: string;
  apiKey: string;
  model: string;
  themeColor?: string;
}

export const ExplainerModal: React.FC<ExplainerModalProps> = ({
  isOpen,
  onClose,
  concept,
  baseExplanation,
  messageContext,
  personaName,
  apiKey,
  model,
  themeColor = '#38bdf8'
}) => {
  const { toast } = useToast();
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  
  // Audio Speech Synthesis state
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if concept is already saved
  useEffect(() => {
    if (isOpen && concept) {
      try {
        const savedList = safeStorage.getJson<SavedConcept[]>('mindmirror_saved_concepts', []);
        const exists = savedList.some((item: SavedConcept) => item.concept === concept && item.personaName === personaName);
        setIsSaved(exists);
      } catch (e) {
        setIsSaved(false);
      }
    }
  }, [isOpen, concept, personaName]);

  const handleSaveConcept = () => {
    if (!explanation) return;
    try {
      const savedList = safeStorage.getJson<SavedConcept[]>('mindmirror_saved_concepts', []);
      const existsIndex = savedList.findIndex((item: SavedConcept) => item.concept === concept && item.personaName === personaName);
      
      const newConceptItem: SavedConcept = {
        id: existsIndex >= 0 ? savedList[existsIndex].id : `concept_${Date.now()}`,
        concept,
        baseExplanation,
        fullExplanation: explanation,
        personaName,
        messageContext,
        createdAt: new Date().toISOString(),
        tags: [personaName, 'مفهوم معرفي', 'المفسر الذكي']
      };

      if (existsIndex >= 0) {
        savedList[existsIndex] = newConceptItem;
      } else {
        savedList.unshift(newConceptItem);
      }

      safeStorage.setItem('mindmirror_saved_concepts', JSON.stringify(savedList));
      setIsSaved(true);

      toast({
        title: 'تم حفظ الشرح المعرفي بنجاح',
        message: `تم أرشفة شرح "${concept}" في سجل الشروحات المعرفية للمحراب.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Error saving concept:', err);
      toast({
        title: 'خطأ في الحفظ',
        message: 'تعذر حفظ الشرح في التخزين المحلي.',
        type: 'error'
      });
    }
  };

  // Generate explanation using Gemini API
  const generateExplanation = async () => {
    setIsLoading(true);
    setError('');
    setExplanation('');
    stopSpeech();

    // Cancel previous stream request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const ai = getGeminiClient(apiKey);
      
      const prompt = `
أنت خبير ومعلم ذكي متميز في تبسيط العلوم والمفاهيم الفلسفية والتكنولوجية والتاريخية باللغة العربية الفصحى.
لقد ذكر المتحدث "${personaName}" المفهوم أو العبارة التالية: "${concept}"

سياق الرسالة التي كُتب فيها هذا المفهوم:
---
"${messageContext}"
---

التعريف المختصر المتاح حالياً: "${baseExplanation}"

المرجو منك تقديم شرح تفصيلي وعميق ومبسط جداً في آن واحد، ومفسراً له في سياق هذا الحوار بالتحديد.
يرجى صياغة الإجابة باتباع التنسيق التالي في Markdown:

### 🧠 مفهوم: ${concept}
*شرح موجز لتبسيط المعنى في المبتدأ بأسلوب واضح ومباشر للأذهان.*

---

### 🔍 الارتباط بالسياق وحوار "${personaName}"
*وضح بدقة كيف ينعكس هذا المفهوم على كلام وفلسفة ورأي "${personaName}" في هذا السياق بالتحديد لتوفير اتصال فكري مميز.*

---

### 💡 تطبيقات وأمثلة تسهل الفهم واكتساب المعرفة
*قدم أمثلة مبسطة ومألوفة أو استعارات توضيحية لتعميق ترسيخ المفهوم في ذهن القارئ.*

---

### 📚 زاوية فكرية إضافية (إثراء)
*فكرة تكميلية أو حكمة فلسفية، أو حقيقة علمية غير شائعة تثير الاهتمام وتثري ثقافة القارئ بأسلوب ممتع.*

اكتب الإجابة باللغة العربية الفصحى الفائقة الجمال والجزالة، وتجنب العبارات الفضفاضة أو الحشو الإنشائي التكراري، ولا تنسق الكلام كقائمة فقرات جافة، بل اجعله نصاً مترابطاً ممتع القراءة.
`;

      const targetModel = normalizeGeminiModel(model || 'gemini-3-flash-preview');
      
      // Cascade prioritized with Gemini 3 Flash Preview as primary default & fallbacks
      const modelsToTry = Array.from(new Set([
        targetModel,
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-robotics-er-2-preview'
      ]));
      let responseStream = null;
      let usedModel = targetModel;

      for (const m of modelsToTry) {
        try {
          responseStream = await withRetry(() => ai.models.generateContentStream({
            model: m,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              temperature: 0.85,
              topP: 0.95
            }
          }), 1, 1000);
          if (responseStream) {
            usedModel = m;
            if (m !== targetModel) {
              console.info(`[المفسر الذكي] تم التراجع التلقائي للنموذج (${m}) بعد انتهاء حصة النموذج الأساسي.`);
            }
            break;
          }
        } catch (err: any) {
          const errMsg = String(err?.message || err);
          console.warn(`[المفسر الذكي] تعذر استخدام النموذج ${m} (${errMsg.slice(0, 80)}). جاري التراجع التلقائي...`);
        }
      }

      if (!responseStream) {
        throw new Error('تعذر إنشاء خط اتصال مع خوادم الذكاء الاصطناعي. قد يكون مفتاح API غير صالح أو انتهت حصتك.');
      }

      let textBuffer = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          textBuffer += chunk.text;
          setExplanation(textBuffer);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'حدث خطأ غير متوقع أثناء معالجة الشرح الذكي.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && concept) {
      generateExplanation();
    }
    
    return () => {
      stopSpeech();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, concept, baseExplanation, messageContext]);

  // Handle Speech Synthesis
  const startSpeech = () => {
    if (!explanation) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast({
        title: 'عذراً',
        message: 'متصفحك لا يدعم القراءة الصوتية للنصوص.',
        type: 'error'
      });
      return;
    }

    window.speechSynthesis.cancel();
    
    // Clean markdown tags for clear speech
    const cleanSpeechText = explanation
      .replace(/[#*`_~]/g, '')
      .replace(/---/g, ' ')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    utterance.lang = 'ar-SA';
    // Attempt to locate an Arabic voice if available
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }
    utterance.rate = 0.95; // Slightly slower for better clarity
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    speechUtteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleCopy = () => {
    if (!explanation) return;
    copyToClipboard(explanation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden" dir="rtl">
      {/* Background overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          stopSpeech();
          onClose();
        }}
        className="fixed inset-0 bg-black/40 -z-10"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className="bg-surface border border-accent/20 rounded-3xl max-w-2xl w-[96%] max-h-[85vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,212,255,0.12)] relative my-auto mx-auto"
        dir="rtl"
        style={{ '--color-accent': themeColor } as React.CSSProperties}
      >
        {/* Glow Element */}
        <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface2/40">
          <div className="flex items-center gap-2 text-accent">
            <div className="bg-accent/10 p-2 rounded-xl border border-accent/20">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold font-sans text-start text-[16px] md:text-[18px]">مفسر المفاهيم الذكي</h3>
              <p className="text-[11px] text-muted text-start font-sans">توليد تفسير تفصيلي عبر الذكاء الاصطناعي</p>
            </div>
          </div>
          <button 
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface3 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          
          {/* Quick Info & Context Segment */}
          <div className="p-4 bg-surface2/60 border border-border rounded-2xl space-y-3 shadow-inner">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[11px] bg-accent/10 border border-accent/30 text-accent font-bold px-2.5 py-0.5 rounded-full font-sans uppercase tracking-wider">
                المفهوم المختار
              </span>
              <h2 className="text-[18px] md:text-[20px] font-black text-text font-sans">
                {concept}
              </h2>
            </div>
            
            {baseExplanation && (
              <p className="text-sm text-text/80 leading-relaxed text-start border-s-2 border-accent/40 pe-3 font-sans font-normal">
                {baseExplanation}
              </p>
            )}

            {/* Context from source message */}
            <div className="pt-2 text-xs text-muted flex flex-col gap-1">
              <span className="flex items-center gap-1 font-bold font-sans text-[11px]">
                <MessageSquare size={12} className="text-accent2" />
                سياق الاستخدام من كلام ({personaName}):
              </span>
              <p className="italic text-muted/80 bg-surface3/70 px-3 py-2 rounded-xl text-[12px] leading-relaxed select-text text-start border-s border-border font-sans">
                « ... {messageContext.length > 150 ? `${messageContext.substring(0, 150)}...` : messageContext} »
              </p>
            </div>
          </div>

          {/* AI Output Explainer Section */}
          <div className="relative min-h-[180px] bg-bg/40 border border-border/80 rounded-2xl p-5 md:p-6 overflow-hidden">
            {isLoading && !explanation && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/50 backdrop-blur-sm">
                <Loader2 size={32} className="animate-spin text-accent" />
                <span className="text-xs text-muted font-sans animate-pulse">جاري صياغة الشرح وتحليل فكرة الرمز...</span>
              </div>
            )}

            {error ? (
              <div className="flex flex-col items-center justify-center text-center p-6 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                <AlertTriangle className="text-red-400" size={32} />
                <p className="text-sm text-red-300 font-sans leading-relaxed max-w-sm">{error}</p>
                <button 
                  onClick={generateExplanation}
                  className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  إعادة المحاولة
                </button>
              </div>
            ) : (
              <div className="markdown-body text-start text-[14px] md:text-[15px] leading-relaxed text-text font-sans scroll-smooth" dir="auto">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-relaxed text-start" dir="auto" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-[16px] md:text-[17px] font-bold text-accent mb-2 mt-4 text-start flex items-center gap-1.5" dir="auto" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pe-5 mb-4 space-y-1 text-start" dir="auto" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pe-5 mb-4 space-y-1 text-start" dir="auto" {...props} />,
                    li: ({node, ...props}) => <li className="text-start" dir="auto" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-accent" {...props} />,
                    hr: ({node, ...props}) => <hr className="my-4 border-border/60" {...props} />,
                  }}
                >
                  {explanation}
                </ReactMarkdown>

                {isLoading && (
                  <span className="inline-flex ms-1 w-2 h-4 bg-accent animate-pulse align-middle" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-surface2/50 border-t border-border flex flex-wrap items-center justify-between gap-3">
          {/* Right: Sound, Copy, and Save controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {explanation && !error && (
              <>
                {/* Advanced Save Button */}
                <button
                  onClick={handleSaveConcept}
                  disabled={!explanation || isLoading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer select-none ${
                    isSaved
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25 hover:border-accent shadow-[0_0_12px_rgba(var(--accent-rgb),0.15)]'
                  }`}
                  title={isSaved ? "الشرح محفوظ في أرشيف المفاهيم" : "حفظ الشرح في سجل المفاهيم للمحراب"}
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck size={15} className="text-emerald-400" />
                      <span>محفوظ بالأرشيف</span>
                    </>
                  ) : (
                    <>
                      <Bookmark size={15} />
                      <span>حفظ في سجل المفاهيم</span>
                    </>
                  )}
                </button>

                <button
                  onClick={isSpeaking ? stopSpeech : startSpeech}
                  disabled={isLoading && !explanation}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer select-none ${
                    isSpeaking 
                      ? 'bg-accent/15 border-accent text-accent shadow-[0_0_12px_rgba(0,212,255,0.15)]' 
                      : 'bg-surface2 border-border text-muted hover:text-text hover:border-accent'
                  }`}
                  title={isSpeaking ? "إيقاف القراءة" : "استمع للشرح بالصوت"}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX size={14} className="animate-pulse" />
                      إيقاف الاستماع
                    </>
                  ) : (
                    <>
                      <Volume2 size={14} />
                      استمع للشرح الفوري
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopy}
                  className="px-3 py-2 bg-surface2 border border-border text-muted hover:text-text hover:border-accent rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="نسخ الشرح"
                >
                  {copied ? <CheckCheck size={14} className="text-accent4" /> : <Copy size={14} />}
                  {copied ? 'تم النسخ' : 'نسخ النص'}
                </button>
              </>
            )}
          </div>

          {/* Left: Regenerate button */}
          <button
            onClick={generateExplanation}
            disabled={isLoading}
            className="px-4 py-2 bg-surface2 border border-border text-muted hover:text-text hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            إعادة توليد الشرح
          </button>
        </div>
      </motion.div>
    </div>
  );
};
