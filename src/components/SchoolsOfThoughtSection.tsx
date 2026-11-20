import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Sparkles, Plus, Play, Send, Loader2, CheckCircle2, ArrowRight, BookOpen, ShieldCheck, Cpu } from 'lucide-react';
import { SchoolOfThought } from '../types';
import { getGeminiClient, parseJsonSafely, withRetry } from '../utils/gemini';

interface SchoolsOfThoughtSectionProps {
  onChatWithPerson: (name: string) => void;
  launchGroupSession: (participants: string[], question?: string) => void;
}

const defaultSchools: SchoolOfThought[] = [
  {
    id: 'greek',
    name: 'الفلسفة الهيلينية والمشائية (Greek Rationalism)',
    era: '400 ق.م - 200 ق.م',
    icon: '🏛️',
    color: '#38bdf8',
    thesis: 'العالم محكوم بقوانين عقلية صاردة، والفضيلة والمعرفة يتحققان عبر المنطق الصوري المبرهن.',
    description: 'تعتبر مهد الحكمة والأخلاق الغربية، أسسها سقراط، أفلاطون، وأرسطو، وصاغت قواعد المنطق القياسي الأول.',
    keyMinds: ['سقراط', 'أفلاطون', 'أرسطو'],
    principles: ['القياس المنطقي الصوري', 'نظرية الصور والمُثل', 'الفضيلة والمعرفة النفسية'],
    historicalStages: [
      { stage: 'المهد السقراطي', period: '470 ق.م', summary: 'التركيز على الحوار الجدلي وتفكيك المفاهيم الأخلاقية.' },
      { stage: 'الأكاديمية والأورغانون', period: '350 ق.م', summary: 'تبويب علوم المنطق والطبائع والماورائيات على يد أرسطو.' }
    ],
    footprint: 'أورغانون المنطق الصوري والبناء القياسي الأولي لقواعد الحوسبة البرمجية.',
    evolutionToAGI: 'التحول إلى منطق الرسوم البيانية المعرفية (Knowledge Graphs) والنطق الرمزي للذكاء الاصطناعي.'
  },
  {
    id: 'islamic_rationalism',
    name: 'العقلانية والحكمة الإسلامية (Islamic Philosophy)',
    era: '800 م - 1200 م',
    icon: '🕌',
    color: '#34d399',
    thesis: 'التوافق التام بين العقل والنقل، وأن الحكمة هي البحث عن الحقائق بحسب الطاقة البشرية.',
    description: 'قادها الكندي، الفارابي، ابن سينا، وابن رشد، وجسدت التجميع العلمي والبرهاني بين الحكمة اليونانية والإشراق الإيماني.',
    keyMinds: ['ابن رشد', 'ابن سينا', 'الفارابي', 'ابن خلدون'],
    principles: ['فصل المقال فيما بين الشريعة والحكمة من الاتصال', 'تجربة الوعي الذاتي (الإنسان الطائر)', 'علم العمران البشري والعصبية'],
    historicalStages: [
      { stage: 'عصر الترجمة والتعقيل', period: '830 م', summary: 'بيت الحكمة وتطوير الحساب والرياضيات الحوارية.' },
      { stage: 'المدرسة المشائية الإسلامية', period: '1180 م', summary: 'ابن رشد وتنقيتها من التأويلات الميتافيزيقية.' }
    ],
    footprint: 'التوفيق بين العقل والواقع، وإرساء خوارزميات ابن خلدون للعلوم الاجتماعية.',
    evolutionToAGI: 'الاستفادة من أسلوب ابن رشد البرهاني لتطوير النمذجة القابلة للتفسير (XAI) في الذكاء الاصطناعي.'
  },
  {
    id: 'enlightenment',
    name: 'عصر التنوير والتجريبية (Enlightenment & Rationalism)',
    era: '1600 م - 1800 م',
    icon: '💡',
    color: '#fbbf24',
    thesis: 'العقل البشري المادي والمنهج العلمي التجريبي هما المصدران الوحيدان للمعرفة والتقدم.',
    description: 'روادها ديكارت، سبينوزا، كانط، وجون لوك، وتميزت بالتحرر المعرفي وتطوير المنهج العلمي الحديث.',
    keyMinds: ['رينيه ديكارت', 'إيمانويل كانط', 'سبينوزا'],
    principles: ['الشك المنهجي والكوجيتو', 'نقد العقل الخالص', 'العقد الاجتماعي والحرية الفردية'],
    historicalStages: [
      { stage: 'الشك الديكارتي', period: '1637 م', summary: 'تفكيك المسلمات وبناء اليقين على الفكر.' },
      { stage: 'النقد الكانطي', period: '1781 م', summary: 'تحديد حدود المعرفة البشرية بين الظواهر والذوات.' }
    ],
    footprint: 'تطوير المنهج العلمي وصياغة المفاهيم الأولية للحوسبة المادية.',
    evolutionToAGI: 'تأسيس أطر الأخلاقيات العالمية المستندة إلى الواجب الكانطي لحوكمة AGI.'
  },
  {
    id: 'existentialism',
    name: 'الوجودية والظاهراتية (Existentialism)',
    era: '1850 م - 1970 م',
    icon: '🕯️',
    color: '#a78bfa',
    thesis: 'الوجود يسبق الماهية؛ الإنسان يعرّف نفسه من خلال أفعاله واختياراته ومسؤوليته المطلقة.',
    description: 'انطلقت مع كيركغارد ونيتشه، ووصلت أوجها مع سارتر وكامو وهيدجر، مرركزة على حرية الفرد والقلق الوجودي.',
    keyMinds: ['فريدريك نيتشه', 'جان بول سارتر', 'ألبير كامو'],
    principles: ['الوجود يسبق الماهية', 'المسؤولية والقلق الوجودي', 'إرادة القوة وتجاوز الذات'],
    historicalStages: [
      { stage: 'الوجودية الدينية والفردية', period: '1843 م', summary: 'كيركغارد ونقد العقلانية السردية الجافة.' },
      { stage: 'إرادة القوة والانسان الأعلى', period: '1883 م', summary: 'نيتشه وتفكيك العدمية وإعادة تقييم القيم.' }
    ],
    footprint: 'سبر أغوار الدوافع الإنسانية وتحدي الحتمية الميكانيكية.',
    evolutionToAGI: 'طرح أسئلة المعنى والغاية عندما تتفوق الآلات على الإنجاز البشري المادي.'
  },
  {
    id: 'cybernetics',
    name: 'السيبرنيطيقا وعصر الذكاء الحاسوبي (Cybernetics & AI Pioneers)',
    era: '1940 م - 2000 م',
    icon: '⚡',
    color: '#ef4444',
    thesis: 'العقل والآلة يشاركان نفس الآليات المفهومية: التغذية الراجعة ومعالجة البيانات والمعلومات.',
    description: 'تأسست على أيدي ألان تورينغ، نوربرت فينر، كلود شانون، ومارفن مينسكي، ونقلت التفكير من المادة إلى المعلومة.',
    keyMinds: ['ألان تورينغ', 'كلود شانون', 'ستيف جوبز'],
    principles: ['اختبار تورينغ للتفكير', 'نظرية المعلومات والإنتروبيا', 'التغذية الراجعة والتحكم'],
    historicalStages: [
      { stage: 'الآلة الشاملة', period: '1936 م', summary: 'آلة تورينغ وتأسيس النظرية الرياضية للحوسبة.' },
      { stage: 'السيبرنيطيقا والذكاء المبكر', period: '1956 م', summary: 'مؤتمر دارتموث وإعلان ميلاد مصطلح الذكاء الاصطناعي.' }
    ],
    footprint: 'بناء معمارية الحاسوب الحديث وتحويل الفكر إلى معالجة رموز ورسائل.',
    evolutionToAGI: 'الانتقال المباشر من النماذج اللغوية إلى الذكاء العام الفائق المتفاعل مع البيئة الحقيقية.'
  },
  {
    id: 'agi_transhumanism',
    name: 'مدرسة AGI وما بعد الإنسانية (AGI & Transhumanism Era)',
    era: '2020 م - 2050 م+',
    icon: '🤖',
    color: '#ec4899',
    thesis: 'الذكاء العام التوليدي هو نقطة التفرد القادمة التي ستندمج مع الوعي البشري وتوسع أفق الإدراك الكوني.',
    description: 'يمثلها رواد الذكاء الاصطناعي الحاليون كسام ألتمان، ديميس هاسابيس، راي كورزوايل، وتدرس اندماج العقل والآلة.',
    keyMinds: ['سام ألتمان', 'ديميس هاسابيس', 'ألبيرت أينشتاين', 'ستيف جوبز'],
    principles: ['التفرد المعرفي (Singularity)', 'الحوسبة الهجينة البولوجية-السيليكونية', 'الأمان والمحاذاة الأخلاقية (Alignment)'],
    historicalStages: [
      { stage: 'النماذج التوليدية الضخمة', period: '2023 م', summary: 'المحاكاة اللغوية واستحضار البصلمات الرقمية.' },
      { stage: 'الذكاء الاصطناعي العام (AGI)', period: '2028 م+', summary: 'الاستدلال والتأمل الذاتي والتفكير الأكاديمي السقراطي المستقل.' }
    ],
    footprint: 'إعادة تعريف مفهوم الكائن العاقل والوعي في الكون.',
    evolutionToAGI: 'التحول النهائي من أداة حوسبة إلى شريك مفكر ومرشد حكيم للإنسانية.'
  }
];

