import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Clock, Sparkles, Plus, Send, MessageSquare, Play, 
  Search, BookOpen, Compass, Layers, CheckCircle2, ChevronLeft, 
  HelpCircle, Trash2, Cpu, Globe, ArrowRight, Lightbulb, RefreshCw
} from 'lucide-react';
import { PersonaData, SchoolOfThought } from '../types';
import { getGeminiClient, parseJsonSafely } from '../utils/gemini';
import { safeStorage } from '../utils/storage';
import ConfirmModal from './ConfirmModal';

interface CollectiveMindBoardProps {
  personas: Record<string, PersonaData>;
  onSelectPersona: (name: string) => void;
  launchGroupSession: (participants: string[], question?: string) => void;
}

// Initial rich list of Schools of Thought with timeline data
const DEFAULT_SCHOOLS: SchoolOfThought[] = [
  {
    id: 'aristotelian',
    name: 'المدرسة المنطقية والعقلانية الكلاسيكية',
    era: '384 - 322 قبل الميلاد',
    icon: '🏛️',
    color: '#38bdf8',
    thesis: 'العقل والمنطق الصوري هما الأداة الأسمى لبناء المعرفة وفهم قوانين الطبيعة والمادة.',
    description: 'تأسست على مبادئ التحليل المنطقي والملاحظة المنهجية، واعتبرت أن الكون يعمل وفق قوانين سببية يمكن إدراكها بالبرهان الفلسفي.',
    keyMinds: ['أرسطو', 'ابن سينا', 'ديكارت'],
    principles: [
      'مبدأ عدم التناقض والسببية المطلقة',
      'الاستدلال المنطقي من الكليات إلى الجزئيات',
      'التصنيف التجريبي لظواهر الطبيعة'
    ],
    historicalStages: [
      { stage: 'التأسيس الأثيني', period: 'القرن IV ق.م', summary: 'وضع كتاب الأورغانون وصياغة القياس المنطقي.' },
      { stage: 'الاستيعاب الإسلامي', period: 'القرن IX - XI م', summary: 'تطوير ابن سينا والفارابي للمنطق المشائي وتوفيقه مع التوحيد.' },
      { stage: 'النهضة الأوروبية', period: 'القرن XVII م', summary: 'إعادة صياغة العقلانية مع كوجيتو ديكارت.' }
    ],
    footprint: 'شكلت اللبنة الأولى لعلوم الكومبيوتر وتصميم الخوارزميات المنطقية الصارمة.',
    evolutionToAGI: 'تطبيق المنطق الرمزي والأنظمة القائمة على القواعد في الذكاء الاصطناعي (Symbolic AI).'
  },
  {
    id: 'khaldunian',
    name: 'مدرسة العمران البشري والعصبية الاجتماعية',
    era: '1332 - 1406 ميلادي',
    icon: '📜',
    color: '#fbbf24',
    thesis: 'التاريخ والمجتمعات تخضع لقوانين نماء وسقوط حتمية ترتبط بالعصبية والعمران والبيئة.',
    description: 'المدرسة الأولى في تاريخ البشرية التي صاغت علم الاجتماع وفلسفة التاريخ بشكل علمي رصين ومستقل عن الخرافات.',
    keyMinds: ['ابن خلدون', 'كانت'],
    principles: [
      'مفهوم العصبية كديناميكية دافعة للتمكين',
      'دور الاقتصاد والعمران في تشكيل الدولة',
      'دور الدورة الحياتية للدول والمجتمعات'
    ],
    historicalStages: [
      { stage: 'صياغة المقدمة', period: '1377 م', summary: 'كتابة مقدمة ابن خلدون واكتشاف قوانين العمران.' },
      { stage: 'التأثير العالمي', period: 'القرن XIX م', summary: 'اعتراف المؤرخين وعلماء الاجتماع الغربيين بأسبقية ابن خلدون.' }
    ],
    footprint: 'أسست للتحليل البياني والنمذجة الديموغرافية لسلوك الحشود والمجتمعات.',
    evolutionToAGI: 'مكّنت من بناء شبكات تحليل السلوك الجمعي ونمذجة المجتمعات الذكية شبكياً.'
  },
  {
    id: 'cybernetic',
    name: 'مدرسة الحاسوبية والحسابية المجرّدة (Turing-Einsteinian)',
    era: '1900 - 1950 ميلادي',
    icon: '💻',
    color: '#a78bfa',
    thesis: 'العقل والكون هما نظاما معالجة معلومات وطاقة خاضعان لقوانين حسابية ونسبيات فيزيو-رياضية.',
    description: 'دمجت بين النسبية العامة الفيزيائية وآلة تورينغ الشاملة، معتبرة أن معالجة البيانات هي الجوهر الأساسي للحياة والذكاء.',
    keyMinds: ['ألان تورينغ', 'ألبيرت أينشتاين'],
    principles: [
      'اختبار تورينغ وقابلية الآلة للتفكير',
      'استكشاف نسبية الزمان والمكان والطاقة',
      'الخوارزمية كمعمارية للحلول المعقدة'
    ],
    historicalStages: [
      { stage: 'الثورة الفيزيائية', period: '1905 - 1915 م', summary: 'صياغة النسبية الخاصة والعامة من قبل أينشتاين.' },
      { stage: 'آلة تورينغ', period: '1936 - 1950 م', summary: 'ابتكار مفهوم الحوسبة الشاملة واختبار الذكاء الاصطناعي.' }
    ],
    footprint: 'أوجدت الثورة الرقمية المعاصرة وبناء أول أجهزة الحواسيب الفائقة.',
    evolutionToAGI: 'الركيزة المباشرة لبناء شبكات التعلم العميق ونماذج المحولات (Transformers) و AGI.'
  },
  {
    id: 'jobsian',
    name: 'مدرسة التفكير التصميمي والإبداع الإنساني الرقمي',
    era: '1976 - الوقت الحاضر',
    icon: '🍎',
    color: '#34d399',
    thesis: 'التكنولوجيا وحدها لا تكفي؛ البساطة المطلقة والتقاطع مع العلوم الإنسانية هما سر إلهام الروح البشرية.',
    description: 'تركز على جعل التكنولوجيا امتداداً عفوياً وجمالياً للعقل البشري دون تعقيد ثقيل.',
    keyMinds: ['ستيف جوبز'],
    principles: [
      'التصميم ليس فقط كيف يبدو الشيء، بل كيف يعمل',
      'البساطة هي نهاية المطاف في التعقيد',
      'دمج التكنولوجيا بالفن والجماليات الإنسانية'
    ],
    historicalStages: [
      { stage: 'تأسيس أبل والحاسوب الشخصي', period: '1976 - 1984 م', summary: 'إطلاق ماكنتوش وواجهة المستخدم الرسمية.' },
      { stage: 'عصر الأجهزة الذكية', period: '2007 م', summary: 'إعادة تعريف الهاتف والتفاعل اللمسي الإنساني.' }
    ],
    footprint: 'غيرت علاقة البشر بالتكنولوجيا من مجرد أدوات حسوبية إلى أسلوب حياة وإلهام.',
    evolutionToAGI: 'توجيه الذكاء الاصطناعي العام ليكون واجهة سلسة، أخلاقية، وإنسانية التفاعل.'
  }
];

