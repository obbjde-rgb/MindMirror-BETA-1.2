import React from 'react';
import { motion } from 'motion/react';
import { 
  Bot, Globe, Brain, Layers, GraduationCap, Compass, Sparkles, Zap, ChevronDown, Check, Search, User, Scale, Image as ImageIcon, Headphones
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { PWAInstallButton } from './PWAInstallButton';

interface AgiAssistantHeaderBarProps {
  currentEngine: 'standard' | 'thinking' | 'deep_research';
  onEngineChange: (engine: 'standard' | 'thinking' | 'deep_research') => void;
  isWebSearchEnabled: boolean;
  setIsWebSearchEnabled: (val: boolean) => void;
  isDeepThinkingEnabled: boolean;
  setIsDeepThinkingEnabled: (val: boolean) => void;
  isMapsGroundingEnabled: boolean;
  setIsMapsGroundingEnabled: (val: boolean) => void;
  onOpenAgiWorkspace: () => void;
  onOpenTextDissector: () => void;
  onOpenAcademyVault: () => void;
  onOpenUserProfiles?: () => void;
  onOpenPersonaComparison?: () => void;
  onOpenGroundedImageAssistant?: () => void;
  onOpenPodLiveStudio?: () => void;
}

export const AgiAssistantHeaderBar: React.FC<AgiAssistantHeaderBarProps> = ({
  currentEngine,
  onEngineChange,
  isWebSearchEnabled,
  setIsWebSearchEnabled,
  isDeepThinkingEnabled,
  setIsDeepThinkingEnabled,
  isMapsGroundingEnabled,
  setIsMapsGroundingEnabled,
  onOpenAgiWorkspace,
  onOpenTextDissector,
  onOpenAcademyVault,
  onOpenUserProfiles,
  onOpenPersonaComparison,
  onOpenGroundedImageAssistant,
  onOpenPodLiveStudio
}) => {
  return (
    <div className="sticky top-0 z-[100] w-full bg-surface2/60 border-b border-border/70 backdrop-blur-md px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs font-sans dir-rtl select-none shadow-sm">
      {/* Left: Omnipotent Assistant Launcher & Engine Selection */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* AGI Assistant Main Workspace Launcher */}
        <Tooltip content="مساحة العمل المتكاملة" subContent="المساعد الذكي الفائق للتفكير العميق وتفكيك النصوص">
          <button
            onClick={onOpenAgiWorkspace}
            className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-accent via-accent/90 to-sky-500 text-bg font-bold shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] transition-all flex items-center gap-2 cursor-pointer border border-accent/40"
          >
            <Bot size={16} className="animate-bounce" />
            <span>المساعد الذكي الفائق (AGI Workspace)</span>
            <span className="bg-bg/20 text-bg px-2 py-0.5 rounded-full text-[10px] font-mono">
              {currentEngine === 'standard' ? 'Fast' : currentEngine === 'thinking' ? 'Deep Think' : 'Deep Research'}
            </span>
          </button>
        </Tooltip>

        {/* Engine Mode Pills */}
        <div className="hidden md:flex items-center gap-1 bg-surface border border-border/60 p-0.5 rounded-2xl">
          <Tooltip content="ذكاء سريع ومرن" subContent="الوضع القياسي السريع والذكي للمحادثات اليومية">
            <button
              onClick={() => onEngineChange('standard')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                currentEngine === 'standard' 
                  ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm' 
                  : 'text-muted hover:text-text'
              }`}
            >
              ⚡ قياسي
            </button>
          </Tooltip>

          <Tooltip content="تفكير منطقي عميق" subContent="تحليل المسائل المعقدة والبرمجة والرياضيات خطوة بخطوة">
            <button
              onClick={() => onEngineChange('thinking')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                currentEngine === 'thinking' 
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' 
                  : 'text-muted hover:text-text'
              }`}
            >
              🧠 تفكير عميق
            </button>
          </Tooltip>

          <Tooltip content="البحث العميق الشامل" subContent="التقصي والتحليل المعرفي وبناء خريطة حلول متكاملة">
            <button
              onClick={() => onEngineChange('deep_research')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                currentEngine === 'deep_research' 
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm' 
                  : 'text-muted hover:text-text'
              }`}
            >
              🔬 Deep Research
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Center: Live API Capabilities Toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tooltip content="ربط محرك البحث غوغل" subContent="مواكبة الأحداث والتحقق من الحقائق والمعلومات الحية">
          <button
            onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isWebSearchEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-surface border-border/60 text-muted hover:text-text'
            }`}
          >
            <Globe size={13} className={isWebSearchEnabled ? 'text-emerald-400 animate-spin' : ''} />
            <span>الربط بالويب</span>
            {isWebSearchEnabled && <Check size={12} className="text-emerald-400" />}
          </button>
        </Tooltip>

        <Tooltip content="نمط التحليل الذاتي المستفيض" subContent="توجيه الذكاء الاصطناعي للتفكير المتأني والمطول قبل الإجابة">
          <button
            onClick={() => setIsDeepThinkingEnabled(!isDeepThinkingEnabled)}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isDeepThinkingEnabled
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'bg-surface border-border/60 text-muted hover:text-text'
            }`}
          >
            <Brain size={13} />
            <span>التفكير العميق</span>
            {isDeepThinkingEnabled && <Check size={12} className="text-purple-300" />}
          </button>
        </Tooltip>

        <Tooltip content="ربط الجغرافيا والخرائط" subContent="الاستعلام الدقيق عن المواقع الجغرافية والمسافات والاتجاهات">
          <button
            onClick={() => setIsMapsGroundingEnabled(!isMapsGroundingEnabled)}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isMapsGroundingEnabled
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.2)]'
                : 'bg-surface border border-border/60 text-muted hover:text-text'
            }`}
          >
            <Compass size={13} />
            <span className="hidden sm:inline">ربط الخرائط</span>
          </button>
        </Tooltip>
      </div>

      {/* Right: Quick Tools Shortcuts (PWA, Text Dissector, User Profiles, Persona Comparison & Academy Vault) */}
      <div className="flex items-center gap-2">
        {/* PWA 2026 Install Quick Button */}
        <PWAInstallButton variant="header-bar" />

        {/* PodLive Digital Audio Studio 2026 */}
        {onOpenPodLiveStudio && (
          <Tooltip content="غرفة البودلايف والهندسة الصوتية" subContent="أستوديو بودكاست وهندسة صوتية رقمية متكامل للشخصيات">
            <button
              onClick={onOpenPodLiveStudio}
              className="px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 hover:text-white hover:border-cyan-400 hover:from-cyan-500/30 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Headphones size={13} className="text-cyan-400 animate-pulse" />
              <span>استوديو البودلايف 🎙️</span>
            </button>
          </Tooltip>
        )}

        {onOpenGroundedImageAssistant && (
          <Tooltip content="مساعد الصور الذكي" subContent="التنبؤ بالسياق البصري وجلب الصور الحقيقية عبر Google Grounding">
            <button
              onClick={onOpenGroundedImageAssistant}
              className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <ImageIcon size={13} className="text-amber-400" />
              <span>مساعد الصور 🖼️</span>
            </button>
          </Tooltip>
        )}

        {onOpenUserProfiles && (
          <Tooltip content="إدارة بروفايلات المستخدم" subContent="إنشاء وتعديل وحذف ملفات التخصيص والمصادر المعرفية والسجلات">
            <button
              onClick={onOpenUserProfiles}
              className="px-3 py-1 rounded-xl bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <User size={13} />
              <span>البروفايلات</span>
            </button>
          </Tooltip>
        )}

        {onOpenPersonaComparison && (
          <Tooltip content="مقارنة الشخصيات والأطياف" subContent="تحليل مقارن للأنماط اللغوية، القيم الجوهرية، ومناهج الاستدلال">
            <button
              onClick={onOpenPersonaComparison}
              className="px-3 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Scale size={13} />
              <span>مقارنة الشخصيات ⚖️</span>
            </button>
          </Tooltip>
        )}

        <Tooltip content="مفكك ومحلل النصوص والمعرفة" subContent="تحليل ذكي فوري للمقالات واستخراج المدارس والعقول دفعة واحدة">
          <button
            onClick={onOpenTextDissector}
            className="px-3 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Layers size={13} />
            <span>فكك النص والمعرفة 🔍</span>
          </button>
        </Tooltip>

        <Tooltip content="مكتبة وأرشيف المعرفة المستخلصة" subContent="سجل متكامل للدروس المنهجية، المفاهيم، والشيفرات البرمجية المولدة">
          <button
            onClick={onOpenAcademyVault}
            className="px-3 py-1 rounded-xl bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <GraduationCap size={13} />
            <span className="hidden sm:inline">أرشيف المحراب</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
