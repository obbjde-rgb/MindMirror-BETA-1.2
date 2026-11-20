import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, Sparkles, X, Check, Bookmark, Tag, FileText, Quote, BookOpen, 
  Wand2, Loader2, RefreshCw, Cpu
} from 'lucide-react';
import { useToast } from './Toast';
import { SavedLesson } from '../types';
import { getGeminiClient, parseJsonSafely, normalizeGeminiModel, withRetry } from '../utils/gemini';
import { safeStorage } from '../utils/storage';

interface ExtractLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageText: string;
  personaName: string;
  personaLabel: string;
  apiKey?: string;
}

export const ExtractLessonModal: React.FC<ExtractLessonModalProps> = ({
  isOpen,
  onClose,
  messageText,
  personaName,
  personaLabel,
  apiKey = ''
}) => {
  const { toast } = useToast();

  // Smart heuristic auto-extraction as immediate fallback
  const extractAutoValues = () => {
    const lines = messageText.split('\n').map(l => l.trim()).filter(Boolean);
    const titleCandidate = lines.find(l => l.startsWith('#') || l.startsWith('**') || (l.length > 5 && l.length < 60)) || `درس معرفي مع ${personaLabel}`;
    const cleanTitle = titleCandidate.replace(/^[#*–-\s]+|[#*–-\s]+$/g, '');

    const quoteCandidate = lines.find(l => l.startsWith('>') || l.includes('«') || l.includes('"')) || lines[0] || '';
    const cleanQuote = quoteCandidate.replace(/^[>«"\s]+|[»"\s]+$/g, '').slice(0, 180);

    const takeawayCandidate = lines.find(l => l.includes('النتيجة') || l.includes('الخلاصة') || l.includes('الفائدة') || l.length > 50) || lines[1] || lines[0] || '';

    return {
      title: cleanTitle || `حكمة من ${personaLabel}`,
      takeaway: takeawayCandidate.replace(/^[#*–-\s]+/, ''),
      quote: cleanQuote,
      category: 'فلسفة ومعرفة',
      tags: [personaLabel, 'حكمة', 'استنتاجات المحراب'],
      notes: ''
    };
  };

  const initial = extractAutoValues();
  const [title, setTitle] = useState(initial.title);
  const [takeaway, setTakeaway] = useState(initial.takeaway);
  const [quote, setQuote] = useState(initial.quote);
  const [category, setCategory] = useState(initial.category);
  const [tagInput, setTagInput] = useState(initial.tags.join(', '));
  const [studentNote, setStudentNote] = useState('');

  // AI Extraction Loading State
  const [isAiExtracting, setIsAiExtracting] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);

  // Function to perform AI Surgical Extraction
  const handleSurgicalAiExtraction = async () => {
    if (!messageText) return;

    setIsAiExtracting(true);
    setAiSuccess(false);

    try {
      const ai = getGeminiClient(apiKey);
      let modelName = 'gemini-3-flash-preview';
      try {
        const saved = safeStorage.getItem('mindmirror_model');
        if (saved) modelName = normalizeGeminiModel(saved);
      } catch (e) {
        console.warn('[Storage] Failed to get model from storage:', e);
      }

      const prompt = `أنت الأستاذ الأكاديمي والخبير الجراحي في تحليل النصوص واستخلاص البصمات المعرفية.
بناءً على النص التالي الصادر عن شخصية "${personaLabel} (${personaName})":

---
${messageText}
---

قم باستخلاص وبناء سجل "درس معرفي أكاديمي" دقيق ونموذجي يحتوي على العناصر التالية بصيغة JSON فقط:
1. "title": عنوان رنان وجذاب ومصاغ بدقة جراحية يعبر عن الدرس المحوري (سطر واحد).
2. "takeaway": الجوهر والفائدة المعرفية المستخلصة مكتملة الأبعاد بصياغة أسلوبية راقية.
3. "quote": أبرز وأعمق اقتباس قيل في النص أو يُلخّص فلسفة الحوار.
4. "category": التصنيف المعرفي الدقيق (مثال: فلسفة المعرفة، أخلاقيات التقنية، منطق رياضي، حكمة إنسانية).
5. "tags": قائمة بـ 3 إلى 5 وسوم مفتاحية ذات صلة.
6. "notes": تأملات تطبيقية وملاحظة مقترحة للطالب للاستفادة العملية من هذا الدرس.

المخرجات المطلوبة: JSON Object فقط بالنمط التالي دون أي كلام إضافي:
{
  "title": "...",
  "takeaway": "...",
  "quote": "...",
  "category": "...",
  "tags": ["وسم1", "وسم2", "وسم3"],
  "notes": "..."
}`;

      const response = await withRetry(() => ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      }));

      if (response.text) {
        const parsed = parseJsonSafely(response.text);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.takeaway) setTakeaway(parsed.takeaway);
        if (parsed.quote) setQuote(parsed.quote);
        if (parsed.category) setCategory(parsed.category);
        if (Array.isArray(parsed.tags)) setTagInput(parsed.tags.join(', '));
        if (parsed.notes) setStudentNote(parsed.notes);

        setAiSuccess(true);
        toast({
          title: 'تم الاستنباط الجراحي الذكي',
          message: 'تم ملء جميع الحقول تلقائياً بالذكاء الاصطناعي بدقة عالية.',
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Failed surgical extraction:', err);
      toast({
        title: 'تنبه أثناء الاستخراج',
        message: 'تم استخدام الاستنباط الأولي المحلي بدلاً من النموذج التوليدي.',
        type: 'info'
      });
    } finally {
      setIsAiExtracting(false);
    }
  };

  // Trigger AI auto-extraction automatically when modal opens if message exists
  useEffect(() => {
    if (isOpen && messageText) {
      // Set initial heuristic first so fields are never empty
      const init = extractAutoValues();
      setTitle(init.title);
      setTakeaway(init.takeaway);
      setQuote(init.quote);
      setCategory(init.category);
      setTagInput(init.tags.join(', '));
      setStudentNote(init.notes);

      // Perform AI extraction in background automatically
      handleSurgicalAiExtraction();
    }
  }, [isOpen, messageText]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim() || !takeaway.trim()) {
      toast({
        title: 'بيانات ناقصة',
        message: 'يرجى كتابة عنوان الدرس والفائدة المستخلصة.',
        type: 'error'
      });
      return;
    }

    try {
      const existing = safeStorage.getJson<SavedLesson[]>('mindmirror_saved_lessons', []);
      const newLesson: SavedLesson = {
        id: 'lesson_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: title.trim(),
        takeaway: takeaway.trim(),
        sourcePersona: personaName,
        personaLabel: personaLabel || personaName,
        quote: quote.trim(),
        category: category.trim(),
        tags: tagInput.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: new Date().toISOString(),
        notes: studentNote.trim()
      };

      existing.unshift(newLesson);
      safeStorage.setItem('mindmirror_saved_lessons', JSON.stringify(existing));

      toast({
        title: 'تم تدوين الدرس بالمحراب',
        message: `تم حفظ درس "${title}" في سجل دروس المحراب المعرفي.`,
        type: 'success'
      });
      onClose();
    } catch (e) {
      toast({
        title: 'خطأ أثناء الحفظ',
        message: 'فشل حفظ الدرس في الأرشيف المحلي.',
        type: 'error'
      });
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex flex-col items-center p-2 sm:p-4 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-surface border border-border/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden my-auto flex flex-col max-h-[92vh]"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <GraduationCap size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                  <span>استخلاص درس معرفي</span>
                  {aiSuccess && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Check size={12} />
                      <span>مستخرج بالذكاء الأصطناعي</span>
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted">تدوين الفوائد والدروس المنهجية من نقاش {personaLabel}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-text rounded-xl hover:bg-surface2 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* AI Surgical Trigger Bar */}
          <div className="mb-5 p-3 rounded-2xl bg-gradient-to-r from-accent/15 via-surface2 to-accent2/15 border border-accent/30 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-accent/20 text-accent shrink-0">
                <Wand2 size={18} className={isAiExtracting ? 'animate-spin' : 'animate-bounce'} />
              </div>
              <div>
                <p className="text-xs font-bold text-text flex items-center gap-1.5">
                  <span>الاستنباط الجراحي الذكي</span>
                  <Sparkles size={13} className="text-amber-400" />
                </p>
                <p className="text-[11px] text-muted">
                  {isAiExtracting ? 'جاري تحليل النص واستخراج العناوين والدروس بدقة...' : 'ملء كل الحقول تلقائياً بضغطة زر مفردة'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSurgicalAiExtraction}
              disabled={isAiExtracting}
              className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-bg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md disabled:opacity-50"
              title="إعادة التعبئة التلقائية بالذكاء الاصطناعي"
            >
              {isAiExtracting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>جاري الاستخراج...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  <span>إعادة الاستنباط</span>
                </>
              )}
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto ps-1 pe-1">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText size={14} className="text-accent" />
                  <span>عنوان الدرس المستخلص:</span>
                </span>
                {isAiExtracting && <Loader2 size={12} className="animate-spin text-accent" />}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-surface2 border border-border/70 rounded-xl px-3.5 py-2.5 text-sm text-text font-bold focus:outline-none focus:border-accent transition-all"
                placeholder="أدخل عنواناً رنانًا للدرس..."
              />
            </div>

            {/* Core Takeaway */}
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-accent" />
                  <span>الجوهر والفائدة المعرفية المستخلصة:</span>
                </span>
                {isAiExtracting && <Loader2 size={12} className="animate-spin text-accent" />}
              </label>
              <textarea
                value={takeaway}
                onChange={(e) => setTakeaway(e.target.value)}
                rows={3}
                className="w-full bg-surface2 border border-border/70 rounded-xl px-3.5 py-2.5 text-sm text-text leading-relaxed focus:outline-none focus:border-accent resize-none transition-all"
                placeholder="ما هي الفكرة الجوهرية والدرس المستفاد من هذا النقاش؟"
              />
            </div>

            {/* Quote */}
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5 flex items-center gap-1.5">
                <Quote size={14} className="text-accent" />
                <span>اقتباس مستلهم من الشخصية (اختياري):</span>
              </label>
              <input
                type="text"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                className="w-full bg-surface2 border border-border/70 rounded-xl px-3.5 py-2 text-xs text-text/90 italic focus:outline-none focus:border-accent transition-all"
                placeholder="اقتباس قيل خلال الحوار..."
              />
            </div>

            {/* Category & Tags Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 flex items-center gap-1.5">
                  <Cpu size={14} className="text-accent" />
                  <span>التصنيف المعرفي:</span>
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-surface2 border border-border/70 rounded-xl px-3.5 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  placeholder="مثال: فلسفة المعرفة"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 flex items-center gap-1.5">
                  <Tag size={14} className="text-accent" />
                  <span>الوسوم والتصنيفات:</span>
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full bg-surface2 border border-border/70 rounded-xl px-3.5 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  placeholder="منطق, فلسفة, أخلاق"
                />
              </div>
            </div>

            {/* Student Note */}
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5 flex items-center gap-1.5">
                <BookOpen size={14} className="text-accent" />
                <span>ملاحظات الطالب والإنعكاس الذاتي (تأملاتك الخاصة):</span>
              </label>
              <textarea
                value={studentNote}
                onChange={(e) => setStudentNote(e.target.value)}
                rows={2}
                className="w-full bg-surface2 border border-border/70 rounded-xl px-3.5 py-2 text-xs text-text leading-relaxed focus:outline-none focus:border-accent resize-none transition-all"
                placeholder="اكتب أفكارك الشخصية وكيف تنوي تطبيق هذا الدرس..."
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-5 mt-4 border-t border-border/60">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-text hover:bg-surface2 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-accent text-bg font-bold text-xs hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md"
            >
              <Bookmark size={16} />
              <span>حفظ في المحراب المعرفي</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