// Historical Eras for Timeline mapping
const HISTORICAL_ERAS = [
  { id: 'ancient', name: 'العصور القديمة والفلسفة الأولى', period: '500 ق.م - 500 م', color: '#38bdf8', icon: '🏛️' },
  { id: 'golden', name: 'العصر الذهبي والعقلانية الإسلامية', period: '800 م - 1400 م', color: '#fbbf24', icon: '🕌' },
  { id: 'enlightenment', name: 'عصر التنوير والنهضة الحديثة', period: '1500 م - 1900 م', color: '#f472b6', icon: '📜' },
  { id: 'cybernetics', name: 'عصر الحوسبة والفيزياء الحديثة', period: '1900 م - 2000 م', color: '#a78bfa', icon: '⚛️' },
  { id: 'agi', name: 'عصر الابتكار الرقمي والـ AGI', period: '2000 م - المستقبل', color: '#34d399', icon: '🧠' }
];

export const CollectiveMindBoard: React.FC<CollectiveMindBoardProps> = ({
  personas,
  onSelectPersona,
  launchGroupSession
}) => {
  const [schools, setSchools] = useState<SchoolOfThought[]>(() => {
    try {
      const saved = safeStorage.getItem('mindmirror_custom_schools');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return [...DEFAULT_SCHOOLS, ...parsed];
        }
      }
    } catch (e) {
      console.error('[Storage] Failed to load custom schools:', e);
    }
    return DEFAULT_SCHOOLS;
  });

  const [activeEra, setActiveEra] = useState<string>('all');
  const [selectedSchool, setSelectedSchool] = useState<SchoolOfThought>(schools[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonaFilter, setSelectedPersonaFilter] = useState<string | null>(null);
  const [schoolToDeleteId, setSchoolToDeleteId] = useState<string | null>(null);

  // New School Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolEra, setNewSchoolEra] = useState('عصر الحديث والذكاء الاصطناعي');
  const [newSchoolThesis, setNewSchoolThesis] = useState('');
  const [newSchoolMinds, setNewSchoolMinds] = useState('');
  const [isGeneratingSchool, setIsGeneratingSchool] = useState(false);

  // Symposium Triggering Quick Modal State
  const [showSymposiumPromptModal, setShowSymposiumPromptModal] = useState(false);
  const [symposiumQuestion, setSymposiumQuestion] = useState('');
  const [symposiumMinds, setSymposiumMinds] = useState<string[]>([]);

  // Array of all available personas keys/names
  const allPersonaKeys = Object.keys(personas);

  // Sync to local storage when custom schools change
  const saveCustomSchools = (updatedList: SchoolOfThought[]) => {
    setSchools(updatedList);
    const customOnly = updatedList.filter(s => s.isCustom);
    safeStorage.setItem('mindmirror_custom_schools', JSON.stringify(customOnly));
  };

  const handleCreateCustomSchoolWithAI = async () => {
    if (!newSchoolName.trim()) return;
    setIsGeneratingSchool(true);

    try {
      const ai = getGeminiClient();
      const prompt = `أنت فيلسوف ومؤرخ معارف خبير. قم بتوليد بيانات مدرسة فكرية أو تيار فلسفي/علمي باسم "${newSchoolName}".
العصر الفكري: ${newSchoolEra}
أدخل الشخصيات الممثلة إن وجدت: ${newSchoolMinds || 'غير محدد'}

المطلوب: إرجاع كائن JSON حصراً بالصيغة التالية:
{
  "thesis": "أطروحة مركزية مكثفة وعميقة في سطرين عن جوهر هذه المدرسة",
  "description": "شرح مفصل وممتع عن المدرسة الفكرية وأهدافها",
  "keyMinds": ["اسم شخصية 1", "اسم شخصية 2", "اسم شخصية 3"],
  "principles": ["مبدأ 1", "مبدأ 2", "مبدأ 3"],
  "historicalStages": [
    { "stage": "مرحلة التأسيس", "period": "الفترة الزمنية", "summary": "ملخص المرحلة" },
    { "stage": "مرحلة النضج والانتشار", "period": "الفترة الزمنية", "summary": "ملخص المرحلة" }
  ],
  "footprint": "الأثر التاريخي والمعرفي الذي تركته هذه المدرسة",
  "evolutionToAGI": "كيف تؤثر هذه المدرسة وتنعكس على مستقبل الذكاء الاصطناعي العام AGI والوعي الرقمي"
}`;

      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      let parsed: any = {};
      if (res.text) {
        parsed = parseJsonSafely(res.text);
      }

      const newSchoolObj: SchoolOfThought = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: newSchoolName.trim(),
        era: newSchoolEra,
        icon: '✨',
        color: '#f472b6',
        thesis: parsed.thesis || newSchoolThesis || 'مدرسة فكرية معاصرة تجسد تطلع المعرفة والوعي.',
        description: parsed.description || 'مدرسة فكرية جديدة مضافة بواسطة المستخدم لتوسيع خريطة العقول.',
        keyMinds: parsed.keyMinds && parsed.keyMinds.length > 0 ? parsed.keyMinds : (newSchoolMinds ? newSchoolMinds.split(',').map(s => s.trim()) : ['ستيف جوبز', 'أرسطو']),
        principles: parsed.principles || ['الابتكار المستمر', 'التكامل بين العقل والتكنولوجيا'],
        historicalStages: parsed.historicalStages || [
          { stage: 'التأسيس والمبادرة', period: 'الحاضر', summary: 'إطلاق المدرسة ضمن العقل الجمعي لـ MindMirror.' }
        ],
        footprint: parsed.footprint || 'إثراء الحوار الفكري الرقمي.',
        evolutionToAGI: parsed.evolutionToAGI || 'توجيه AGI نحو آفاق جديدة من الفهم.',
        isCustom: true
      };

      const updated = [...schools, newSchoolObj];
      saveCustomSchools(updated);
      setSelectedSchool(newSchoolObj);
      setShowAddModal(false);
      setNewSchoolName('');
      setNewSchoolThesis('');
      setNewSchoolMinds('');
    } catch (err) {
      console.error(err);
      // Fallback custom school
      const fallbackSchool: SchoolOfThought = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: newSchoolName.trim(),
        era: newSchoolEra,
        icon: '💡',
        color: '#ec4899',
        thesis: newSchoolThesis || 'مدرسة فكرية تجمع بين الرؤية المستقبلية والتكامل المعرفي.',
        description: 'مدرسة فكرية تم إنشاؤها وتأطيرها ضمن خريطة العقول.',
        keyMinds: newSchoolMinds ? newSchoolMinds.split(',').map(s => s.trim()) : ['أرسطو', 'ستيف جوبز'],
        principles: ['التفكير المستقل', 'الربط بين العلوم'],
        historicalStages: [{ stage: 'البداية', period: 'الحاضر', summary: 'صياغة المبادئ الأساسية.' }],
        footprint: 'توسيع آفاق العقل الجمعي.',
        evolutionToAGI: 'دعم تطبيقات الوعي الرقمي.',
        isCustom: true
      };
      const updated = [...schools, fallbackSchool];
      saveCustomSchools(updated);
      setSelectedSchool(fallbackSchool);
      setShowAddModal(false);
      setNewSchoolName('');
    } finally {
      setIsGeneratingSchool(false);
    }
  };

  const confirmDeleteCustomSchool = (schoolId: string) => {
    const updated = schools.filter(s => s.id !== schoolId);
    saveCustomSchools(updated);
    if (selectedSchool.id === schoolId) {
      setSelectedSchool(updated[0] || DEFAULT_SCHOOLS[0]);
    }
  };

  const openSymposiumForSchool = (school: SchoolOfThought) => {
    setSymposiumMinds(school.keyMinds);
    setSymposiumQuestion(`ندوة العقل الجمعي لـ (${school.name}): ما هي الأطروحة المعرفية والأخلاقية الجوهرية لمدرستنا حول "${school.thesis}"، وكيف تسهم في تشكيل الوعي البشري والرقمي؟`);
    setShowSymposiumPromptModal(true);
  };

  const handleLaunchSymposiumNow = () => {
    if (symposiumMinds.length === 0) return;
    setShowSymposiumPromptModal(false);
    launchGroupSession(symposiumMinds, symposiumQuestion);
  };

  const matchesActiveEra = (school: SchoolOfThought, eraFilter: string): boolean => {
    if (eraFilter === 'all') return true;
    const eraText = `${school.id} ${school.era} ${school.name}`.toLowerCase();
    if (eraFilter === 'ancient') return eraText.includes('قبل الميلاد') || eraText.includes('ق.م') || eraText.includes('القديم') || school.id === 'aristotelian';
    if (eraFilter === 'golden') return eraText.includes('1332') || eraText.includes('1406') || eraText.includes('الذهبي') || eraText.includes('إسلامي') || school.id === 'khaldunian';
    if (eraFilter === 'enlightenment') return eraText.includes('تنوير') || eraText.includes('نهضة') || /1[5-8]\d{2}/.test(eraText);
    if (eraFilter === 'cybernetics') return eraText.includes('1900') || eraText.includes('1950') || eraText.includes('حوسبة') || eraText.includes('فيزياء') || school.id === 'cybernetic';
    if (eraFilter === 'agi') return eraText.includes('1976') || eraText.includes('الحاضر') || eraText.includes('حديث') || eraText.includes('معاصر') || eraText.includes('agi') || eraText.includes('رقمي') || eraText.includes('مستقبل') || school.id === 'jobsian';
    return true;
  };

  // Filtered schools
  const filteredSchools = schools.filter(s => {
    const matchesSearch = searchQuery === '' || 
      s.name.includes(searchQuery) || 
      s.thesis.includes(searchQuery) || 
      s.keyMinds.some(m => m.includes(searchQuery));
    
    const matchesPersona = !selectedPersonaFilter || s.keyMinds.includes(selectedPersonaFilter);
    const matchesEra = matchesActiveEra(s, activeEra);
    return matchesSearch && matchesPersona && matchesEra;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-surface2 via-surface to-surface2 border border-border/80 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-3 py-1 rounded-full text-accent text-xs font-bold mb-3">
              <Sparkles size={14} className="animate-pulse" />
              <span>لوحة العقل الجمعي والشبكة المعرفية (Collective Mind Board)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text leading-tight">
              ترابط العقول وتتبع التيارات الفكرية عبر التاريخ
            </h2>
            <p className="text-sm text-muted mt-2 leading-relaxed">
              استكشف كيف تتداخل الأفكار والمدارس الفلسفية من العصور القديمة وصولاً إلى عصر الـ AGI. يمكنك إضافة مدارس فكرية جديدة، واختبار العقول الممثلة لها عبر استدعاء فوري للمناظرة الجماعية.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-accent hover:bg-accent/90 text-white font-bold px-5 py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer hover:scale-102 shrink-0"
            >
              <Plus size={16} /> إضافة مدرسة فكرية جديدة
            </button>

            <button
              onClick={() => openSymposiumForSchool(selectedSchool)}
              className="bg-gradient-to-r from-emerald-500 via-teal-500 to-purple-600 text-white font-extrabold px-5 py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer hover:scale-102 shrink-0 border border-white/20"
            >
              <Users size={16} /> إطلاق ندوة العقل الجمعي المباشرة
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Timeline Filter Header */}
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h3 className="text-base font-bold text-text flex items-center gap-2">
            <Clock size={18} className="text-accent" /> المسار الزمني للتيارات الفكرية (Interactive Era Timeline)
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>تصفية بحسب العصر الفكري</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {HISTORICAL_ERAS.map((era) => {
            const isSelected = activeEra === era.id;
            return (
              <button
                key={era.id}
                onClick={() => setActiveEra(isSelected ? 'all' : era.id)}
                className={`p-3.5 rounded-2xl border text-start transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-surface border-accent shadow-md shadow-accent/10 scale-102'
                    : 'bg-surface2/50 border-border/60 hover:border-border text-muted hover:text-text'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{era.icon}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface2 border border-border text-muted">
                    {era.period}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text mb-1">{era.name}</h4>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Personas Matrix Link */}
      <div className="bg-surface/60 border border-border/80 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-accent" />
            <span className="text-xs font-bold text-text">شبكة البصمات المعرفية المتصلة ({allPersonaKeys.length} شخصيات):</span>
          </div>
          {selectedPersonaFilter && (
            <button
              onClick={() => setSelectedPersonaFilter(null)}
              className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer"
            >
              إلغاء تصفية الشخصية ({selectedPersonaFilter})
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {allPersonaKeys.map(pKey => {
            const pData = personas[pKey];
            const isSelected = selectedPersonaFilter === pKey;
            return (
              <button
                key={pKey}
                onClick={() => setSelectedPersonaFilter(isSelected ? null : pKey)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected 
                    ? 'bg-accent text-white border-accent shadow-md scale-105' 
                    : 'bg-surface2/80 border-border/60 text-muted hover:text-text hover:border-accent/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pData?.color || '#38bdf8' }}></span>
                <span>{pData?.label || pKey}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Layout: Schools List & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Right Schools Cards Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مدرسة فكرية، أطروحة، أو مفكر..."
              className="w-full bg-surface2/80 border border-border/80 rounded-xl pe-9 ps-4 py-2.5 text-xs text-text focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pe-1">
            {filteredSchools.map((school) => {
              const isSelected = selectedSchool.id === school.id;
              return (
                <div
                  key={school.id}
                  onClick={() => setSelectedSchool(school)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'bg-surface border-accent shadow-lg shadow-accent/10 scale-101'
                      : 'bg-surface2/40 border-border/60 hover:border-border text-muted hover:text-text'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{school.icon}</span>
                      <h4 className="text-sm font-bold text-text group-hover:text-accent transition-colors">
                        {school.name}
                      </h4>
                    </div>
                    {school.isCustom && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSchoolToDeleteId(school.id);
                        }}
                        className="text-muted hover:text-red-400 p-1 transition-colors cursor-pointer"
                        title="حذف هذه المدرسة المخصصة"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-muted line-clamp-2 leading-relaxed mb-3">
                    {school.thesis}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/40">
                    <span className="text-muted font-mono">{school.era}</span>
                    <div className="flex items-center gap-1.5 text-accent font-bold">
                      <Users size={12} />
                      <span>{school.keyMinds.length} عقول</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSchools.length === 0 && (
              <div className="text-center py-10 bg-surface2/30 rounded-2xl border border-dashed border-border/60 text-muted text-xs">
                لا توجد مدارس فكرية مطابقة للبحث الحفاظي.
              </div>
            )}
          </div>
        </div>

        {/* Selected School Detailed View & Action Panel */}
        <div className="lg:col-span-7 bg-surface border border-border/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl sticky top-6">
          <div className="flex justify-between items-start flex-wrap gap-4 pb-4 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{selectedSchool.icon}</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-bold">
                  {selectedSchool.era}
                </span>
                {selectedSchool.isCustom && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                    مدرسة مخصصة
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-text">
                {selectedSchool.name}
              </h3>
            </div>

            <button
              onClick={() => openSymposiumForSchool(selectedSchool)}
              className="bg-gradient-to-r from-emerald-500 to-accent text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 shadow-md cursor-pointer hover:scale-102"
            >
              <Sparkles size={16} className="animate-pulse" />
              إطلاق المناظرة الجماعية لهذه المدرسة
            </button>
          </div>

          {/* Thesis Box */}
          <div className="bg-surface2/70 border border-accent/30 rounded-2xl p-4 relative overflow-hidden">
            <div className="text-xs font-bold text-accent mb-1 flex items-center gap-1.5">
              <Lightbulb size={14} /> الأطروحة المعرفية الجوهرية (Core Thesis)
            </div>
            <p className="text-sm font-semibold text-text leading-relaxed">
              "{selectedSchool.thesis}"
            </p>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-muted mb-2 uppercase tracking-wider">حول المدرسة والمنهج المعرفي:</h4>
            <p className="text-xs text-text/90 leading-relaxed">
              {selectedSchool.description}
            </p>
          </div>

          {/* Representing Minds */}
          <div>
            <h4 className="text-xs font-bold text-muted mb-3 uppercase tracking-wider">العقول الممثلة لهذه المدرسة:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedSchool.keyMinds.map((mind, idx) => (
                <div
                  key={idx}
                  className="bg-surface2 border border-border/80 px-3 py-2 rounded-xl text-xs font-bold text-text flex items-center justify-between gap-3 group hover:border-accent transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent"></span>
                    {mind}
                  </span>
                  <button
                    onClick={() => onSelectPersona(mind)}
                    className="text-[10px] text-accent opacity-80 group-hover:opacity-100 hover:underline cursor-pointer"
                  >
                    حوار مباشر ←
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Key Principles */}
          {selectedSchool.principles && selectedSchool.principles.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted mb-2 uppercase tracking-wider">المبادئ والأركان الأساسية:</h4>
              <ul className="space-y-2">
                {selectedSchool.principles.map((p, i) => (
                  <li key={i} className="text-xs text-text/80 flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Historical Stages */}
          {selectedSchool.historicalStages && selectedSchool.historicalStages.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted mb-3 uppercase tracking-wider">المراحل التاريخية للتطور:</h4>
              <div className="space-y-2 border-s-2 border-accent/30 pe-3 me-1">
                {selectedSchool.historicalStages.map((stage, sIdx) => (
                  <div key={sIdx} className="relative pb-2">
                    <div className="absolute -right-[17px] top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-surface"></div>
                    <div className="flex items-center justify-between text-xs font-bold text-text">
                      <span>{stage.stage}</span>
                      <span className="text-[10px] text-muted font-mono">{stage.period}</span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{stage.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evolution to AGI */}
          <div className="bg-purple-950/20 border border-purple-500/30 rounded-2xl p-4">
            <div className="text-xs font-bold text-purple-400 mb-1 flex items-center gap-1.5">
              <Cpu size={14} /> الانعكاس على المستقبل والتفكير الذكي (Evolution to AGI)
            </div>
            <p className="text-xs text-text/90 leading-relaxed">
              {selectedSchool.evolutionToAGI}
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Add New School of Thought */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-border rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl relative"
            >
              <div className="flex justify-between items-center pb-3 border-b border-border/60">
                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                  <Sparkles size={18} className="text-accent" /> إضافة مدرسة فكرية جديدة للتايم لاين
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted hover:text-text cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-muted font-bold mb-1">اسم المدرسة الفكرية أو التيار المعرفي:</label>
                  <input
                    type="text"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="مثال: الفينومينولوجيا الرقمية، المدرسة المشائية الجديدة..."
                    className="w-full bg-surface2 border border-border rounded-xl p-3 text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-muted font-bold mb-1">العصر الزمني أو الحقبة التاريخية:</label>
                  <input
                    type="text"
                    value={newSchoolEra}
                    onChange={(e) => setNewSchoolEra(e.target.value)}
                    placeholder="مثال: القرن الحادي والعشرين، العصر الحديث..."
                    className="w-full bg-surface2 border border-border rounded-xl p-3 text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-muted font-bold mb-1">الشخصيات والعقول الممثلة (مفصولة بفاصلة):</label>
                  <input
                    type="text"
                    value={newSchoolMinds}
                    onChange={(e) => setNewSchoolMinds(e.target.value)}
                    placeholder="مثال: ستيف جوبز, ألان تورينغ, أرسطو..."
                    className="w-full bg-surface2 border border-border rounded-xl p-3 text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-muted font-bold mb-1">الأطروحة المركزية (اختياري، أو اتركها للذكاء الاصطناعي):</label>
                  <textarea
                    value={newSchoolThesis}
                    onChange={(e) => setNewSchoolThesis(e.target.value)}
                    placeholder="اكتب أطروحة المدرسة الفكرية أو دَع المحرك يستنتجها تلقائياً..."
                    rows={3}
                    className="w-full bg-surface2 border border-border rounded-xl p-3 text-text focus:outline-none focus:border-accent resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateCustomSchoolWithAI}
                  disabled={isGeneratingSchool || !newSchoolName.trim()}
                  className="flex-1 bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isGeneratingSchool ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {isGeneratingSchool ? 'جاري الاستنتاج والتأطير بواسطة Gemini...' : 'توليد وإضافة المدرسة الفكرية'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="bg-surface2 hover:bg-surface2/80 text-muted hover:text-text font-bold px-4 py-3 rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Live Symposium Call Prompt */}
      <AnimatePresence>
        {showSymposiumPromptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-border rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl relative"
            >
              <div className="flex justify-between items-center pb-3 border-b border-border/60">
                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                  <Users size={18} className="text-emerald-400" /> إطلاق ندوة العقل الجمعي المباشرة
                </h3>
                <button
                  onClick={() => setShowSymposiumPromptModal(false)}
                  className="text-muted hover:text-text cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-muted font-bold mb-1">العقول والمفكرون المشاركون في الندوة:</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-surface2 rounded-xl border border-border">
                    {symposiumMinds.map((m, i) => (
                      <span key={i} className="bg-accent/10 border border-accent/30 text-accent font-bold px-2.5 py-1 rounded-lg text-xs">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-muted font-bold mb-1">السؤال الحواري والأطروحة المطروحة للندوة:</label>
                  <textarea
                    value={symposiumQuestion}
                    onChange={(e) => setSymposiumQuestion(e.target.value)}
                    rows={4}
                    className="w-full bg-surface2 border border-border rounded-xl p-3 text-text focus:outline-none focus:border-accent resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleLaunchSymposiumNow}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-accent text-white font-extrabold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer hover:scale-102"
                >
                  <Send size={16} /> بدء الندوة الجماعية الآن
                </button>
                <button
                  onClick={() => setShowSymposiumPromptModal(false)}
                  className="bg-surface2 hover:bg-surface2/80 text-muted hover:text-text font-bold px-4 py-3.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!schoolToDeleteId}
        title="حذف المدرسة الفكرية المخصصة"
        message="هل أنت متأكد من رغبتك في حذف هذه المدرسة الفكرية المخصصة نهائياً؟"
        confirmText="نعم، احذف المدرسة"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          if (schoolToDeleteId) {
            confirmDeleteCustomSchool(schoolToDeleteId);
            setSchoolToDeleteId(null);
          }
        }}
        onCancel={() => setSchoolToDeleteId(null)}
      />
    </div>
  );
};
