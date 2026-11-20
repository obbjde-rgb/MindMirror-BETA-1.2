import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, Sparkles } from 'lucide-react';
import { generateRandomAITheme, applyAITheme } from '../utils/aiThemeGenerator';

const fadeInVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export const SectionTitle = ({ title, tag }: { title: string, tag: string }) => (
  <div className="flex items-center gap-3.5 mb-8">
    <h2 className="text-[22px] font-bold text-text">{title}</h2>
    <span className="font-mono text-[11px] text-accent bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.2)] px-2.5 py-1 rounded tracking-[0.08em]">
      {tag}
    </span>
    <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent"></div>
  </div>
);

export const LandingSections: React.FC = () => {
  const [activeThemeToast, setActiveThemeToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleMindMirrorClick = () => {
    const newPalette = generateRandomAITheme();
    applyAITheme(newPalette);
    setActiveThemeToast(newPalette.name);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setActiveThemeToast(null), 3500);
  };

  return (
    <>
      {/* HEADER */}
      <motion.header 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}
        className="text-center mb-20 flex flex-col items-center justify-center min-h-[40vh] relative"
      >
        {activeThemeToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[2000] bg-surface/95 border border-accent text-accent px-4 py-2 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
            <Sparkles size={14} className="animate-spin" />
            <span>تم تغيير الألوان بالذكاء الاصطناعي: <strong>{activeThemeToast}</strong></span>
          </div>
        )}

        <button
          type="button"
          onClick={handleMindMirrorClick}
          className="inline-flex items-center gap-2.5 bg-accent/10 border border-accent/30 rounded-full px-5 py-2 text-[13px] text-accent tracking-[0.1em] font-mono mb-6 before:content-['◈'] before:animate-pulse cursor-pointer hover:bg-accent/25 hover:border-accent hover:scale-105 active:scale-95 transition-all shadow-md select-none group"
          title="اضغط هنا لتغيير ألوان المنصة بالكامل بالذكاء الاصطناعي! 🎨"
        >
          <span>MINDMIRROR — AI PERSONA ENGINE</span>
          <Sparkles size={14} className="text-amber-400 group-hover:rotate-12 transition-transform" />
        </button>
        <div className="flex flex-col items-center justify-center gap-6">
          <h1 className="text-[clamp(42px,6vw,80px)] font-black leading-[1.1] text-gradient mb-0">
            محاكاة عقل أي شخص
          </h1>
          <button 
            onClick={() => {
              const element = document.getElementById('chat-section');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="px-8 py-3 rounded-full text-base font-bold bg-accent/10 border border-accent/50 text-accent hover:bg-accent/20 transition-all flex items-center gap-2"
          >
            <ArrowDown size={20}/> ابدأ المحادثة
          </button>
        </div>
        <p className="text-lg md:text-xl text-muted max-w-[700px] mx-auto leading-[1.8] mt-6">
          تطبيق يبني نموذجاً ذكياً لأسلوب تفكير أي شخص من البيانات المتاحة،
          ويتيح التفاعل معه كأنك تتحدث إليه فعلاً.
        </p>
      </motion.header>

      {/* STATS */}
      <motion.div 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}
        className="flex justify-center gap-6 flex-wrap mb-12"
      >
        <div className="text-center bg-surface px-6 py-4 rounded-xl border border-border">
          <span className="text-3xl font-black font-mono text-accent block">7</span>
          <span className="text-[11px] text-muted mt-1 uppercase tracking-wider">طبقات معالجة</span>
        </div>
        <div className="text-center bg-surface px-6 py-4 rounded-xl border border-border">
          <span className="text-3xl font-black font-mono text-accent block">∞</span>
          <span className="text-[11px] text-muted mt-1 uppercase tracking-wider">شخصية للمحاكاة</span>
        </div>
        <div className="text-center bg-surface px-6 py-4 rounded-xl border border-border">
          <span className="text-3xl font-black font-mono text-accent block">RAG</span>
          <span className="text-[11px] text-muted mt-1 uppercase tracking-wider">التقنية</span>
        </div>
        <div className="text-center bg-surface px-6 py-4 rounded-xl border border-border">
          <span className="text-3xl font-black font-mono text-accent block">100%</span>
          <span className="text-[11px] text-muted mt-1 uppercase tracking-wider">التوسّع</span>
        </div>
      </motion.div>

      {/* FLOW PIPELINE */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}>
        <SectionTitle title="مسار المعالجة الكامل" tag="PIPELINE" />
      </motion.div>

      <motion.div 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}
        className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-12"
      >
        {[
            { tag: "INPUT", icon: "🔍", title: "التعرف", desc: "اسم الشخص → البحث" },
            { tag: "RAG", icon: "📚", title: "جمع البيانات", desc: "مقالات، كتب، فيديوهات" },
            { tag: "NLP", icon: "🧬", title: "استخراج الأنماط", desc: "البصمة، القيم، المنطق" },
            { tag: "LLM", icon: "🧠", title: "بناء الشخصية", desc: "System Prompt + Vector" },
            { tag: "LIVE", icon: "💬", title: "المحادثة الحية", desc: "تفاعل بأسلوب الشخص" },
        ].map((item, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 relative flex flex-col items-center text-center">
                <span className="absolute top-2 font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface2 text-muted">{item.tag}</span>
                <span className="text-2xl mt-4 mb-2">{item.icon}</span>
                <h3 className="text-[13px] font-bold mb-1 text-text">{item.title}</h3>
                <p className="text-[10px] text-muted leading-tight">{item.desc}</p>
            </div>
        ))}
      </motion.div>

      {/* LAYERS */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}>
        <SectionTitle title="طبقات النظام" tag="ARCHITECTURE LAYERS" />
      </motion.div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-12">
        {[
            { barColor: "var(--color-accent)", icon: "🔎", title: "طبقة الاستيعاب", subtitle: "Data Ingestion", items: ["خادم بحث يجمع بيانات الشخص", "Web Scraper لكتب، مقالات", "Crawler للشبكات الاجتماعية", "Document Parser لملفات PDF", "YouTube Transcriber للفيديوهات"] },
            { barColor: "var(--color-accent2)", icon: "🧬", title: "طبقة تحليل الشخصية", subtitle: "Persona Analysis", items: ["استخراج البصمة اللغوية", "تحديد منظومة القيم والمبادئ", "رسم خارطة طريقة التفكير", "تتبع تطور الأفكار (Timeline)", "تحليل المواقف والآراء"] },
            { barColor: "var(--color-accent3)", icon: "🗄️", title: "طبقة المعرفة", subtitle: "Knowledge & Memory", items: ["Vector Database مخصص", "Hierarchical Memory", "Semantic Chunking ذكي", "Episodic Memory للمسار", "Contradiction Detection"] },
            { barColor: "var(--color-accent4)", icon: "🤖", title: "طبقة النموذج اللغوي", subtitle: "LLM Orchestration", items: ["Dynamic System Prompt", "RAG Pipeline: استرجاع + توليد", "Multi-Model Strategy", "Style Consistency Checker", "Confidence Score للرد"] },
            { barColor: "#ef4444", icon: "⚖️", title: "طبقة الأخلاقيات", subtitle: "Ethics & Safety", items: ["تمييز الشخصيات العامة", "Disclaimer تلقائي", "Content Filter للردود", "Opt-out System", "Bias Detection"] },
            { barColor: "#ec4899", icon: "🎨", title: "طبقة الواجهة", subtitle: "UX Layer", items: ["Persona Card مع ملخص", "Chat Interface للأصالة", "Source Viewer للمصدر", "Voice Mode (TTS)", "Debate Mode تفاعلي"] },
        ].map((layer, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants} 
                className="bg-surface border border-border rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:border-border-accent hover:shadow-lg">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: layer.barColor }} />
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-surface2">{layer.icon}</div>
                    <div>
                        <h3 className="text-[14px] font-bold">{layer.title}</h3>
                        <span className="text-[10px] text-muted font-mono">{layer.subtitle}</span>
                    </div>
                </div>
                <ul className="list-none space-y-1.5">
                    {layer.items.map((item, idx) => (
                        <li key={idx} className="text-[11px] text-[#94a3b8] flex items-start gap-2 leading-[1.4] before:content-['—'] before:text-muted before:shrink-0">{item}</li>
                    ))}
                </ul>
            </motion.div>
        ))}
      </div>

      {/* DATA SOURCES */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}>
        <SectionTitle title="مصادر البيانات المدعومة" tag="DATA SOURCES" />
      </motion.div>

      <motion.div 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}
        className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 mb-20"
      >
        {[
          { icon: '📖', name: 'الكتب', desc: 'PDF، Epub، Open Library' },
          { icon: '🐦', name: 'X / تويتر', desc: 'تغريدات ومحادثات كاملة' },
          { icon: '🎥', name: 'يوتيوب', desc: 'ترانسكريبت الفيديوهات' },
          { icon: '🎙️', name: 'بودكاست', desc: 'Whisper ASR للمقابلات' },
          { icon: '📰', name: 'المقالات', desc: 'Medium, Substack, مدونات' },
          { icon: '💼', name: 'LinkedIn', desc: 'المنشورات والمقالات المهنية' },
          { icon: '🌐', name: 'Wikipedia', desc: 'السيرة الذاتية والحقائق' },
          { icon: '📄', name: 'الأبحاث', desc: 'ArXiv, Google Scholar' },
          { icon: '🎤', name: 'الخطب', desc: 'تسجيلات المؤتمرات والندوات' },
          { icon: '📬', name: 'رسائل / رسائل مفتوحة', desc: 'رسائل معلنة ووثائق عامة' },
        ].map((source, i) => (
          <div key={i} className="bg-surface border border-border rounded-[14px] p-5 text-center transition-all duration-300 hover:border-[rgba(0,212,255,0.3)] hover:shadow-[0_0_20px_rgba(0,212,255,0.15)] hover:scale-[1.03] cursor-default">
            <span className="text-[28px] mb-2.5 block">{source.icon}</span>
            <div className="text-[14px] font-bold mb-1">{source.name}</div>
            <div className="text-[11px] text-muted leading-[1.4]">{source.desc}</div>
          </div>
        ))}
      </motion.div>
      {/* TECH STACK */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}>
        <SectionTitle title="المكدس التقني المقترح" tag="TECH STACK" />
      </motion.div>

      <motion.div 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20"
      >
        <div>
          <h3 className="text-[14px] font-bold text-muted uppercase tracking-[0.1em] mb-4 font-mono">// الواجهة</h3>
          <div>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">⚛️ Next.js 15</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🎨 TailwindCSS</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">✨ Framer Motion</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🔌 Socket.io</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">📊 Recharts</span>
          </div>
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-muted uppercase tracking-[0.1em] mb-4 font-mono">// الخلفية والذكاء</h3>
          <div>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🐍 FastAPI</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🦜 LangChain</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🧠 Claude API</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🌲 Pinecone</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🔊 Whisper</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">📦 Celery</span>
          </div>
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-muted uppercase tracking-[0.1em] mb-4 font-mono">// البنية التحتية</h3>
          <div>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🐳 Docker</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">☁️ AWS / GCP</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🗄️ PostgreSQL</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">⚡ Redis</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">📈 Prometheus</span>
            <span className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3.5 py-2 m-1 text-[13px] font-mono transition-all duration-200 hover:border-accent hover:text-accent">🔒 Auth0</span>
          </div>
        </div>
      </motion.div>

      {/* ROADMAP */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}>
        <SectionTitle title="خارطة طريق التطوير" tag="ROADMAP" />
      </motion.div>

      <motion.div 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}
        className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5 mb-20"
      >
        <div className="bg-surface border border-border rounded-2xl p-7 relative">
          <div className="font-mono text-5xl font-bold text-text/5 absolute top-5 left-5 leading-none">1</div>
          <span className="font-mono text-[10px] px-2.5 py-1 rounded bg-accent4/10 border border-accent4/30 text-accent4 mb-4 inline-block tracking-[0.08em]">الآن — MVP</span>
          <h3 className="text-[17px] font-bold mb-3.5 relative">النواة الأساسية</h3>
          <ul className="list-none">
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">بحث + جمع بيانات تلقائي</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">بناء System Prompt من البيانات</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">RAG أساسي + محادثة</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">10 شخصيات جاهزة مسبقاً</li>
          </ul>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-7 relative">
          <div className="font-mono text-5xl font-bold text-text/5 absolute top-5 left-5 leading-none">2</div>
          <span className="font-mono text-[10px] px-2.5 py-1 rounded bg-accent3/10 border border-accent3/30 text-accent3 mb-4 inline-block tracking-[0.08em]">الشهر 3-4</span>
          <h3 className="text-[17px] font-bold mb-3.5 relative">التعمق والدقة</h3>
          <ul className="list-none">
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">Fine-tuning لأبرز الشخصيات</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">نظام درجة الأصالة</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">Voice Mode (TTS)</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">Debate Mode بين شخصيتين</li>
          </ul>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-7 relative">
          <div className="font-mono text-5xl font-bold text-text/5 absolute top-5 left-5 leading-none">3</div>
          <span className="font-mono text-[10px] px-2.5 py-1 rounded bg-accent3/10 border border-accent3/30 text-accent3 mb-4 inline-block tracking-[0.08em]">الشهر 5-6</span>
          <h3 className="text-[17px] font-bold mb-3.5 relative">التوسع والمجتمع</h3>
          <ul className="list-none">
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">API للمطورين</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">إضافة شخصيات مخصصة</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">Timeline: أفكار الشخص عبر العمر</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">تكامل مع Notion وObsidian</li>
          </ul>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-7 relative">
          <div className="font-mono text-5xl font-bold text-text/5 absolute top-5 left-5 leading-none">4</div>
          <span className="font-mono text-[10px] px-2.5 py-1 rounded bg-accent2/10 border border-accent2/30 text-accent2 mb-4 inline-block tracking-[0.08em]">الرؤية المستقبلية</span>
          <h3 className="text-[17px] font-bold mb-3.5 relative">الحدود القادمة</h3>
          <ul className="list-none">
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">محاكاة مجموعة أفكار (مدرسة فكرية)</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">تتبع تطور فكرة عبر شخصيات مختلفة</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">Avatar 3D تفاعلي</li>
            <li className="text-[13px] text-muted py-1.5 flex gap-2 items-start before:content-['·'] before:text-accent before:shrink-0">تعليم: "تعلم من عقل داروين"</li>
          </ul>
        </div>
      </motion.div>

      {/* RISKS */}
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}>
        <SectionTitle title="التحديات والحلول" tag="RISKS & MITIGATIONS" />
      </motion.div>

      <motion.div 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInVariants}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-20"
      >
        <div className="bg-surface border border-border rounded-xl p-5 flex gap-3.5">
          <span className="text-2xl shrink-0 mt-0.5">⚖️</span>
          <div>
            <h4 className="text-[14px] font-bold mb-1.5">التحدي الأخلاقي والقانوني</h4>
            <p className="text-[12px] text-muted leading-[1.6]">الحل: التركيز على الشخصيات التاريخية والعامة فقط، مع disclaimer واضح، ونظام Opt-out للأشخاص الأحياء.</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 flex gap-3.5">
          <span className="text-2xl shrink-0 mt-0.5">🎭</span>
          <div>
            <h4 className="text-[14px] font-bold mb-1.5">الدقة في المحاكاة</h4>
            <p className="text-[12px] text-muted leading-[1.6]">الحل: Confidence Score مع كل رد، وربط كل فكرة بمصدرها الأصلي، ومنع الادعاء بأفكار لم تُثبَت.</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 flex gap-3.5">
          <span className="text-2xl shrink-0 mt-0.5">💾</span>
          <div>
            <h4 className="text-[14px] font-bold mb-1.5">ندرة البيانات لبعض الشخصيات</h4>
            <p className="text-[12px] text-muted leading-[1.6]">الحل: مؤشر "مستوى البيانات" لكل شخصية، مع تحذير واضح حين تكون البيانات محدودة.</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 flex gap-3.5">
          <span className="text-2xl shrink-0 mt-0.5">📰</span>
          <div>
            <h4 className="text-[14px] font-bold mb-1.5">معلومات قديمة أو منقوصة</h4>
            <p className="text-[12px] text-muted leading-[1.6]">الحل: Timeline Awareness يُحدد متى قال الشخص هذا الرأي، مع تمييز التطور الفكري عبر الزمن.</p>
          </div>
        </div>
      </motion.div>

      {/* FOOTER */}
      <footer className="text-center py-10 border-t border-border text-muted text-[13px]">
        <p><strong className="text-accent">MindMirror</strong> — محاكاة العقول البشرية بدقة وأمانة</p>
        <p className="mt-2 text-[11px] font-mono text-muted/50">
          Data Ingestion → Persona Analysis → Vector Store → RAG Pipeline → Style-Consistent Output
        </p>
      </footer>
    </>
  );
};
