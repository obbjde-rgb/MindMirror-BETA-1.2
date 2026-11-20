import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Award, BookOpen, MessageSquare, Send, Loader2, Sparkles, CheckCircle, HelpCircle, Trophy, Star, ArrowRight } from 'lucide-react';
import { LearningPathway } from '../types';
import { getGeminiClient, parseJsonSafely, withRetry } from '../utils/gemini';

interface SocraticAcademySectionProps {
  onChatWithPerson: (name: string) => void;
}

const defaultPathways: LearningPathway[] = [
  {
    id: 'path_socrates',
    title: 'مسار الفلسفة والتحليل النقدي السقراطي',
    mentor: 'سقراط الحكيم وابن رشد',
    mentorId: 'سقراط',
    icon: '🏛️',
    color: '#38bdf8',
    description: 'تعلم كيف تتساءل بأسلوب توليد الأفكار (المعاياة السقراطية)، وتفكك المسلمات الزائفة للوصول إلى الحقيقة العارية.',
    level: 'طالب علم مبتدئ',
    topics: ['توليد المفاهيم والأفكار', 'تفكيك المغالطات المنطقية', 'أخلاقيات العقل والواجب'],
    dilemma: {
      title: 'معضلة العدالة والقانون الأعمى',
      scenario: 'تخيل أن صديقاً مقرباً أودع لديك سيفاً أمانة. وبعد فترة، جاءك ينوي أخذ سيفه وهو في حالة غضب شديد للانتقام من جاره. هل رد الأمانة هنا شرف وعالم بالعدالة أم خيانة لمفهوم الخير؟',
      question: 'كيف تعرّف "العدالة" في هذه الحالة بناءً على غايات الأخلاق؟'
    }
  },
  {
    id: 'path_einstein',
    title: 'مسار الفيزياء والكون والتجارب الفكرية',
    mentor: 'ألبيرت أينشتاين ونيوتن',
    mentorId: 'ألبيرت أينشتاين',
    icon: '🌌',
    color: '#a78bfa',
    description: 'سافر عبر التجارب الفكرية التخيلية (Gedankenexperiment)، لتفهم نسبية الزمن وانحناء الزمكان وقوانين الطبيعة.',
    level: 'باحث متفوق',
    topics: ['التجارب التخيلية الذهنية', 'نسبية الزمن والسرعة', 'فلسفة الفيزياء والكون'],
    dilemma: {
      title: 'تأمل السفر على شعاع الضوء',
      scenario: 'إذا امتطيت شعاعاً ضوئياً وسرت بسرعة الضوء تماماً ممسكاً بمرآة أمام وجهك، هل سترى انعكاس وجهك في المرآة؟ ولماذا؟',
      question: 'ما الذي يعنيه هذا بالنسبة لثبات سرعة الضوء ونسبية الزمن؟'
    }
  },
  {
    id: 'path_turing',
    title: 'مسار علوم الحوسبة والذكاء الاصطناعي',
    mentor: 'ألان تورينغ وكلود شانون',
    mentorId: 'ألان تورينغ',
    icon: '💻',
    color: '#34d399',
    description: 'ابنِ تفكيرك البرمجي والسيبرنيطي العميق، واستكشف حدود الحساب، العقل، واختبار المحاكاة اللغوية.',
    level: 'فيلسوف صغير',
    topics: ['الآلة الشاملة وحسابيتها', 'اختبار المحاكاة والتفكير', 'نظرية المعلومات والإنتروبيا'],
    dilemma: {
      title: 'الغرفة الصينية واختبار الوعي',
      scenario: 'شخص داخل غرفة مغلقة يستقبل رموزاً صينية لا يفهمها، ويتبع كتاب تعليمات دقيق لترجمة الرموز وإخراجها للغرف الأخرى كإجابات صحيحة 100%. الخارجية تظن أنه يعرف الصينية بينما هو يطبق خوارزمية صماء.',
      question: 'هل تطبيق الخوارزمية مع نتائج مثالية يعتبر "فهماً حقيقياً" أم مجرد محاكاة للوظيفة؟'
    }
  },
  {
    id: 'path_jobs',
    title: 'مسار الابتكار والتصميم والتفكير الشمولي',
    mentor: 'ستيف جوبز وليوناردو دا فينشي',
    mentorId: 'ستيف جوبز',
    icon: '🎨',
    color: '#fbbf24',
    description: 'تعلم كيف تدمج الفن بالتكنولوجيا، وترى البساطة الفائقة كنهاية المطاف في التعقيد، وتغير العالم بمنتج يلهم الروح.',
    level: 'الحكيم السقراطي',
    topics: ['البساطة كفلسفة تصميم', 'التقاطع بين الفن والتكنولوجيا', 'التركيز الصارم ورؤية المنتج'],
    dilemma: {
      title: 'معضلة التركيز وحذف الميزات',
      scenario: 'فريقك يريد إضافة 20 ميزة جديدة للآلة لتلبي جميع رغبات السوق. لكنك تعلم أن البساطة هي السر وأن كثرة الميزات تقتل الروح والجمال.',
      question: 'كيف تقنع الفريق بحذف 90% من الميزات للحفاظ على نِقاوة التجربة دون التنازل عن القوة؟'
    }
  }
];

