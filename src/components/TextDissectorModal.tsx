import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sparkles, Brain, Check, Plus, Loader2, RefreshCw, Layers, Quote, 
  UserCheck, Lightbulb, BookOpen, MessageSquare, ArrowLeft, Zap, Shield, FileText, Share2,
  Volume2, VolumeX
} from 'lucide-react';
import { getGeminiClient, parseJsonSafely } from '../utils/gemini';
import { logger } from '../utils/logger';
import { useToast } from './Toast';
import { PersonaData } from '../types';

export interface ExtractedEntity {
  id: string;
  name: string;
  type: 'personality' | 'concept' | 'school' | 'quote';
  categoryLabel: string;
  summary: string;
  historicalContext?: string;
  suggestedPrompt?: string;
  fingerprintScore?: number;
}

interface TextDissectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputText: string;
  sourceSpeaker?: string;
  apiKey?: string;
  onExtractAndChat: (entity: ExtractedEntity, fullPersonaData?: PersonaData) => void;
  onExtractAll?: (entities: ExtractedEntity[]) => void;
  requireApiKey: (featureName: string) => boolean;
  isZenMode?: boolean;
}

export const TextDissectorModal: React.FC<TextDissectorModalProps> = ({
  isOpen,
  onClose,
  inputText,
  sourceSpeaker = 'المتحدث',
  apiKey,
  onExtractAndChat,
  onExtractAll,
  requireApiKey,
  isZenMode = false
}) => {
  const { toast } = useToast();
  const [isDissecting, setIsDissecting] = useState<boolean>(false);
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [generatingEntityId, setGeneratingEntityId] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string>('');
  const [speakingEntityId, setSpeakingEntityId] = useState<string | null>(null);

  const handleSpeakText = (text: string, entityId: string) => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: 'عذراً',
        message: 'متصفحك لا يدعم قراءة النصوص بالصوت.',
        type: 'error'
      });
      return;
    }

    if (speakingEntityId === entityId) {
      window.speechSynthesis.cancel();
      setSpeakingEntityId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.0;

    utterance.onend = () => setSpeakingEntityId(null);
    utterance.onerror = () => setSpeakingEntityId(null);

    setSpeakingEntityId(entityId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (isOpen) {
      if (inputText) {
        setCustomText(inputText);
        dissectText(inputText);
      } else {
        setEntities([]);
      }
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen, inputText]);

  // Main text dissection function powered by Gemini
  const dissectText = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    if (!requireApiKey("تفكيـك النصوص واستخراج العقول والمفاهيم")) return;

    setIsDissecting(true);
    setEntities([]);

    try {
      const ai = getGeminiClient(apiKey);
      const prompt = `أنت محرك فائق لتفكيك النصوص المعرفية والتحليل الجراحي للنصوص والوعي.
قم بتحليل النص التالي واستخراج كافة العناصر والكيانات المذكورة فيه صراحة أو ضمناً:
1. الشخصيات والعقول والمفكرين (personalities)
2. المفاهيم والأفكار والنظريات الجوهرية (concepts)
3. المدارس والتوجهات الفلسفية والفكرية (schools)
4. الشواهد والمقولات المركزية ذات الثقل المعرفي (quotes)

نص التحليل المطلوب:
"""
${textToProcess}
"""

أرجع الناتج بتنسيق JSON حصراً كقائمة أجزاء بالتركيب التالي:
{
  "entities": [
    {
      "name": "اسم الكيان أو الشخصية أو المفهوم باللغة العربية",
      "type": "personality" | "concept" | "school" | "quote",
      "categoryLabel": "العقل المفكر | مفهوم محوري | مدرسة فكرية | شاهد معرفي",
      "summary": "ملخص مكثف وجوهري في سطرين عن هذا الكيان وأهميته الفكرية",
      "historicalContext": "الحقبة أو المجال المعرفي التابع له",
      "suggestedPrompt": "طريقة محاكاة حوارية مقترحة للتحدث مع هذا العقل أو هذا المفهوم كشخصية مستقلة",
      "fingerprintScore": 96
    }
  ]
}
لا تضف أي شرح أو مقدمات خارية خارج الـ JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const rawJson = response.text || '';
      const parsed = parseJsonSafely<{ entities: any[] }>(rawJson);

      if (parsed && Array.isArray(parsed.entities) && parsed.entities.length > 0) {
        const formattedEntities: ExtractedEntity[] = parsed.entities.map((item, idx) => ({
          id: `entity_${Date.now()}_${idx}`,
          name: item.name || 'عنصر معرفي',
          type: item.type || 'concept',
          categoryLabel: item.categoryLabel || 'عنصر فكري',
          summary: item.summary || 'تحليل جراحي للمفهوم المقتطع',
          historicalContext: item.historicalContext || 'الأرشيف المعرفي العام',
          suggestedPrompt: item.suggestedPrompt || `تحدث معي كشخصية وعقل مفكر يمثل ${item.name}`,
          fingerprintScore: item.fingerprintScore || 95
        }));

        setEntities(formattedEntities);
        toast({
          title: 'تم تفكيك النص بنجاح',
          message: `تم التعرف الآلي على ${formattedEntities.length} من العقول والمفاهيم والمدارس الفكرية.`,
          type: 'success'
        });
      } else {
        // Fallback local regex parsing if JSON was sparse
        fallbackLocalParsing(textToProcess);
      }
    } catch (err) {
      logger.error('Error dissecting text:', err);
      fallbackLocalParsing(textToProcess);
    } finally {
      setIsDissecting(false);
    }
  };

  // Fallback pattern parser for offline/fast entity detection
  const fallbackLocalParsing = (text: string) => {
    const mockEntities: ExtractedEntity[] = [];

    // Simple heuristic extraction for famous Arabic thinkers / concepts
    if (text.includes('ابن خلدون') || text.includes('العمران')) {
      mockEntities.push({
        id: `local_${Date.now()}_1`,
        name: 'ابن خلدون',
        type: 'personality',
        categoryLabel: 'مؤسس علم الاجتماع والعمران',
        summary: 'صاحب المقدمة والعصبية وقوانين نشوء الحضارات وسقوطها.',
        historicalContext: 'الحضارة الإسلامية - القرن الرابع عشر',
        suggestedPrompt: 'تحدث معي كـ ابن خلدون مفسراً تحولات المجتمع والعمران معتمداً على مفهوم العصبية.',
        fingerprintScore: 98
      });
    }

    if (text.includes('أرسطو') || text.includes('منطق')) {
      mockEntities.push({
        id: `local_${Date.now()}_2`,
        name: 'أرسطو طاليس',
        type: 'personality',
        categoryLabel: 'المعلم الأول',
        summary: 'واضع المنطق الصوري والأورغانون وفلسفة الأسباب الأربعة.',
        historicalContext: 'أثينا القديمة - القرن الرابع قبل الميلاد',
        suggestedPrompt: 'تحدث معي بصوت أرسطو مستخدماً القياس المنطقي والبحث عن السبب الغائي.',
        fingerprintScore: 97
      });
    }

    if (mockEntities.length === 0) {
      mockEntities.push({
        id: `local_${Date.now()}_default`,
        name: sourceSpeaker || 'الكيان المفكر',
        type: 'concept',
        categoryLabel: 'الرؤية المعرفية',
        summary: text.slice(0, 100) + '...',
        historicalContext: 'السياق الحالي',
        suggestedPrompt: `تحدث معي كعقل يناقش هذه الفكرة: ${text.slice(0, 60)}`,
        fingerprintScore: 94
      });
    }

    setEntities(mockEntities);
  };

  // Extract Full Intellectual Fingerprint & Launch Chat
  const handleSelectEntity = async (entity: ExtractedEntity) => {
    setGeneratingEntityId(entity.id);
    toast({
      title: `جاري استخراج بصمة "${entity.name}"`,
      message: 'يتم الآن صياغة الوعي المعرفي والنبرة الحوارية لهذه الشخصية...',
      type: 'info'
    });

    try {
      const ai = getGeminiClient(apiKey);
      const fingerprintPrompt = `أنت مهندس وعي اصطناعي في مشروع MindMirror.
قم بإنشاء "بصمة معرفية جراحية" وافية للكيان المعرفي: "${entity.name}" (${entity.categoryLabel}).

المطلوب إرجاع JSON حصراً لإنشاء شخصية حوارية متكاملة بنفس النموذج:
{
  "label": "${entity.name}",
  "description": "وصف مكثف في سطرين للوعي والنظرة الفلسفية",
  "prompt": "صيغة موجهة صارمة وعميقة توضح نبرته، منهجه التحليلي، طريقة استشهاده، والأسلوب الحواري التفاعلي",
  "quote": "مقولة جوهرية أو حكمة معبرة جداً تعكس فلسفته",
  "color": "#8b5cf6",
  "icon": "Brain",
  "voice": "Kore",
  "ttsTone": "وقور وعميق",
  "greeting": "عبارة ترحيبية مهيبة يفتتح بها الحوار مع المستخدم"
}
اختر لون هكس سداسي مميز ومناسب لطبيعة الشخصية، وصوت مناسب من قائمة [Puck, Kore, Fenrir, Zephyr, Charon].`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: fingerprintPrompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const raw = response.text || '';
      const personaConfig = parseJsonSafely<any>(raw);

      if (personaConfig && personaConfig.label) {
        const fullPersona: PersonaData = {
          label: personaConfig.label,
          description: personaConfig.description || entity.summary,
          prompt: personaConfig.prompt || entity.suggestedPrompt || '',
          quote: personaConfig.quote || `«أنا أفكّر إذاً أنا أتساءل عن ${entity.name}»`,
          color: personaConfig.color || '#8b5cf6',
          icon: personaConfig.icon || 'Brain',
          voice: personaConfig.voice || 'Kore',
          ttsTone: personaConfig.ttsTone || 'عميق وفلسفي',
          greeting: personaConfig.greeting || `مرحباً بك في رحاب ${entity.name}. أين تحب أن نبدأ تفكيك هذه المسألة المعرفية؟`
        };

        onExtractAndChat(entity, fullPersona);
        onClose();
      } else {
        // Simple fallback
        onExtractAndChat(entity);
        onClose();
      }
    } catch (err) {
      logger.error('Error extracting fingerprint:', err);
      onExtractAndChat(entity);
      onClose();
    } finally {
      setGeneratingEntityId(null);
    }
  };

  if (!isOpen) return null;

  const filteredEntities = entities.filter(e => {
    if (selectedType === 'all') return true;
    return e.type === selectedType;
  });

  const getTypeBadgeStyle = (type: ExtractedEntity['type']) => {
    switch (type) {
      case 'personality':
        return 'bg-purple-500/15 border-purple-500/40 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]';
      case 'concept':
        return 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]';
      case 'school':
        return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]';
      case 'quote':
        return 'bg-sky-500/15 border-sky-500/40 text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.15)]';
      default:
        return 'bg-accent/15 border-accent/40 text-accent';
    }
  };

  return (
    <AnimatePresence>
      <div className={isZenMode ? "fixed inset-0 z-[1000] flex items-center justify-center p-0 bg-bg overflow-y-auto overflow-x-hidden" : "fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden"}>
        <motion.div
          initial={{ opacity: 0, scale: isZenMode ? 1 : 0.95, y: isZenMode ? 0 : 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: isZenMode ? 1 : 0.95, y: isZenMode ? 0 : 15 }}
          className={isZenMode ? "bg-bg w-screen h-screen flex flex-col relative overflow-hidden" : "bg-surface border border-border/80 rounded-3xl max-w-3xl w-full h-[85vh] flex flex-col shadow-2xl relative overflow-hidden my-auto"}
          dir="rtl"
        >
          {/* Header */}
          {isZenMode ? (
            <div className="p-4 border-b border-border/40 bg-surface/40 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Layers size={16} />
                </div>
                <h2 className="text-xs font-bold text-text">المفكك المعرفي (وضع التركيز مفعّل 🧘‍♂️)</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-muted hover:text-text rounded-lg hover:bg-surface2 transition-colors cursor-pointer"
                title="إغلاق المفكك"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="p-6 border-b border-border/60 bg-surface2/40 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
                  <Layers size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text flex items-center gap-2">
                    <span>المفكك الجراحي للنصوص والوعي</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                      Text Dissector Pro
                    </span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    التعرف الآلي على العقول، المفاهيم، والمدارس واستخراج بصمتها الحوارية
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-muted hover:text-text rounded-2xl hover:bg-surface2 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* Text Input & Re-dissect bar */}
          <div className="p-5 bg-surface2/20 border-b border-border/50 shrink-0 space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-accent" />
              <span className="text-xs font-bold text-text">النص الجاري تفكيكه:</span>
            </div>
            <div className="relative">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="أدخل أو ألصق أي نص معرفي لتفكيك عقوله ومفاهيمه..."
                rows={2}
                className="w-full bg-surface border border-border/70 rounded-2xl p-3 text-xs text-text focus:outline-none focus:border-purple-500 resize-none"
              />
              <button
                onClick={() => dissectText(customText)}
                disabled={isDissecting || !customText.trim()}
                className="absolute left-2.5 bottom-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                {isDissecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                <span>إعادة التفكيك</span>
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="px-6 py-3 bg-surface2/10 border-b border-border/40 flex items-center justify-between gap-3 shrink-0 flex-wrap text-xs font-bold">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${selectedType === 'all' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-surface2/50 border-border/60 text-muted hover:text-text'}`}
              >
                كافة الكيانات ({entities.length})
              </button>
              <button
                onClick={() => setSelectedType('personality')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${selectedType === 'personality' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-surface2/50 border-border/60 text-muted hover:text-text'}`}
              >
                👤 العقول والشخصيات ({entities.filter(e => e.type === 'personality').length})
              </button>
              <button
                onClick={() => setSelectedType('concept')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${selectedType === 'concept' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-surface2/50 border-border/60 text-muted hover:text-text'}`}
              >
                💡 المفاهيم والنظريات ({entities.filter(e => e.type === 'concept').length})
              </button>
              <button
                onClick={() => setSelectedType('school')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${selectedType === 'school' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-surface2/50 border-border/60 text-muted hover:text-text'}`}
              >
                🏛️ المدارس الفكرية ({entities.filter(e => e.type === 'school').length})
              </button>
            </div>

            {entities.length > 0 && onExtractAll && (
              <button
                onClick={() => onExtractAll(entities)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-400/40 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer hover:shadow-purple-500/15"
                title="إضافة كافة العقول والمفاهيم المستخرجة إلى قائمتك الحوارية مباشرة"
              >
                <Sparkles size={14} className="animate-pulse" />
                <span>إضافة كل الكيانات دفعة واحدة ({entities.length})</span>
              </button>
            )}
          </div>

          {/* Entities Grid / List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isDissecting ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 text-purple-400">
                <Loader2 size={40} className="animate-spin text-purple-500" />
                <div>
                  <h3 className="font-bold text-base text-text">جاري إجراء التفكيك الجراحي للنص...</h3>
                  <p className="text-xs text-muted mt-1 max-w-sm">
                    نقوم بمسح الحمولات المعرفية والتعرف التلقائي على الأفكار والشخصيات والروابط المفاهيمية.
                  </p>
                </div>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted space-y-3">
                <Brain size={48} className="text-muted/30" />
                <p className="text-sm font-bold text-text/80">لم يتم العثور على كيانات مسجلة في هذا النص بعد</p>
                <p className="text-xs text-muted max-w-sm">
                  جرب كتابة أو لصق نص يتضمن أسماء مفكرين، نظريات، أو مدارس فلسفية ثم اضغط زر "إعادة التفكيك".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredEntities.map((entity) => (
                  <motion.div
                    key={entity.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface2/60 border border-border/70 hover:border-purple-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md relative group"
                  >
                    <div>
                      {/* Badge Header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getTypeBadgeStyle(entity.type)}`}>
                          {entity.categoryLabel}
                        </span>
                        {entity.fingerprintScore && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            مطابقة الوعي: {entity.fingerprintScore}%
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-text mb-1.5 flex items-center gap-2">
                        <span>{entity.name}</span>
                      </h3>

                      {entity.historicalContext && (
                        <p className="text-[11px] text-muted font-mono mb-2">
                          📌 {entity.historicalContext}
                        </p>
                      )}

                      <div className="relative">
                        <p className="text-xs text-text/90 leading-relaxed bg-surface/60 p-3 rounded-xl border border-border/40 mb-3 ps-9">
                          {entity.summary}
                        </p>
                        <button
                          onClick={() => handleSpeakText(entity.summary, entity.id)}
                          className={`absolute left-2.5 top-2.5 p-1 rounded-lg transition-colors cursor-pointer border ${
                            speakingEntityId === entity.id
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                              : 'text-muted hover:text-text bg-surface/85 border-border/40 hover:border-purple-500/50 shadow-sm'
                          }`}
                          title="قراءة ملخص الكيان بصوت عالٍ"
                        >
                          {speakingEntityId === entity.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* Footer Action Button */}
                    <button
                      onClick={() => handleSelectEntity(entity)}
                      disabled={generatingEntityId === entity.id}
                      className="w-full mt-2 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 border border-purple-400/30 cursor-pointer"
                    >
                      {generatingEntityId === entity.id ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>جاري استخراج البصمة المعرفية...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={15} />
                          <span>استخراج البصمة المعرفية وبدء المحادثة 🚀</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
