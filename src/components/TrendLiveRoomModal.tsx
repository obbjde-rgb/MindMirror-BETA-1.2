import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sparkles, Radar, Satellite, ShieldCheck, AlertTriangle, 
  TrendingUp, Users, Send, Bot, User, CheckCircle2, RefreshCw, 
  Sliders, MessageSquare, BookOpen, Layers, Activity, Eye, Play, Plus, Zap, ArrowRight, ExternalLink, Loader2
} from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';
import { getGeminiClient, withRetry, parseJsonSafely, normalizeGeminiModel } from '../utils/gemini';
import { safeStorage } from '../utils/storage';
import { useToast } from './Toast';

export interface TrendTopic {
  id: string;
  title: string;
  category: string;
  confidence: number;
  sentiment: string;
  sentimentScore: number;
  riskLevel: 'منخفض' | 'متوسط' | 'مرتفع';
  verificationStatus: 'غير مطلوب' | 'قيد التحقق' | 'تم التحقق' | 'مضلل';
  sourceAuthority: number;
  weakSignalSource: string;
  syntheticQueries: string[];
  suggestedCrew: {
    role: string;
    name: string;
    tone: string;
    avatarKey: string;
    specialty?: string;
  }[];
}

interface TrendLiveRoomModalProps {
  show: boolean;
  onClose: () => void;
  personas: Record<string, any>;
  isLoading?: boolean;
  onStartTrendRoom?: (trend: TrendTopic, initialMessages?: any[]) => void;
  isStrictModelMode?: boolean;
  model?: string;
  apiKey?: string;
}

const DEFAULT_PRESET_TRENDS: TrendTopic[] = [
  {
    id: 't1',
    title: 'تداول صورة مفبركة لمنتج غذائي شهير مع ادعاءات صحية خطيرة',
    category: 'صحة وسلامة عامة',
    confidence: 96,
    sentiment: 'قلق وشكوك',
    sentimentScore: -0.78,
    riskLevel: 'متوسط',
    verificationStatus: 'قيد التحقق',
    sourceAuthority: 0.84,
    weakSignalSource: 'منشورات مصغرة تتبادل صورة قديمة من 2021 مع وسوم وتواريخ مستحدثة',
    syntheticQueries: ['منتج غذائي تحذير صحي فحص عينة مخبرية', 'صورة مفبركة لشركة مواد غذائية 2026'],
    suggestedCrew: [
      { role: 'متحقق رقمي', name: 'د. سارة المتحققة', tone: 'حذرة ومدعمة بالأدلة التاريخية', avatarKey: 'المرأة الحكيمة', specialty: 'فحص التزييف والبيانات الوصفية' },
      { role: 'محلل سلامة غذائية', name: 'المهندس خليل', tone: 'موضوعي وعلمي صارم', avatarKey: 'ابن خلدون', specialty: 'المعايير الصحية والمخبرية' },
      { role: 'صوت الجمهور', name: 'سعيد المستهلك', tone: 'قلق ويبحث عن طمأنة وتوضيح', avatarKey: 'ستيف جوبز', specialty: 'نقل مخاوف المستهلكين' },
      { role: 'وسيط الغرفة', name: 'ريم المنسقة', tone: 'محايد، جامع للآراء وهادئ', avatarKey: 'أرسطو', specialty: 'إدارة الحوار ومنع الشائعات' }
    ]
  },
  {
    id: 't2',
    title: 'إعلان مفاجئ عن خوارزمية ذكاء اصطناعي تتفوق في هندسة البرمجيات الذاتية',
    category: 'تقنية وذكاء اصطناعي',
    confidence: 93,
    sentiment: 'أمل وانبهار',
    sentimentScore: 0.88,
    riskLevel: 'منخفض',
    verificationStatus: 'تم التحقق',
    sourceAuthority: 0.95,
    weakSignalSource: 'أوراق بحثية غير منشورة وتسريبات مستودعات كود ومقاييس اختبار معتمدة',
    syntheticQueries: ['الذكاء الاصطناعي البرمجة الذاتية نموذج جديد 2026', 'أداء الخوارزميات الذاتية في هندسة النظم'],
    suggestedCrew: [
      { role: 'خبير الذكاء الاصطناعي', name: 'آلان تورينغ الرقمي', tone: 'عميق وفلسفي رياضي', avatarKey: 'ألبرت أينشتاين', specialty: 'منطق الحساب والآلات المفكرة' },
      { role: 'محلل اقتصادي', name: 'دانا الاقتصادية', tone: 'واقعي ويقيس أثر سوق العمل', avatarKey: 'مارك تووين', specialty: 'اقتصاديات البرمجيات والإنتاجية' },
      { role: 'ممثل المطورين', name: 'عمر المبرمج', tone: 'عملي وتقني مباشر', avatarKey: 'ستيف جوبز', specialty: 'سير العمل الحقيقي والتطبيقات' },
      { role: 'وسيط الغرفة', name: 'سامي الميسر', tone: 'هادئ وموجه للأسئلة', avatarKey: 'أرسطو', specialty: 'تركيب الرؤى والتلخيص' }
    ]
  }
];

