import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Brain, Check, Plus, AlertCircle, Loader2, ListPlus, ChevronDown, ChevronUp, Copy, Eye } from 'lucide-react';
import { getGeminiClient, parseJsonSafely } from '../utils/gemini';
import { logger } from '../utils/logger';
import { getAvatarUrl } from '../utils/avatar';

interface ExtractedPersona {
  name: string;
  originalName: string;
  description: string;
  prompt: string;
  greeting: string;
  suggestions: string[];
  added?: boolean;
}

interface PersonaExtractorModalProps {
  show: boolean;
  onClose: () => void;
  isLoadingApp: boolean;
  model: string;
  onAddPersonas: (newPersonas: Record<string, any>) => void;
  requireApiKey: (featureName: string) => boolean;
}

const EXAMPLES = [
  {
    title: "مؤسسو ميكانيكا الكم والنسبية",
    text: "بحث ومناظرة تاريخية فكرية بين ألبرت أينشتاين، نيلز بور، وماكس بلانك، وفيرنر هايزنبرغ حول عشوائية الكون ومبدأ الشك ولماذا 'الله لا يلعب النرد'."
  },
  {
    title: "الفلسفة الوجودية والعبثية",
    text: "أفكار تدور حول التمرد والحرية والمسؤولية الفردية وصنع المعنى من العدم، بحضور رواد مثل جان بول سارتر، ألبير كامو، وسيمون دي بوفوار."
  },
  {
    title: "تأسيس علم الاجتماع وعمران الخلدوني",
    text: "مقارنة ودراسة اجتماعية عميقة بين عبد الرحمن ابن خلدون، كارل ماركس، وإميل دوركايم حول بنية المجتمع، العصبية، الصراع الطبقي وتطور الحضارات البشرية."
  }
];

