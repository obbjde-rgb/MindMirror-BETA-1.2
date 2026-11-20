import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Radar, Satellite, Globe, Network, ShieldCheck, Crosshair, 
  ExternalLink, Sparkles, Check, Compass, Layers, AlertCircle, 
  Search, Eye, FileSearch, ArrowRight, Share2
} from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';

export interface OsintAnalyst {
  id: string;
  name: string;
  role: string;
  icon: string;
  desc: string;
  focus: string;
  isCustom?: boolean;
}

export const DEFAULT_OSINT_ANALYSTS: OsintAnalyst[] = [
  {
    id: 'botnet_mlcd',
    name: 'محلل البوتات والسلوك المنسق (MLCD Botnet Specialist)',
    role: 'خبير كشف السلوك الزائف المنسق (CIB) والشبكات المصطنعة',
    icon: '🤖',
    desc: 'تطبيق إطار MLCD خماسي الطبقات (الحساب، الزمن، المحتوى، الشبكة، والتقنية) لكشف أسراب البوتات والتنسيق الزائف.',
    focus: 'كشف CIB، تحليل CLSN، زخارف الشبكات (Motifs)، وتوليد نصوص LLM المشبوهة'
  },
  {
    id: 'crypto_finint',
    name: 'محلل البلوكتشين والتمويل الرقمي (Crypto FININT)',
    role: 'خبير تعقب المحافظ وسلاسل الكتل والجهات الممولة',
    icon: '⛓️',
    desc: 'تتبع مسار التبرعات المشفرة، تحليل On-Chain، كشف الجسور والمبادلات DEXs ونقاط الصرف، وربط المحافظ بالهويات والكيانات.',
    focus: 'تحليل البلوكتشين (Etherscan/TronScan/Arkham)، كشف الجهات الممولة، وخرائط التدفق المالي'
  },
  {
    id: 'geoint_satellite',
    name: 'محلل الاستطلاع الفضائي (GEOINT)',
    role: 'خبير الأقمار الاصطناعية والجغرافيا المفتوحة',
    icon: '🛰️',
    desc: 'تقاطع الصور الفضائية (Sentinel, Landsat)، رصد التضاريس، المعالم وتغيرات الغطاء والحرائق والفيضانات (NASA Worldview).',
    focus: 'التحليل الجغرافي والفضائي والمكاني وتغيرات المعالم والبيانات المفتوحة'
  },
  {
    id: 'link_network',
    name: 'محلل الروابط والشبكات (Link OSINT)',
    role: 'متخصص البصمات الرقمية والمواقع الشبيهة',
    icon: '🔗',
    desc: 'تتبع النطاقات، أرشيف الويب (Wayback Machine)، شبكات الروابط العكسية، وبصمات المواقع الشبيهة والبيانات الوصفية.',
    focus: 'تتبع الروابط، تاريخ الأرشفة، مقارنة النطاقات والبصمات الرقمية'
  },
  {
    id: 'evidence_auditor',
    name: 'مدقق الأدلة والتحقق التبادلي (Fact Auditor)',
    role: 'محقق التضليل والتسلسل الزمني',
    icon: '⚖️',
    desc: 'مقاطعة الروايات المتعددة، تفكيك التناقضات، قياس اتساق التواريخ، وعزل التلاعب والتضليل الرقمي.',
    focus: 'التدقيق الصارم، كشف التناقضات، وفحص مصداقية المصادر المتاحة'
  },
  {
    id: 'context_synthesizer',
    name: 'محلل السياق وقواعد البيانات (Open Data)',
    role: 'منسق التقارير المفتوحة والملاحة والكيانات',
    icon: '📊',
    desc: 'ربط المعطيات بالسجلات المفتوحة، حركة الملاحة (Marine/Flight)، تقارير المنظمات الدولية، واستخراج الخلاصة الاستخباراتية.',
    focus: 'ربط السجلات العامة، الملاحة المفتوحة، وتجميع الصورة الكلية'
  }
];

export interface OpenSourceTool {
  name: string;
  category: 'satellite' | 'links_domains' | 'geo_mapping' | 'verification' | 'crypto_finint' | 'botnet_cib';
  url: string;
  description: string;
  badge: string;
}