export const SocraticAcademySection: React.FC<SocraticAcademySectionProps> = ({ onChatWithPerson }) => {
  const [activePathway, setActivePathway] = useState<LearningPathway>(defaultPathways[0]);
  const [userAnswer, setUserAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number;
    feedback: string;
    badgeAwarded?: string;
    mentorReply: string;
  } | null>(null);

  // Student Mastery Rank State
  const [userScore, setUserScore] = useState(120);

  const getRankBadge = (score: number) => {
    if (score < 100) return { title: 'طالب علم مبتدئ', icon: '🥇', color: 'text-sky-400' };
    if (score < 250) return { title: 'باحث متفوق', icon: '🥈', color: 'text-emerald-400' };
    if (score < 400) return { title: 'فيلسوف صغير', icon: '🥉', color: 'text-purple-400' };
    return { title: 'الحكيم السقراطي (Master Sage)', icon: '👑', color: 'text-amber-400' };
  };

  const currentRank = getRankBadge(userScore);

  const handleEvaluateAnswer = async () => {
    if (!userAnswer.trim()) return;
    setIsEvaluating(true);
    setEvaluationResult(null);

    try {
      const ai = getGeminiClient();
      const prompt = `أنت المعلم الحكيم: "${activePathway.mentor}".
تقوم بتقييم تلميذك في "محراب التلاميذ والأكاديمية السقراطية".

التلميذ أجاب على المعضلة التالية:
عنوان المعضلة: "${activePathway.dilemma.title}"
السياق: "${activePathway.dilemma.scenario}"
السؤال: "${activePathway.dilemma.question}"

إجابة التلميذ:
"${userAnswer}"

قم بتقييم الإجابة بأسلوب سقراطي حكيم ومحفز، وأعد النتيجة كـ JSON Object مطابق بالضبط للنموذج التالي:
{
  "score": عدد_بين_50_و_100,
  "feedback": "ملاحظات نقدية وبناءة على منطق التلميذ ومدى تحليله في سطرين",
  "mentorReply": "رد المعلم الحكيم بلسانه وتقمصه في 3 أسطر",
  "badgeAwarded": "اسم وسام تقديري قصير (مثال: وسام الشك المنطقي أو وسام التخيل النسبي)"
}
عد بـ JSON Object فقط.`;

      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      }));

      const data = parseJsonSafely<{
        score?: number;
        feedback?: string;
        badgeAwarded?: string;
        mentorReply?: string;
      }>(response.text || '{}');
      if (data && typeof data.score === 'number') {
        setEvaluationResult({
          score: data.score,
          feedback: data.feedback || '',
          badgeAwarded: data.badgeAwarded,
          mentorReply: data.mentorReply || ''
        });
        setUserScore(prev => prev + (data.score || 0));
      }
    } catch (e) {
      console.error('Error evaluating answer:', e);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Academy Banner */}
      <div className="bg-gradient-to-r from-purple-500/10 via-accent/10 to-emerald-500/10 border border-border/80 rounded-2xl p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold mb-3 border border-purple-500/30">
              <GraduationCap size={14} /> محراب التلاميذ والأكاديمية السقراطية
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight mb-2">
              التعليم المنظّم والتعلم السقراطي المنهجي
            </h3>
            <p className="text-muted text-sm sm:text-base max-w-2xl leading-relaxed">
              تحوّل من مجرد الدردشة العادية إلى مسارات تعلم منهجية مقسمة ومحكومة بتحديات تفكير نقدي. تتلمذ على أيدي عقول التاريخ واستلم شارات الرقي المعرفي!
            </p>
          </div>

          {/* Student Status Badge */}
          <div className="bg-surface/90 border border-border p-4 rounded-2xl flex items-center gap-4 shrink-0 shadow-md">
            <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-2xl">
              {currentRank.icon}
            </div>
            <div>
              <div className="text-[11px] font-bold text-muted uppercase">مستواك المعرفي الحالي:</div>
              <div className={`text-base font-extrabold ${currentRank.color}`}>{currentRank.title}</div>
              <div className="text-[10px] text-muted font-mono mt-0.5">نقاط الحكمة: {userScore} XP</div>
            </div>
          </div>
        </div>

        {/* Pathway Tabs */}
        <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {defaultPathways.map((path) => (
            <button
              key={path.id}
              onClick={() => {
                setActivePathway(path);
                setEvaluationResult(null);
                setUserAnswer('');
              }}
              className={`p-4 rounded-xl border text-start transition-all flex flex-col justify-between cursor-pointer ${
                activePathway.id === path.id
                  ? 'bg-surface border-accent shadow-md scale-102'
                  : 'bg-surface2/40 border-border/60 text-muted hover:text-text'
              }`}
            >
              <div>
                <div className="text-2xl mb-2">{path.icon}</div>
                <h4 className="text-sm font-bold text-text mb-1">{path.title}</h4>
                <div className="text-xs font-semibold text-accent mb-2">المعلم: {path.mentor}</div>
              </div>
              <div className="text-[11px] text-muted flex items-center gap-1 mt-2 pt-2 border-t border-border/40">
                <BookOpen size={12} /> {path.topics.length} محاور منهجية
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Pathway Details & Socratic Dilemma Challenge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pathway Curriculum & Mentor Intro (1 col) */}
        <div className="space-y-6">
          <div className="bg-surface border border-border/80 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 pb-4 border-b border-border/60">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-2xl">
                {activePathway.icon}
              </div>
              <div>
                <h4 className="text-lg font-bold text-text">{activePathway.title}</h4>
                <p className="text-xs font-bold text-accent">المعلم الرائد: {activePathway.mentor}</p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              {activePathway.description}
            </p>

            <div>
              <h5 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">المحاور المنهجية للمسار:</h5>
              <div className="space-y-2">
                {activePathway.topics.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-surface2/60 border border-border/60 text-xs font-bold text-text flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onChatWithPerson(activePathway.mentorId)}
              className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <MessageSquare size={16} /> فتح حوار درس مباشر مع المعلم {activePathway.mentorId}
            </button>
          </div>
        </div>

        {/* Socratic Dilemma Challenge Workspace (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Trophy size={20} className="text-amber-400" />
                <h4 className="text-lg font-bold text-text">تحدي الحوار السقراطي والتفكير النقدي</h4>
              </div>
              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full">
                اختبار الأداء الذهني
              </span>
            </div>

            {/* Dilemma Box */}
            <div className="p-5 rounded-2xl bg-surface2/70 border border-border/80 space-y-3">
              <h5 className="text-base font-bold text-text flex items-center gap-2">
                <HelpCircle size={18} className="text-accent" /> {activePathway.dilemma.title}
              </h5>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {activePathway.dilemma.scenario}
              </p>
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-accent font-bold text-xs">
                السؤال المطلوب الإجابة عنه: "{activePathway.dilemma.question}"
              </div>
            </div>

            {/* User Answer Field */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted block">
                اكتب إجابتك وأطروحتك التحليلية لتقديمها للمعلم السقراطي:
              </label>
              <textarea
                rows={4}
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="اكتب تحليل المنطقي هنا بأسلوب رصين ومبرهن..."
                className="w-full bg-surface2/70 border border-border/80 rounded-xl p-4 text-xs sm:text-sm text-text focus:outline-none focus:border-accent"
              />

              <button
                onClick={handleEvaluateAnswer}
                disabled={isEvaluating || !userAnswer.trim()}
                className="bg-accent hover:bg-accent/90 text-white font-bold px-6 py-3 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isEvaluating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {isEvaluating ? 'جاري تقييم الإجابة...' : 'تسليم الإجابة للمعلم وتقييمها'}
              </button>
            </div>

            {/* Evaluation Results Card */}
            {evaluationResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl bg-gradient-to-r from-accent/10 via-purple-500/10 to-amber-500/10 border border-accent/40 space-y-4 shadow-md"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Star className="text-amber-400 fill-amber-400" size={20} />
                    <span className="text-sm font-bold text-text">تقييم المعلم السقراطي:</span>
                  </div>
                  <div className="bg-accent text-white font-mono font-bold text-sm px-3 py-1 rounded-xl">
                    النتيجة: {evaluationResult.score} / 100
                  </div>
                </div>

                {evaluationResult.badgeAwarded && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                    <Award size={14} /> تم منحك وسام: {evaluationResult.badgeAwarded}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-bold text-muted">ملاحظات التحليل المنطقي:</div>
                  <p className="text-xs text-text leading-relaxed bg-surface/80 p-3 rounded-xl border border-border/60">
                    {evaluationResult.feedback}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-accent">كلمة المعلم السقراطي ({activePathway.mentor}):</div>
                  <p className="text-xs sm:text-sm italic text-text leading-relaxed bg-accent/5 p-4 rounded-xl border-r-4 border-r-accent">
                    "{evaluationResult.mentorReply}"
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
