import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, Calendar, MessageSquare, ChevronLeft, Sparkles, User, Brain, 
  Download, Play, BookOpen, Layers, Radar, Swords, GraduationCap, RefreshCw, Loader2, Check
} from 'lucide-react';
import { Message } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import { getGeminiClient, withRetry } from '../utils/gemini';
import { useToast } from './Toast';

interface ChatSearchModalProps {
  show: boolean;
  onClose: () => void;
  chatHistory: Record<string, Message[]>;
  personas: Record<string, any>;
  onSelectResult: (personaKey: string, messageIndex: number) => void;
}

export default function ChatSearchModal({
  show,
  onClose,
  chatHistory,
  personas,
  onSelectResult
}: ChatSearchModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'review' | 'search'>('review');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'rooms' | 'personas'>('all');
  const [selectedPersonaFilter, setSelectedPersonaFilter] = useState<string>('all');
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizingKey, setSummarizingKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on open when in search tab
  useEffect(() => {
    if (show && activeTab === 'search') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [show, activeTab]);

  // Clean and map active conversation histories
  const allHistoryItems = useMemo(() => {
    const items: Array<{
      personaKey: string;
      personaLabel: string;
      personaColor: string;
      msg: Message;
      msgIndex: number;
    }> = [];

    Object.entries(chatHistory).forEach(([personaKey, messages]) => {
      const persona = personas[personaKey];
      let label = persona?.label || personaKey;
      if (personaKey === 'debate') label = 'المناظرة الفكرية';
      else if (personaKey === 'group_question') label = 'ندوة المعرفة (سؤال جماعي)';
      else if (personaKey === 'osint_room') label = 'غرفة الاستخبارات (OSINT)';
      else if (personaKey === 'trend_live') label = 'غرفة تريند لايف الاستباقية';

      const color = persona?.color || '#a78bfa';

      messages.forEach((msg, idx) => {
        if (!msg.text || msg.text.trim() === '') return;
        items.push({
          personaKey,
          personaLabel: label,
          personaColor: color,
          msg,
          msgIndex: idx
        });
      });
    });

    return items;
  }, [chatHistory, personas]);

  // List of all recorded conversations
  const conversationsList = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      type: 'room' | 'persona';
      categoryBadge: string;
      avatar: string;
      color: string;
      messagesCount: number;
      lastMessage: string;
      lastTimestamp?: string;
    }> = [];

    Object.entries(chatHistory).forEach(([key, msgs]) => {
      if (!msgs || msgs.length === 0) return;
      const persona = personas[key];
      let label = persona?.label || key;
      let type: 'room' | 'persona' = 'persona';
      let categoryBadge = 'حوار فردي';

      if (key === 'trend_live') {
        label = 'غرفة تريند لايف الاستباقية';
        type = 'room';
        categoryBadge = 'غرفة تريند لايف (RTTP)';
      } else if (key === 'debate') {
        label = 'المناظرة الفكرية';
        type = 'room';
        categoryBadge = 'مناظرة ثنائية';
      } else if (key === 'group_question') {
        label = 'ندوة المعرفة (سؤال جماعي)';
        type = 'room';
        categoryBadge = 'ندوة فكرية جماعية';
      } else if (key === 'osint_room') {
        label = 'غرفة الاستخبارات الرقمية (OSINT)';
        type = 'room';
        categoryBadge = 'استخبارات وتقاطع مصادر';
      }

      const validMsgs = msgs.filter(m => m.text && m.text.trim());
      const lastMsg = validMsgs[validMsgs.length - 1];

      list.push({
        key,
        label,
        type,
        categoryBadge,
        avatar: getAvatarUrl(key),
        color: persona?.color || '#818cf8',
        messagesCount: validMsgs.length,
        lastMessage: lastMsg?.text || 'لا توجد رسائل',
        lastTimestamp: 'مؤخراً'
      });
    });

    return list.sort((a, b) => b.messagesCount - a.messagesCount);
  }, [chatHistory, personas]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversationsList.filter(c => {
      if (categoryFilter === 'rooms' && c.type !== 'room') return false;
      if (categoryFilter === 'personas' && c.type !== 'persona') return false;
      return true;
    });
  }, [conversationsList, categoryFilter]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalizedQuery = query.toLowerCase().trim();

    return allHistoryItems.filter(item => {
      if (selectedPersonaFilter !== 'all' && item.personaKey !== selectedPersonaFilter) {
        return false;
      }
      return item.msg.text.toLowerCase().includes(normalizedQuery);
    });
  }, [query, selectedPersonaFilter, allHistoryItems]);

  // Generate AI Summary for a conversation
  const handleGenerateSummary = async (convKey: string) => {
    const msgs = chatHistory[convKey];
    if (!msgs || msgs.length === 0) return;
    setSummarizingKey(convKey);

    try {
      const ai = getGeminiClient();
      const text = msgs.slice(-12).map(m => `${m.persona || m.role}: ${m.text}`).join('\n\n');
      const prompt = `أنت المحلل المعرفي لمنصة MindMirror.
قدم ملخصاً مركزاً ومكثفاً في 3 أسطر باللغة العربية لأبرز ما دار في هذه المحادثة وأهم النتائج الفكرية المستخلصة:
${text}`;

      const res = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }), 2, 1000);

      const summaryText = (res as any)?.text?.trim() || 'ملخص الحوار متاح.';
      setSummaries(prev => ({ ...prev, [convKey]: summaryText }));
      toast({
        title: 'تم توليد الملخص الذكي',
        message: 'تم استخلاص جوهر المحادثة بنجاح.',
        type: 'success'
      });
    } catch (e: any) {
      console.error("Summary Error:", e);
      toast({ title: 'خطأ', message: 'تعذر توليد الملخص حالياً.', type: 'error' });
    } finally {
      setSummarizingKey(null);
    }
  };

  // Export a single conversation
  const handleExportConversation = (convKey: string) => {
    const msgs = chatHistory[convKey];
    if (!msgs || msgs.length === 0) return;
    const persona = personas[convKey];
    const title = persona?.label || convKey;

    const exportText = `# سجل محادثة: ${title} - MindMirror\n\nتاريخ التصدير: ${new Date().toLocaleString('ar-SA')}\nإجمالي الرسائل: ${msgs.length}\n\n---\n\n` + 
      msgs.map(m => `### ${m.persona || (m.role === 'user' ? 'المستخدم' : 'الذكاء الاصطناعي')}:\n${m.text}\n`).join('\n---\n\n');

    const blob = new Blob([exportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MindMirror_${convKey}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'تم التصدير', message: 'تم تحميل السجل بصيغة Markdown بنجاح.', type: 'success' });
  };

  // Export ALL conversations at once
  const handleExportAllConversations = () => {
    let combined = `# الأرشيف الشامل لكافة محادثات وغرف MindMirror\nتاريخ الأرشفة: ${new Date().toLocaleString('ar-SA')}\n\n`;
    Object.entries(chatHistory).forEach(([key, msgs]) => {
      if (!msgs || msgs.length === 0) return;
      combined += `\n========================================\n# سجل: ${key} (${msgs.length} رسالة)\n========================================\n\n`;
      combined += msgs.map(m => `[${m.persona || m.role}]:\n${m.text}\n`).join('\n---\n\n');
    });

    const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MindMirror_Complete_Archive_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'تم تصدير الأرشيف الشامل', message: 'تم تصدير كافة المحادثات والغرف في ملف واحد.', type: 'success' });
  };

  // Highlight helper
  const renderHighlightedText = (text: string, search: string) => {
    if (!search.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-amber-500/30 text-amber-200 px-1 py-0.5 rounded font-bold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#02040a]/95 backdrop-blur-md z-[1000] flex items-center justify-center p-3 md:p-6 overflow-y-auto overflow-x-hidden"
        dir="rtl"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 15 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.95, y: 15 }}
          className="bg-surface border border-border rounded-3xl p-5 md:p-6 w-full max-w-4xl shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden my-auto"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-border/60 shrink-0 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-extrabold text-text flex items-center gap-2">
                  مستكشف ومراجع المحادثات والغرف
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-full font-bold">
                    {conversationsList.length} محادثة نشطة
                  </span>
                </h3>
                <p className="text-xs text-muted">مراجعة كاملة لجميع الغرف (المناظرات، الندوات، OSINT، تريند لايف) وحوارات المفكرين.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-bg/60 border border-border rounded-xl p-1 text-xs">
                <button
                  onClick={() => setActiveTab('review')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'review' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-text'
                  }`}
                >
                  لوحة المحادثات ({conversationsList.length})
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'search' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-text'
                  }`}
                >
                  البحث النصي الدقيق
                </button>
              </div>

              <button 
                onClick={onClose}
                className="text-muted hover:text-text transition-colors bg-bg/50 rounded-full p-2 cursor-pointer border border-border"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* TAB 1: ALL CONVERSATIONS REVIEW */}
          {activeTab === 'review' && (
            <div className="flex-1 overflow-y-auto pt-4 space-y-4 custom-scrollbar">
              {/* Analytics Header Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-surface2/60 border border-border/80 rounded-2xl">
                  <span className="text-[11px] text-muted block mb-1">إجمالي المحادثات</span>
                  <span className="text-lg font-black font-mono text-text">{conversationsList.length}</span>
                </div>
                <div className="p-3 bg-surface2/60 border border-border/80 rounded-2xl">
                  <span className="text-[11px] text-muted block mb-1">إجمالي الرسائل</span>
                  <span className="text-lg font-black font-mono text-indigo-400">{allHistoryItems.length}</span>
                </div>
                <div className="p-3 bg-surface2/60 border border-border/80 rounded-2xl">
                  <span className="text-[11px] text-muted block mb-1">الغرف الاستباقية</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {conversationsList.filter(c => c.type === 'room').length}
                  </span>
                </div>
                <div className="p-3 bg-surface2/60 border border-border/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-muted block mb-0.5">تصدير الأرشيف</span>
                    <button
                      onClick={handleExportAllConversations}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download size={13} /> تحميل الكل
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex gap-1.5 text-xs font-bold">
                  {(['all', 'rooms', 'personas'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setCategoryFilter(f)}
                      className={`px-3 py-1 rounded-xl border transition-all cursor-pointer ${
                        categoryFilter === f 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
                          : 'bg-surface2/60 border-border/70 text-muted hover:text-text'
                      }`}
                    >
                      {f === 'all' ? 'كافة المحادثات' : f === 'rooms' ? 'الغرف المتخصصة' : 'الشخصيات الفردية'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversations List */}
              <div className="space-y-3">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-12 text-muted">
                    <MessageSquare size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">لا توجد محادثات مسجلة ضمن هذا التصنيف.</p>
                  </div>
                ) : (
                  filteredConversations.map(conv => (
                    <div 
                      key={conv.key}
                      className="p-4 bg-surface2/70 hover:bg-surface2 border border-border/80 hover:border-indigo-500/50 rounded-2xl transition-all shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-border/80 bg-surface shrink-0">
                            <img src={conv.avatar} alt={conv.label} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-text flex items-center gap-2">
                              {conv.label}
                              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-semibold">
                                {conv.categoryBadge}
                              </span>
                            </h4>
                            <span className="text-[11px] text-muted">
                              {conv.messagesCount} رسالة محفوظة في الذاكرة
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleGenerateSummary(conv.key)}
                            disabled={summarizingKey === conv.key}
                            className="bg-surface border border-border hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-300 text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="توليد ملخص تركيبي للمحادثة عبر Gemini"
                          >
                            {summarizingKey === conv.key ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            <span>ملخص ذكي</span>
                          </button>

                          <button
                            onClick={() => handleExportConversation(conv.key)}
                            className="bg-surface border border-border hover:border-accent text-muted hover:text-text text-xs p-1.5 rounded-xl transition-all cursor-pointer"
                            title="تصدير بصيغة Markdown"
                          >
                            <Download size={14} />
                          </button>

                          <button
                            onClick={() => {
                              onSelectResult(conv.key, 0);
                              onClose();
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shadow cursor-pointer"
                          >
                            <Play size={12} />
                            <span>استئناف</span>
                          </button>
                        </div>
                      </div>

                      {/* Last Message Preview */}
                      <p className="text-xs text-muted/90 bg-bg/50 p-2.5 rounded-xl border border-border/50 line-clamp-2 leading-relaxed font-sans">
                        {conv.lastMessage}
                      </p>

                      {/* Display Summary if Generated */}
                      {summaries[conv.key] && (
                        <div className="bg-indigo-950/30 border border-indigo-500/30 p-3 rounded-xl text-xs space-y-1">
                          <span className="text-[10px] text-indigo-400 font-bold block">ملخص الذكاء الاصطناعي للمحادثة:</span>
                          <p className="text-text leading-relaxed whitespace-pre-line">{summaries[conv.key]}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DEEP TEXT SEARCH */}
          {activeTab === 'search' && (
            <div className="flex-1 overflow-y-auto pt-4 space-y-3 custom-scrollbar">
              {/* Search Bar Input */}
              <div className="relative mb-2 shrink-0">
                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
                <input 
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="ابحث عن كلمة، فكرة، دليل، أو جملة في نقاشاتك السابقة..."
                  className="w-full bg-bg border border-border rounded-2xl pe-11 ps-4 py-3 text-xs md:text-sm text-text outline-none focus:border-indigo-500 transition-all shadow-inner placeholder:text-muted/40"
                />
                {query && (
                  <button 
                    onClick={() => setQuery('')}
                    className="absolute end-4 top-1/2 -translate-y-1/2 text-muted hover:text-text text-xs font-bold bg-surface2 px-2 py-1 rounded-md"
                  >
                    مسح
                  </button>
                )}
              </div>

              {/* Persona Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-border/40 scrollbar-hide text-xs font-bold">
                <button
                  onClick={() => setSelectedPersonaFilter('all')}
                  className={`px-3 py-1 rounded-full border transition-all shrink-0 cursor-pointer ${
                    selectedPersonaFilter === 'all'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-surface2/60 border-border/80 text-muted hover:border-indigo-500/40 hover:text-text'
                  }`}
                >
                  الكل ({allHistoryItems.length})
                </button>
                {conversationsList.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPersonaFilter(p.key)}
                    className={`px-2.5 py-1 rounded-full border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      selectedPersonaFilter === p.key
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-surface2/60 border-border/80 text-muted hover:border-indigo-500/40 hover:text-text'
                    }`}
                  >
                    <img src={p.avatar} alt={p.label} className="w-3.5 h-3.5 rounded-full object-cover" />
                    <span>{p.label}</span>
                    <span className="text-[10px] opacity-65">({p.messagesCount})</span>
                  </button>
                ))}
              </div>

              {/* Search Results Feed */}
              <div className="space-y-2">
                {!query.trim() ? (
                  <div className="text-center py-12 text-muted space-y-2">
                    <Search size={36} className="mx-auto opacity-30" />
                    <p className="text-xs">اكتب أي كلمة للبحث الفوري عبر المحادثات والغرف السابقة.</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12 text-muted space-y-2">
                    <MessageSquare size={36} className="mx-auto opacity-30" />
                    <p className="text-xs">لم نجد أي نتائج متطابقة لهذا البحث.</p>
                  </div>
                ) : (
                  <>
                    <span className="text-[11px] text-muted font-bold block mb-2 px-1">
                      تم العثور على {searchResults.length} موضع متطابق:
                    </span>
                    {searchResults.map((item, index) => {
                      const isUser = item.msg.role === 'user';
                      return (
                        <div 
                          key={index}
                          onClick={() => {
                            onSelectResult(item.personaKey, item.msgIndex);
                            onClose();
                          }}
                          className="p-3.5 bg-surface2 hover:bg-surface3 border border-border/80 hover:border-indigo-500/50 rounded-2xl transition-all cursor-pointer group text-start flex flex-col gap-1.5 shadow-sm"
                        >
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <img 
                                src={getAvatarUrl(item.personaKey)} 
                                alt={item.personaLabel} 
                                className="w-5 h-5 rounded-full object-cover" 
                              />
                              <span className="font-bold text-indigo-400">
                                {item.personaLabel}
                              </span>
                            </div>
                            
                            <span className="text-[10px] text-muted font-mono bg-bg px-2 py-0.5 rounded-md border border-border">
                              #{item.msgIndex + 1}
                            </span>
                          </div>

                          <p className="text-xs text-muted/90 leading-relaxed font-sans line-clamp-3 group-hover:text-text transition-colors">
                            {renderHighlightedText(item.msg.text, query)}
                          </p>

                          <div className="flex justify-end pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                              انتقال فوري للموضع
                              <ChevronLeft size={12} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