export const OPEN_SOURCE_TOOLS_DIRECTORY: OpenSourceTool[] = [
  {
    name: 'Botometer (OSoMe)',
    category: 'botnet_cib',
    url: 'https://botometer.osome.iu.edu',
    description: 'أداة جامعة إنديانا لحساب احتمالية سلوك البوت عبر تحليل سمات الحساب، التوقيت، ولغة التفاعل.',
    badge: 'احتمالية البوت'
  },
  {
    name: 'Hoaxy',
    category: 'botnet_cib',
    url: 'https://hoaxy.osome.iu.edu',
    description: 'رسم بياني مرئي لتتبع انتشار الادعاءات والشائعات وروابط التنسيق عبر حسابات التواصل.',
    badge: 'انتشار الشائعات'
  },
  {
    name: 'Coordination Network Toolkit',
    category: 'botnet_cib',
    url: 'https://github.com/QUT-DCRC/coordination-network-toolkit',
    description: 'حزمة كشف شبكات مشاركة الروابط المنسقة (CLSN)، وتزامن التغريدات والوسوم بدقة ميكروثانية.',
    badge: 'تحليل CLSN'
  },
  {
    name: 'Gephi & Graphika Hub',
    category: 'botnet_cib',
    url: 'https://gephi.org',
    description: 'تحليل بنية الشبكات، كشف المجتمعات (Louvain)، وقياس المركزية والزخارف الشبكية (Motifs).',
    badge: 'تصور الشبكات'
  },
  {
    name: 'Neo4j Graph Database',
    category: 'botnet_cib',
    url: 'https://neo4j.com',
    description: 'قاعدة بيانات رسوم بيانية لاستعلامات العلاقات المعقدة بين العقد (الحسابات، الهاشتاغات، والروابط).',
    badge: 'قواعد بيانات الرسوم'
  },
  {
    name: 'BotSlayer & CooRTweet',
    category: 'botnet_cib',
    url: 'https://github.com/osome-iu/botslayer',
    description: 'كشف حملات التأثير والتنسيق المصطنع في الوقت الحقيقي عبر مراقبة الشذوذ الإحصائي.',
    badge: 'رصد لحظي'
  },
  {
    name: 'Arkham Intelligence',
    category: 'crypto_finint',
    url: 'https://platform.arkhamintelligence.com',
    description: 'منصة استخبارات سلاسل الكتل لربط العناوين والمحافظ الرقمية بـ 3.1+ مليار عنوان وكيان حقيقي.',
    badge: 'استخبارات محافظ'
  },
  {
    name: 'Etherscan',
    category: 'crypto_finint',
    url: 'https://etherscan.io',
    description: 'مستكشف شبكة إيثيريوم لتتبع المعاملات، العقود الذكية، وتدفق التوكنز وتبرعات العملات المشفرة.',
    badge: 'سلسلة Ethereum'
  },
  {
    name: 'TronScan',
    category: 'crypto_finint',
    url: 'https://tronscan.org',
    description: 'مستكشف شبكة ترون الأكثر استخداماً في تحويلات وتبرعات العملة المستقرة USDT-TRC20.',
    badge: 'شبكة TRON / USDT'
  },
  {
    name: 'Blockchair',
    category: 'crypto_finint',
    url: 'https://blockchair.com',
    description: 'محرك بحث ومستكشف متعدد السلاسل لبيتكوين وشبكات كبرى مع فرز متقدم للمحافظ.',
    badge: 'متعدد الشبكات'
  },
  {
    name: 'OpenSanctions',
    category: 'crypto_finint',
    url: 'https://www.opensanctions.org',
    description: 'قاعدة بيانات دولية مفتوحة لمقاطعة عناوين المحافظ والأفراد والكيانات مع قوائم العقوبات العالمية.',
    badge: 'قوائم العقوبات'
  },
  {
    name: 'Maltego OSINT Hub',
    category: 'crypto_finint',
    url: 'https://www.maltego.com',
    description: 'بناء مخططات ورسوم بيانية تربط المحافظ الرقمية، الكيانات، النطاقات، والشبكات المالية.',
    badge: 'رسم علاقات'
  },
  {
    name: 'NASA Worldview',
    category: 'satellite',
    url: 'https://worldview.earthdata.nasa.gov',
    description: 'رصد تفاعلي شبه لحظي للأرض مع أكثر من 1200 طبقة بيانات (حرائق، فيضانات، تلوث، أعاصير).',
    badge: 'فضائي لحظي'
  },
  {
    name: 'Copernicus Browser (Sentinel Hub)',
    category: 'satellite',
    url: 'https://browser.dataspace.copernicus.eu',
    description: 'صور الأقمار الاصطناعية الأوروبية Sentinel-2 بدقة 10 أمتار ورادار Sentinel-1 المخترق للسحب.',
    badge: 'متعدد الأطياف'
  },
  {
    name: 'Google Earth Engine & Timelapse',
    category: 'satellite',
    url: 'https://earthengine.google.com/timelapse',
    description: 'أرشيف كوكبي هائل لتتبع التغيرات الجغرافية والعمرانية عبر العقود الماضية.',
    badge: 'أرشيف زمني'
  },
  {
    name: 'OpenAerialMap',
    category: 'satellite',
    url: 'https://openaerialmap.org',
    description: 'مستودع مفتوح لمشاركة والبحث في الصور الجوية المفتوحة من الطائرات المسيرة والدرونز.',
    badge: 'صور جوية'
  },
  {
    name: 'Wayback Machine (Internet Archive)',
    category: 'links_domains',
    url: 'https://web.archive.org',
    description: 'أكبر أرشيف رقمي للويب، لمقارنة الصفحات والمواقع وتتبع التغيرات التاريخية للروابط.',
    badge: 'أرشيف الويب'
  },
  {
    name: 'URLScan.io',
    category: 'links_domains',
    url: 'https://urlscan.io',
    description: 'فاحص ومحلل مجاني للروابط الرقمية، يرصد النطاقات والـ IP والمكتبات الخارجية المستخدمة.',
    badge: 'فحص النطاقات'
  },
  {
    name: 'OpenStreetMap & Overpass Turbo',
    category: 'geo_mapping',
    url: 'https://overpass-turbo.eu',
    description: 'خرائط مجتمعية تفاعلية مع استعلامات متقدمة عن المنشآت والمعالم والطرق في العالم.',
    badge: 'بيانات مكانية'
  },
  {
    name: 'SunCalc (تحليل الظلال والشمس)',
    category: 'verification',
    url: 'https://www.suncalc.org',
    description: 'حساب زاوية وارتفاع الشمس والظل في أي موقع وزمان للتحقق من تاريخ التقاط الصور وتوقيتها.',
    badge: 'تحقق زمني'
  }
];