export default function PersonaExtractorModal({
  show,
  onClose,
  isLoadingApp,
  model,
  onAddPersonas,
  requireApiKey
}: PersonaExtractorModalProps) {
  const [text, setText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedList, setExtractedList] = useState<ExtractedPersona[]>([]);
  const [error, setError] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const handleExtract = async () => {
    if (!text.trim()) return;
    if (!requireApiKey("تفكيك النصوص واستخلاص الشخصيات")) return;

    setIsExtracting(true);
    setError('');
    setExtractedList([]);

    try {
      const ai = getGeminiClient();
      const setupPrompt = `أنت خبير محترف ومؤرخ علامة متخصص في استخلاص الشخصيات التاريخية، الفلسفية، والسياسية، وتفكيك النصوص وبناء البصمات المعرفية وعلم الأنساب الفكري وتتبع الهويات العميقة.

قم بتحليل النص أو الفكرة أو السياق المعروض بدقة بالغة للغاية واستخلص منه **كافة** الشخصيات بلا استثناء (سواء كانت تاريخية، فلسفية، علمية، فكرية، سياسية، عسكرية، أو أدبية) التي وردت صراحةً، أو أشير إليها تلميحاً أو دوراً، أو ارتبطت ارتباطاً وثيقاً وضمنياً بالسياق الفكري والتاريخي المطروح.

**القوانين الذهبية الصارمة للاستخلاص والتحليل**:
1. **الشمولية المطلقة والكاملة**: يُمنع تماماً تقييد المخرجات بعدد أقصى أو الاكتفاء ببعض الرموز الشهيرة. يجب عليك إدراج **كل شخصية واحدة** لها دور أو حضور في النص أو السياق، حتى لو بلغ العدد 10، 20، 30 شخصية أو أكثر! استخرجهم جميعاً فرداً فرداً دون إغفال أي اسم أو دور.
2. **استنباط الشخصيات الضمنية والمبهمة**:
   - إذا ذُكرت شخصية بصفتها أو بلقبها دون ذكر الاسم الشخصي (مثل "داي الجزائر"، "باي تونس"، "قنصل فرنسا"، "قائد الأسطول")، فقم بالبحث المعرفي السريع واستنباط هويتها الحقيقية تاريخياً (مثال: الداي مصطفى باشا، أو الباي حمودة باشا، أو بوسييه القنصل الفرنسي) وقم بصياغة شخصية مستقلة متكاملة له باسمه ودوره لتمثيله بشكل رصين.
   - إذا أشار النص إلى تيار فكري أو مدرسة فلسفية أو حدث تاريخي محدد بوضوح، فقم باستنباط الرواد واللاعبين الأساسيين المرتبطين بهذا الحدث أو الفكر فكرياً أو تاريخياً والذين يفترض حضورهم لتكتمل الصورة المعرفية، حتى لو لم يذكروا صراحة (مثلاً: إدراج القادة الرئيسيين أو الفلاسفة المؤثرين الذين يثرون هذا السياق).
3. **الجودة والعمق المعرفي**: لكل شخصية مستخرجة، قم بصياغة وعي رقمي فائق التميز يعكس معتقداتها، أسلوب كلامها، مصطلحاتها المميزة، ومحاجتها الفكرية التاريخية، بحيث يكون مهيأً تماماً للحوار المباشر.

يجب أن تكون مخرجاتك في صيغة ملف JSON مصفوفة كائنات (Array of Objects) فقط دون أي كلام جانبي أو شروحات خارج نطاق الـ JSON.

الحقول المطلوبة لكل كائن في المصفوفة:
1. "name": اسم الشخصية باللغة العربية بوضوح ودقة (مثال: "يوسف قرمانلي"، "توماس جيفرسون"، "داي الجزائر (مصطفى باشا)").
2. "originalName": الاسم باللغة الأصلية أو الإنجليزية (مثال: "Yusuf Karamanli", "Thomas Jefferson").
3. "description": سطر بليغ يوضح من هو ودوره الفكري أو التاريخي أو العسكري بدقة شديدة تليق بمرتبته المعرفية.
4. "prompt": البصمة الفكرية العميقة والتوجيهات الفائقة لتقمص الشخصية (لا تقل عن 4 أسطر). يجب أن تحدد أسلوبه الخاص في الحديث (مثلاً: رصين، حاد، دبلوماسي، حكيم)، مصطلحاته التاريخية أو الفكرية المفضلة، منطلقاته العقدية أو السياسية، مع إلزامه التام بالتحدث باللغة العربية البليغة وعدم كشف كونه ذكاء اصطناعي تحت أي ظرف.
5. "greeting": ترحيب فريد جداً يعبر عن كبرياء الشخصية وروحه وتاريخه لافتتاح الحوار (مثال: "مرحباً بك، أنا يوسف باشا قرمانلي، حاكم طرابلس الغرب، هل جئت تفاوض على كرامة بحارنا أم على شروط السلام؟").
6. "suggestions": مصفوفة من ثلاثة أسئلة يطرحها المستخدم تقع في قلب اهتمام وتاريخ وعلم هذه الشخصية.

النص المراد تفكيكه واستخلاص كافة شخصياته المذكورة صراحةً أو المستنبطة ضمناً:
"${text}"

أنتج مصفوفة JSON صالحة 100% وخالية تماماً من العيوب الهيكلية، ولا تكتب أي تعليقات أو نصوص خارج المصفوفة.`;

      const response = await ai.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: setupPrompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || '';
      logger.info("Extracted personas raw JSON result", responseText);

      if (responseText) {
        let parsed: any;
        try {
          parsed = parseJsonSafely(responseText);
        } catch (e) {
          throw new Error("Could not parse extracted JSON from response: " + String(e));
        }

        if (Array.isArray(parsed)) {
          const validated = parsed.map(item => ({
            name: item.name || 'شخصية مستخلصة',
            originalName: item.originalName || '',
            description: item.description || 'شخصية مستخرجة عبر تفكيك النصوص.',
            prompt: item.prompt || `أنت ${item.name}. أجب باللغة العربية بدقة متناهية وتقمص شخصيته وأفكاره بالكامل ولا تقل أنك ذكاء اصطناعي.`,
            greeting: item.greeting || `مرحباً، أنا ${item.name}. يسعدني أن نتبادل الأفكار المعرفية الرصينة معاً.`,
            suggestions: Array.isArray(item.suggestions) ? item.suggestions.slice(0, 3) : ['من أنت؟', 'ما أفكارك؟', 'بماذا تنصحني؟'],
            added: false
          }));
          setExtractedList(validated);
          // Auto select all
          setSelectedIndices(validated.map((_, idx) => idx));
        } else {
          throw new Error("Invalid output format from model");
        }
      } else {
        throw new Error("Empty response from AI model");
      }
    } catch (e: any) {
      logger.error("Failed to extract personas from text", e);
      setError("حدث خطأ أثناء تفكيك النص واستخراج الشخصيات. يرجى التحقق من النص والمحاولة مرة أخرى.");
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleSelect = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleAddSelected = () => {
    if (selectedIndices.length === 0) return;

    const randomColors = ['#38bdf8', '#ef4444', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#60a5fa'];
    const newPersonasObj: Record<string, any> = {};

    selectedIndices.forEach(idx => {
      const p = extractedList[idx];
      const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)];
      newPersonasObj[p.name] = {
        label: p.name,
        prompt: p.prompt,
        greeting: p.greeting,
        suggestions: p.suggestions,
        color: randomColor,
        voice: 'Puck',
        ttsTone: 'تلقائي',
        isExtracted: true
      };
    });

    onAddPersonas(newPersonasObj);
    
    // Mark them as added
    setExtractedList(prev => prev.map((p, idx) => {
      if (selectedIndices.includes(idx)) {
        return { ...p, added: true };
      }
      return p;
    }));
    
    setSelectedIndices([]);
  };

  const loadExample = (exText: string) => {
    setText(exText);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#02040a]/95 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden"
        >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.95, y: 20 }}
          className="bg-surface border border-border rounded-3xl p-6 md:p-8 w-full max-w-3xl shadow-2xl relative my-auto flex flex-col max-h-[92vh]"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-muted hover:text-text transition-colors bg-bg/50 rounded-full p-1.5 cursor-pointer z-10"
          >
            <X size={20} />
          </button>
          
          {/* Header */}
          <div className="flex items-center gap-4 mb-6 mt-2 md:mt-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-accent/20 border border-accent/30 flex items-center justify-center text-accent shrink-0 shadow-[0_0_15px_rgba(0,212,255,0.1)] animate-pulse">
              <Brain size={24} />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-text flex items-center gap-2">
                مفكك النصوص ومولد الهويات الفكرية
              </h3>
              <p className="text-xs md:text-sm text-muted mt-1">تفكيك النصوص أو الأفكار واستخلاص روادها ومفكريها وصنع بصمتهم الرقمية بدقة فائقة التميز.</p>
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto flex-1 pe-1 scrollbar-hide">
            {/* Example Prompts / templates */}
            {extractedList.length === 0 && !isExtracting && (
              <div>
                <span className="text-xs font-bold text-muted block mb-2">أمثلة ملهمة للتجربة والسند:</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => loadExample(ex.text)}
                      className="p-3 bg-surface2 hover:bg-surface3 border border-border/60 rounded-xl text-start transition-colors cursor-pointer text-xs"
                    >
                      <div className="font-bold text-text flex items-center gap-1 mb-1 text-[11px]">
                        <Sparkles size={11} className="text-accent" />
                        {ex.title}
                      </div>
                      <p className="text-muted/80 leading-relaxed text-[10px] line-clamp-2">{ex.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-muted flex items-center gap-1.5">
                  <Brain size={14} className="text-accent" />
                  أدخل نصاً، سيرة ذاتية، قضية، أو فكرة تفصيلية
                </label>
                {text.length > 0 && (
                  <button 
                    onClick={() => setText('')} 
                    className="text-[10px] text-red-400 hover:underline cursor-pointer"
                  >
                    مسح النص
                  </button>
                )}
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="مثال: اكتب نصاً يتكلم عن الحرب البربرية الأولى وسياسات توماس جيفرسون البحرية ودور يوسف قرمانلي باشا طرابلس، أو الصراع الفكري حول الحقيقة والمطلق بين الغزالي وابن رشد وديكارت..."
                rows={5}
                className="w-full bg-bg border border-border rounded-2xl p-4 text-xs text-text outline-none focus:border-accent transition-all resize-none shadow-inner leading-relaxed"
              />
              
              <div className="flex justify-end">
                <button
                  onClick={handleExtract}
                  disabled={isExtracting || !text.trim()}
                  className="px-6 py-3 rounded-2xl bg-accent text-bg font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-accent/15 cursor-pointer hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      جاري تفكيك النص واستخراج كافة الشخصيات...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      تفكيك النص واستنباط جميع الشخصيات الفكرية
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Extracted results */}
            {extractedList.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                  <span className="text-xs font-extrabold text-muted">
                    تم استخلاص ({extractedList.length}) شخصية فكرية مرتبطة بالسياق:
                  </span>
                  <button 
                    onClick={() => {
                      if (selectedIndices.length === extractedList.length) {
                        setSelectedIndices([]);
                      } else {
                        setSelectedIndices(extractedList.map((_, i) => i));
                      }
                    }}
                    className="text-[10px] text-accent hover:underline cursor-pointer"
                  >
                    {selectedIndices.length === extractedList.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                  </button>
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto pe-1 scrollbar-hide">
                  {extractedList.map((p, idx) => {
                    const isSelected = selectedIndices.includes(idx);
                    const isExpanded = expandedIndex === idx;

                    return (
                      <div 
                        key={idx}
                        className={`p-4 border rounded-2xl transition-all text-start flex flex-col gap-2 ${
                          p.added 
                            ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70' 
                            : isSelected 
                              ? 'bg-surface2 border-accent shadow-sm' 
                              : 'bg-surface2/40 border-border/60 hover:bg-surface2/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {p.added ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                <Check size={12} />
                              </div>
                            ) : (
                              <button 
                                onClick={() => toggleSelect(idx)}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                                  isSelected 
                                    ? 'bg-accent border-accent text-bg' 
                                    : 'border-border bg-bg hover:border-accent/40'
                                }`}
                              >
                                {isSelected && <Check size={12} />}
                              </button>
                            )}
                            <img 
                              src={getAvatarUrl(p.name)} 
                              alt={p.name} 
                              className="w-10 h-10 rounded-full object-cover border border-border shrink-0" 
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-text text-sm">{p.name}</span>
                                {p.originalName && (
                                  <span className="text-[10px] text-muted font-mono">({p.originalName})</span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted leading-relaxed">{p.description}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                              className="p-1.5 rounded-lg hover:bg-surface3 border border-border/50 text-muted hover:text-text transition-colors cursor-pointer"
                              title="عرض التفاصيل والوعي المقترح"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-xs space-y-3 pt-2 border-t border-border/40 mt-1 leading-relaxed"
                          >
                            <div>
                              <span className="font-extrabold text-text block mb-1">تعليمات تقمص الشخصية والوعي الرقمي (Prompt):</span>
                              <p className="bg-bg/60 p-3 rounded-xl text-[10px] text-muted/90 font-mono border border-border/40 whitespace-pre-line leading-relaxed">{p.prompt}</p>
                            </div>
                            <div>
                              <span className="font-extrabold text-text block mb-1">الترحيب المعرفي الافتتاحي:</span>
                              <p className="bg-bg/60 p-3 rounded-xl text-[10px] text-accent/90 font-sans border border-border/40 leading-relaxed">"{p.greeting}"</p>
                            </div>
                            <div>
                              <span className="font-extrabold text-text block mb-1">الأسئلة المقترحة الافتتاحية:</span>
                              <ul className="list-disc list-inside space-y-1 text-[9px] text-muted">
                                {p.suggestions.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Import action */}
                {selectedIndices.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleAddSelected}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 text-bg hover:bg-emerald-600 transition-all font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer"
                    >
                      <ListPlus size={14} />
                      إضافة الشخصيات المحددة إلى بصماتي الفكرية ({selectedIndices.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer Action buttons */}
          <div className="flex gap-3 mt-6 border-t border-border/50 pt-4 shrink-0">
            <button 
              onClick={onClose} 
              className="flex-1 py-2.5 rounded-xl border border-border text-text hover:bg-surface2 transition-colors font-bold text-xs cursor-pointer"
            >
              إغلاق المفكك
            </button>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
