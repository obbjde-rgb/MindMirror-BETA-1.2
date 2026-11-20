import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Search, Globe, Plus, X, RefreshCw, Check, Eye, 
  Layers, Compass, BookOpen, Wand2, Trash2, Bookmark, Copy 
} from 'lucide-react';
import { GroundedImageResponse, GroundedImageResult } from '../types';
import { getApiKey } from '../utils/gemini';
import { copyToClipboard as copyTextToClipboard } from '../utils/clipboard';
import ConfirmModal from './ConfirmModal';

interface GroundedImageAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePersona?: string;
  discussionContext?: string;
  onInsertImageToChat?: (imageUrl: string, title: string, sourceUri: string) => void;
  isStrictModelMode?: boolean;
}

export const GroundedImageAssistantModal: React.FC<GroundedImageAssistantModalProps> = ({
  isOpen,
  onClose,
  activePersona,
  discussionContext = '',
  onInsertImageToChat,
  isStrictModelMode = false
}) => {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'web_grounding' | 'predictive_context' | 'archive_search' | 'visual_synthesis'>('web_grounding');
  const [searchType, setSearchType] = useState<'photo' | 'diagram' | 'historical' | 'infographic'>('photo');
  const [imageModel, setImageModel] = useState<string>('gemini-3.1-flash-lite-image');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<GroundedImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GroundedImageResult | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [savedArchive, setSavedArchive] = useState<Array<any>>([]);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [generatedAiImages, setGeneratedAiImages] = useState<Array<any>>([]);
  const [analysisResult, setAnalysisResult] = useState<{
    analysis: string;
    enhancedPrompt: string;
    suggestedEnhancements: string[];
  } | null>(null);
  const [imageToDeleteId, setImageToDeleteId] = useState<string | null>(null);

  const presets = [
    'المغرب وتطوير ميناء طنجة المتوسط',
    'خرائط ورسومات بيانية عن AGI والذكاء الاصطناعي',
    'معركة وادي المخازن التاريخية والأرشيف المصور',
    'استكشاف الفضاء ومقر ناسا والنظام الشمسي',
    'الأمن السايبراني والبنية التحتية للمعلومات'
  ];

  const searchCategories = [
    { 
      id: 'photo', 
      name: '📷 صور فوتوغرافية', 
      desc: 'معالم، طبيعة، أشخاص، ولقطات واقعية HD',
      tip: 'اختر صوراً فوتوغرافية لنتائج واقعية عالية الدقة للمشاهد الطبيعية والمباني والأشخاص واللقطات الحية.'
    },
    { 
      id: 'diagram', 
      name: '📊 رسوم بيانية وتوضيحية', 
      desc: 'مخططات، هياكل مفاهيمية، وشروحات',
      tip: 'اختر الرسوم البيانية والتوضيحية للحصول على مخططات هندسية وهياكل مفاهيمية ودراسات تشريحية وشروحات علمية.'
    },
    { 
      id: 'historical', 
      name: '📜 وثائق وصور تاريخية', 
      desc: 'أرشيفات تاريخية، مخطوطات والمعارك القديمة',
      tip: 'اختر الوثائق والصور التاريخية للوصول للأرشيفات الرسمية، والمخطوطات القديمة، وصور المعارك والشخصيات التاريخية.'
    },
    { 
      id: 'infographic', 
      name: '📈 خرائط وإنفوجرافيك', 
      desc: 'خرائط جغرافية، بيانات بصرية وبنى تحتية',
      tip: 'اختر الخرائط والإنفوجرافيك للحصول على تحليلات بصرية للبيانات والإحصائيات ورسوم توزيع البنية التحتية والمواقع الجغرافية.'
    }
  ];

  const geminiModels = [
    { id: 'gemini-3.1-flash-lite-image', name: 'Nano Banana 2 Lite', badge: 'سريع ومجاني', desc: 'توليد سريع ضمن الحصة المجانية' },
    { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2 (Flash)', badge: 'متوازن عالي الدقة', desc: 'دقة عالية لتفاصيل واضحة' },
    { id: 'gemini-3-pro-image', name: 'Nano Banana Pro', badge: 'احترافي بلس', desc: 'صور إبداعية فنية بدقة فائقة' },
    { id: 'gemini-nano-banana-2.1', name: 'Nano Banana 2.1', badge: 'فائق الجودة', desc: 'أعلى دقة لتوليد الصور والتفاصيل المعقدة' },
    { id: 'gemini-2.5-flash-image', name: 'Legacy Flash (2.5)', badge: 'مستقر', desc: 'الجيل السابق السريع والموثوق' }
  ];

  useEffect(() => {
    if (isOpen) {
      fetchSavedArchive();
      if (discussionContext && !prompt) {
        setPrompt(discussionContext.slice(0, 150));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchSavedArchive = async () => {
    try {
      const res = await fetch('/api/saved-images');
      if (res.ok) {
        const data = await res.json();
        setSavedArchive(data.savedImages || []);
      }
    } catch (err) {
      console.error("Failed to load archive", err);
    }
  };

  const handleSaveToArchive = async (img: any) => {
    try {
      const res = await fetch('/api/saved-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: img.title || 'صورة محفوظة',
          imageUrl: img.url || img.imageUrl,
          sourceDomain: img.sourceDomain || 'أرشيف شخصي',
          sourceUri: img.sourceUri || img.url || img.imageUrl,
          description: img.description || 'تم الحفظ من منصة الصور',
          category: mode === 'visual_synthesis' ? 'توليد AI' : 'ويب'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.savedImages) {
          setSavedArchive(data.savedImages);
          setSavedSuccessMsg(`تم حفظ "${img.title?.slice(0, 30) || 'الصورة'}" في الأرشيف!`);
          setTimeout(() => setSavedSuccessMsg(null), 3000);
        }
      }
    } catch (err) {
      console.error("Failed to save image", err);
    }
  };

  const handleDeleteFromArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/saved-images/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setSavedArchive(data.savedImages || []);
      }
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleWebSearch = async (queryToUse?: string) => {
    const finalPrompt = queryToUse || prompt;
    if (!finalPrompt.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/grounded-image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, searchType, imageModel, discussionContext, apiKey: getApiKey(), strictModel: isStrictModelMode })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'فشل في استرجاع الصور');
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال بالخادم. حاول مجدداً.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAiImage = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: imageModel, aspectRatio, apiKey: getApiKey(), strictModel: isStrictModelMode })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'فشل التوليد. تأكد من حصة API.');
      if (data.image) setGeneratedAiImages(prev => [data.image, ...prev]);
    } catch (err: any) {
      setError(err.message || 'خطأ أثناء توليد الصورة بالذكاء الاصطناعي.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeAndEnhance = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze-and-enhance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, apiKey: getApiKey(), strictModel: isStrictModelMode })
      });
      const data = await res.json();
      if (data) setAnalysisResult(data);
    } catch (err: any) {
      setError(err.message || 'خطأ أثناء تحليل الوصف البصري.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2500);
    }
  };

  const currentCategoryTip = searchCategories.find(c => c.id === searchType)?.tip || '';
  const filteredArchive = savedArchive.filter(img => 
    (img.title || '').toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
    (img.description || '').toLowerCase().includes(archiveSearchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex flex-col items-center p-2 sm:p-4 md:p-6 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full max-h-[94vh] md:max-h-[90vh] my-auto"
        >
          {/* Header */}
          <div className="flex-none flex items-center justify-between px-4 sm:px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 z-20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-indigo-500/20 to-emerald-500/20 border border-amber-500/30 text-amber-400">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-100 flex flex-wrap items-center gap-2">
                  منصة البحث والتوليد البصري
                  <span className="text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Gemini Vision Suite
                  </span>
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">
                  محرك متقدم للبحث والتأصيل البصري، وتوليد الصور، والأرشفة الفنية.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-200" style={{ scrollbarWidth: 'thin' }}>
            
            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800 shrink-0">
              <button
                onClick={() => setMode('web_grounding')}
                className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  mode === 'web_grounding'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Globe className="w-4 h-4 hidden sm:block" />
                بحث الصور
              </button>
              <button
                onClick={() => setMode('archive_search')}
                className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  mode === 'archive_search'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <BookOpen className="w-4 h-4 hidden sm:block" />
                الأرشيف ({savedArchive.length})
              </button>
              <button
                onClick={() => setMode('visual_synthesis')}
                className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  mode === 'visual_synthesis'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Layers className="w-4 h-4 hidden sm:block" />
                توليد بالـ AI
              </button>
              <button
                onClick={() => setMode('predictive_context')}
                className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  mode === 'predictive_context'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Wand2 className="w-4 h-4 hidden sm:block" />
                تحليل الصور
              </button>
            </div>

            {/* Success/Error Banners */}
            <AnimatePresence>
              {savedSuccessMsg && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-2"><Check className="w-4 h-4" />{savedSuccessMsg}</span>
                  <button onClick={() => setSavedSuccessMsg(null)} className="text-emerald-400"><X className="w-4 h-4" /></button>
                </motion.div>
              )}
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-2"><X className="w-4 h-4" />{error}</span>
                  <button onClick={() => setError(null)} className="text-rose-400"><X className="w-4 h-4" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB 1: WEB GROUNDING */}
            {mode === 'web_grounding' && (
              <div className="space-y-4 animate-fade-in shrink-0">
                {/* Presets */}
                <div>
                  <span className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    استكشافات جاهزة:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {presets.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setPrompt(preset); handleWebSearch(preset); }}
                        className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                  <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    الفئة البصرية
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {searchCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSearchType(cat.id as any)}
                        className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between min-h-[90px] ${
                          searchType === cat.id
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-1 ring-amber-500/30 shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="text-sm font-bold block mb-1">{cat.name}</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{cat.desc}</span>
                      </button>
                    ))}
                  </div>
                  <motion.div 
                    key={searchType}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span><strong className="text-amber-200 mr-1">نصيحة:</strong>{currentCategoryTip}</span>
                  </motion.div>
                </div>

                <div className="relative bg-slate-950/80 border border-slate-800 rounded-2xl p-3 focus-within:border-amber-500/50 shadow-inner transition-colors">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="اكتب الموضوع للبحث عن الصور في الويب..."
                    className="w-full bg-transparent text-slate-100 text-sm focus:outline-none resize-none h-16 placeholder-slate-500"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 mt-2">
                    <span className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:flex items-center gap-1">
                      <Globe className="w-3 h-3 text-amber-400" />
                      محرك البحث المباشر
                    </span>
                    <button
                      onClick={() => handleWebSearch()}
                      disabled={isLoading || !prompt.trim()}
                      className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-lg disabled:opacity-50 transition-all"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      جلب الصور
                    </button>
                  </div>
                </div>

                {response && (
                  <div className="space-y-4 pt-4 border-t border-slate-800/80">
                    <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-2xl text-xs text-slate-300 shadow-sm">
                      <h3 className="font-bold text-amber-300 mb-2">تحليل السياق البصري:</h3>
                      <p className="leading-relaxed">{response.analysis}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {response.images.map((img, idx) => (
                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between group">
                          <div className="aspect-video relative overflow-hidden bg-slate-900 cursor-pointer" onClick={() => setSelectedImage(img)}>
                            <img src={img.url} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                          <div className="p-3 space-y-2">
                            <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{img.title}</h4>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="truncate max-w-[120px]">{img.sourceDomain}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => handleSaveToArchive(img)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-all" title="حفظ بالأرشيف">
                                  <Bookmark className="w-3.5 h-3.5" />
                                </button>
                                {onInsertImageToChat && (
                                  <button onClick={() => onInsertImageToChat(img.url, img.title, img.sourceUri)} className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition-all" title="إدراج في المحادثة">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ARCHIVE */}
            {mode === 'archive_search' && (
              <div className="space-y-4 animate-fade-in shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <Search className="w-4 h-4 text-slate-500 absolute top-3.5 right-3" />
                    <input
                      type="text"
                      value={archiveSearchQuery}
                      onChange={(e) => setArchiveSearchQuery(e.target.value)}
                      placeholder="ابحث في أرشيف الصور المحفوظة..."
                      className="w-full bg-transparent pr-8 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <button onClick={fetchSavedArchive} className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all" title="تحديث">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {filteredArchive.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/80 border-dashed">
                    <BookOpen className="w-12 h-12 mx-auto text-slate-600" />
                    <h3 className="text-base font-bold text-slate-300">الأرشيف فارغ</h3>
                    <p className="text-sm">قم بحفظ الصور من نتائج البحث لتجدها هنا لاحقاً.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredArchive.map((img) => (
                      <div key={img.id} className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between group">
                        <div className="aspect-video relative overflow-hidden bg-slate-900 cursor-pointer" onClick={() => setSelectedImage(img)}>
                          <img src={img.imageUrl} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded bg-slate-900/90 text-amber-300 border border-slate-700">
                            {img.category || 'محفوظ'}
                          </span>
                        </div>
                        <div className="p-3 space-y-2">
                          <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{img.title}</h4>
                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between mt-2">
                            <span className="text-[10px] text-slate-500">{img.savedAt}</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setImageToDeleteId(img.id)} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all" title="حذف من الأرشيف">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {onInsertImageToChat && (
                                <button onClick={() => onInsertImageToChat(img.imageUrl, img.title, img.sourceUri)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-bold transition-all">
                                  إدراج
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GENERATION */}
            {mode === 'visual_synthesis' && (
              <div className="space-y-4 animate-fade-in shrink-0">
                <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-2xl space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-indigo-200 mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" /> نموذج التوليد
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {geminiModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setImageModel(m.id)}
                          className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between min-h-[100px] ${
                            imageModel === m.id
                              ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100 ring-1 ring-indigo-400/30 shadow-md'
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-sm font-bold mb-1 block text-slate-100">{m.name}</span>
                          <span className="text-[10px] text-slate-400 mb-2 block">{m.desc}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 self-start w-fit mt-auto font-semibold">{m.badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-indigo-500/20 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">أبعاد الصورة:</span>
                    {['1:1', '16:9', '4:3', '9:16'].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          aspectRatio === ratio
                            ? 'bg-amber-500 text-slate-950 shadow-md'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative bg-slate-950/80 border border-slate-800 rounded-2xl p-3 focus-within:border-amber-500/50 shadow-inner transition-colors">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="وصف الصورة التي تود توليدها بأسلوب فني وسينمائي..."
                    className="w-full bg-transparent text-slate-100 text-sm focus:outline-none resize-none h-20 placeholder-slate-500"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 mt-2">
                    <button
                      onClick={handleGenerateAiImage}
                      disabled={isLoading || !prompt.trim()}
                      className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-lg disabled:opacity-50 transition-all"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                      توليد الصورة
                    </button>
                  </div>
                </div>

                {generatedAiImages.length > 0 && (
                  <div className="pt-4 space-y-4 border-t border-slate-800/80">
                    <h3 className="text-sm font-bold text-slate-200">أحدث الصور المولدة:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {generatedAiImages.map((genImg) => (
                        <div key={genImg.id} className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col group">
                          <div className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer" onClick={() => setSelectedImage(genImg)}>
                            <img src={genImg.url} alt={genImg.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 shadow-md">
                              توليد AI
                            </span>
                          </div>
                          <div className="p-3 space-y-2 flex-1 flex flex-col">
                            <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{genImg.title}</h4>
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between mt-auto">
                              <button onClick={() => handleSaveToArchive(genImg)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-all">
                                <Bookmark className="w-4 h-4" />
                              </button>
                              {onInsertImageToChat && (
                                <button onClick={() => onInsertImageToChat(genImg.url, genImg.title, genImg.sourceUri)} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition-all shadow-md">
                                  إدراج في المحادثة
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: ANALYSIS */}
            {mode === 'predictive_context' && (
              <div className="space-y-4 animate-fade-in shrink-0">
                <div className="relative bg-slate-950/80 border border-slate-800 rounded-2xl p-3 focus-within:border-amber-500/50 shadow-inner transition-colors">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="اكتب الفكرة البصرية ليقوم الذكاء الاصطناعي باستخراج وصف فني (Prompt) عالي الجودة..."
                    className="w-full bg-transparent text-slate-100 text-sm focus:outline-none resize-none h-20 placeholder-slate-500"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 mt-2">
                    <button
                      onClick={handleAnalyzeAndEnhance}
                      disabled={isLoading || !prompt.trim()}
                      className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-lg disabled:opacity-50 transition-all"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      تحليل وتحسين الوصف
                    </button>
                  </div>
                </div>

                {analysisResult && (
                  <div className="space-y-4 pt-2">
                    <div className="p-5 bg-slate-950 border border-amber-500/30 rounded-2xl space-y-3 shadow-sm">
                      <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" /> التحليل الفني والبصري:
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{analysisResult.analysis}</p>
                    </div>

                    <div className="p-5 bg-indigo-950/30 border border-indigo-500/40 rounded-2xl space-y-4">
                      <h4 className="text-sm font-bold text-indigo-200">الموجه المحسّن (Enhanced Prompt):</h4>
                      <div className="p-3 bg-slate-950 rounded-xl font-mono text-sm text-indigo-300 border border-slate-800 flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row shadow-inner">
                        <span className="flex-1 text-left">{analysisResult.enhancedPrompt}</span>
                        <button
                          onClick={() => copyToClipboard(analysisResult.enhancedPrompt)}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold shrink-0 flex items-center gap-2"
                        >
                          {copiedUrl === analysisResult.enhancedPrompt ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          نسخ
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.suggestedEnhancements?.map((enh, i) => (
                            <span key={i} className="text-[10px] sm:text-xs px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                              {enh}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setPrompt(analysisResult.enhancedPrompt);
                            setMode('visual_synthesis');
                            handleGenerateAiImage();
                          }}
                          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md w-full sm:w-auto justify-center"
                        >
                          <Layers className="w-4 h-4" />
                          توليد الصورة الآن
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Selected Image Full Screen Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[96vh] md:max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-900/90 z-10 shrink-0">
              <h3 className="text-base font-bold text-slate-100 line-clamp-1 flex-1 pr-4">{selectedImage.title}</h3>
              <button onClick={() => setSelectedImage(null)} className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-all shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-slate-950 relative">
              <img
                src={selectedImage.url || (selectedImage as any).imageUrl}
                alt={selectedImage.title}
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
              />
            </div>

            <div className="p-4 sm:p-6 bg-slate-900 border-t border-slate-800/80 space-y-4 shrink-0">
              <p className="text-sm text-slate-300 leading-relaxed">{selectedImage.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-slate-400" />
                  {selectedImage.sourceDomain}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => handleSaveToArchive(selectedImage)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all flex items-center gap-2 font-semibold text-xs sm:text-sm">
                    <Bookmark className="w-4 h-4" /> حفظ
                  </button>
                  {onInsertImageToChat && (
                    <button
                      onClick={() => {
                        onInsertImageToChat(selectedImage.url || (selectedImage as any).imageUrl, selectedImage.title, selectedImage.sourceUri || selectedImage.url);
                        setSelectedImage(null);
                        onClose();
                      }}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all flex items-center gap-2 text-xs sm:text-sm shadow-md"
                    >
                      <Plus className="w-4 h-4" /> إدراج للمناقشة
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!imageToDeleteId}
        title="حذف الصورة من الأرشيف"
        message="هل أنت متأكد من رغبتك في حذف هذه الصورة من الأرشيف الشخصي نهائياً؟"
        confirmText="نعم، احذف الصورة"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          if (imageToDeleteId) {
            handleDeleteFromArchive(imageToDeleteId);
            setImageToDeleteId(null);
          }
        }}
        onCancel={() => setImageToDeleteId(null)}
      />
    </AnimatePresence>
  );
};
