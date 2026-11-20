import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  Download, Smartphone, Monitor, Globe, Check, Copy, ExternalLink, 
  X, Sparkles, ShieldCheck, Zap, Server, Share2, Info
} from 'lucide-react';
import { PERMANENT_PRODUCTION_APP_URL } from '../constants';
import { copyToClipboard } from '../utils/clipboard';

interface PWAInstallButtonProps {
  variant?: 'default' | 'full-banner' | 'header' | 'header-bar' | 'top-banner' | 'minimal';
  onOpenDeploymentCenter?: () => void;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'default', 
  onOpenDeploymentCenter,
  className = '' 
}) => {
  const { isInstallable, isInstalled, isIOS, isIframe, install, getDirectInstallUrl } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const directUrl = getDirectInstallUrl();

  const handleCopyLink = () => {
    copyToClipboard(directUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleButtonClick = async () => {
    // If browser supports native beforeinstallprompt and we are not in an iframe, invoke native prompt
    if (isInstallable && !isIframe) {
      const outcome = await install();
      if (!outcome) {
        setShowModal(true);
      }
    } else {
      // In iframes or when beforeinstallprompt has not fired, show the direct install modal
      setShowModal(true);
    }
  };

  // If already installed in standalone mode
  if (isInstalled) {
    if (variant === 'header' || variant === 'header-bar') {
      return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold select-none ${className}`}>
          <Check size={12} className="stroke-[3]" />
          <span className="hidden sm:inline">التطبيق مثبت</span>
        </div>
      );
    }
    return null;
  }

  // Header compact variant for ChatHeader
  if (variant === 'header') {
    return (
      <>
        <button
          type="button"
          onClick={handleButtonClick}
          className={`h-7 px-2 sm:px-2.5 rounded-md border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 via-blue-600/20 to-indigo-600/20 text-cyan-300 hover:text-white hover:border-cyan-400 hover:from-cyan-500/30 hover:to-indigo-600/30 text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.25)] hover:shadow-[0_0_18px_rgba(6,182,212,0.4)] cursor-pointer animate-pulse select-none ${className}`}
          title="تثبيت المنصة كتطبيق أصلي مستقل (PWA 2026)"
        >
          <Download size={13} className="text-cyan-300 shrink-0" />
          <span className="font-extrabold whitespace-nowrap">تثبيت المنصة</span>
          <span className="text-[9px] bg-cyan-400/20 text-cyan-300 px-1 py-0.2 rounded font-mono hidden md:inline">PWA</span>
        </button>

        {showModal && renderInstallModal()}
      </>
    );
  }

  // Header-bar variant for AgiAssistantHeaderBar
  if (variant === 'header-bar') {
    return (
      <>
        <button
          type="button"
          onClick={handleButtonClick}
          className={`px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600/25 to-cyan-500/25 border border-cyan-500/40 text-cyan-300 hover:text-white hover:border-cyan-400 hover:bg-cyan-500/30 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm select-none ${className}`}
          title="تثبيت التطبيق على جهازك برابط الإنتاج"
        >
          <Download size={13} className="text-cyan-300 animate-bounce shrink-0" />
          <span className="whitespace-nowrap">تثبيت التطبيق 📲</span>
        </button>

        {showModal && renderInstallModal()}
      </>
    );
  }

  // Top banner variant (dismissible floating banner)
  if (variant === 'top-banner') {
    if (isBannerDismissed) return null;
    return (
      <>
        <div className="w-full bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-cyan-500/30 px-3 py-2 text-xs flex items-center justify-between gap-3 shadow-md z-40 select-none">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="p-1 rounded-lg bg-cyan-500/20 text-cyan-300 shrink-0">
              <Smartphone size={15} />
            </span>
            <div className="truncate">
              <span className="font-bold text-white">تثبيت تطبيق محراب العقول 2026: </span>
              <span className="text-slate-300 hidden sm:inline">احصل على تجربة مستقلة بدون أشرطة تصفح مع دعم العمل بدون إنترنت وسرعة فائقة.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleButtonClick}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-[11px] shadow-sm transition-all cursor-pointer flex items-center gap-1"
            >
              <Download size={12} />
              <span>تثبيت الآن</span>
            </button>
            <button
              onClick={() => setIsBannerDismissed(true)}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
              title="إغلاق التنبيه"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {showModal && renderInstallModal()}
      </>
    );
  }

  // Full-banner variant (landing page card)
  if (variant === 'full-banner') {
    return (
      <>
        <div className={`w-full max-w-4xl mx-auto px-4 ${className}`}>
          <div className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-cyan-500/40 p-6 sm:p-8 shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-right">
                <div className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl shadow-xl shadow-cyan-500/20 shrink-0">
                  <Smartphone className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl sm:text-2xl font-black text-white">تثبيت المنصة كتطبيق أصلي (PWA 2026)</h3>
                    <span className="text-[10px] bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 px-2 py-0.5 rounded-full font-bold">معايير W3C الحديثة</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                    يعمل التطبيق كنافذة مستقلة Standalone بدون أي أشرطة تصفح أو شريط عنوان، مع استجابة فورية، دعم العمل دون اتصال، وحفظ كامل للسجلات محلياً.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-cyan-300/80 font-bold">
                    <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-400" /> رابط الإنتاج الدائم</span>
                    <span className="flex items-center gap-1"><Zap size={14} className="text-amber-400" /> تشغيل فوري</span>
                    <span className="flex items-center gap-1"><Globe size={14} className="text-cyan-400" /> يدعم جميع المنصات</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
                <button
                  onClick={handleButtonClick}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl font-black shadow-xl shadow-cyan-600/30 hover:shadow-cyan-600/50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Download size={18} />
                  <span>تثبيت التطبيق الآن</span>
                </button>
                {onOpenDeploymentCenter && (
                  <button
                    onClick={onOpenDeploymentCenter}
                    className="w-full sm:w-auto px-4 py-3.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <Server size={16} />
                    <span>مركز النشر</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {showModal && renderInstallModal()}
      </>
    );
  }

  // Default button variant
  return (
    <>
      <button
        onClick={handleButtonClick}
        className={`group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-xl hover:shadow-cyan-500/25 transition-all active:scale-95 cursor-pointer ${className}`}
      >
        <Download className="w-4 h-4 text-cyan-200 group-hover:scale-110 transition-transform" />
        <span>تثبيت التطبيق على جهازك 📲</span>
      </button>

      {showModal && renderInstallModal()}
    </>
  );

  function renderInstallModal() {
    return (
      <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200" dir="rtl">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl flex flex-col text-right">
          
          {/* Modal Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-lg flex items-center justify-center overflow-hidden">
                <img src="/pwa-192x192.png" alt="MindMirror" className="w-full h-full object-cover rounded-[14px]" onError={(e: any) => { e.target.style.display = 'none'; }} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  تثبيت محراب العقول (PWA 2026)
                  <span className="text-[10px] bg-cyan-400/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-400/30">
                    رابط الإنتاج
                  </span>
                </h3>
                <p className="text-xs text-slate-400">تطبيق ويب تقدمي عالي الأداء مع دعم العمل دون اتصال</p>
              </div>
            </div>
            <button 
              onClick={() => setShowModal(false)}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            
            {/* Primary Action: Direct Launch in Top Window */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  التثبيت التلقائي المباشر (موصى به)
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-mono">
                  رابط دائم
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                افتح المنصة مباشرة في نافذة مستقلة عبر رابط الإنتاج الرسمي. سيظهر لك المتصفح خيار التثبيت الفوري في شريط العنوان أو القائمة فوراً:
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <a
                  href={directUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <ExternalLink size={15} />
                  <span>فتح وتثبيت فوري برابط الإنتاج 🚀</span>
                </a>
                <button
                  onClick={handleCopyLink}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  <span>{copied ? 'تم النسخ بنجاح!' : 'نسخ الرابط'}</span>
                </button>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-cyan-300/80 break-all select-all text-left dir-ltr">
                {directUrl}
              </div>
            </div>

            {/* Platform Guides Navigation */}
            <div>
              <div className="text-xs font-bold text-slate-400 mb-2">تعليمات التثبيت حسب جهازك:</div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs font-bold">
                <button
                  onClick={() => setActiveGuideTab('android')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeGuideTab === 'android' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone size={14} />
                  <span>Android</span>
                </button>
                <button
                  onClick={() => setActiveGuideTab('ios')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeGuideTab === 'ios' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Share2 size={14} />
                  <span>iPhone / iPad</span>
                </button>
                <button
                  onClick={() => setActiveGuideTab('desktop')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeGuideTab === 'desktop' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor size={14} />
                  <span>كمبيوتر / PC</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Android Guide */}
            {activeGuideTab === 'android' && (
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-3 text-xs text-slate-300">
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">1</div>
                  <p>افتح متصفح <strong>Google Chrome</strong> أو <strong>Edge</strong> على هاتفك وافتح رابط المنصة.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">2</div>
                  <p>اضغط على قائمة الخيارات (<strong>الثلاث نقاط ⋮</strong>) أعلى يمين أو يسار المتصفح.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">3</div>
                  <p>اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong> لتثبيت الأيقونة بدقة 512×512 والشاشة المستقلة.</p>
                </div>
              </div>
            )}

            {/* Tab 2: iOS Safari Guide */}
            {activeGuideTab === 'ios' && (
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-3 text-xs text-slate-300">
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">1</div>
                  <p>افتح الرابط في متصفح <strong>Safari</strong> على جهاز iPhone أو iPad.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">2</div>
                  <p>اضغط على زر <strong>المشاركة (Share ⎋)</strong> في أسفل الشاشة.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">3</div>
                  <p>مرر للأسفل واضغط على <strong>«إضافة إلى الشاشة الرئيسية» (Add to Home Screen ⊞)</strong>.</p>
                </div>
              </div>
            )}

            {/* Tab 3: Desktop Guide */}
            {activeGuideTab === 'desktop' && (
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-3 text-xs text-slate-300">
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">1</div>
                  <p>في متصفح <strong>Chrome</strong> أو <strong>Edge</strong> على الكمبيوتر، انظر إلى شريط العنوان في الأعلى.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">2</div>
                  <p>ستجد أيقونة التثبيت (<strong>رمز الشاشة مع سهم ⊕</strong>) في الجهة المقابلة لشريط العنوان.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">3</div>
                  <p>اضغط على <strong>«تثبيت» (Install)</strong> لتشغيل المنصة في نافذة ويندوز/ماك منفصلة وفائقة السرعة.</p>
                </div>
              </div>
            )}

            {/* Advanced Deployment Center Shortcut */}
            {onOpenDeploymentCenter && (
              <button
                onClick={() => {
                  setShowModal(false);
                  onOpenDeploymentCenter();
                }}
                className="w-full p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Server size={15} className="text-cyan-400" />
                  <span className="font-bold">مركز النشر والسيرفرات (Docker & Nginx & PM2)</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">فتح ←</span>
              </button>
            )}

          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono text-[10px]">PWA 2026 STANDALONE SPECIFICATION</span>
            <button
              onClick={() => setShowModal(false)}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>

        </div>
      </div>
    );
  }
};