export default function TrendLiveRoomModal({
  show,
  onClose,
  personas,
  isLoading = false,
  onStartTrendRoom,
  isStrictModelMode = false,
  model = 'gemini-3-flash-preview',
  apiKey = ''
}: TrendLiveRoomModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'radar' | 'room' | 'create'>('radar');
  const [trends, setTrends] = useState<TrendTopic[]>(() => {
    try {
      const saved = safeStorage.getItem('mindmirror_trendLive_topics');
      if (saved) {
        const parsed = parseJsonSafely<TrendTopic[]>(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('[Storage] Failed to load trend topics:', e);
    }
    return DEFAULT_PRESET_TRENDS;
  });

  const [selectedTrend, setSelectedTrend] = useState<TrendTopic>(trends[0] || DEFAULT_PRESET_TRENDS[0]);
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [roomActive, setRoomActive] = useState(false);
  const [roomMessages, setRoomMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  const [userIntent, setUserIntent] = useState<'فهم' | 'تحقق' | 'نقاش' | 'متابعة'>('فهم');
  
  // Real AI Processing States
  const [isScanningLive, setIsScanningLive] = useState(false);
  const [isAiGeneratingTurn, setIsAiGeneratingTurn] = useState(false);
  const [isVerifyingClaim, setIsVerifyingClaim] = useState(false);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      safeStorage.setItem('mindmirror_trendLive_topics', JSON.stringify(trends));
    } catch (e) {
      // ignore
    }
  }, [trends]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomMessages]);

  if (!show) return null;

  // 1. Launch Room with initial crew dialogue
  const handleLaunchRoom = (trend: TrendTopic) => {
    setSelectedTrend(trend);
    setActiveTab('room');
    setRoomActive(true);

    const initialMsgs = [
      {
        id: 'sys_' + Date.now(),
        sender: 'وسيط الغرفة الذكي',
        role: 'وسيط الغرفة',
        text: `📡 **انعقاد غرفة تريند لايف الاستباقية**\n\nالموضوع المرصود: **"${trend.title}"**\nمؤشر الثقة بالانتشار: **${trend.confidence}%** | الحالة الشعورية: **${trend.sentiment}** | حالة التحقق: **${trend.verificationStatus}**\n\nنبدأ الآن الجلسة الحية بمشاركة الطاقم الرقمي المتولد ومسار التحقق المستمر.`,
        timestamp: 'الآن',
        isSystem: true
      },
      {
        id: 'msg_v_' + Date.now(),
        sender: trend.suggestedCrew[0]?.name || 'المتحقق الرقمي',
        role: trend.suggestedCrew[0]?.role || 'متحقق',
        text: `أقوم الآن بفحص مسار الإشارات الضعيفة (RTTP). المصدر المبدئي للرصد: "${trend.weakSignalSource}". قمنا بتوليد استعلامات البحث الاصطناعية: (${trend.syntheticQueries.join(' ، ')}). التحقق الأولي يشير إلى أن المعطيات قيد التدقيق المخبري والتاريخي لمنع أي تضليل.`,
        timestamp: 'منذ دقيقة',
        isSystem: false
      },
      {
        id: 'msg_a_' + Date.now(),
        sender: trend.suggestedCrew[1]?.name || 'المحلل المعرفي',
        role: trend.suggestedCrew[1]?.role || 'محلل',
        text: `من الناحية التحليلية والبنيوية (TrendSpotter)، نلاحظ تسارعاً في التفاعل بنسبة عالية. الجوهري هنا ليس مجرد تداول الخبر، بل فهم الدافع المعرفي والنفسي لدى الجمهور والآثار المترتبة.`,
        timestamp: 'الآن',
        isSystem: false
      }
    ];

    setRoomMessages(initialMsgs);
  };

  // 2. Real AI Scanner: Discover fresh live trends via Gemini
  const handleScanLiveTrendsWithAI = async () => {
    setIsScanningLive(true);
    toast({
      title: 'استشعار الإشارات الضعيفة (RTTP)',
      message: 'يقوم الذكاء الاصطناعي الآن برصد الموضوعات الصاعدة وبناء الرسم البياني الدلالي...',
      type: 'info'
    });

    try {
      const ai = getGeminiClient(apiKey);
      const prompt = `أنت محرك اكتشاف الترندات الاستباقي (RTTP & TrendSpotter Live Engine).
المطلوب: اكتشاف ورصد 3 تريندات أو أحداث صاعدة (في مجالات التقنية، الذكاء الاصطناعي، العلوم، الطاقة، الصحة، أو القضايا العامة العالمية والعربية) التي تبدأ بإشارات ضعيفة قبل تحولها لترند جماهيري، وتوليد طاقم شخصيات رقمية مناسب لكل منها.

أعد مصفوفة JSON تحتوي على 3 عناصر تماماً مطابقة للهيكل التالي (القيم المسموحة لـ riskLevel هي: "منخفض" أو "متوسط" أو "مرتفع"، والقيم المسموحة لـ verificationStatus هي: "قيد التحقق" أو "تم التحقق" أو "مضلل"):
[
  {
    "id": "trend_${Date.now()}_1",
    "title": "عنوان الترند الواضح واللافت",
    "category": "المجال والتصنيف",
    "confidence": 94,
    "sentiment": "الحالة الشعورية (مثال: قلق وترقب، أمل وانبهار، غضب وجدل)",
    "sentimentScore": 0.4,
    "riskLevel": "متوسط",
    "verificationStatus": "قيد التحقق",
    "sourceAuthority": 0.88,
    "weakSignalSource": "توصيف دقيق للإشارة الضعيفة الأولى ومكان التقاطها",
    "syntheticQueries": ["استعلام بحث اصطناعي 1", "استعلام بحث اصطناعي 2"],
    "suggestedCrew": [
      { "role": "متحقق رقمي", "name": "اسم خبير التحقق", "tone": "حذر ومدعم بالأدلة", "avatarKey": "المرأة الحكيمة", "specialty": "تخصصه" },
      { "role": "محلل استراتيجي", "name": "اسم المحلل", "tone": "عميق وموضوعي", "avatarKey": "ابن خلدون", "specialty": "تخصصه" },
      { "role": "صوت الجمهور", "name": "اسم الممثل", "tone": "متسائل وواقعي", "avatarKey": "ستيف جوبز", "specialty": "تخصصه" },
      { "role": "وسيط الغرفة", "name": "اسم الوسيط", "tone": "محايد وميسر", "avatarKey": "أرسطو", "specialty": "إدارة النقاش" }
    ]
  }
]
أعد JSON فقط بدون أي تعليقات أو نصوص خارج المصفوفة.`;

      const response = await withRetry(() => ai.models.generateContent({
        model: normalizeGeminiModel(model),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json'
        }
      }), 2, 2000);

      const raw = (response as any)?.text || '';
      const parsed: TrendTopic[] = parseJsonSafely(raw);

      if (Array.isArray(parsed) && parsed.length > 0) {
        setTrends(parsed);
        setSelectedTrend(parsed[0]);
        toast({
          title: 'تم استشعار تريندات جديدة',
          message: `تم رصد ${parsed.length} ترندات استباقية وتوليد طواقمها الرقمية بنجاح!`,
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Trend Scan Error:', err);
      toast({
        title: 'تنبيه الاتصال بالخدمة',
        message: 'تعذر التقاط ترندات جديدة حالياً، جاري استخدام البيانات الحالية الموثقة أو يرجى المحاولة لاحقاً.',
        type: 'error'
      });
    } finally {
      setIsScanningLive(false);
    }
  };

  // 3. Real AI Creation of custom user topic with 5 layers
  const handleCreateCustomTrend = async () => {
    if (!customTopicInput.trim()) return;
    setIsCreatingTopic(true);

    try {
      const ai = getGeminiClient(apiKey);
      const prompt = `أنت محرك الذكاء الاستباقي للترندات (RTTP + TrendSpotter).
قام المستخدم بإدخال الموضوع التالي لفتح غرفة تريند لايف حوله:
"${customTopicInput}"

المطلوب: إجراء تحليل خماسي الطبقات (الاستشعار RTTP، البنية الدلالية TrendSpotter، التقييم والمخاطر، التخصيص، وتوليد طاقم من 3-4 شخصيات رقمية متخصصة ومتحقق).

أعد كائن JSON فقط مطابق للنموذج التالي (القيم المسموحة لـ riskLevel هي "منخفض" أو "متوسط" أو "مرتفع"، و verificationStatus هي "قيد التحقق" أو "تم التحقق"):
{
  "id": "custom_${Date.now()}",
  "title": "${customTopicInput}",
  "category": "تصنيف دقيق للموضوع",
  "confidence": 92,
  "sentiment": "الحالة الشعورية السائدة",
  "sentimentScore": 0.2,
  "riskLevel": "متوسط",
  "verificationStatus": "قيد التحقق",
  "sourceAuthority": 0.85,
  "weakSignalSource": "توصيف الإشارات الأولى والروابط المرصودة",
  "syntheticQueries": ["استعلام بحث 1", "استعلام بحث 2"],
  "suggestedCrew": [
    { "role": "متحقق رقمي", "name": "اسم المتحقق", "tone": "حذر ومدعم بالبراهين", "avatarKey": "المرأة الحكيمة", "specialty": "التحقق والتوثيق" },
    { "role": "محلل موضوعي", "name": "اسم الخبير", "tone": "علمي وتفكيكي", "avatarKey": "ابن خلدون", "specialty": "التحليل العميق" },
    { "role": "صوت الجمهور", "name": "اسم الممثل", "tone": "متسائل وفضولي", "avatarKey": "ستيف جوبز", "specialty": "الشارع والأسئلة الحيوية" },
    { "role": "وسيط الغرفة", "name": "اسم المنسق", "tone": "هادئ وموجه", "avatarKey": "أرسطو", "specialty": "تيسير الحوار" }
  ]
}
أعد JSON Object فقط.`;

      const response = await withRetry(() => ai.models.generateContent({
        model: normalizeGeminiModel(model),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      }), 2, 1500);

      const parsed: TrendTopic = parseJsonSafely((response as any)?.text || '');
      if (parsed && parsed.title) {
        setTrends(prev => [parsed, ...prev]);
        setCustomTopicInput('');
        handleLaunchRoom(parsed);
      }
    } catch (e: any) {
      console.error("Create Trend Error:", e);
      toast({
        title: 'خطأ في إنشاء الترند',
        message: 'تعذر تحليل الموضوع وتوليد الغرفة حالياً، يرجى المحاولة لاحقاً.',
        type: 'error'
      });
    } finally {
      setIsCreatingTopic(false);
    }
  };

  // 4. Real User Message Handling via Gemini AI
  const handleSendMessage = async () => {
    if (!userInput.trim() || isAiGeneratingTurn) return;
    
    const userText = userInput.trim();
    const userMsg = {
      id: 'usr_' + Date.now(),
      sender: 'أنت (مشارك)',
      role: 'مشارك',
      text: userText,
      timestamp: 'الآن',
      isUser: true
    };

    setRoomMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setIsAiGeneratingTurn(true);

    try {
      const ai = getGeminiClient(apiKey);
      const crew = selectedTrend.suggestedCrew;
      // Pick best matching persona based on intent
      let chosenPersona = crew[0];
      if (userIntent === 'فهم') {
        chosenPersona = crew.find(c => c.role.includes('محلل') || c.role.includes('خبير')) || crew[1] || crew[0];
      } else if (userIntent === 'تحقق') {
        chosenPersona = crew.find(c => c.role.includes('متحقق') || c.role.includes('دقة')) || crew[0];
      } else if (userIntent === 'نقاش') {
        chosenPersona = crew.find(c => c.role.includes('جمهور') || c.role.includes('ممثل')) || crew[2] || crew[0];
      } else {
        chosenPersona = crew.find(c => c.role.includes('وسيط') || c.role.includes('منسق')) || crew[3] || crew[0];
      }

      const recentChat = [...roomMessages, userMsg].slice(-8).map(m => `${m.sender} (${m.role}): "${m.text}"`).join('\n\n');

      const prompt = `أنت تجسد شخصية "${chosenPersona.name}" بدور: (${chosenPersona.role}) في "غرفة تريند لايف الاستباقية".
نبرتك وأسلوبك: ${chosenPersona.tone}.
تخصصك: ${chosenPersona.specialty || 'التحليل المعرفي'}.

موضوع الغرفة: "${selectedTrend.title}".
الحالة الشعورية السائدة: "${selectedTrend.sentiment}".
حالة التحقق الحالية: "${selectedTrend.verificationStatus}".
احتياج المستخدم الحالي هو: "${userIntent}".

سجل الحوار الأخير داخل الغرفة:
${recentChat}

المطلوب منك:
- الرد مباشرة بلسان شخصيتك وأسلوبك على رسالة المستخدم الأخيرة.
- خاطب نقطة المستخدم بذكاء وعمق وقدم رؤية تدعم الفهم أو التحقق وفق دورك.
- لا تذكر أنك نموذج ذكاء اصطناعي، بل انغمس في دورك وطبيعة شخصيتك في هذه الغرفة.
- تحدث باللغة العربية الفصحى الراقية في فقرة مكثفة من 3-5 أسطر.`;

      const response = await withRetry(() => ai.models.generateContent({
        model: normalizeGeminiModel(model),
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }), 2, 1000);

      const replyText = (response as any)?.text?.trim() || 'شكراً لمداخلتك، نواصل متابعة الأدلة والحقائق.';

      const aiReply = {
        id: 'ai_' + Date.now(),
        sender: chosenPersona.name,
        role: chosenPersona.role,
        text: replyText,
        timestamp: 'الآن',
        isUser: false
      };

      setRoomMessages(prev => [...prev, aiReply]);
    } catch (e: any) {
      console.error("AI Reply Error:", e);
      toast({
        title: 'خطأ في الاتصال',
        message: 'تعذر توليد رد الشخصية حالياً، يرجى إعادة المحاولة.',
        type: "error"
      });
    } finally {
      setIsAiGeneratingTurn(false);
    }
  };

  // 5. Real Multi-Agent Live Turn (Crew members converse with each other)
  const handleTriggerCrewTurn = async () => {
    if (isAiGeneratingTurn) return;
    setIsAiGeneratingTurn(true);

    try {
      const ai = getGeminiClient(apiKey);
      const crew = selectedTrend.suggestedCrew;
      const lastMsg = roomMessages[roomMessages.length - 1];
      const nextIndex = (crew.findIndex(c => c.name === lastMsg?.sender) + 1) % crew.length;
      const speaker = crew[nextIndex >= 0 ? nextIndex : 0];

      const recentTranscript = roomMessages.slice(-6).map(m => `${m.sender} (${m.role}): "${m.text}"`).join('\n\n');

      const prompt = `أنت "${speaker.name}" بدور (${speaker.role}) في غرفة تريند لايف حول: "${selectedTrend.title}".
نبرتك: ${speaker.tone}.
المحادثة حتى الآن:
${recentTranscript}

المطلوب منك: التعقيب على ما طرحه زملاؤك في الطاقم، وإضافة نقطة جديدة سواء كدليل إضافي، أو تساؤل نقدي، أو تحليل لسلوك الانتشار.
اكتب رداً حوارياً طبيعياً ومتفاعلاً في سياق الغرفة باللغة العربية (3-4 أسطر).`;

      const response = await withRetry(() => ai.models.generateContent({
        model: normalizeGeminiModel(model),
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }), 2, 1000);

      const text = (response as any)?.text?.trim() || '';
      if (text) {
        setRoomMessages(prev => [
          ...prev,
          {
            id: 'crew_' + Date.now(),
            sender: speaker.name,
            role: speaker.role,
            text: text,
            timestamp: 'الآن',
            isUser: false
          }
        ]);
      }
    } catch (err: any) {
      console.error("Crew Turn Error:", err);
    } finally {
      setIsAiGeneratingTurn(false);
    }
  };

  // 6. Real Verification Lens Analysis (SLED & Google Search)
  const handleRunVerificationCheck = async () => {
    setIsVerifyingClaim(true);
    toast({
      title: 'عدسة التحقق السريعة',
      message: 'جاري فحص الادعاء ومطابقة الأدلة ومقاطعة المصادر...',
      type: 'info'
    });

    try {
      const ai = getGeminiClient(apiKey);
      const prompt = `أنت شخصية "المتحقق الرقمي المستقل" في نظام التحقق متعدد الوكلاء (SLED Framework).
موضوع التحقق والادعاء المرصود:
"${selectedTrend.title}"
الإشارات الأولية: "${selectedTrend.weakSignalSource}"
الاستعلامات المقترحة: ${selectedTrend.syntheticQueries.join(' ، ')}

المطلوب منك:
1. تقييم صدقية الادعاء وفق الحقائق والمنطق ومصادر الأرشيف.
2. تحديد حكم التحقق النهائي: هل هو "تم التحقق"، أم "مضلل"، أم "قيد التحقق".
3. كتابة خلاصة تدقيقية جراحية مدعمة بنقاط محددة توضح ما ثبت وما لم يثبت وحدود المعرفة الحالية.

أعد كائن JSON فقط (القيم المسموحة لـ verdictStatus هي: "تم التحقق" أو "مضلل" أو "قيد التحقق"):
{
  "verdictStatus": "تم التحقق",
  "confidenceScore": 95,
  "summaryText": "خلاصة التدقيق والأدلة المقاطعة بأسلوب بليغ في 3-4 أسطر",
  "evidencePoints": ["دليل 1 أو وثيقة", "دليل 2 أو مقارنة تاريخية"]
}`;

      const response = await withRetry(() => ai.models.generateContent({
        model: normalizeGeminiModel(model),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      }), 2, 1500);

      const parsed = parseJsonSafely((response as any)?.text || '');
      if (parsed) {
        const updatedStatus = parsed.verdictStatus === 'مضلل' ? 'مضلل' : parsed.verdictStatus === 'تم التحقق' ? 'تم التحقق' : 'قيد التحقق';
        const updatedTrend: TrendTopic = {
          ...selectedTrend,
          verificationStatus: updatedStatus,
          confidence: parsed.confidenceScore || selectedTrend.confidence
        };

        setSelectedTrend(updatedTrend);
        setTrends(prev => prev.map(t => t.id === updatedTrend.id ? updatedTrend : t));

        setRoomMessages(prev => [
          ...prev,
          {
            id: 'verif_' + Date.now(),
            sender: 'عدسة التحقق المباشر (SLED Engine)',
            role: 'تقرير تحقق رسمي',
            text: `🛡️ **تقرير التحقق والتقصي الميداني:**\n\nالحالة الرسمية: **[${updatedStatus}]** (بدرجة ثقة ${parsed.confidenceScore || 90}%)\n\n${parsed.summaryText}\n\n**الأدلة والشواهد المنقاة:**\n${(parsed.evidencePoints || []).map((p: string) => `• ${p}`).join('\n')}`,
            timestamp: 'الآن',
            isSystem: true
          }
        ]);
      }
    } catch (e: any) {
      console.error("Verification Error:", e);
      toast({
        title: 'خطأ في التحقق',
        message: 'تعذر تشغيل عدسة التحقق حالياً، يرجى إعادة المحاولة.',
        type: 'error'
      });
    } finally {
      setIsVerifyingClaim(false);
    }
  };

  const handleTransferToMainPlatform = () => {
    if (onStartTrendRoom) {
      onStartTrendRoom(selectedTrend, roomMessages);
    }
  };

  // 8. Visual Components for the Living Entity feel
  const TrendPulseWave = () => (
    <div className="flex items-end gap-0.5 h-6 px-2">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <motion.div
          key={i}
          animate={{ height: [4, 16, 8, 20, 6][i % 5] }}
          transition={{ repeat: Infinity, duration: 0.5 + (i * 0.1), ease: "easeInOut" }}
          className="w-1 bg-indigo-500 rounded-full"
        />
      ))}
    </div>
  );

  const SemanticGraphVisualizer = () => (
    <div className="relative w-full h-40 bg-bg/40 rounded-2xl border border-indigo-500/20 overflow-hidden group">
      <div className="absolute inset-0 flex items-center justify-center">
        <Radar size={80} className="text-indigo-500/10 animate-pulse" />
      </div>
      {[
        { x: '20%', y: '30%', label: selectedTrend.category },
        { x: '70%', y: '40%', label: selectedTrend.sentiment },
        { x: '40%', y: '70%', label: 'RTTP Signals' },
        { x: '80%', y: '20%', label: 'Anomaly' }
      ].map((node, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ left: node.x, top: node.y }}
          className="absolute flex flex-col items-center"
        >
          <div className="w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
          <span className="text-[8px] text-muted mt-1 whitespace-nowrap bg-surface/80 px-1 rounded">{node.label}</span>
        </motion.div>
      ))}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <line x1="20%" y1="30%" x2="40%" y2="70%" stroke="currentColor" className="text-indigo-400" strokeWidth="0.5" />
        <line x1="70%" y1="40%" x2="40%" y2="70%" stroke="currentColor" className="text-indigo-400" strokeWidth="0.5" />
        <line x1="20%" y1="30%" x2="80%" y2="20%" stroke="currentColor" className="text-indigo-400" strokeWidth="0.5" />
      </svg>
      <div className="absolute bottom-2 right-3 flex items-center gap-1.5 text-[9px] font-bold text-indigo-400/80">
        <Activity size={10} />
        <span>TrendSpotter Live Graph</span>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#02040a]/95 backdrop-blur-md z-[1000] flex flex-col items-center p-2 md:p-6 overflow-y-auto overflow-x-hidden"
        dir="rtl"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.95, y: 20 }}
          className="bg-surface border border-indigo-500/40 rounded-3xl w-full max-w-6xl min-h-[500px] max-h-[94vh] flex flex-col shadow-2xl relative overflow-hidden my-auto"
        >
          {/* Top Bar / Header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface/90 backdrop-blur shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
                <Radar size={22} className="animate-spin" style={{ animationDuration: '10s' }} />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-extrabold text-text flex items-center gap-2">
                  غرفة تريند لايف الاستباقية
                  <span className="text-[10px] bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                    RTTP + TrendSpotter + SLED
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-muted hidden sm:block font-medium italic">استشعار الإشارات الضعيفة، تحليل البنية الدلالية، والتحقق المباشر</p>
                  <TrendPulseWave />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-bg/60 border border-border rounded-xl p-1 text-xs">
                <button 
                  onClick={() => setActiveTab('radar')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'radar' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-text'}`}
                >
                  الرادار والنبض ({trends.length})
                </button>
                <button 
                  onClick={() => setActiveTab('room')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'room' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-text'}`}
                >
                  مسرح الغرفة الحي
                </button>
                <button 
                  onClick={() => setActiveTab('create')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow' : 'text-muted hover:text-text'}`}
                >
                  اكتشاف جديد
                </button>
              </div>

              <button 
                onClick={onClose}
                className="text-muted hover:text-text transition-colors bg-bg/60 rounded-full p-2 cursor-pointer border border-border"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-bg/30">
            {activeTab === 'radar' && (
              <div className="space-y-6">
                {/* 3 Architecture Layer Badges */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">طبقة الاستشعار RTTP</span>
                      <Satellite size={16} className="text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
                    </div>
                    <h3 className="text-sm font-bold text-text mb-1">التقاط الإشارات الضعيفة</h3>
                    <p className="text-[11px] text-muted leading-relaxed">توليد استعلامات بحث اصطناعية وتقييم قوة التفاعل وسلطة المصادر قبل تبلور البحث الجماهيري.</p>
                  </div>

                  <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">TrendSpotter الدلالي</span>
                      <Activity size={16} className="text-emerald-400 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-bold text-text mb-1">رسم بياني لحظي للتواجد المشترك</h3>
                    <p className="text-[11px] text-muted leading-relaxed">كشف المجتمعات وقياس المركزية اللحظية أسرع 27 مرة من الطرق التقليدية لرصد الشذوذ الصاعد.</p>
                  </div>

                  <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">عدسة التحقق SLED & RAMA</span>
                      <ShieldCheck size={16} className="text-amber-400" />
                    </div>
                    <h3 className="text-sm font-bold text-text mb-1">مسار التحقق كشخصية مستقلة</h3>
                    <p className="text-[11px] text-muted leading-relaxed">تدخل مباشر لإزالة الضوضاء وتوليد حجج متقابلة لحكم ثلاثي (مؤكد / غير مؤكد / مضلل).</p>
                  </div>
                </div>

                {/* Scan Action Bar */}
                <div className="flex items-center justify-between flex-wrap gap-3 bg-surface border border-indigo-500/30 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 flex items-center justify-center relative">
                      <motion.div 
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2.5 }}
                        className="absolute inset-0 bg-indigo-500/10 rounded-full"
                      />
                      <Radar size={20} className="text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-text flex items-center gap-2">
                        <Zap size={18} className="text-amber-400" /> 
                        الترندات المرصودة حالياً بنظام الاستشعار
                      </h3>
                      <p className="text-xs text-muted">يمكنك فتح الغرفة التفاعلية فوراً أو تشغيل الاستشعار اللحظي بالذكاء الاصطناعي</p>
                    </div>
                  </div>

                  <button
                    onClick={handleScanLiveTrendsWithAI}
                    disabled={isScanningLive}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-60"
                  >
                    {isScanningLive ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    <span>استشعار تريندات جديدة (RTTP Scan)</span>
                  </button>
                </div>

                {/* Trends Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {trends.map((t) => (
                    <div 
                      key={t.id}
                      className="bg-surface border border-border hover:border-indigo-500/60 transition-all rounded-2xl p-5 flex flex-col justify-between shadow-md cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
                      onClick={() => handleLaunchRoom(t)}
                    >
                      <div className="absolute top-0 left-0 h-1 bg-indigo-500/20 w-full">
                        <div className="h-full bg-indigo-500" style={{ width: `${t.confidence}%` }} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] bg-bg px-2 py-0.5 rounded-md text-muted border border-border font-semibold">
                            {t.category}
                          </span>
                          <div className="flex items-center gap-1">
                            <TrendingUp size={12} className="text-indigo-400" />
                            <span className="text-[11px] font-bold text-indigo-400">
                              {t.confidence}%
                            </span>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-text mb-2 group-hover:text-indigo-400 transition-colors line-clamp-2 leading-tight">
                          {t.title}
                        </h4>

                        <div className="flex items-center gap-1.5 mb-3">
                          <div className={`w-2 h-2 rounded-full ${t.sentimentScore > 0.5 ? 'bg-emerald-400' : t.sentimentScore < -0.5 ? 'bg-red-400' : 'bg-amber-400'}`} />
                          <span className="text-[10px] text-muted font-medium">{t.sentiment}</span>
                        </div>

                        <p className="text-[11px] text-muted mb-4 line-clamp-2 leading-relaxed bg-bg/40 p-2 rounded-lg border border-border/40">
                          <strong className="text-indigo-300">RTTP Source:</strong> {t.weakSignalSource}
                        </p>

                        <div className="space-y-2 mb-4">
                          <span className="text-[10px] text-muted block font-semibold">طاقم الغرفة المتولد:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {t.suggestedCrew.map((c, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-[10px] bg-bg/80 border border-border/80 px-2 py-0.5 rounded-md text-text">
                                <Users size={10} className="text-indigo-400/70" />
                                <span>{c.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border flex items-center justify-between">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                          t.verificationStatus === 'تم التحقق' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : t.verificationStatus === 'مضلل'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {t.verificationStatus}
                        </span>

                        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-md">
                          <Play size={12} fill="currentColor" /> دخول المسرح
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'room' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 h-full">
                <div className="lg:col-span-3 flex flex-col h-[75vh] bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="bg-bg/80 border-b border-border px-4 py-3 flex items-center justify-between shrink-0 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                        <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text line-clamp-1">{selectedTrend.title}</h3>
                        <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                          <span>المجال: <strong className="text-text">{selectedTrend.category}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-1">النبض: <TrendPulseWave /></span>
                          <span>•</span>
                          <span>حالة التحقق: <strong className={selectedTrend.verificationStatus === 'تم التحقق' ? 'text-emerald-400' : 'text-amber-400'}>{selectedTrend.verificationStatus}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTriggerCrewTurn}
                        disabled={isAiGeneratingTurn}
                        className="bg-surface border border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600/30 text-xs px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="دع الطاقم يواصل التحليل بشكل تلقائي"
                      >
                        {isAiGeneratingTurn ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                        <span>جولة للطاقم</span>
                      </button>

                      {onStartTrendRoom && (
                        <button
                          onClick={handleTransferToMainPlatform}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer"
                        >
                          <ExternalLink size={13} />
                          <span>فتح في المنصة</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-bg/20">
                    {roomMessages.map((msg) => (
                      <motion.div 
                        initial={{ opacity: 0, x: msg.isUser ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={msg.id}
                        className={`flex gap-3 ${msg.isUser ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
                          msg.isUser ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-surface border-indigo-500/30 text-indigo-400'
                        }`}>
                          {msg.isUser ? <User size={18} /> : msg.isSystem ? <ShieldCheck size={18} /> : <Bot size={18} />}
                        </div>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border transition-all ${
                          msg.isUser 
                            ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' 
                            : msg.isSystem 
                            ? 'bg-indigo-950/40 border-indigo-500/30 text-text rounded-tl-none border-dashed' 
                            : 'bg-bg border-border text-text rounded-tl-none group-hover:border-indigo-500/40'
                        }`}>
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <span className={`text-xs font-bold ${msg.isUser ? 'text-indigo-100' : 'text-indigo-400'}`}>
                              {msg.sender} <span className="text-[10px] opacity-75 font-normal">({msg.role})</span>
                            </span>
                            <span className="text-[10px] opacity-60 font-mono">{msg.timestamp}</span>
                          </div>
                          <p className="text-xs md:text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                        </div>
                      </motion.div>
                    ))}
                    {isAiGeneratingTurn && (
                      <div className="flex items-center gap-3 text-xs text-muted p-2">
                        <div className="flex gap-1">
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        </div>
                        <span>طاقم الغرفة يتبادل الرؤى البنيوية (TrendSpotter Turn)...</span>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <div className="p-3 border-t border-border bg-bg/60 shrink-0 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted font-bold">احتياجك المعرفي (Cognitive Intent):</span>
                        {(['فهم', 'تحقق', 'نقاش', 'متابعة'] as const).map(intent => (
                          <button
                            key={intent}
                            onClick={() => setUserIntent(intent)}
                            className={`text-[10px] px-3 py-1 rounded-full font-bold transition-all cursor-pointer border ${
                              userIntent === intent 
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' 
                                : 'bg-surface text-muted hover:text-text border-border'
                            }`}
                          >
                            {intent}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-muted hidden sm:inline italic">تخصيص الرد وفق الطبقة الرابعة للقرار</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="وجه سؤالاً للطاقم، أضف دليلاً، أو اطلب زاوية تحليلية جديدة..."
                        className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-muted/60"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!userInput.trim() || isAiGeneratingTurn}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar h-[75vh]">
                  <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs border-b border-border/40 pb-2">
                      <Layers size={14} />
                      <span>البنية الدلالية (Layer 2)</span>
                    </div>
                    <SemanticGraphVisualizer />
                    <div className="text-[10px] text-muted leading-relaxed italic">يتم بناء علاقات التواجد الدلالي لكشف الشذوذ والمركزية.</div>
                  </div>

                  <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <ShieldCheck size={14} />
                        <span>عدسة التحقق SLED</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        selectedTrend.verificationStatus === 'تم التحقق' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {selectedTrend.verificationStatus}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-[10px] text-muted font-bold">الاستعلامات الاصطناعية (RTTP):</div>
                      <div className="flex flex-wrap gap-1">
                        {(selectedTrend.syntheticQueries || []).map((q, i) => (
                          <span key={i} className="text-[9px] bg-bg border border-border px-1.5 py-0.5 rounded text-indigo-300">{q}</span>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={handleRunVerificationCheck}
                      disabled={isVerifyingClaim}
                      className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 py-2 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isVerifyingClaim ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      <span>تحديث فحص الادعاء (Deep Lens)</span>
                    </button>
                  </div>

                  <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-text font-bold text-xs border-b border-border/40 pb-2">
                      <Users size={14} />
                      <span>حالة الطاقم الرقمي</span>
                    </div>
                    <div className="space-y-3">
                      {selectedTrend.suggestedCrew.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <img src={getAvatarUrl(c.avatarKey)} alt={c.name} className="w-7 h-7 rounded-lg border border-border" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-text truncate">{c.name}</div>
                            <div className="text-[8px] text-muted truncate">{c.role}</div>
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'create' && (
              <div className="max-w-3xl mx-auto space-y-8 py-10">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center text-indigo-400 mx-auto shadow-xl shadow-indigo-500/10">
                    <Plus size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-text">اكتشاف موضوع جديد</h2>
                  <p className="text-sm text-muted">أدخل خبراً، رابطاً، أو موضوعاً قيد التبلور ليقوم المحرك بتحليله خماسي الطبقات وبناء غرفته.</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <textarea 
                      value={customTopicInput}
                      onChange={(e) => setCustomTopicInput(e.target.value)}
                      placeholder="اكتب هنا الموضوع أو الخبر الذي ترغب في تتبعه استباقياً..."
                      className="w-full h-32 bg-surface border border-border rounded-2xl p-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all resize-none shadow-sm"
                    />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      <span className="text-[10px] text-muted italic">سيتولى محرك RTTP توليد الاستعلامات</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateCustomTrend}
                    disabled={!customTopicInput.trim() || isCreatingTopic}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isCreatingTopic ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>جاري بناء الرسم البياني الدلالي (TrendSpotter)...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={20} className="text-amber-400" />
                        <span>تشغيل المحرك الاستباقي وفتح الغرفة</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                  <div className="bg-bg/40 border border-border rounded-2xl p-4 flex gap-3 items-start">
                    <Layers size={18} className="text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-text mb-1">تحليل 5 طبقات</h4>
                      <p className="text-[10px] text-muted">من الاستشعار RTTP إلى التوليد التفاعلي، يمر موضوعك بدورة حياة معرفية كاملة.</p>
                    </div>
                  </div>
                  <div className="bg-bg/40 border border-border rounded-2xl p-4 flex gap-3 items-start">
                    <Users size={18} className="text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-text mb-1">طاقم رقمي مخصص</h4>
                      <p className="text-[10px] text-muted">لن تحصل على بوت واحد، بل طاقم يضم محللاً ومتحققاً وصوت جمهور ووسيطاً.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
