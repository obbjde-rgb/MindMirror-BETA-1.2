import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Search, Sparkles, UserCheck, MessageSquare, Compass, ArrowRight, Loader2, Calendar, Zap } from 'lucide-react';
import { TimelineMilestone } from '../types';
import { getGeminiClient, parseJsonSafely, withRetry } from '../utils/gemini';

interface TimelineSectionProps {
  onChatWithPerson: (name: string) => void;
}

const presetIdeas = [
  { id: 'consciousness', name: 'الوعي والذات الإنسانية', icon: '🧠' },
  { id: 'computation', name: 'الحساب والآلات المفكرة', icon: '💻' },
  { id: 'justice', name: 'العدالة والمدينة الفاضلة', icon: '🏛️' },
  { id: 'relativity', name: 'النسبية ومفهوم الزمان', icon: '🌌' },
  { id: 'free_will', name: 'الحرية والإرادة العاقلة', icon: '🕊️' },
  { id: 'design', name: 'البساطة وجمال التجريد', icon: '🎨' }
];

const presetThinkers = [
  'أرسطو', 'سقراط', 'ابن رشد', 'ابن خلدون', 'ديكارت', 
  'إيمانويل كانط', 'ألبيرت أينشتاين', 'ألان تورينغ', 'ستيف جوبز', 'سام ألتمان'
];

