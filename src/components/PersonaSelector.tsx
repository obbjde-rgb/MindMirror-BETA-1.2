import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Plus, Swords, Settings, GraduationCap, Sparkles, Users, ChevronDown, User, Bot, Brain, Zap, Coffee, Cloud, Moon, Sun, Ghost, Heart, Star, Crown, Rocket, Search, MessageCircle, Shield, Activity, Flame, Music, Briefcase, Palette, Terminal, Globe, Microscope, Calculator, Radar, BookOpen, Trash2 } from 'lucide-react';
import { PersonaData } from '../types';
import { initialPersonas } from '../constants';
import { useDragScroll } from '../hooks/useDragScroll';
import ConfirmModal from './ConfirmModal';

const ICON_MAP: Record<string, React.FC<any>> = {
  User, Bot, Sparkles, Brain, Zap, Coffee, Cloud, Moon, Sun, Ghost, Heart, Star, Crown, Rocket, Search, MessageCircle, Shield, Activity, Flame, Music, Briefcase, GraduationCap, Palette, Terminal, Globe, Microscope, Calculator, Radar
};

interface PersonaSelectorProps {
  personas: Record<string, PersonaData>;
  activePersona: string;
  setActivePersona: (name: string) => void;
  isLoading: boolean;
  deletePersona: (name: string, e: React.MouseEvent) => void;
  editPersona: (name: string, e: React.MouseEvent) => void;
  chatHistory: Record<string, any[]>;
  setChatHistory: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  isAddingPersona: boolean;
  setIsAddingPersona: (val: boolean) => void;
  newPersonaName: string;
  setNewPersonaName: (val: string) => void;
  submitNewPersona: () => void;
  setShowDebateModal: (val: boolean) => void;
  setShowGroupQuestionModal: (val: boolean) => void;
  setShowPersonaExtractorModal: (val: boolean) => void;
  setShowOsintRoomModal?: (val: boolean) => void;
  setShowTrendLiveRoomModal?: (val: boolean) => void;
  setShowChatSearchModal?: (val: boolean) => void;
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  personas,
  activePersona,
  setActivePersona,
  isLoading,
  deletePersona,
  editPersona,
  chatHistory,
  setChatHistory,
  isAddingPersona,
  setIsAddingPersona,
  newPersonaName,
  setNewPersonaName,
  submitNewPersona,
  setShowDebateModal,
  setShowGroupQuestionModal,
  setShowPersonaExtractorModal,
  setShowOsintRoomModal,
  setShowTrendLiveRoomModal,
  setShowChatSearchModal
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [roomToClear, setRoomToClear] = useState<{ key: string; label: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const chipsScroll = useDragScroll();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="flex items-center gap-2 mb-2 select-none">
      {/* قائمة التنقل الذكي - ثابتة في البداية لسهولة الوصول */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isLoading}
          className={`shrink-0 h-7.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 border flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
            isDropdownOpen 
              ? 'bg-[rgba(0,212,255,0.15)] border-accent text-accent shadow-[0_0_12px_rgba(0,212,255,0.25)]' 
              : 'bg-surface2 border-border text-muted hover:border-accent hover:text-accent'
          }`}
          title="قائمة التنقل الذكي"
        >
          <Users size={13} className={isDropdownOpen ? 'text-accent' : 'text-muted'} />
          <span>تصفح الشخصيات</span>
          <ChevronDown size={11} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute top-8 right-0 z-[1000] w-60 bg-surface rounded-xl border border-border shadow-xl py-2 max-h-72 overflow-y-auto mt-1 scrollbar-hide animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-3 py-1 text-[10px] font-bold text-accent/80 tracking-wider border-b border-border/40 pb-1.5 mb-1 flex items-center gap-1">
              <Sparkles size={11} className="text-accent" />
              تصفح الشخصيات المعرفية
            </div>
            {Object.keys(personas).filter(p => p !== 'debate' && p !== 'group_question' && p !== 'osint_room' && p !== 'trend_live').map((name) => {
              const isActive = activePersona === name;
              const isInitial = Object.keys(initialPersonas).includes(name);
              return (
                <div
                  key={name}
                  className={`w-full px-3 py-1.5 text-xs transition-colors duration-150 flex items-center justify-between hover:bg-surface2 group/item ${
                    isActive ? 'text-accent font-semibold bg-[rgba(0,212,255,0.05)]' : 'text-text hover:text-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!isLoading) {
                        setActivePersona(name);
                        setIsDropdownOpen(false);
                      }
                    }}
                    disabled={isLoading}
                    className="flex items-center gap-2 overflow-hidden flex-1 text-start cursor-pointer min-w-0"
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${isActive ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-surface2 border-border text-muted'}`}>
                      {personas[name]?.icon && ICON_MAP[personas[name].icon] ? (
                        React.createElement(ICON_MAP[personas[name].icon], { size: 11 })
                      ) : (
                        <User size={11} />
                      )}
                    </div>
                    <span className="truncate">{name}</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0 ms-1">
                    {isActive && <Check size={13} className="text-accent shrink-0" />}
                    {!isInitial && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePersona(name, e);
                        }}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all cursor-pointer opacity-70 group-hover/item:opacity-100"
                        title={`حذف شخصية ${name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border mx-0.5 shrink-0"></div>

      {/* شريط الشخصيات والأوضاع القابل للتمرير الأفقي */}
      <div
        ref={chipsScroll.ref}
        {...chipsScroll.scrollProps}
        className="flex-1 flex overflow-x-auto gap-1.5 scrollbar-custom items-center py-1 touch-pan-x cursor-grab active:cursor-grabbing select-none"
      >
        {/* Swords / وضع المناظرة */}
        <button 
          onClick={() => setShowDebateModal(true)} 
          disabled={isLoading}
          className="shrink-0 h-7.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 border bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Swords size={13} /> وضع المناظرة
        </button>

        {/* GraduationCap / سؤال جماعي */}
        <button 
          onClick={() => setShowGroupQuestionModal(true)} 
          disabled={isLoading}
          className="shrink-0 h-7.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GraduationCap size={13} /> سؤال جماعي
        </button>

        {/* Radar / غرفة الاستخبارات الرقمية OSINT */}
        {setShowOsintRoomModal && (
          <button 
            onClick={() => setShowOsintRoomModal(true)} 
            disabled={isLoading}
            className="shrink-0 h-7.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 border bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Radar size={13} className="text-amber-400" /> غرفة الاستخبارات (OSINT)
          </button>
        )}

        {/* Radar / Pulse / غرفة تريند لايف الاستباقية */}
        {setShowTrendLiveRoomModal && (
          <button 
            onClick={() => setShowTrendLiveRoomModal(true)} 
            disabled={isLoading}
            className="shrink-0 h-7.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 border bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25 flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Radar size={13} className="text-indigo-400" />
            <span className="font-bold">غرفة تريند لايف</span>
          </button>
        )}

        {/* BookOpen / مراجعة المحادثات */}
        {setShowChatSearchModal && (
          <button 
            onClick={() => setShowChatSearchModal(true)} 
            disabled={isLoading}
            className="shrink-0 px-4 py-1.5 rounded-full text-[14px] font-bold cursor-pointer transition-all duration-200 border bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BookOpen size={16} className="text-sky-400" /> مراجعة المحادثات
          </button>
        )}

        {/* Sparkles / مفكك النصوص */}
        <button 
          onClick={() => setShowPersonaExtractorModal(true)} 
          disabled={isLoading}
          className="shrink-0 px-4 py-1.5 rounded-full text-[14px] font-bold cursor-pointer transition-all duration-200 border bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={16} className="animate-pulse text-cyan-400" /> مفكك النصوص
        </button>

        {/* شخصية جديدة */}
        {isAddingPersona ? (
          <div className="flex items-center bg-surface2 border border-accent rounded-full px-2 py-1 shadow-[0_0_10px_rgba(0,212,255,0.1)] shrink-0">
            <input 
              autoFocus
              type="text"
              value={newPersonaName}
              onChange={e => setNewPersonaName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitNewPersona()}
              placeholder="اسم الشخصية..."
              className="bg-transparent text-[13px] text-text outline-none w-32 px-2 placeholder:text-muted/50"
            />
            <button onClick={submitNewPersona} disabled={isLoading} className="text-accent hover:text-white p-1 transition-colors disabled:opacity-50"><Check size={14}/></button>
            <button onClick={() => setIsAddingPersona(false)} disabled={isLoading} className="text-muted hover:text-white p-1 transition-colors disabled:opacity-50"><X size={14}/></button>
          </div>
        ) : (
          <button 
            onClick={() => setIsAddingPersona(true)} 
            disabled={isLoading}
            className="shrink-0 px-3 py-1.5 rounded-full text-[14px] font-semibold cursor-pointer transition-all duration-200 border bg-surface2 border-dashed border-muted text-muted hover:border-accent hover:text-accent flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} /> شخصية جديدة
          </button>
        )}

        {/* المناظرة النشطة */}
        {chatHistory['debate'] && chatHistory['debate'].length > 0 && (
          <div className="relative group flex items-center shrink-0">
            <button
              onClick={() => !isLoading && setActivePersona('debate')}
              disabled={isLoading}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[14px] font-semibold cursor-pointer transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed ${
                activePersona === 'debate'
                  ? 'bg-[rgba(16,185,129,0.15)] border-accent text-accent shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-surface2 border-border text-muted hover:border-[#2a3a55] hover:text-text'
              }`}
            >
              المناظرة
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRoomToClear({ key: 'debate', label: 'المناظرة' });
              }}
              className="absolute -top-2 -right-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="مسح المناظرة"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* سؤال جماعي نشط */}
        {chatHistory['group_question'] && chatHistory['group_question'].length > 0 && (
          <div className="relative group flex items-center shrink-0">
            <button
              onClick={() => !isLoading && setActivePersona('group_question')}
              disabled={isLoading}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[14px] font-semibold cursor-pointer transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed ${
                activePersona === 'group_question'
                  ? 'bg-[rgba(16,185,129,0.15)] border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-surface2 border-border text-muted hover:border-[#2a3a55] hover:text-text'
              }`}
            >
              سؤال جماعي
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRoomToClear({ key: 'group_question', label: 'سؤال جماعي' });
              }}
              className="absolute -top-2 -right-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="مسح السؤال الجماعي"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* غرفة الاستخبارات النشطة */}
        {chatHistory['osint_room'] && chatHistory['osint_room'].length > 0 && (
          <div className="relative group flex items-center shrink-0">
            <button
              onClick={() => !isLoading && setActivePersona('osint_room')}
              disabled={isLoading}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[14px] font-semibold cursor-pointer transition-all duration-200 border flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                activePersona === 'osint_room'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : 'bg-surface2 border-border text-muted hover:border-[#2a3a55] hover:text-text'
              }`}
            >
              <Radar size={14} className="text-amber-400" />
              <span>تحقيق OSINT</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRoomToClear({ key: 'osint_room', label: 'تحقيق OSINT' });
              }}
              className="absolute -top-2 -right-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="مسح جلسة الاستخبارات"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* غرفة تريند لايف النشطة */}
        {chatHistory['trend_live'] && chatHistory['trend_live'].length > 0 && (
          <div className="relative group flex items-center shrink-0">
            <button
              onClick={() => !isLoading && setActivePersona('trend_live')}
              disabled={isLoading}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[14px] font-semibold cursor-pointer transition-all duration-200 border flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                activePersona === 'trend_live'
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                  : 'bg-surface2 border-border text-muted hover:border-[#2a3a55] hover:text-text'
              }`}
            >
              <Radar size={14} className="text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>جلسة تريند لايف</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRoomToClear({ key: 'trend_live', label: 'جلسة تريند لايف' });
              }}
              className="absolute -top-2 -right-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="مسح جلسة تريند لايف"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* أسماء الشخصيات */}
        {Object.keys(personas).filter(p => p !== 'debate' && p !== 'group_question' && p !== 'osint_room' && p !== 'trend_live').map((name) => (
          <div key={name} className="relative group flex items-center shrink-0">
            <button
              onClick={() => !isLoading && setActivePersona(name)}
              disabled={isLoading}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[14px] font-semibold cursor-pointer transition-all duration-200 border flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                activePersona === name
                  ? 'bg-[rgba(0,212,255,0.15)] border-accent text-accent shadow-[0_0_15px_rgba(0,212,255,0.2)]'
                  : 'bg-surface2 border-border text-muted hover:border-[#2a3a55] hover:text-text'
              }`}
            >
              {personas[name]?.icon && ICON_MAP[personas[name].icon] && (
                React.createElement(ICON_MAP[personas[name].icon], { size: 14, className: activePersona === name ? 'text-accent' : 'text-muted' })
              )}
              {name}
            </button>
            <div className="absolute -top-2.5 -right-2.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
              <button
                onClick={(e) => editPersona(name, e)}
                className="bg-accent/10 text-accent hover:bg-accent hover:text-surface rounded-full p-1 border border-accent/20"
                title="تعديل طبع الشخصية"
              >
                <Settings size={12} />
              </button>
              {!Object.keys(initialPersonas).includes(name) && (
                <button
                  onClick={(e) => deletePersona(name, e)}
                  className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-full p-1 border border-red-500/20"
                  title="حذف الشخصية"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={!!roomToClear}
        title={`مسح ${roomToClear?.label || 'الجلسة'}`}
        message={`هل أنت متأكد من رغبتك في مسح سجل "${roomToClear?.label || 'الجلسة'}" بالكامل؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، امسح السجل"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          if (roomToClear) {
            const targetKey = roomToClear.key;
            setChatHistory(prev => {
              const newHistory = { ...prev };
              delete newHistory[targetKey];
              return newHistory;
            });
            if (activePersona === targetKey) {
              setActivePersona(Object.keys(personas).filter(p => p !== 'debate' && p !== 'group_question' && p !== 'osint_room' && p !== 'trend_live')[0] || 'ستيف جوبز');
            }
            setRoomToClear(null);
          }
        }}
        onCancel={() => setRoomToClear(null)}
      />
    </div>
  );
};
