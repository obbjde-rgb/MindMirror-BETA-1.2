import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw, Save, User, Bot, Sparkles, Brain, Zap, Coffee, Cloud, Moon, Sun, Ghost, Heart, Star, Crown, Rocket, Search, MessageCircle, Shield, Activity, Flame, Music, Briefcase, GraduationCap, Palette, Terminal, Globe, Microscope, Calculator } from 'lucide-react';
import { PersonaData } from '../types';

const ICON_OPTIONS = [
  { name: 'User', icon: User },
  { name: 'Bot', icon: Bot },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Brain', icon: Brain },
  { name: 'Zap', icon: Zap },
  { name: 'Coffee', icon: Coffee },
  { name: 'Cloud', icon: Cloud },
  { name: 'Moon', icon: Moon },
  { name: 'Sun', icon: Sun },
  { name: 'Ghost', icon: Ghost },
  { name: 'Heart', icon: Heart },
  { name: 'Star', icon: Star },
  { name: 'Crown', icon: Crown },
  { name: 'Rocket', icon: Rocket },
  { name: 'Search', icon: Search },
  { name: 'MessageCircle', icon: MessageCircle },
  { name: 'Shield', icon: Shield },
  { name: 'Activity', icon: Activity },
  { name: 'Flame', icon: Flame },
  { name: 'Music', icon: Music },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Palette', icon: Palette },
  { name: 'Terminal', icon: Terminal },
  { name: 'Globe', icon: Globe },
  { name: 'Microscope', icon: Microscope },
  { name: 'Calculator', icon: Calculator },
];

interface EditPersonaModalProps {
  isOpen: boolean;
  personaName: string;
  personaData: PersonaData | undefined;
  onClose: () => void;
  onSave: (name: string, newContext: string, newIcon?: string) => Promise<void>;
  isLoading: boolean;
}

const EditPersonaModal: React.FC<EditPersonaModalProps> = ({
  isOpen,
  personaName,
  personaData,
  onClose,
  onSave,
  isLoading
}) => {
  const [context, setContext] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen && personaData) {
      setContext('');
      setSelectedIcon(personaData.icon);
    }
  }, [isOpen, personaData]);

  if (!isOpen || !personaData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-surface border border-accent/20 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50">
            <div>
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                <span className="text-accent text-xl">⚙️</span>
                تعديل طبع {personaName}
              </h2>
              <p className="text-[11px] text-muted mt-1 font-mono uppercase tracking-wider">Persona Configuration Matrix</p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-2 text-muted hover:text-text hover:bg-surface2 rounded-full transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
            <div className="space-y-6">
              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-bold text-accent mb-3 tracking-widest uppercase">
                  أيقونة الشخصية (PERSONA SYMBOL)
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                  {ICON_OPTIONS.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = selectedIcon === item.name;
                    return (
                      <button
                        key={item.name}
                        onClick={() => setSelectedIcon(item.name)}
                        disabled={isLoading}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-center
                          ${isSelected 
                            ? 'bg-accent/20 border-accent text-accent shadow-[0_0_10px_rgba(0,212,255,0.2)]' 
                            : 'bg-surface2 border-border text-muted hover:border-accent/40 hover:text-text'
                          }`}
                        title={item.name}
                      >
                        <IconComp size={20} />
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setSelectedIcon(undefined)}
                    disabled={isLoading}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-center text-[10px] font-bold leading-none
                      ${!selectedIcon 
                        ? 'bg-accent/20 border-accent text-accent shadow-[0_0_10px_rgba(0,212,255,0.2)]' 
                        : 'bg-surface2 border-border text-muted hover:border-accent/40 hover:text-text'
                      }`}
                  >
                    افتراضي
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-accent mb-2 tracking-widest uppercase">
                  السياق الإضافي (CONTEXT OVERRIDE)
                </label>
                <p className="text-xs text-muted mb-3 leading-relaxed">
                  إذا كان الذكاء الاصطناعي يخلط بين هذه الشخصية وشخصية أخرى، يمكنك إضافة سياق وتفاصيل هنا لتوجيهه بدقة.
                </p>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="مثال: هذا ليس ابن سينا العالم القديم، بل كاتب معاصر اسمه ابن سينا يكتب الروايات الحديثة..."
                  className="w-full bg-surface2 border border-border rounded-xl p-3 text-sm text-text placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent outline-none min-h-[120px] resize-y transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-surface2/30 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-muted hover:text-text hover:bg-surface2 transition-colors border border-transparent disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={() => onSave(personaName, context, selectedIcon)}
              disabled={isLoading}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-surface transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,212,255,0.1)]"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                <>
                  <Save size={16} />
                  حفظ التغييرات
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditPersonaModal;