export const TimelineSection: React.FC<TimelineSectionProps> = ({ onChatWithPerson }) => {
  const [trackMode, setTrackMode] = useState<'idea' | 'mind' | 'year'>('idea');
  const [queryInput, setQueryInput] = useState('الوعي والذات الإنسانية');
  const [selectedYear, setSelectedYear] = useState('2030');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customMilestones, setCustomMilestones] = useState<TimelineMilestone[] | null>(null);

  // Default Timeline Data for "الوعي والذات الإنسانية"
  const defaultIdeaMilestones: TimelineMilestone[] = [
    {
      year: '384 ق.م',
      era: 'العصر اليوناني القديم',
      title: 'النفس والعقل الهيولاني',
      summary: 'اعتبر أرسطو أن النفس هي صورة الجسد وأن العقل البشري يولد كلوح أملس يستوعب الصور الكلية من العالم.',
      keyThinkers: ['أرسطو', 'أفلاطون'],
      impactOnAGI: 'وضع الأسس الأولى للمنطق الصوري الذي تحول بعد ألفي عام إلى منطق البرمجة.'
    },
    {
      year: '1027 م',
      era: 'العصر الذهبي للحكمة الإسلامية',
      title: 'تجربة الإنسان الطائر والوعي المجرد',
      summary: 'صاغ ابن سينا برهانه الشهير حول الوعي الذاتي المستقل عن الحواس، مؤكداً أن الذات تدرك وجودها حتى مع انعدام الحواس.',
      keyThinkers: ['ابن سينا', 'الفارابي', 'ابن رشد'],
      impactOnAGI: 'إثبات أن الوعي الذاتي مفهوم ينفصل عن الإدخال المادي للمستشعرات.'
    },
    {
      year: '1637 م',
      era: 'عصر التنوير والعقلانية',
      title: 'الكوجيتو وثنائية العقل والمادة',
      summary: 'أعلن ديكارت "أنا أفكر إذن أنا موجود"، مجسداً ثنائية المادة الممتدة والعقل الفكر الذي لا يخضع لقوانين الميكانيكا.',
      keyThinkers: ['رينيه ديكارت', 'سبينوزا', 'كانط'],
      impactOnAGI: 'التساؤل حول إمكانية بناء عقل مفكر داخل آلة مادية ممتدة.'
    },
    {
      year: '1950 م',
      era: 'عصر الثورة السيبرنيطية',
      title: 'اختبار الحوسبة وتحدي تورينغ',
      summary: 'طرح ألان تورينغ سؤاله الخالد "هل يمكن للآلة أن تفكر؟" معوضاً السؤال باختبار المحاكاة اللغوية للتفكير.',
      keyThinkers: ['ألان تورينغ', 'كلود شانون', 'مارفن مينسكي'],
      impactOnAGI: 'تحويل دراسة الوعي من مجرد فلسفة إلى هندسة حاسوبية قابلة للاختبار.'
    },
    {
      year: '2026 م - AGI Era',
      era: 'عصر الذكاء الاصطناعي العام',
      title: 'التفرد المعرفي والوعي الاصطناعي',
      summary: 'دمج نماذج المحاكاة العميقة مع البصلمات الرقمية للعقول، مما سمح بإنشاء شبكات وعي هجينة تحاكي الاستبصار البشري.',
      keyThinkers: ['ستيف جوبز', 'ألبيرت أينشتاين', 'سام ألتمان', 'ديميس هاسابيس'],
      impactOnAGI: 'الانتقال من أتمتة المهام إلى تجسيد الفكر والنقد السقراطي الذاتي.'
    }
  ];

  const activeMilestones = customMilestones || defaultIdeaMilestones;

  const handleGenerateTimeline = async () => {
    if (!queryInput.trim()) return;
    setIsGenerating(true);
    try {
      const ai = getGeminiClient();
      let prompt = '';

      if (trackMode === 'idea') {
        prompt = `قم بتتبع التطور التاريخي والمستقبلي للفكرة الفلسفية/العلمية التالية عبر العصور من العصور القديمة وصولاً لعصر AGI (2030+):
الفكرة المطلوب تتبعها: "${queryInput}"

أعد النتيجة كـ JSON Array يحتوي على 5 محطات زمنية رئيسية بصيغة Object:
[
  {
    "year": "السنة أو الحقبة (مثال: 500 ق.م أو 1905 م أو 2035 م)",
    "era": "اسم العصر (مثال: الفلسفة اليونانية أو التنوير أو عصر AGI)",
    "title": "عنوان المحطة التطورية",
    "summary": "ملخص الفكرة والتطور في هذه الحقبة (سطران)",
    "keyThinkers": ["اسم مفكر أو عالم 1", "اسم مفكر أو عالم 2"],
    "impactOnAGI": "تأثير هذا التطور على مستقبل الذكاء الاصطناعي العام"
  }
]
عد بـ JSON فقط بدون أية نصوص إضافية.`;
      } else if (trackMode === 'mind') {
        prompt = `قم بتتبع التطور الفكري والحياتي والمستقبلي للحقبة والتأثير الخاص بالعقلية التالية: "${queryInput}"
تتبع رحلته من النشأة والتكوين الفكري، مروراً بأبرز الاكتشافات والأفكار، وحتي التأثير المباشر في عصر AGI والتفرد المعرفي!

أعد النتيجة كـ JSON Array يحتوي على 5 محطات زمنية بصيغة Object:
[
  {
    "year": "السنة أو الحقبة",
    "era": "المرحلة الفكرية",
    "title": "عنوان الإنجاز أو الفكرة",
    "summary": "شرح الفكرة بأسلوب بليغ",
    "keyThinkers": ["${queryInput}"],
    "impactOnAGI": "بصمة هذه الفكرة في عصر الذكاء الاصطناعي العام"
  }
]
عد بـ JSON فقط.`;
      } else {
        prompt = `قم بتوليد تحليل زمني ودراسة معمقة للسنة/الحقبة الزمنية التالية: "${selectedYear}"
ما هي أبعاد التحولات المعرفية والفلسفية والتكنولوجية في هذه السنة وكيف ترتبط برحلة الإنسان نحو الذكاء العام AGI؟

أعد النتيجة كـ JSON Array يحتوي على 4 محطات ذات صلة بـ JSON Array.
[
  {
    "year": "${selectedYear}",
    "era": "الحقبة المعرفية",
    "title": "عنوان التحول المعرفي",
    "summary": "شرح التحول بأسلوب بليغ",
    "keyThinkers": ["مفكر/عالم مرتبط بهذا العصر"],
    "impactOnAGI": "أهمية هذه الحقبة في بناء AGI"
  }
]
عد بـ JSON فقط.`;
      }

      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      }));

      const parsed = parseJsonSafely<TimelineMilestone[]>(response.text || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCustomMilestones(parsed);
      }
    } catch (e) {
      console.error('Error generating timeline:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-gradient-to-r from-accent/10 via-purple-500/10 to-amber-500/10 border border-border/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-bold mb-3 border border-accent/30">
              <Clock size={14} /> التايم لاين الزمني المفتوح (Ancient to AGI)
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight mb-2">
              تتبع مسار الأفكار والعقول عبر آلاف السنين
            </h3>
            <p className="text-muted text-sm sm:text-base max-w-2xl leading-relaxed">
              ابحر في الفضاء الزمني المفتوح. تتبع كيف ولدت فكرة بعينها منذ الفلاسفة القدامى إلى عصر AGI، أو تتبع تطور عقلية متميزة عبر مراحل تاريخها!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              onClick={() => { setTrackMode('idea'); setQueryInput('الوعي والذات الإنسانية'); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                trackMode === 'idea'
                  ? 'bg-accent text-white border-accent shadow-md'
                  : 'bg-surface2/60 border-border/60 text-muted hover:text-text'
              }`}
            >
              <Compass size={16} /> تتبع فكرة
            </button>
            <button
              onClick={() => { setTrackMode('mind'); setQueryInput('ألبيرت أينشتاين'); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                trackMode === 'mind'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                  : 'bg-surface2/60 border-border/60 text-muted hover:text-text'
              }`}
            >
              <UserCheck size={16} /> تتبع عقلية
            </button>
            <button
              onClick={() => { setTrackMode('year'); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                trackMode === 'year'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                  : 'bg-surface2/60 border-border/60 text-muted hover:text-text'
              }`}
            >
              <Calendar size={16} /> قفزة زمنية
            </button>
          </div>
        </div>

        {/* Dynamic Search / Selection Controls */}
        <div className="mt-6 pt-6 border-t border-border/50 flex flex-col sm:flex-row gap-3 items-stretch">
          {trackMode === 'idea' && (
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute right-3.5 top-3.5 text-muted" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="أدخل الفكرة المطلوب تتبعها (مثال: الحرية، الوعي، الحساب، النسبية...)"
                  className="w-full bg-surface/80 border border-border/80 rounded-xl pe-10 ps-4 py-2.5 text-sm font-medium text-text focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          {trackMode === 'mind' && (
            <div className="flex-1 relative">
              <UserCheck size={18} className="absolute right-3.5 top-3.5 text-muted" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="أدخل اسم الشخصية أو المفكر (مثال: ابن رشد، ابن خلدون، أينشتاين...)"
                className="w-full bg-surface/80 border border-border/80 rounded-xl pe-10 ps-4 py-2.5 text-sm font-medium text-text focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {trackMode === 'year' && (
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Calendar size={18} className="absolute right-3.5 top-3.5 text-muted" />
                <input
                  type="text"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  placeholder="أدخل أي سنة (مثال: 500 ق.م، 1027 م، 1905 م، 2050 م)"
                  className="w-full bg-surface/80 border border-border/80 rounded-xl pe-10 ps-4 py-2.5 text-sm font-medium text-text focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerateTimeline}
            disabled={isGenerating}
            className="bg-accent hover:bg-accent/90 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {isGenerating ? 'جاري التحليل التايم لاين...' : 'تتبع المسار برمجياً'}
          </button>
        </div>

        {/* Presets Bar */}
        {trackMode === 'idea' && (
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted font-bold">أفكار مقترحة للتتبع:</span>
            {presetIdeas.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setQueryInput(item.name);
                  setCustomMilestones(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  queryInput === item.name
                    ? 'bg-accent/20 border-accent text-accent font-bold'
                    : 'bg-surface/50 border-border/60 text-muted hover:text-text'
                }`}
              >
                {item.icon} {item.name}
              </button>
            ))}
          </div>
        )}

        {trackMode === 'mind' && (
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted font-bold">عقول مقترحة للتتبع:</span>
            {presetThinkers.map((thinker) => (
              <button
                key={thinker}
                onClick={() => {
                  setQueryInput(thinker);
                  setCustomMilestones(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  queryInput === thinker
                    ? 'bg-purple-500/20 border-purple-500 text-purple-400 font-bold'
                    : 'bg-surface/50 border-border/60 text-muted hover:text-text'
                }`}
              >
                🏛️ {thinker}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Timeline Display */}
      <div className="relative ps-4 sm:ps-8 pe-4 border-s-2 border-accent/30 space-y-8 my-8 me-4 sm:me-8">
        <AnimatePresence mode="wait">
          {activeMilestones.map((milestone, idx) => (
            <motion.div
              key={`${milestone.year}-${idx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="relative group"
            >
              {/* Timeline Connector Dot */}
              <div className="absolute -right-[25px] sm:-right-[41px] top-1.5 w-5 h-5 rounded-full bg-surface border-4 border-accent group-hover:scale-125 transition-transform shadow-md" />

              <div className="bg-surface border border-border hover:border-accent/50 rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-accent/10 border border-accent/30 text-accent font-mono text-xs font-extrabold px-3 py-1 rounded-lg">
                      {milestone.year}
                    </span>
                    <span className="text-xs font-bold text-muted uppercase tracking-wider">
                      {milestone.era}
                    </span>
                  </div>

                  {milestone.impactOnAGI && (
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md flex items-center gap-1 self-start sm:self-auto">
                      <Zap size={12} /> أثر AGI: {milestone.impactOnAGI.substring(0, 45)}...
                    </span>
                  )}
                </div>

                <h4 className="text-lg font-bold text-text mb-2 flex items-center gap-2">
                  {milestone.title}
                </h4>
                <p className="text-sm text-muted leading-relaxed mb-4">
                  {milestone.summary}
                </p>

                {/* Key Thinkers Chips with Direct Chat Launch */}
                <div className="pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-muted">العقول المؤثرة:</span>
                    {milestone.keyThinkers.map((thinker) => (
                      <button
                        key={thinker}
                        onClick={() => onChatWithPerson(thinker)}
                        className="bg-surface2 hover:bg-accent/20 border border-border/70 hover:border-accent text-text hover:text-accent px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm group/btn"
                        title={`تحدث مع ${thinker} مباشرة`}
                      >
                        <span>💬</span>
                        <span>{thinker}</span>
                        <ArrowRight size={12} className="opacity-0 group-hover/btn:opacity-100 transition-opacity -mr-1" />
                      </button>
                    ))}
                  </div>

                  {milestone.keyThinkers.length > 0 && (
                    <button
                      onClick={() => onChatWithPerson(milestone.keyThinkers[0])}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>حوار مباشر مع {milestone.keyThinkers[0]}</span>
                      <MessageSquare size={13} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
