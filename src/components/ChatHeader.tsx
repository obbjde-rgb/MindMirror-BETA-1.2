import React from 'react';
import { Sparkles, Settings, Sun, Moon, Monitor, Copy, Share2, Download, Globe, Minimize2, Maximize2, Trash2, Eye, EyeOff, Search, User, Bot, Brain, Zap, Coffee, Cloud, Ghost, Heart, Star, Crown, Rocket, MessageCircle, Shield, Activity, Flame, Music, Briefcase, GraduationCap, Palette, Terminal, Microscope, Calculator, Scale, Video, Image as ImageIcon, Radar, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';
import { PersonaData } from '../types';
import { Tooltip } from './Tooltip';
import { PWAInstallButton } from './PWAInstallButton';
import { useDragScroll } from '../hooks/useDragScroll';
import { generateRandomAITheme, applyAITheme } from '../utils/aiThemeGenerator';

const ICON_MAP: Record<string, React.FC<any>> = {
  User, Bot, Sparkles, Brain, Zap, Coffee, Cloud, Moon, Sun, Ghost, Heart, Star, Crown, Rocket, Search, MessageCircle, Shield, Activity, Flame, Music, Briefcase, GraduationCap, Palette, Terminal, Globe, Microscope, Calculator
};

interface ChatHeaderProps {
  activePersona: string;
  personas: Record<string, PersonaData>;
  theme: 'light' | 'dark' | 'system' | 'calculator-gray' | 'plain-text';
  setTheme: (theme: 'light' | 'dark' | 'system' | 'calculator-gray' | 'plain-text') => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  handleCopyConversation: () => void;
  handleShareConversation: () => void;
  handleExport: () => void;
  onExportFullVideo?: () => void;
  onExportAllCachedAudio?: () => void;
  onClearAudioCache?: () => void;
  isWebSearchEnabled: boolean;
  setIsWebSearchEnabled: (enabled: boolean) => void;
  isFullScreen: boolean;
  setIsFullScreen: (fullscreen: boolean) => void;
  isZenMode: boolean;
  setIsZenMode: (zen: boolean) => void;
  onSearchClick: () => void;
  clearChat: () => void;
  usedModelName: string;
  newsRadarActive?: { enabled: boolean; mode: 'realtime' | 'archival' };
  isAcademyMode?: boolean;
  setIsAcademyMode?: (mode: boolean) => void;
  onOpenAcademyVault?: () => void;
  onOpenLiveConversation: () => void;
  onOpenUserProfiles?: () => void;
  onOpenPersonaComparison?: () => void;
  onOpenGroundedImageAssistant?: () => void;
  onOpenTrendLiveRoom?: () => void;
  onOpenDeploymentCenter?: () => void;
  onOpenPodLiveStudio?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activePersona,
  personas,
  theme,
  setTheme,
  showDebug,
  setShowDebug,
  setShowSettings,
  handleCopyConversation,
  handleShareConversation,
  handleExport,
  onExportFullVideo,
  onExportAllCachedAudio,
  onClearAudioCache,
  isWebSearchEnabled,
  setIsWebSearchEnabled,
  isFullScreen,
  setIsFullScreen,
  isZenMode,
  setIsZenMode,
  onSearchClick,
  clearChat,
  usedModelName,
  newsRadarActive,
  isAcademyMode = false,
  setIsAcademyMode,
  onOpenAcademyVault,
  onOpenLiveConversation,
  onOpenUserProfiles,
  onOpenPersonaComparison,
  onOpenGroundedImageAssistant,
  onOpenTrendLiveRoom,
  onOpenDeploymentCenter,
  onOpenPodLiveStudio
}) => {
  const headerScroll = useDragScroll();

  return (
    <div className="bg-surface/95 backdrop-blur-md border-b border-border px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-2 z-40 shrink-0 select-none">
      {/* Active Persona Branding */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface2 border border-border flex items-center justify-center text-accent shadow-xs overflow-hidden shrink-0">
          {personas[activePersona]?.icon && ICON_MAP[personas[activePersona].icon] ? (
            React.createElement(ICON_MAP[personas[activePersona].icon], { size: 18 })
          ) : (
            <img src={getAvatarUrl(activePersona)} alt={activePersona} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="text-text font-bold text-xs sm:text-sm flex items-center gap-1.5 truncate">
            <span className="truncate">{activePersona}</span>
            <Sparkles size={12} className="text-accent3 shrink-0" />
            {isAcademyMode && (
              <span className="text-[9px] bg-accent/15 text-accent border border-accent/30 px-1.5 py-0.2 rounded-full font-bold shrink-0 hidden md:inline">
                أكاديمية
              </span>
            )}
          </h3>
          <div className="text-[9px] sm:text-[10px] text-accent4 flex items-center gap-1 font-mono leading-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-accent4 animate-pulse shrink-0"></span>
            <span>متصل</span>
            {usedModelName && <span className="ms-1 text-[8px] opacity-70 border-e border-border ps-1 hidden sm:inline truncate max-w-[90px]">{usedModelName}</span>}
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-1 min-w-0 ms-auto max-w-full relative group">
        <button
          type="button"
          onClick={() => headerScroll.scrollByAmount(120)}
          className="hidden group-hover:flex sm:flex items-center justify-center w-5 h-5 rounded-full bg-surface2/90 border border-border/80 text-muted hover:text-text shrink-0 z-10 text-xs cursor-pointer shadow-xs"
          title="تمرير اليمين"
        >
          <ChevronRight size={12} />
        </button>

        <div
          ref={headerScroll.ref}
          {...headerScroll.scrollProps}
          className="flex items-center gap-1 overflow-x-auto scrollbar-custom py-1 max-w-full touch-pan-x cursor-grab active:cursor-grabbing select-none"
        >
          {/* Live Audio Conversation */}
          <Tooltip content="محادثة صوتية حية" subContent="تحدث مباشرة عبر Gemini Live">
            <button
              onClick={async () => {
                try {
                  const s = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
                  if (s) s.getTracks().forEach(t => t.stop());
                } catch (e) {}
                onOpenLiveConversation();
              }}
              className="h-7 px-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Bot size={13} className="animate-pulse" />
              <span>لايف</span>
            </button>
          </Tooltip>

          {/* PodLive Digital Audio & Podcast Studio 2026 */}
          {onOpenPodLiveStudio && (
            <Tooltip content="غرفة البودلايف والهندسة الصوتية" subContent="أستوديو بودكاست رقمي فائق للشخصيات وهندسة الصوت">
              <button
                onClick={onOpenPodLiveStudio}
                className="h-7 px-2.5 rounded-md border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 via-blue-600/20 to-indigo-600/20 text-cyan-300 hover:text-white hover:border-cyan-400 hover:from-cyan-500/30 text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.2)] hover:shadow-[0_0_18px_rgba(6,182,212,0.4)] cursor-pointer"
              >
                <Radio size={13} className="text-cyan-300 animate-pulse" />
                <span>بودلايف 🎙️</span>
              </button>
            </Tooltip>
          )}

          {/* PWA Install Button 2026 */}
          <PWAInstallButton 
            variant="header" 
            onOpenDeploymentCenter={onOpenDeploymentCenter} 
          />

          {/* User Profiles */}
          {onOpenUserProfiles && (
            <Tooltip content="البروفايلات" subContent="إدارة التخصيصات والبروفايلات">
              <button
                onClick={onOpenUserProfiles}
                className="h-7 px-2 rounded-md border border-border/70 bg-surface2/60 text-muted hover:text-accent hover:border-accent text-[11px] font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <User size={13} />
                <span className="hidden sm:inline">البروفايلات</span>
              </button>
            </Tooltip>
          )}

          {/* Persona Comparison */}
          {onOpenPersonaComparison && (
            <Tooltip content="مقارنة الشخصيات" subContent="مقارنة أنماط اللغة والاستدلال">
              <button
                onClick={onOpenPersonaComparison}
                className="h-7 px-2 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-[11px] font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Scale size={13} className="text-purple-400" />
                <span className="hidden md:inline">مقارنة</span>
              </button>
            </Tooltip>
          )}

          {/* Image Assistant */}
          {onOpenGroundedImageAssistant && (
            <Tooltip content="مساعد الصور" subContent="جلب الصور الموثوقة من غوغل">
              <button
                onClick={onOpenGroundedImageAssistant}
                className="h-7 px-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11px] font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ImageIcon size={13} className="text-amber-400" />
                <span className="hidden md:inline">الصور</span>
              </button>
            </Tooltip>
          )}

          {/* Trend Room */}
          {onOpenTrendLiveRoom && (
            <Tooltip content="تريند لايف" subContent="اكتشاف الترندات المباشرة">
              <button
                onClick={onOpenTrendLiveRoom}
                className="h-7 px-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 text-[11px] font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Radar size={13} className="text-indigo-400" />
                <span className="hidden md:inline">تريند</span>
              </button>
            </Tooltip>
          )}

          {/* Settings Direct Launcher */}
          <Tooltip content="الإعدادات العامة" subContent="تطوير وتخصيص النظام والنماذج والأصوات">
            <button 
              onClick={() => setShowSettings(true)}
              className="h-7 px-2 rounded-md border border-border/70 bg-surface2/60 text-muted hover:text-accent hover:border-accent text-[11px] font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Settings size={13} />
              <span className="hidden sm:inline">الإعدادات</span>
            </button>
          </Tooltip>

          {/* Zen Focus Mode Toggle */}
          <Tooltip content="وضع التركيز" subContent={isZenMode ? "إظهار العناصر" : "إخفاء المشتتات"}>
            <button 
              onClick={() => setIsZenMode(!isZenMode)}
              className={`h-7 px-2 rounded-md border transition-all flex items-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer ${
                isZenMode 
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
                  : 'bg-surface2/60 border-border/70 text-muted hover:text-text'
              }`}
            >
              {isZenMode ? <Eye size={13} className="text-emerald-400" /> : <EyeOff size={13} />}
              <span className="hidden sm:inline">تركيز</span>
            </button>
          </Tooltip>

          {/* Search Chat */}
          <Tooltip content="البحث في السجل" subContent="البحث بمركز السجلات">
            <button 
              onClick={onSearchClick}
              className="h-7 px-2 rounded-md border border-border/70 bg-surface2/60 text-muted hover:text-text text-[11px] font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Search size={13} />
            </button>
          </Tooltip>

          {/* Theme Quick Toggle Bar */}
          <div className="hidden lg:flex items-center bg-surface2/80 rounded-md p-0.5 border border-border/60 shrink-0 gap-0.5">
            <Tooltip content="توليد لون بالذكاء الاصطناعي" subContent="ألوان مختلطة فريدة بنقرة">
              <button 
                onClick={() => {
                  const p = generateRandomAITheme();
                  applyAITheme(p);
                }} 
                className="px-1.5 py-0.5 text-[10px] rounded transition-all cursor-pointer bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-amber-300 border border-amber-500/30 font-bold hover:scale-105 active:scale-95 flex items-center gap-1 shadow-xs"
                title="توليد لون ذكي جديد بالكامل"
              >
                <Sparkles size={11} className="text-amber-400 animate-pulse" />
                <span>لون ذكي</span>
              </button>
            </Tooltip>
            <Tooltip content="النهار" subContent="المظهر الفاتح">
              <button onClick={() => setTheme('light')} className={`p-1 rounded transition-all cursor-pointer ${theme === 'light' ? 'bg-accent text-bg shadow-xs font-bold' : 'text-muted hover:text-text'}`}><Sun size={12} /></button>
            </Tooltip>
            <Tooltip content="الليل" subContent="المظهر الداكن">
              <button onClick={() => setTheme('dark')} className={`p-1 rounded transition-all cursor-pointer ${theme === 'dark' ? 'bg-accent text-bg shadow-xs font-bold' : 'text-muted hover:text-text'}`}><Moon size={12} /></button>
            </Tooltip>
            <Tooltip content="آلة حاسبة" subContent="ثيم الآلة الحاسبة الرمادي">
              <button onClick={() => setTheme(theme === 'calculator-gray' ? 'system' : 'calculator-gray')} className={`p-1 rounded transition-all cursor-pointer ${theme === 'calculator-gray' ? 'bg-accent text-bg shadow-xs font-bold' : 'text-muted hover:text-text'}`}><Calculator size={12} /></button>
            </Tooltip>
            <Tooltip content="نص صافٍ" subContent="ثيم النص الصافي">
              <button onClick={() => setTheme(theme === 'plain-text' ? 'system' : 'plain-text')} className={`px-1.5 py-0.5 text-[10px] rounded transition-all cursor-pointer ${theme === 'plain-text' ? 'bg-black text-white font-bold' : 'text-muted hover:text-text'}`}>نص</button>
            </Tooltip>
          </div>
        </div>

        <button
          type="button"
          onClick={() => headerScroll.scrollByAmount(-120)}
          className="hidden group-hover:flex sm:flex items-center justify-center w-5 h-5 rounded-full bg-surface2/90 border border-border/80 text-muted hover:text-text shrink-0 z-10 text-xs cursor-pointer shadow-xs"
          title="تمرير اليسار"
        >
          <ChevronLeft size={12} />
        </button>

        <div className="relative shrink-0 ms-1">
          <Tooltip content="قائمة الخيارات السريعة" subContent="خيارات مشاركة وتصدير ومسح المحادثات">
            <button 
              onClick={() => {
                  const menu = document.getElementById('chat-actions-menu');
                  if (menu) menu.classList.toggle('hidden');
              }}
              className="text-muted hover:text-accent p-1.5 rounded-xl hover:bg-surface2 transition-all cursor-pointer"
            >
              <Settings size={16} />
            </button>
          </Tooltip>
          <div
            id="chat-actions-menu"
            className="fixed top-14 end-2 sm:end-10 z-[1000] w-60 max-h-[85vh] overflow-y-auto bg-surface shadow-2xl border border-border rounded-xl hidden p-2 flex flex-col gap-1 backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-2 py-1 bg-surface2 rounded-lg mb-1">
              <button onClick={() => setShowDebug(!showDebug)} className={`p-2 rounded-lg ${showDebug ? 'text-accent' : 'text-muted'}`}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg></button>
              <button onClick={() => setTheme('light')} className={`p-2 rounded-lg ${theme === 'light' ? 'text-accent bg-surface' : 'text-muted'}`}><Sun size={16} /></button>
              <button onClick={() => setTheme('dark')} className={`p-2 rounded-lg ${theme === 'dark' ? 'text-accent bg-surface' : 'text-muted'}`}><Moon size={16} /></button>
              <button onClick={() => setTheme('system')} className={`p-2 rounded-lg ${theme === 'system' ? 'text-accent bg-surface' : 'text-muted'}`}><Monitor size={16} /></button>
              <button onClick={() => setTheme('calculator-gray')} className={`p-2 rounded-lg ${theme === 'calculator-gray' ? 'text-accent bg-surface font-bold' : 'text-muted'}`} title="آلة حاسبة رمادية"><Calculator size={16} /></button>
              <button onClick={() => setTheme('plain-text')} className={`p-2 rounded-lg text-xs ${theme === 'plain-text' ? 'text-accent bg-surface font-bold' : 'text-muted'}`} title="نص صافٍ">نص</button>
            </div>
            <div className="h-px bg-border my-1"></div>
            <button onClick={() => { setShowSettings(true); document.getElementById('chat-actions-menu')?.classList.add('hidden'); }} className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface2 rounded-lg transition-colors font-bold">
              <Settings size={16} /> الإعدادات العامة للنظام
            </button>
            <div className="md:hidden h-px bg-border my-1"></div>
            <button 
              onClick={() => { setIsZenMode(!isZenMode); document.getElementById('chat-actions-menu')?.classList.add('hidden'); }}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${isZenMode ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-text hover:bg-surface2'}`}
            >
              {isZenMode ? <Eye size={16} /> : <EyeOff size={16} />} {isZenMode ? 'تعطيل وضع التركيز' : 'تفعيل وضع التركيز'}
            </button>
            {onOpenDeploymentCenter && (
              <button 
                onClick={() => { onOpenDeploymentCenter(); document.getElementById('chat-actions-menu')?.classList.add('hidden'); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-surface2 rounded-lg transition-colors font-bold"
              >
                <Download size={16} /> مركز التثبيت والنشر (PWA & Deploy)
              </button>
            )}
            <button 
              onClick={() => { onSearchClick(); document.getElementById('chat-actions-menu')?.classList.add('hidden'); }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface2 rounded-lg transition-colors"
            >
              <Search size={16} /> البحث في سجلات المحادثة
            </button>
            <button onClick={handleCopyConversation} className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface2 rounded-lg transition-colors">
              <Copy size={16} /> نسخ المحادثة
            </button>
            <button onClick={handleShareConversation} className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface2 rounded-lg transition-colors">
              <Share2 size={16} /> مشاركة
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface2 rounded-lg transition-colors">
              <Download size={16} /> تصدير نص المحادثة
            </button>

            {onExportFullVideo && (
              <button 
                onClick={() => {
                  onExportFullVideo();
                  document.getElementById('chat-actions-menu')?.classList.add('hidden');
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors font-bold"
              >
                <Video size={16} /> تصدير فيديو كامل مع الكلمات 🎬
              </button>
            )}

            {onExportAllCachedAudio && (
              <button 
                onClick={() => {
                  onExportAllCachedAudio();
                  document.getElementById('chat-actions-menu')?.classList.add('hidden');
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors font-bold"
              >
                <Download size={16} /> تنزيل أرشيف الصوتيات بالكاش (ZIP) 📦
              </button>
            )}

            {onClearAudioCache && (
              <button 
                onClick={() => {
                  onClearAudioCache();
                  document.getElementById('chat-actions-menu')?.classList.add('hidden');
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors font-bold"
                title="تصفير كاش الصوتيات ومسح المقاطع المخزنة محلياً لتحديث المخرجات"
              >
                <Trash2 size={16} /> تصفير كاش الصوتيات 🗑️
              </button>
            )}
            <div className="h-px bg-border my-1"></div>
            <button 
              onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${isWebSearchEnabled ? 'text-accent' : 'text-text hover:bg-surface2'}`}
            >
              <Globe size={16} /> {isWebSearchEnabled ? 'تعطيل البحث' : 'تفعيل البحث'}
            </button>
            <button 
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface2 rounded-lg transition-colors"
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {isFullScreen ? 'تصغير' : 'ملء الشاشة'}
            </button>
            <div className="h-px bg-border my-1"></div>
            <button 
              onClick={() => { clearChat(); document.getElementById('chat-actions-menu')?.classList.add('hidden'); }}
              disabled={activePersona === 'debate'}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} /> مسح المحادثة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