interface OsintRoomModalProps {
  show: boolean;
  onClose: () => void;
  personas: Record<string, any>;
  isLoading: boolean;
  startOsintInvestigation: (
    selectedAnalysts: (OsintAnalyst | { id: string; name: string; role: string; icon: string; prompt: string })[],
    targetQuery: string,
    investigationMode: 'triangulation' | 'satellite_geo' | 'link_footprint' | 'financial_crypto' | 'botnet_coordination',
    depth: 'standard' | 'deep'
  ) => void;
}

export default function OsintRoomModal({
  show,
  onClose,
  personas,
  isLoading,
  startOsintInvestigation
}: OsintRoomModalProps) {
  const [selectedAnalystIds, setSelectedAnalystIds] = useState<string[]>([
    'botnet_mlcd',
    'crypto_finint',
    'geoint_satellite', 
    'link_network', 
    'evidence_auditor', 
    'context_synthesizer'
  ]);
  const [includePhilosopher, setIncludePhilosopher] = useState<string>('');
  const [targetQuery, setTargetQuery] = useState('');
  const [investigationMode, setInvestigationMode] = useState<'triangulation' | 'satellite_geo' | 'link_footprint' | 'financial_crypto' | 'botnet_coordination'>('triangulation');
  const [depth, setDepth] = useState<'standard' | 'deep'>('deep');
  const [showToolsDirectory, setShowToolsDirectory] = useState(false);
  const [showCryptoProtocol, setShowCryptoProtocol] = useState(false);
  const [showMlcdProtocol, setShowMlcdProtocol] = useState(false);
  const [activeToolCategory, setActiveToolCategory] = useState<'all' | 'botnet_cib' | 'crypto_finint' | 'satellite' | 'links_domains' | 'geo_mapping' | 'verification'>('all');

  useEffect(() => {
    if (show && !targetQuery) {
      // Default placeholder / clean state
    }
  }, [show]);

  if (!show) return null;

  const toggleAnalyst = (id: string) => {
    if (selectedAnalystIds.includes(id)) {
      if (selectedAnalystIds.length > 1) {
        setSelectedAnalystIds(selectedAnalystIds.filter(aId => aId !== id));
      }
    } else {
      setSelectedAnalystIds([...selectedAnalystIds, id]);
    }
  };

  const handleStart = () => {
    if (!targetQuery.trim() || selectedAnalystIds.length === 0) return;

    const chosen: any[] = DEFAULT_OSINT_ANALYSTS.filter(a => selectedAnalystIds.includes(a.id));
    if (includePhilosopher && personas[includePhilosopher]) {
      const p = personas[includePhilosopher];
      chosen.push({
        id: includePhilosopher,
        name: p.label || includePhilosopher,
        role: `مستشار تحليلي وفلسفي: ${p.role || 'خبير تفكير نقدي'}`,
        icon: '🧠',
        desc: p.bio || 'تقديم رؤية تحليلية معمقة قائمة على المنهج المنطقي والنقدي.',
        prompt: p.prompt
      });
    }

    startOsintInvestigation(chosen, targetQuery, investigationMode, depth);
  };

  const filteredTools = activeToolCategory === 'all' 
    ? OPEN_SOURCE_TOOLS_DIRECTORY 
    : OPEN_SOURCE_TOOLS_DIRECTORY.filter(t => t.category === activeToolCategory);

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#02040a]/95 backdrop-blur-md z-[1000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto overflow-x-hidden"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.95, y: 20 }}
          className="bg-surface border border-amber-500/30 rounded-3xl p-5 sm:p-7 w-full max-w-3xl shadow-[0_0_50px_rgba(245,158,11,0.12)] relative my-auto custom-scrollbar text-right flex flex-col max-h-[94vh]"
          dir="rtl"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 text-muted hover:text-text transition-colors bg-bg/60 rounded-full p-2 cursor-pointer border border-border"
          >
            <X size={18} />
          </button>
          
          {/* Header */}
          <div className="flex items-center gap-3.5 mb-5 mt-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Radar size={26} className="animate-spin-slow text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-2xl font-black text-text">
                  غرفة الاستخبارات الرقمية وتقاطع المصادر
                </h3>
                <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Satellite size={12} /> OSINT & GEOINT
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
                محرك تحقيقي متقدم يعتمد على تقاطع المصادر المفتوحة، رصد الأقمار الاصطناعية، تتبع الروابط والمواقع، وتدقيق الأدلة الميدانية والرقمية.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Quick Tools Accordion / Showcase */}
            <div className="bg-surface2/50 border border-border/80 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-text">
                  <Layers size={16} className="text-amber-400" />
                  <span>دليل الأقمار الاصطناعية والمصادر المفتوحة المعتمدة ({OPEN_SOURCE_TOOLS_DIRECTORY.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToolsDirectory(!showToolsDirectory)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  {showToolsDirectory ? 'إخفاء الدليل' : 'استعراض الدليل والروابط'}
                  <ArrowRight size={13} className={`transform transition-transform ${showToolsDirectory ? 'rotate-90' : '-rotate-90'}`} />
                </button>
              </div>

              {showToolsDirectory && (
                <div className="pt-2 border-t border-border/40 space-y-3">
                  {/* Category filters */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {[
                      { id: 'all', label: 'الكل' },
                      { id: 'botnet_cib', label: '🤖 البوتات والتنسيق الممنهج (CIB)' },
                      { id: 'crypto_finint', label: '⛓️ البلوكتشين والمالية' },
                      { id: 'satellite', label: '🛰️ الأقمار الاصطناعية' },
                      { id: 'links_domains', label: '🔗 الروابط والأرشفة' },
                      { id: 'geo_mapping', label: '🗺️ الخرائط المكانية' },
                      { id: 'verification', label: '⚖️ أدوات التحقق' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveToolCategory(cat.id as any)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold shrink-0 transition-all cursor-pointer ${
                          activeToolCategory === cat.id
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-surface border-border text-muted hover:text-text'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                    {filteredTools.map((tool, idx) => (
                      <a
                        key={idx}
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl border border-border/70 bg-surface/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group flex flex-col justify-between gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-text group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                            {tool.name}
                            <ExternalLink size={11} className="opacity-50 group-hover:opacity-100" />
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            {tool.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted leading-tight line-clamp-2">
                          {tool.description}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Target Query / Investigation Input */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-muted mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Crosshair size={16} className="text-amber-400" />
                  موضوع التحقيق، الرابط، أو عنوان المحفظة/الإحداثية
                </span>
                <span className="text-[10px] text-amber-400/80 font-normal">مدعوم بـ Google Grounding الحي للويب</span>
              </label>
              <textarea 
                value={targetQuery} 
                onChange={e => setTargetQuery(e.target.value)} 
                placeholder="أدخل عنوان محفظة مشفرة لتتبع مسارها المالي، أو رابطاً للتحقق من أصله وأرشيفه، أو اسم حملة/كيان لتقاطع مصادر تمويلها ووقائعها المفتوحة..." 
                className="w-full bg-bg border border-border rounded-2xl p-3.5 text-text text-xs sm:text-sm focus:border-amber-500 outline-none resize-none h-24 transition-colors shadow-inner placeholder:text-muted/40 leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (targetQuery.trim() && selectedAnalystIds.length > 0) {
                      handleStart();
                    }
                  }
                }}
              />
              <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
                <span>أمثلة: تتبع تمويل حملة مشبوهة، رصد محفظة USDT، فحص تغيرات موقع جغرافي بالأقمار</span>
                <span>Enter للبدء</span>
              </div>
            </div>

            {/* Crypto FININT 4-Stage Protocol Accordion */}
            <div className="bg-gradient-to-r from-amber-500/10 via-surface2/50 to-orange-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Network size={16} />
                  <span>منهجية تتبع المسار المالي وكشف الجهات الممولة (4-Stage Crypto FININT)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCryptoProtocol(!showCryptoProtocol)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  {showCryptoProtocol ? 'إخفاء المنهجية' : 'عرض مراحل التتبع'}
                  <ArrowRight size={13} className={`transform transition-transform ${showCryptoProtocol ? 'rotate-90' : '-rotate-90'}`} />
                </button>
              </div>

              {showCryptoProtocol && (
                <div className="pt-2 border-t border-amber-500/20 space-y-2 text-[11px] text-muted">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-amber-400 block mb-1">🔍 1. تحديد نقاط الدخول (جمع العناوين)</span>
                      <p>فحص كود المصدر لصفحات التبرع، رصد قنوات تيليجرام والمنتديات المشفرة، والبحث في سجلات النطاقات وتسريبات OSINT.</p>
                    </div>
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-amber-400 block mb-1">⛓️ 2. التحليل على السلسلة (On-Chain)</span>
                      <p>مستكشفات Etherscan و TronScan و Blockchair، وربط الكيانات عبر Arkham Intelligence وتتبع الجسور ونقاط الصرف (Cash-out).</p>
                    </div>
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-amber-400 block mb-1">🕵️ 3. الربط بالهوية الحقيقية (Attribution)</span>
                      <p>تحديد نقاط الإيداع في المنصات الخاضعة لـ KYC، استغلال أخطاء المشغلين والتسريبات الرقمية لربط المحافظ بأشخاص وكيانات.</p>
                    </div>
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-amber-400 block mb-1">🧩 4. تحليل الشبكة وقوائم العقوبات</span>
                      <p>تصور العلاقات بمخططات Maltego، رصد التمويل الصغير أو التحويلات الدائرية، ومطابقة العناوين مع OpenSanctions.</p>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] text-muted">استخدم هذا القالب لتوجيه الخلية مباشرة لفحص تدفقات التمويل:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetQuery("تتبع المسار المالي ومحافظ التبرع المشفرة للحملة المنظمة، وتحديد نقاط الاحتكاك بمنصات الصرف والجهات الممولة عبر تحليل البلوكتشين (On-Chain) وتقاطع OSINT.");
                        setInvestigationMode('financial_crypto');
                        if (!selectedAnalystIds.includes('crypto_finint')) {
                          setSelectedAnalystIds(prev => ['crypto_finint', ...prev]);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold cursor-pointer transition-all"
                    >
                      ⚡ تطبيق نموذج تتبع التمويل المشفر
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* MLCD Framework: Multi-Layer Coordination Detection Accordion */}
            <div className="bg-gradient-to-r from-red-500/10 via-surface2/50 to-amber-500/10 border border-red-500/30 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                  <Share2 size={16} />
                  <span>إطار كشف شبكات البوتات والسلوك المنسق (MLCD - 5 Layers)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMlcdProtocol(!showMlcdProtocol)}
                  className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  {showMlcdProtocol ? 'إخفاء الإطار' : 'عرض الطبقات الخمس والتقنيات'}
                  <ArrowRight size={13} className={`transform transition-transform ${showMlcdProtocol ? 'rotate-90' : '-rotate-90'}`} />
                </button>
              </div>

              {showMlcdProtocol && (
                <div className="pt-2 border-t border-red-500/20 space-y-2.5 text-[11px] text-muted">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-red-400 block mb-1">👤 1. طبقة الحساب (Account Layer)</span>
                      <p>عمر الحساب، نمط اسم المستخدم، الوصف، فحص الصور العكسي، أنماط التسجيل المتزامن، ونسبة المتابعين/المتابَعين.</p>
                    </div>
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-amber-400 block mb-1">⏱️ 2. طبقة الزمن (Temporal Layer)</span>
                      <p>تزامن النشر (نفس الدقيقة/الثانية)، نبضات النشاط الفجائية (Bursts)، فترات الصمت المشتركة، والتتابع الزمني للتفاعل.</p>
                    </div>
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-cyan-400 block mb-1">📝 3. طبقة المحتوى (Content Layer)</span>
                      <p>التشابه الدلالي (Semantic Similarity)، تكرار الروابط/الوسوم، البصمة الأسلوبية (Stylometry)، وكشف نصوص LLM المولدة.</p>
                    </div>
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-purple-400 block mb-1">🕸️ 4. طبقة الشبكة (Network Layer)</span>
                      <p>عقد (حسابات/وسوم) وحواف (إعادة نشر/إعجاب)، كشف المجتمعات، والزخارف الشبكية المتكررة (Network Motifs).</p>
                    </div>
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-emerald-400 block mb-1">💻 5. طبقة التقنية (Technical Layer)</span>
                      <p>بصمة الجهاز والمتصفح، عناوين IP، مجالات ASN، بوابات VPN/Proxy، سرعة الاستجابة وأنماط السلوك الرقمي.</p>
                    </div>
                    <div className="p-2.5 bg-surface/70 rounded-xl border border-border/70">
                      <span className="font-bold text-orange-400 block mb-1">💡 تقنيات متقدمة مدمجة</span>
                      <p>كشف مشاركة الروابط المنسقة (CLSN)، نماذج GNN، حسابات الطعم (Honeypots)، والعلامات المائية الرقمية (Watermarking).</p>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] text-muted">توجيه الخلية لتطبيق فحص MLCD الخماسي متكامل الأركان:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetQuery("كشف وتفكيك شبكة البوتات والسلوك الزائف المنسق (CIB) حول الحملة/الوسم عبر إطار MLCD خماسي الطبقات: الحساب، الزمن، المحتوى والأسلوبية، بنية الشبكة، والبصمة التقنية.");
                        setInvestigationMode('botnet_coordination');
                        if (!selectedAnalystIds.includes('botnet_mlcd')) {
                          setSelectedAnalystIds(prev => ['botnet_mlcd', ...prev]);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 text-[11px] font-bold cursor-pointer transition-all"
                    >
                      ⚡ تطبيق نموذج كشف شبكات البوتات (MLCD)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Investigation Mode & Depth */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {[
                {
                  id: 'triangulation',
                  title: '🎯 تقاطع شامل للأدلة',
                  desc: 'تجميع ومقاطعة كافة الأدلة الرقمية والروابط والتصريحات لرسم صورة مؤكدة.'
                },
                {
                  id: 'botnet_coordination',
                  title: '🤖 شبكات البوتات (MLCD)',
                  desc: 'فحص التنسيق الزائف (CIB) عبر طبقات الحساب، الزمن، المحتوى، والشبكة.'
                },
                {
                  id: 'financial_crypto',
                  title: '⛓️ مسار مالي وبلوكتشين',
                  desc: 'تتبع محافظ التبرع، تحليل On-Chain، وكشف الكيانات الممولة ونقاط الصرف.'
                },
                {
                  id: 'satellite_geo',
                  title: '🛰️ استطلاع فضائي ومكاني',
                  desc: 'التركيز على رصد الأقمار الاصطناعية (Copernicus/NASA)، المعالم، والخرائط.'
                },
                {
                  id: 'link_footprint',
                  title: '🔗 مسار الروابط والبصمات',
                  desc: 'تتبع تاريخ النطاقات، أرشيف الويب، ومقارنة المواقع الشبيهة والارتباطات.'
                }
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setInvestigationMode(mode.id as any)}
                  className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex flex-col gap-1.5 ${
                    investigationMode === mode.id
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-md shadow-amber-500/5'
                      : 'bg-surface2 border-border text-muted hover:border-muted/50 hover:text-text'
                  }`}
                >
                  <span className="text-xs font-bold">{mode.title}</span>
                  <span className="text-[10px] leading-relaxed opacity-85">{mode.desc}</span>
                </button>
              ))}
            </div>

            {/* Depth Selection */}
            <div className="flex items-center justify-between bg-surface2/40 border border-border/80 rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-text">
                <Eye size={15} className="text-amber-400" />
                <span>عمق التحقيق ومستوى التقرير:</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDepth('standard')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    depth === 'standard'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-surface border-border text-muted hover:text-text'
                  }`}
                >
                  موجز استخباراتي مركز
                </button>
                <button
                  type="button"
                  onClick={() => setDepth('deep')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    depth === 'deep'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-surface border-border text-muted hover:text-text'
                  }`}
                >
                  ملف تحقيقي معمق (Deep OSINT)
                </button>
              </div>
            </div>

            {/* Analysts Selection */}
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <label className="text-xs sm:text-sm font-bold text-muted flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-400" />
                  أعضاء خلية التحقيق والاستخبارات الرقمية ({selectedAnalystIds.length})
                </label>
                <div className="flex gap-2 text-xs">
                  <button 
                    type="button"
                    onClick={() => setSelectedAnalystIds(DEFAULT_OSINT_ANALYSTS.map(a => a.id))} 
                    className="text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    تحديد الجميع
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DEFAULT_OSINT_ANALYSTS.map(analyst => {
                  const isSelected = selectedAnalystIds.includes(analyst.id);
                  return (
                    <button
                      key={analyst.id}
                      type="button"
                      onClick={() => toggleAnalyst(analyst.id)}
                      className={`p-3 rounded-2xl border text-right transition-all duration-200 cursor-pointer relative flex items-start gap-3 ${
                        isSelected 
                          ? 'bg-amber-500/10 border-amber-500/50 text-text shadow-sm' 
                          : 'bg-surface2/60 border-border text-muted hover:border-muted/50'
                      }`}
                    >
                      <div className="text-2xl shrink-0 p-1.5 rounded-xl bg-bg/50 border border-border/50">
                        {analyst.icon}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-black text-text truncate">{analyst.name}</span>
                          {isSelected && (
                            <div className="bg-amber-500 text-bg rounded-full p-0.5 shrink-0">
                              <Check size={9} strokeWidth={4} />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-amber-400/90 font-medium block truncate mt-0.5">
                          {analyst.role}
                        </span>
                        <p className="text-[10px] text-muted leading-tight mt-1 line-clamp-2">
                          {analyst.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional: Add a platform Thinker/Philosopher to the task force */}
            <div className="bg-surface2/30 border border-border/60 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧠</span>
                <div>
                  <h5 className="text-xs font-bold text-text">إشراك مستشار تحليلي وفلسفي إضافي (اختياري)</h5>
                  <p className="text-[10px] text-muted">إضافة أحد المفكرين لتقديم نقد منهجي للمعلومات وفحص المغالطات المنطقية.</p>
                </div>
              </div>
              <select
                value={includePhilosopher}
                onChange={e => setIncludePhilosopher(e.target.value)}
                className="bg-bg border border-border rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-amber-500 w-full sm:w-48 cursor-pointer"
              >
                <option value="">بدون مستشار إضافي</option>
                {Object.keys(personas).filter(k => k !== 'debate' && k !== 'group_question' && k !== 'osint_room').map(key => (
                  <option key={key} value={key}>
                    {personas[key]?.label || key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6 border-t border-border/50 pt-5">
            <button 
              type="button"
              onClick={onClose} 
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border text-text hover:bg-surface2 transition-colors font-bold text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button 
              type="button"
              onClick={handleStart} 
              disabled={!targetQuery.trim() || selectedAnalystIds.length === 0 || isLoading} 
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-bg font-black hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <Radar size={16} />
              بدء التحقيق ومقاطعة المصادر المفتوحة
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
