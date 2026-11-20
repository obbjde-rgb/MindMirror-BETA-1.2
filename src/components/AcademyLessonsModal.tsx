import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, Code2, Search, X, Trash2, Download, Copy, Check, 
  Bookmark, Sparkles, Tag, Calendar, FileText, BookOpen, Quote, RefreshCw, FileCode, Edit3,
  Layers, Volume2, VolumeX, Eye, EyeOff, CheckCheck, Lightbulb, Brain, ArrowRight, ArrowLeft, RotateCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from './Toast';
import ConfirmModal from './ConfirmModal';
import { SavedLesson, SavedCodeSnippet, SavedConcept } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { safeStorage } from '../utils/storage';

interface AcademyLessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AcademyLessonsModal: React.FC<AcademyLessonsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'lessons' | 'concepts' | 'code'>('lessons');

  // Lessons State
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [lessonSearch, setLessonSearch] = useState('');
  const [selectedPersonaFilter, setSelectedPersonaFilter] = useState<string>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInputValue, setNoteInputValue] = useState('');

  // Concepts Log State
  const [concepts, setConcepts] = useState<SavedConcept[]>([]);
  const [conceptSearch, setConceptSearch] = useState('');
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [speakingConceptId, setSpeakingConceptId] = useState<string | null>(null);
  const [copiedConceptId, setCopiedConceptId] = useState<string | null>(null);

  // Code Vault State
  const [codeSnippets, setCodeSnippets] = useState<SavedCodeSnippet[]>([]);
  const [codeSearch, setCodeSearch] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Deletion Confirmation States
  const [lessonToDelete, setLessonToDelete] = useState<{ id: string; title: string } | null>(null);
  const [conceptToDelete, setConceptToDelete] = useState<{ id: string; concept: string } | null>(null);
  const [codeToDelete, setCodeToDelete] = useState<{ id: string; title: string } | null>(null);

  // Load from safeStorage
  const loadData = () => {
    try {
      setLessons(safeStorage.getJson<SavedLesson[]>('mindmirror_saved_lessons', []));
      setConcepts(safeStorage.getJson<SavedConcept[]>('mindmirror_saved_concepts', []));
      setCodeSnippets(safeStorage.getJson<SavedCodeSnippet[]>('mindmirror_saved_code', []));
    } catch (e) {
      console.error('[Storage] Error loading academy archive data:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingConceptId(null);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter lessons
  const filteredLessons = lessons.filter(l => {
    const matchesSearch = 
      l.title.toLowerCase().includes(lessonSearch.toLowerCase()) ||
      l.takeaway.toLowerCase().includes(lessonSearch.toLowerCase()) ||
      (l.quote && l.quote.toLowerCase().includes(lessonSearch.toLowerCase())) ||
      (l.tags && l.tags.some(t => t.toLowerCase().includes(lessonSearch.toLowerCase())));

    const matchesPersona = selectedPersonaFilter === 'all' || l.personaLabel === selectedPersonaFilter || l.sourcePersona === selectedPersonaFilter;

    return matchesSearch && matchesPersona;
  });

  // Filter concepts
  const filteredConcepts = concepts.filter(c => {
    return (
      c.concept.toLowerCase().includes(conceptSearch.toLowerCase()) ||
      c.baseExplanation.toLowerCase().includes(conceptSearch.toLowerCase()) ||
      c.fullExplanation.toLowerCase().includes(conceptSearch.toLowerCase()) ||
      c.personaName.toLowerCase().includes(conceptSearch.toLowerCase())
    );
  });

  // Filter code
  const filteredCode = codeSnippets.filter(c => {
    return (
      c.filePath.toLowerCase().includes(codeSearch.toLowerCase()) ||
      c.language.toLowerCase().includes(codeSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(codeSearch.toLowerCase())
    );
  });

  // Extract list of unique personas from lessons
  const personaOptions = Array.from(new Set(lessons.map(l => l.personaLabel || l.sourcePersona)));

  // Delete Lesson
  const handleDeleteLesson = (id: string) => {
    const updated = lessons.filter(l => l.id !== id);
    setLessons(updated);
    safeStorage.setItem('mindmirror_saved_lessons', JSON.stringify(updated));
    toast({
      title: 'تم حذف الدرس',
      message: 'تم إزالة الدرس من السجل المحلي.',
      type: 'info'
    });
  };

  // Save Note edit
  const handleSaveNote = (id: string) => {
    const updated = lessons.map(l => l.id === id ? { ...l, notes: noteInputValue } : l);
    setLessons(updated);
    safeStorage.setItem('mindmirror_saved_lessons', JSON.stringify(updated));
    setEditingNoteId(null);
    toast({
      title: 'تم تحديث الملاحظة',
      message: 'تم حفظ الملاحظة الخاصة بالدرس بنجاح.',
      type: 'success'
    });
  };

  // Export Lessons as Markdown
  const handleExportLessonsMarkdown = () => {
    if (lessons.length === 0) return;

    let md = `# 🏛️ أرشيف دروس المحراب المعرفي - MindMirror Academy\n\n`;
    md += `*تم التصدير بتاريخ: ${new Date().toLocaleDateString('ar-EG')}*\n\n---\n\n`;

    lessons.forEach((l, idx) => {
      md += `## ${idx + 1}. ${l.title}\n`;
      md += `- **المستنبط منه:** ${l.personaLabel || l.sourcePersona}\n`;
      md += `- **التاريخ:** ${new Date(l.createdAt).toLocaleDateString('ar-EG')}\n`;
      if (l.tags && l.tags.length > 0) {
        md += `- **الوسوم:** ${l.tags.map(t => `#${t}`).join(' ')}\n`;
      }
      if (l.quote) {
        md += `\n> *"${l.quote}"*\n`;
      }
      md += `\n### 💡 الجوهر والفائدة المستخلصة:\n${l.takeaway}\n`;
      if (l.notes) {
        md += `\n### 📝 ملاحظات وتأملات الطالب:\n${l.notes}\n`;
      }
      md += `\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmirror_academy_lessons_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'تم تصدير الدروس',
      message: 'تم تحميل كافة الدروس بتنسيق Markdown.',
      type: 'success'
    });
  };

  // Delete Concept
  const handleDeleteConcept = (id: string) => {
    const updated = concepts.filter(c => c.id !== id);
    setConcepts(updated);
    safeStorage.setItem('mindmirror_saved_concepts', JSON.stringify(updated));
    if (activeCardIndex >= updated.length && updated.length > 0) {
      setActiveCardIndex(updated.length - 1);
    }
    toast({
      title: 'تم حذف الشرح',
      message: 'تم إزالة الشرح المعرفي من الأرشيف.',
      type: 'info'
    });
  };

  // Export Concepts Markdown
  const handleExportConceptsMarkdown = () => {
    if (concepts.length === 0) return;

    let md = `# 🧠 أرشيف شروحات المفاهيم الذكية - MindMirror Academy\n\n`;
    md += `*تم التصدير بتاريخ: ${new Date().toLocaleDateString('ar-EG')}*\n\n---\n\n`;

    concepts.forEach((c, idx) => {
      md += `## ${idx + 1}. المفهوم: ${c.concept}\n`;
      md += `- **الشخصية المصدر:** ${c.personaName}\n`;
      md += `- **تاريخ التدوين:** ${new Date(c.createdAt).toLocaleDateString('ar-EG')}\n`;
      md += `- **التعريف الأولي:** ${c.baseExplanation}\n`;
      md += `- **سياق الحوار:** "${c.messageContext}"\n\n`;
      md += `### 📖 الشرح التفصيلي والتوليدي:\n${c.fullExplanation}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmirror_academy_concepts_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'تم تصدير سجل المفاهيم',
      message: 'تم تحميل كافة شروحات المفاهيم بتنسيق Markdown.',
      type: 'success'
    });
  };

  // Concept Audio Speech
  const handleSpeakConcept = (c: SavedConcept) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast({
        title: 'عذراً',
        message: 'متصفحك لا يدعم القراءة الصوتية للنصوص.',
        type: 'error'
      });
      return;
    }
    if (speakingConceptId === c.id) {
      window.speechSynthesis.cancel();
      setSpeakingConceptId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = c.fullExplanation.replace(/[#*`_~]/g, '').replace(/---/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingConceptId(null);
    utterance.onerror = () => setSpeakingConceptId(null);
    setSpeakingConceptId(c.id);
    window.speechSynthesis.speak(utterance);
  };

  // Copy Concept Text
  const handleCopyConcept = (c: SavedConcept) => {
    copyToClipboard(`المفهوم: ${c.concept}\n\nالشرح:\n${c.fullExplanation}`);
    setCopiedConceptId(c.id);
    setTimeout(() => setCopiedConceptId(null), 2000);
    toast({
      title: 'تم نسخ الشرح',
      message: 'تم نسخ نص الشرح المعرفي بنجاح.',
      type: 'success'
    });
  };

  // Delete Code Snippet
  const handleDeleteCode = (id: string) => {
    const updated = codeSnippets.filter(c => c.id !== id);
    setCodeSnippets(updated);
    safeStorage.setItem('mindmirror_saved_code', JSON.stringify(updated));
    toast({
      title: 'تم حذف الكود',
      message: 'تم إزالة الكود من مكتبة الأكواد.',
      type: 'info'
    });
  };

  // Copy Code
  const handleCopyCode = (code: string, id: string) => {
    copyToClipboard(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
    toast({
      title: 'تم نسخ الكود',
      message: 'تم نسخ الكود إلى الحافظة بنجاح.',
      type: 'success'
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="bg-surface border border-border/80 rounded-3xl max-w-4xl w-[96%] max-h-[94vh] flex flex-col shadow-2xl relative overflow-hidden my-auto mx-auto"
          dir="rtl"
        >
          {/* Header Bar */}
          <div className="p-6 border-b border-border/60 flex items-center justify-between gap-4 flex-wrap bg-surface2/40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-sm">
                <GraduationCap size={26} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text flex items-center gap-2">
                  <span>محراب المحاصيل المعرفية</span>
                  <span className="text-xs bg-accent/15 text-accent border border-accent/30 px-2.5 py-0.5 rounded-full font-mono">
                    Academy Vault
                  </span>
                </h2>
                <p className="text-xs text-muted mt-0.5">سجل الدروس، شروحات المفاهيم الذكية، والأكواد المبرمجة من نقاشات الحكماء</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Export Markdown Buttons */}
              {activeTab === 'lessons' && lessons.length > 0 && (
                <button
                  onClick={handleExportLessonsMarkdown}
                  className="px-3 py-2 rounded-xl bg-surface2 hover:bg-surface3 border border-border/70 text-xs font-bold text-accent hover:text-accent-hover transition-colors flex items-center gap-1.5"
                  title="تصدير جميع الدروس كملف Markdown"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">تصدير الدروس</span>
                </button>
              )}

              {activeTab === 'concepts' && concepts.length > 0 && (
                <button
                  onClick={handleExportConceptsMarkdown}
                  className="px-3 py-2 rounded-xl bg-surface2 hover:bg-surface3 border border-border/70 text-xs font-bold text-accent hover:text-accent-hover transition-colors flex items-center gap-1.5"
                  title="تصدير سجل شروحات المفاهيم كملف Markdown"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">تصدير المفاهيم</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2.5 text-muted hover:text-text rounded-2xl hover:bg-surface2 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 pt-3 bg-surface2/20 border-b border-border/50 flex items-center gap-4 shrink-0 flex-wrap">
            <button
              onClick={() => setActiveTab('lessons')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'lessons' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'}`}
            >
              <BookOpen size={16} />
              <span>دفتر الدروس المعرفية ({lessons.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('concepts')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'concepts' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'}`}
            >
              <Brain size={16} />
              <span>سجل شروحات المفاهيم ({concepts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'code' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'}`}
            >
              <Code2 size={16} />
              <span>مكتبة الأكواد والتجارب ({codeSnippets.length})</span>
            </button>
          </div>

          {/* Tab 1: Saved Lessons */}
          {activeTab === 'lessons' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Controls Bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={lessonSearch}
                    onChange={(e) => setLessonSearch(e.target.value)}
                    placeholder="ابحث في عنوان الدرس، الفائدة، أو الوسوم..."
                    className="w-full bg-surface2 border border-border/70 rounded-2xl pe-10 ps-4 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  />
                  {lessonSearch && (
                    <button onClick={() => setLessonSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-text">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Persona Filter Dropdown */}
                {personaOptions.length > 0 && (
                  <select
                    value={selectedPersonaFilter}
                    onChange={(e) => setSelectedPersonaFilter(e.target.value)}
                    className="bg-surface2 border border-border/70 text-xs text-text rounded-2xl px-3 py-2 focus:outline-none focus:border-accent"
                  >
                    <option value="all">جميع الشخصيات</option>
                    {personaOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Lessons List */}
              {filteredLessons.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted">
                  <GraduationCap size={48} className="text-muted/40 mb-3" />
                  <p className="text-sm font-bold text-text/80">لا توجد دروس مستخلصة محفوظة بعد</p>
                  <p className="text-xs text-muted max-w-sm mt-1">
                    أثناء تحاورك مع الشخصيات والمفكرين، اضغط على زر "استخلاص درس" تحت أي إجابة لحفظ الفائدة الجوهرية هنا.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredLessons.map((l) => (
                    <motion.div
                      key={l.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-surface2/60 border border-border/70 hover:border-accent/50 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md relative group"
                    >
                      <div>
                        {/* Title & Delete */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-sm text-text leading-snug flex-1">
                            {l.title}
                          </h3>
                          <button
                            onClick={() => setLessonToDelete({ id: l.id, title: l.title })}
                            className="p-1.5 text-muted hover:text-rose-400 rounded-lg hover:bg-surface opacity-0 group-hover:opacity-100 transition-opacity"
                            title="حذف الدرس"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Speaker & Date */}
                        <div className="flex items-center gap-3 text-[11px] text-accent mb-3 font-semibold">
                          <span className="bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20">
                            {l.personaLabel || l.sourcePersona}
                          </span>
                          <span className="text-muted/70 flex items-center gap-1 font-mono text-[10px]">
                            <Calendar size={11} />
                            {new Date(l.createdAt).toLocaleDateString('ar-EG')}
                          </span>
                        </div>

                        {/* Quote if present */}
                        {l.quote && (
                          <div className="bg-surface border-r-2 border-accent p-2.5 rounded-l-xl text-xs text-text/90 italic mb-3">
                            "{l.quote}"
                          </div>
                        )}

                        {/* Takeaway */}
                        <div className="text-xs text-text/90 leading-relaxed mb-4 bg-surface/50 p-3 rounded-xl border border-border/40">
                          <p className="font-semibold text-accent mb-1 text-[11px]">💡 الدرس والمحتوى:</p>
                          <p className="whitespace-pre-line">{l.takeaway}</p>
                        </div>

                        {/* Student Note Area */}
                        <div className="mt-2 pt-2 border-t border-border/40">
                          {editingNoteId === l.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={noteInputValue}
                                onChange={(e) => setNoteInputValue(e.target.value)}
                                rows={2}
                                className="w-full bg-surface border border-border rounded-xl p-2 text-xs text-text focus:outline-none focus:border-accent resize-none"
                                placeholder="اكتب تأملاتك حول هذا الدرس..."
                              />
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => setEditingNoteId(null)} className="text-[11px] text-muted hover:text-text px-2 py-1">إلغاء</button>
                                <button onClick={() => handleSaveNote(l.id)} className="text-[11px] bg-accent text-bg px-3 py-1 rounded-lg font-bold">حفظ الملاحظة</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[11px] text-muted">
                              <span className="truncate max-w-[80%] font-sans">
                                {l.notes ? `📝 ملاحظتك: ${l.notes}` : 'لم تُضف ملاحظة شخصية بعد'}
                              </span>
                              <button
                                onClick={() => { setEditingNoteId(l.id); setNoteInputValue(l.notes || ''); }}
                                className="text-accent hover:underline flex items-center gap-1 shrink-0 font-bold"
                              >
                                <Edit3 size={12} />
                                <span>{l.notes ? 'تعديل' : '+ ملاحظة'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      {l.tags && l.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30">
                          {l.tags.map((t, idx) => (
                            <span key={idx} className="bg-surface border border-border/50 text-[10px] text-muted px-2 py-0.5 rounded-full">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Saved Concepts */}
          {activeTab === 'concepts' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Top Controls Bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={conceptSearch}
                    onChange={(e) => setConceptSearch(e.target.value)}
                    placeholder="ابحث في شروحات المفاهيم، أسماء المصطلحات..."
                    className="w-full bg-surface2 border border-border/70 rounded-2xl pe-10 ps-4 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  />
                  {conceptSearch && (
                    <button onClick={() => setConceptSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-text">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* View Mode Toggle Button (Grid vs Study Flashcards) */}
                <button
                  onClick={() => {
                    setIsFlashcardMode(!isFlashcardMode);
                    setIsCardFlipped(false);
                  }}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isFlashcardMode 
                      ? 'bg-accent/15 border-accent text-accent shadow-sm' 
                      : 'bg-surface2 border-border/70 text-muted hover:text-text hover:border-accent'
                  }`}
                >
                  <Layers size={15} />
                  <span>{isFlashcardMode ? 'نمط عرض القائمة' : 'نمط بطاقات المراجعة (Flashcards)'}</span>
                </button>
              </div>

              {filteredConcepts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted">
                  <Brain size={48} className="text-muted/40 mb-3" />
                  <p className="text-sm font-bold text-text/80">لا توجد شروحات مفاهيم محفوظة بعد</p>
                  <p className="text-xs text-muted max-w-sm mt-1">
                    عندما ينبثق لك "مفسر المفاهيم الذكي" اضغط على زر "حفظ في سجل المفاهيم" لأرشفة الشرح التوليدي هنا.
                  </p>
                </div>
              ) : isFlashcardMode ? (
                /* FLASHCARD STUDY REVISION MODE */
                <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full space-y-5">
                  <div className="flex items-center justify-between w-full text-xs text-muted font-bold px-2">
                    <span>بطاقة مراجعة {activeCardIndex + 1} من {filteredConcepts.length}</span>
                    <span className="text-accent flex items-center gap-1">
                      <Lightbulb size={14} />
                      انقر على البطاقة لكشف الشرح
                    </span>
                  </div>

                  {/* Flashcard Component */}
                  {filteredConcepts[activeCardIndex] && (
                    <motion.div
                      key={filteredConcepts[activeCardIndex].id}
                      onClick={() => setIsCardFlipped(!isCardFlipped)}
                      className="w-full min-h-[320px] bg-gradient-to-br from-surface2 via-surface to-surface2 border-2 border-accent/30 hover:border-accent rounded-3xl p-6 md:p-8 flex flex-col justify-between cursor-pointer shadow-xl relative transition-all group select-none"
                    >
                      {!isCardFlipped ? (
                        /* Front Side */
                        <div className="flex flex-col items-center justify-center text-center my-auto space-y-4">
                          <span className="text-xs font-bold bg-accent/15 text-accent border border-accent/30 px-3 py-1 rounded-full uppercase tracking-wider">
                            المفهوم المعرفي
                          </span>
                          <h2 className="text-2xl md:text-3xl font-black text-text">
                            {filteredConcepts[activeCardIndex].concept}
                          </h2>
                          <p className="text-xs text-muted max-w-md italic">
                            « {filteredConcepts[activeCardIndex].baseExplanation} »
                          </p>
                          <div className="pt-4 flex items-center gap-2 text-xs font-bold text-accent animate-pulse">
                            <Sparkles size={16} />
                            <span>انقر لكشف الشرح والتحليل الجراحي</span>
                          </div>
                        </div>
                      ) : (
                        /* Back Side (Revealed Answer) */
                        <div className="space-y-4 text-start overflow-y-auto max-h-[360px] pl-1 pr-1">
                          <div className="flex items-center justify-between border-b border-border/60 pb-2">
                            <span className="text-xs font-bold text-accent">الشرح التوليدي المستخلص</span>
                            <span className="text-[11px] text-muted">الشخصية المصدر: {filteredConcepts[activeCardIndex].personaName}</span>
                          </div>
                          <div className="markdown-body text-xs leading-relaxed text-text">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {filteredConcepts[activeCardIndex].fullExplanation}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Card Footer info */}
                      <div className="flex items-center justify-between pt-4 border-t border-border/40 text-[11px] text-muted font-sans shrink-0">
                        <span>المصدر: {filteredConcepts[activeCardIndex].personaName}</span>
                        <span>{isCardFlipped ? 'انقر للقلب مجدداً 🔄' : 'وجه البطاقة (الوجه الأول)'}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Flashcard Navigation */}
                  <div className="flex items-center gap-4 pt-2">
                    <button
                      onClick={() => {
                        setActiveCardIndex((prev) => (prev > 0 ? prev - 1 : filteredConcepts.length - 1));
                        setIsCardFlipped(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-surface2 border border-border text-xs font-bold hover:border-accent hover:text-accent transition-all flex items-center gap-2"
                    >
                      <ArrowRight size={16} />
                      <span>السابق</span>
                    </button>

                    <button
                      onClick={() => setIsCardFlipped(!isCardFlipped)}
                      className="px-5 py-2 rounded-xl bg-accent text-bg text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      <RotateCw size={14} />
                      <span>قلب البطاقة</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveCardIndex((prev) => (prev < filteredConcepts.length - 1 ? prev + 1 : 0));
                        setIsCardFlipped(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-surface2 border border-border text-xs font-bold hover:border-accent hover:text-accent transition-all flex items-center gap-2"
                    >
                      <span>التالي</span>
                      <ArrowLeft size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                /* GRID LIST OF CONCEPTS */
                <div className="space-y-4">
                  {filteredConcepts.map((c) => (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-surface2/60 border border-border/70 hover:border-accent/40 rounded-2xl p-5 flex flex-col gap-3 transition-all shadow-sm"
                    >
                      {/* Concept Header */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] bg-accent/15 text-accent border border-accent/30 font-bold px-2 py-0.5 rounded-full">
                              مفهوم معرفي
                            </span>
                            <span className="text-xs font-bold text-muted">
                              المتحدث: {c.personaName}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-text">{c.concept}</h3>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSpeakConcept(c)}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                              speakingConceptId === c.id
                                ? 'bg-accent/20 border-accent text-accent'
                                : 'bg-surface2 border-border/70 text-muted hover:text-text hover:border-accent'
                            }`}
                            title="استمع للشرح بالصوت"
                          >
                            {speakingConceptId === c.id ? <VolumeX size={15} /> : <Volume2 size={15} />}
                          </button>

                          <button
                            onClick={() => handleCopyConcept(c)}
                            className="p-2 rounded-xl bg-surface2 border border-border/70 text-muted hover:text-text hover:border-accent transition-all"
                            title="نسخ الشرح"
                          >
                            {copiedConceptId === c.id ? <CheckCheck size={15} className="text-emerald-400" /> : <Copy size={15} />}
                          </button>

                          <button
                            onClick={() => setConceptToDelete({ id: c.id, concept: c.concept })}
                            className="p-2 rounded-xl bg-surface2 border border-border/70 text-muted hover:text-rose-400 hover:border-rose-500/50 transition-all"
                            title="حذف المفهوم"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Base Explanation & Context */}
                      {c.baseExplanation && (
                        <p className="text-xs text-muted italic bg-surface/60 p-2.5 rounded-xl border border-border/30">
                          « {c.baseExplanation} »
                        </p>
                      )}

                      {/* Full Markdown Explanation */}
                      <div className="markdown-body text-xs leading-relaxed text-text bg-bg/40 p-4 rounded-xl border border-border/40 max-h-60 overflow-y-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {c.fullExplanation}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Code Vault */}
          {activeTab === 'code' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  placeholder="ابحث باسم الملف أو اللغة أو الكود..."
                  className="w-full bg-surface2 border border-border/70 rounded-2xl pe-10 ps-4 py-2 text-xs text-text focus:outline-none focus:border-accent"
                />
              </div>

              {/* Code List */}
              {filteredCode.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted">
                  <Code2 size={48} className="text-muted/40 mb-3" />
                  <p className="text-sm font-bold text-text/80">لا يوجد كود محفوظ في المكتبة بعد</p>
                  <p className="text-xs text-muted max-w-sm mt-1">
                    اضغط على أيقونة الإشارة المرجعية (🔖) على أي مربع كود داخل المحادثات لأرشفته هنا.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCode.map((c) => (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#0f172a] border border-border/80 rounded-2xl overflow-hidden shadow-sm"
                    >
                      <div className="bg-[#1e293b] px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-mono">
                        <div className="flex items-center gap-2 truncate">
                          <FileCode size={16} className="text-accent shrink-0" />
                          <span className="font-bold text-slate-200 dir-ltr text-left truncate">{c.filePath}</span>
                          <span className="px-2 py-0.5 rounded bg-surface2 text-[10px] text-accent3 uppercase">
                            {c.language}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCopyCode(c.code, c.id)}
                            className="p-1.5 rounded bg-surface2 hover:bg-surface3 text-slate-300 hover:text-white transition-colors"
                            title="نسخ الكود"
                          >
                            {copiedCodeId === c.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                          <button
                            onClick={() => setCodeToDelete({ id: c.id, title: c.filePath })}
                            className="p-1.5 rounded bg-surface2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="حذف الملف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-[#090d16] font-mono text-xs text-slate-300 max-h-48 overflow-y-auto dir-ltr text-left whitespace-pre">
                        {c.code}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      <ConfirmModal
        isOpen={!!lessonToDelete}
        title="حذف الدرس الأكاديمي"
        message={`هل أنت متأكد من رغبتك في حذف درس "${lessonToDelete?.title}" من السجل المحلي؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف الدرس"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          if (lessonToDelete) {
            handleDeleteLesson(lessonToDelete.id);
            setLessonToDelete(null);
          }
        }}
        onCancel={() => setLessonToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!conceptToDelete}
        title="حذف المفهوم المعرفي"
        message={`هل أنت متأكد من رغبتك في حذف شرح مفهوم "${conceptToDelete?.concept}" من سجل المفاهيم المحلي؟`}
        confirmText="نعم، احذف المفهوم"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          if (conceptToDelete) {
            handleDeleteConcept(conceptToDelete.id);
            setConceptToDelete(null);
          }
        }}
        onCancel={() => setConceptToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!codeToDelete}
        title="حذف الشيفرة البرمجية"
        message={`هل أنت متأكد من رغبتك في حذف ملف الكود "${codeToDelete?.title}" من خزينة الأكواد؟`}
        confirmText="نعم، احذف الشيفرة"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          if (codeToDelete) {
            handleDeleteCode(codeToDelete.id);
            setCodeToDelete(null);
          }
        }}
        onCancel={() => setCodeToDelete(null)}
      />
    </AnimatePresence>
  );
};
