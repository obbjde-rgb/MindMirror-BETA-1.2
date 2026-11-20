import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Scale, Sparkles, Loader2, Check, RefreshCw, MessageSquare, 
  Brain, FileText, Zap, ChevronLeft, Award, Layers, Globe
} from 'lucide-react';
import { PersonaData, PersonaComparisonResult } from '../types';
import { getGeminiClient, withRetry, parseJsonSafely } from '../utils/gemini';

interface PersonaComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: Record<string, PersonaData>;
  apiKey?: string;
}

export const PersonaComparisonModal: React.FC<PersonaComparisonModalProps> = ({
  isOpen,
  onClose,
  personas,
  apiKey = ''
}) => {
  const [selectedPersonaKeys, setSelectedPersonaKeys] = useState<string[]>(() => {
    const keys = Object.keys(personas);
    return keys.slice(0, 2); // default select first two personas
  });

  const [isLoading, setIsLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<PersonaComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const togglePersonaSelection = (key: string) => {
    if (selectedPersonaKeys.includes(key)) {
      if (selectedPersonaKeys.length <= 2) return; // Keep at least 2
      setSelectedPersonaKeys(selectedPersonaKeys.filter(k => k !== key));
    } else {
      if (selectedPersonaKeys.length >= 4) return; // Max 4
      setSelectedPersonaKeys([...selectedPersonaKeys, key]);
    }
  };

  const handleRunComparison = async () => {
    if (selectedPersonaKeys.length < 2) return;

    setIsLoading(true);
    setError(null);

    try {
      const selectedData = selectedPersonaKeys.map(k => {
        const p = personas[k];
        return `الشخصية: ${k}\nالوصف: ${p?.description || ''}\nالموجه الخاص (System Prompt): ${p?.prompt || ''}\nالمقولة: ${p?.quote || ''}`;
      }).join('\n---\n');

      const promptText = `
أنت خبير في تحليل الفلسفات وعلم النفس المعرفي وأنماط الشخصيات.
يرجى إجراء تحليل مقارن دقيق وشامل بين الشخصيات التالية بناءً على نصوصها وموجهاتها المعرفية:

${selectedData}

المطلوب: قم بإرجاع النتيجة بصيغة JSON حصرية بدون أي نصوص إضافية بالهيكل التالي:
{
  "summary": "ملخص شامل للمقارنة الفكرية بين الشخصيات المحددة",
  "languagePatterns": {
    "اسم الشخصية": {
      "tone": "النبرة والتعبير (مثال: حادة، بلاغية، هادئة، منهجية)",
      "vocabulary": "المفردات الشائعة والرموز المصطلحية",
      "style": "أسلوب الصياغة والبناء اللغوي"
    }
  },
  "statedValues": {
    "اسم الشخصية": ["القيمة 1", "القيمة 2", "القيمة 3"]
  },
  "reasoningProcesses": {
    "اسم الشخصية": {
      "logicType": "نوع المنطق والاستدلال (مثال: جدلي، استقرائي، تجريبي، تفكيكي)",
      "decisionApproach": "نهج اتخاذ القرار والتحليل",
      "corePremise": "المنطلق الأساسي للفرك"
    }
  },
  "keyDifferences": [
    "الفارق الأبرز الأول بين الشخصيات",
    "الفارق الأبرز الثاني",
    "الفارق الأبرز الثالث"
  ],
  "synergyOrConflict": "تحليل نقاط الالتقاء والتصادم الفكري بين هذه الشخصيات"
}
`;

      const ai = getGeminiClient(apiKey);
      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: promptText,
        config: {
          responseMimeType: 'application/json'
        }
      }));

      const rawText = (response as any)?.text || '';
      const parsed = parseJsonSafely<PersonaComparisonResult>(rawText);
      if (!parsed || typeof parsed !== 'object' || !parsed.summary) {
        throw new Error('تعذر تحليل نتيجة المقارنة بشكل صحيح');
      }
      parsed.personasCompared = selectedPersonaKeys;
      setComparisonResult(parsed);
    } catch (err: any) {
      console.error('Comparison error:', err);
      setError('حدث خطأ أثناء إجراء المقارنة التحليلية. يرجى إعادة المحاولة.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface border border-accent/30 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative my-auto"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border bg-surface2/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                <Scale size={22} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                  أداة مقارنة الشخصيات والأطياف الفكرية
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                    Persona Comparative Matrix
                  </span>
                </h2>
                <p className="text-xs text-muted">
                  مقارنة الأنماط اللغوية، القيم الجوهرية، وأساليب الاستدلال المنطقي بين الشخصيات المتاحة
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-text hover:bg-surface2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Selection Bar */}
          <div className="p-4 border-b border-border bg-surface/50 space-y-3 shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-text flex items-center gap-2">
                <span>اختر الشخصيات للمقارنة (2 إلى 4 شخصيات):</span>
                <span className="text-purple-400 font-mono">({selectedPersonaKeys.length} محددة)</span>
              </div>

              <button
                onClick={handleRunComparison}
                disabled={isLoading || selectedPersonaKeys.length < 2}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-xs flex items-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all shadow-md cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جاري تحليل المصفوفة المقارنة...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>إجراء التحليل المقارن العميق</span>
                  </>
                )}
              </button>
            </div>

            {/* Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {Object.keys(personas).map(pKey => {
                const isSelected = selectedPersonaKeys.includes(pKey);
                return (
                  <button
                    key={pKey}
                    onClick={() => togglePersonaSelection(pKey)}
                    className={`px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-purple-500/20 border-purple-500 text-purple-200 shadow-sm'
                        : 'bg-surface2 border-border/80 text-muted hover:border-purple-500/40 hover:text-text'
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-purple-400" />}
                    <span>{pKey}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-surface2/20 space-y-6">
            {error && (
              <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold text-center">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted gap-3">
                <Loader2 size={36} className="animate-spin text-purple-400" />
                <p className="text-xs font-bold animate-pulse text-text">
                  جاري تشريح البيانات والمعلمات واستخلاص المقارنات اللغوية والمنطقية...
                </p>
              </div>
            ) : comparisonResult ? (
              <div className="space-y-6 max-w-4xl mx-auto">
                {/* Summary Banner */}
                <div className="p-5 rounded-3xl border border-purple-500/30 bg-purple-500/10 space-y-2">
                  <div className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} />
                    ملخص النتيجة المقارنة (Executive Overview)
                  </div>
                  <p className="text-xs sm:text-sm text-text leading-relaxed">
                    {comparisonResult.summary}
                  </p>
                </div>

                {/* Grid Comparison Aspects */}
                {/* 1. Language & Style */}
                <div className="p-5 rounded-2xl border border-border bg-surface space-y-4">
                  <h3 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={16} />
                    1. أنماط اللغة والبلاغة والتعبير (Language Patterns)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedPersonaKeys.map(pKey => {
                      const lp = comparisonResult.languagePatterns?.[pKey];
                      return (
                        <div key={pKey} className="p-4 rounded-xl border border-border/80 bg-surface2/40 space-y-2">
                          <div className="font-bold text-xs text-text border-b border-border/60 pb-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent" />
                            {pKey}
                          </div>
                          {lp ? (
                            <div className="text-xs space-y-1.5 text-muted">
                              <div>النبرة: <span className="text-text font-bold">{lp.tone}</span></div>
                              <div>المفردات: <span className="text-text font-bold">{lp.vocabulary}</span></div>
                              <div>الأسلوب: <span className="text-text font-bold">{lp.style}</span></div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted">لا تتوفر تفاصيل لغوية لهذه الشخصية.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Core Values & Principles */}
                <div className="p-5 rounded-2xl border border-border bg-surface space-y-4">
                  <h3 className="text-xs font-bold text-accent3 uppercase tracking-wider flex items-center gap-2">
                    <Award size={16} />
                    2. القيم الجوهرية والمبادئ الأخلاقية (Stated Values & Axioms)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedPersonaKeys.map(pKey => {
                      const values = comparisonResult.statedValues?.[pKey] || [];
                      return (
                        <div key={pKey} className="p-4 rounded-xl border border-border/80 bg-surface2/40 space-y-2">
                          <div className="font-bold text-xs text-text border-b border-border/60 pb-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent3" />
                            {pKey}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {values.map((v, idx) => (
                              <span key={idx} className="px-2.5 py-1 rounded-lg bg-accent3/10 border border-accent3/30 text-accent3 text-[11px] font-bold">
                                {v}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Reasoning & Logic */}
                <div className="p-5 rounded-2xl border border-border bg-surface space-y-4">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                    <Brain size={16} />
                    3. أساليب الاستدلال وبناء المنطق (Reasoning Processes)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedPersonaKeys.map(pKey => {
                      const rp = comparisonResult.reasoningProcesses?.[pKey];
                      return (
                        <div key={pKey} className="p-4 rounded-xl border border-border/80 bg-surface2/40 space-y-2">
                          <div className="font-bold text-xs text-text border-b border-border/60 pb-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            {pKey}
                          </div>
                          {rp ? (
                            <div className="text-xs space-y-1.5 text-muted">
                              <div>نمط المنطق: <span className="text-text font-bold">{rp.logicType}</span></div>
                              <div>نهج القرارات: <span className="text-text font-bold">{rp.decisionApproach}</span></div>
                              <div>المنطلق الأساسي: <span className="text-text font-bold">{rp.corePremise}</span></div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted">لا تتوفر تفاصيل استدلالية لهذه الشخصية.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Key Differences */}
                {comparisonResult.keyDifferences && comparisonResult.keyDifferences.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-surface space-y-3">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Zap size={16} />
                      الفوارق الفكرية والمنهجية الأبرز (Key Contrasts)
                    </h3>
                    <ul className="space-y-2 text-xs text-text">
                      {comparisonResult.keyDifferences.map((diff, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-surface2/60 p-2.5 rounded-xl border border-border/60">
                          <span className="text-emerald-400 font-bold shrink-0">•</span>
                          <span>{diff}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 5. Synergy vs Conflict */}
                {comparisonResult.synergyOrConflict && (
                  <div className="p-5 rounded-2xl border border-border bg-surface space-y-2">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Globe size={16} />
                      تحليل التوافق والنزاع الفكري (Dialectical Dynamics)
                    </h3>
                    <p className="text-xs text-text leading-relaxed">
                      {comparisonResult.synergyOrConflict}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted text-xs gap-3">
                <Scale size={40} className="opacity-40 text-purple-400" />
                <p className="text-center max-w-md">
                  اختر الشخصيات التي ترغب في مقارنتها من الشريط العلوي، ثم اضغط على زر <span className="text-purple-300 font-bold">إجراء التحليل المقارن العميق</span> لبدء الاستخلاص الفوري.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