export const SchoolsOfThoughtSection: React.FC<SchoolsOfThoughtSectionProps> = ({ 
  onChatWithPerson,
  launchGroupSession 
}) => {
  const [schools, setSchools] = useState<SchoolOfThought[]>(defaultSchools);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOfThought>(defaultSchools[0]);
  
  // School Simulator Test State
  const [testQuestion, setTestQuestion] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<string | null>(null);

  // New Custom School Discovery Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Handle Testing the School's Collective Intelligence
  const handleTestSchool = async () => {
    if (!testQuestion.trim()) return;
    setIsTesting(true);
    setTestResponse(null);
    try {
      const ai = getGeminiClient();
      const prompt = `أنت تمثل العقل الجمعي لمدرسة: "${selectedSchool.name}".
الأطروحة الجوهرية لهذه المدرسة: "${selectedSchool.thesis}"
أبرز روادها وعقولها: ${selectedSchool.keyMinds.join('، ')}.

تلقيت السؤال التستيي المباشر التالي من أحد الباحثين:
"${testQuestion}"

قم بصياغة إجابة بليغة ومعمقة ومبرهنة كإجابة رسمية تمثل أسلوب وقناعات هذه المدرسة الفكرية بالكامل.
تحدث بلسان المتحدث باسم هذه المدرسة وبأسلوب فكري رفيع باللغة العربية.`;

      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      }));

      setTestResponse(response.text?.trim() || 'لم يتم استلام استجابة.');
    } catch (e) {
      console.error('Error testing school:', e);
      setTestResponse('حدث خطأ أثناء محاكاة العقل الجمعي للمدرسة.');
    } finally {
      setIsTesting(false);
    }
  };

  // Handle Adding and Discovering a New Custom School
  const handleDiscoverNewSchool = async () => {
    if (!newSchoolName.trim()) return;
    setIsDiscovering(true);
    try {
      const ai = getGeminiClient();
      const prompt = `قم بإجراء كشف وتحليل معمق وشامل للمدرسة أو التيار الفكري المطلوب: "${newSchoolName}".
استخرج البصمة المعرفية، الأطروحة الجوهرية، والمراحل التاريخية، وصولاً لتطورها في عصر AGI.

أعد الاستجابة كـ JSON Object مطابق للهيكل التالي بالضبط:
{
  "id": "custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}",
  "name": "${newSchoolName}",
  "era": "الحقبة الزمنية الخاصة بها",
  "icon": "رمز تعبيري مناسب",
  "color": "#38bdf8",
  "thesis": "الأطروحة الجوهرية للمدرسة في سطرين بليغين",
  "description": "وصف ملخص وشامل للمدرسة وخلفيتها المعرفية",
  "keyMinds": ["اسم مفكر 1", "اسم مفكر 2", "اسم مفكر 3"],
  "principles": ["مبدأ فكري 1", "مبدأ فكري 2", "مبدأ فكري 3"],
  "historicalStages": [
    { "stage": "مرحلة النشأة", "period": "الفترة", "summary": "ملخص المرحلة" },
    { "stage": "مرحلة النضج", "period": "الفترة", "summary": "ملخص المرحلة" }
  ],
  "footprint": "البصمة المعرفية والرقمية لهذه المدرسة",
  "evolutionToAGI": "كيف تتطور هذه المدرسة وأفكارها في عصر الذكاء الاصطناعي العام AGI"
}
عد بـ JSON Object فقط بدون أية نصوص إضافية.`;

      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      }));

      const data = parseJsonSafely<SchoolOfThought>(response.text || '{}');
      if (data && data.name) {
        data.isCustom = true;
        setSchools(prev => [data, ...prev]);
        setSelectedSchool(data);
        setShowAddModal(false);
        setNewSchoolName('');
      }
    } catch (e) {
      console.error('Error discovering new school:', e);
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-accent/10 to-purple-500/10 border border-border/80 rounded-2xl p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mb-3 border border-emerald-500/30">
              <Users size={14} /> موسوعة المدارس والتيارات الفكرية (Ancient to AGI)
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight mb-2">
              مكتبة المدارس الفكرية والعقول الجمعية
            </h3>
            <p className="text-muted text-sm sm:text-base max-w-2xl leading-relaxed">
              استكشف المدارس المعرفية منذ مهد العقلانية اليونانية والحكمة الإسلامية حتى عصر AGI والتفرد. اختبر أطروحة أي مدرسة أو أضف مدرسة جديدة لتكتشف بصمتها فوراً!
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0 self-start md:self-auto"
          >
            <Plus size={18} /> إضافة مدرسة جديدة وكشف البصمة
          </button>
        </div>

        {/* Horizontal School Tabs */}
        <div className="mt-6 pt-6 border-t border-border/50 flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {schools.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedSchool(s);
                setTestResponse(null);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border cursor-pointer ${
                selectedSchool.id === s.id
                  ? 'bg-surface border-accent text-accent shadow-md scale-102'
                  : 'bg-surface2/50 border-border/60 text-muted hover:text-text'
              }`}
            >
              <span className="text-base">{s.icon}</span>
              <span>{s.name}</span>
              {s.isCustom && (
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-mono">
                  جديدة
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected School Detailed View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info Card (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-2xl">
                  {selectedSchool.icon}
                </div>
                <div>
                  <h4 className="text-xl font-extrabold text-text">{selectedSchool.name}</h4>
                  <span className="text-xs font-mono font-bold text-accent">{selectedSchool.era}</span>
                </div>
              </div>

              <button
                onClick={() => launchGroupSession(
                  selectedSchool.keyMinds, 
                  `ندوة العقل الجمعي لـ (${selectedSchool.name}): ما هي الأطروحة المعرفية والأخلاقية الجوهرية لمدرستنا حول "${selectedSchool.thesis}"، وكيف تسهم أفكارنا في تشكيل الوعي البشري والرقمي؟`
                )}
                className="bg-gradient-to-r from-accent via-emerald-500 to-purple-500 hover:from-accent/90 hover:to-purple-600 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto shadow-lg hover:scale-102 border border-white/20"
              >
                <Sparkles size={16} className="animate-pulse" /> إطلاق العقل الجمعي ({selectedSchool.keyMinds.length} عقول)
              </button>
            </div>

            {/* Thesis & Description */}
            <div>
              <h5 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">الأطروحة الجوهرية (Thesis):</h5>
              <div className="p-4 rounded-xl bg-surface2/60 border border-border/60 text-text font-bold text-sm leading-relaxed border-r-4 border-r-accent">
                "{selectedSchool.thesis}"
              </div>
            </div>

            <p className="text-sm text-muted leading-relaxed">
              {selectedSchool.description}
            </p>

            {/* Principles */}
            <div>
              <h5 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">المبادئ والأركان الفكرية:</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedSchool.principles.map((p, i) => (
                  <div key={i} className="p-3 rounded-xl bg-surface2/40 border border-border/50 text-xs font-semibold text-text flex items-center gap-2">
                    <ShieldCheck size={14} className="text-accent shrink-0" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Digital Footprint & AGI Evolution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> البصمة الرقمية والمعرفية:
                </div>
                <p className="text-xs text-text leading-relaxed">{selectedSchool.footprint}</p>
              </div>

              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="text-xs font-bold text-purple-400 mb-1 flex items-center gap-1.5">
                  <Cpu size={14} /> التطور في عصر AGI:
                </div>
                <p className="text-xs text-text leading-relaxed">{selectedSchool.evolutionToAGI}</p>
              </div>
            </div>

            {/* Associated Minds & Direct Chat */}
            <div className="pt-4 border-t border-border/60">
              <h5 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">العقول والرموز المرتبطة بـ {selectedSchool.name}:</h5>
              <div className="flex flex-wrap gap-2">
                {selectedSchool.keyMinds.map((mind) => (
                  <button
                    key={mind}
                    onClick={() => onChatWithPerson(mind)}
                    className="bg-surface2 hover:bg-accent/20 border border-border/80 hover:border-accent text-text px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm group"
                  >
                    <span>🏛️</span>
                    <span>{mind}</span>
                    <span className="text-[10px] text-accent font-normal group-hover:underline">💬 محادثة فورية</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: School Interactive Tester (1 col) */}
        <div className="space-y-6">
          <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <Play size={18} />
              </div>
              <h4 className="text-base font-bold text-text">محاكي واختبار العقل الجمعي</h4>
            </div>

            <p className="text-xs text-muted leading-relaxed mb-4">
              اطرح أي قضية أو سؤال فلسفي أو أخلاقي لاختبار كيف سيجيب العقل الجمعي لمدرسة <strong className="text-text">{selectedSchool.name}</strong>:
            </p>

            <textarea
              rows={3}
              value={testQuestion}
              onChange={(e) => setTestQuestion(e.target.value)}
              placeholder="مثال: ما رأيك في مفهوم الحرية مع انتشار الذكاء الاصطناعي والخوارزميات؟"
              className="w-full bg-surface2/70 border border-border/80 rounded-xl p-3 text-xs text-text focus:outline-none focus:border-accent mb-3"
            />

            <div className="flex flex-col gap-2 mb-4">
              <button
                onClick={handleTestSchool}
                disabled={isTesting || !testQuestion.trim()}
                className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {isTesting ? 'جاري المحاكاة والتحليل...' : 'اختبار الاستجابة المركزة'}
              </button>

              <button
                onClick={() => {
                  if (!testQuestion.trim()) return;
                  launchGroupSession(
                    selectedSchool.keyMinds,
                    `سؤال جماعي لندوة ${selectedSchool.name}: "${testQuestion.trim()}"`
                  );
                }}
                disabled={!testQuestion.trim()}
                className="w-full bg-surface2 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Users size={16} className="text-emerald-400" />
                إطلاق ندوة حوارية حية بهذا السؤال ({selectedSchool.keyMinds.length} عقول)
              </button>
            </div>

            {testResponse && (
              <div className="p-4 rounded-xl bg-surface2/80 border border-accent/30 text-text text-xs leading-relaxed space-y-2 animate-fadeIn max-h-[300px] overflow-y-auto">
                <div className="text-[11px] font-bold text-accent flex items-center justify-between border-b border-border/50 pb-1.5">
                  <span>استجابة العقل الجمعي:</span>
                  <span>{selectedSchool.icon}</span>
                </div>
                <p className="whitespace-pre-wrap">{testResponse}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add New Custom School Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                  <Sparkles size={20} className="text-emerald-400" /> إضافة مدرسة جديدة وكشف البصمة
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted hover:text-text p-1 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted leading-relaxed mb-4">
                أدخل اسم أي مدرسة أو تيار فكري جديد (سواء قديم أو حديث أو مستقبلي)، وسيعمل الذكاء الاصطناعي فوراً على كشف أطروحتها وبصمتها الرقمية وعقولها المؤثرة!
              </p>

              <input
                type="text"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="مثال: المدرسة الرواقية الحديثة، مدرسة الوعي الكمومي..."
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-emerald-400 mb-6"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-surface2 border border-border text-muted font-bold py-2.5 rounded-xl text-xs hover:text-text transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDiscoverNewSchool}
                  disabled={isDiscovering || !newSchoolName.trim()}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isDiscovering ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {isDiscovering ? 'جاري كشف البصمة والمراحل...' : 'كشف البصمة الفكرية'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
