import React from 'react';
import { motion } from 'motion/react';
import { X, Swords, Plus } from 'lucide-react';

interface DebateModalProps {
  show: boolean;
  onClose: () => void;
  debateConfig: { participants: string[], topic: string };
  setDebateConfig: (config: { participants: string[], topic: string }) => void;
  personas: Record<string, any>;
  startDebate: () => void;
  startLiveDebate?: () => void;
}

export default function DebateModal({
  show,
  onClose,
  debateConfig,
  setDebateConfig,
  personas,
  startDebate,
  startLiveDebate
}: DebateModalProps) {
  React.useEffect(() => {
    if (show) {
      const validParticipants = debateConfig.participants.filter(p => personas[p]);
      if (validParticipants.length < debateConfig.participants.length) {
        // If some personas were deleted, populate with existing ones so it has at least 2 participants
        const available = Object.keys(personas).filter(p => !validParticipants.includes(p));
        while (validParticipants.length < 2 && available.length > 0) {
          validParticipants.push(available.pop()!);
        }
        setDebateConfig({ ...debateConfig, participants: validParticipants });
      }
    }
  }, [show, personas, debateConfig.participants, setDebateConfig]);

  if (!show) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#02040a]/95 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 overflow-y-auto overflow-x-hidden"
      dir="rtl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-surface border border-border rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative my-auto flex flex-col"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 md:top-6 md:right-6 text-muted hover:text-text transition-colors bg-bg/50 rounded-full p-1"
        >
          <X size={20} />
        </button>
        
        <div className="flex items-center gap-3 mb-6 md:mb-8 mt-2 md:mt-0">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Swords size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-bold text-text">إعداد مناظرة جديدة</h3>
            <p className="text-xs md:text-sm text-muted mt-1">دع شخصيات متعددة تتناقش حول موضوع من اختيارك</p>
          </div>
        </div>
        
        <div className="space-y-5 md:space-y-6">
          <div>
            <label className="block text-sm font-bold text-muted mb-2">عدد المشاركين</label>
            <div className="flex gap-2 flex-wrap items-center">
              {[2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => {
                    const current = [...debateConfig.participants];
                    if (num > current.length) {
                      const available = Object.keys(personas).filter(p => !current.includes(p));
                      while (current.length < num) {
                        current.push(available.pop() || Object.keys(personas)[0]);
                      }
                    } else if (num < current.length) {
                      current.length = num;
                    }
                    setDebateConfig({ ...debateConfig, participants: current });
                  }}
                  className={`px-4 py-2 rounded-xl font-bold transition-colors ${debateConfig.participants.length === num ? 'bg-accent text-bg shadow-md shadow-accent/20' : 'bg-surface2 text-muted hover:text-text border border-border'}`}
                >
                  {num}
                </button>
              ))}
              {debateConfig.participants.length < Object.keys(personas).length && (
                <button
                  onClick={() => {
                    const current = [...debateConfig.participants];
                    const available = Object.keys(personas).filter(p => !current.includes(p));
                    if (available.length > 0) {
                      current.push(available.pop() || Object.keys(personas)[0]);
                      setDebateConfig({ ...debateConfig, participants: current });
                    }
                  }}
                  className="px-3 py-2 rounded-xl font-bold transition-colors bg-surface2 text-muted hover:text-text border border-border flex items-center justify-center"
                  title="إضافة شخصية أخرى"
                >
                  <Plus size={20} />
                </button>
              )}
              {debateConfig.participants.length > 4 && (
                <div className="px-3 py-2 rounded-xl font-bold bg-accent text-bg shadow-md shadow-accent/20 border-accent flex items-center justify-center">
                  {debateConfig.participants.length}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pe-2 custom-scrollbar">
            {debateConfig.participants.map((participant, idx) => (
              <div key={idx} className="relative">
                <label className="block text-sm font-bold text-muted mb-2">الشخصية {idx + 1}</label>
                <div className="flex items-center gap-2">
                  <select 
                    value={participant} 
                    onChange={e => {
                      const newParticipants = [...debateConfig.participants];
                      newParticipants[idx] = e.target.value;
                      setDebateConfig({...debateConfig, participants: newParticipants});
                    }} 
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:border-accent outline-none transition-colors"
                  >
                    {Object.entries(personas).map(([key, p]) => <option key={key} value={key}>{p.label || key}</option>)}
                  </select>
                  {debateConfig.participants.length > 2 && (
                    <button
                      onClick={() => {
                        const current = [...debateConfig.participants];
                        current.splice(idx, 1);
                        setDebateConfig({ ...debateConfig, participants: current });
                      }}
                      className="p-3 bg-surface2 border border-border rounded-xl text-red-400 hover:bg-red-400/10 hover:border-red-400/30 transition-colors"
                      title="حذف هذه الشخصية"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div>
            <label className="block text-sm font-bold text-muted mb-2">موضوع المناظرة</label>
            <textarea 
              value={debateConfig.topic} 
              onChange={e => setDebateConfig({...debateConfig, topic: e.target.value})} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (debateConfig.topic.trim() && new Set(debateConfig.participants).size === debateConfig.participants.length) {
                    startDebate();
                  }
                }
              }}
              placeholder="مثال: هل التكنولوجيا تدمر إنسانيتنا؟" 
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:border-accent outline-none resize-none h-24 transition-colors shadow-inner"
            />
            <p className="text-[11px] text-muted mt-2">اضغط Enter للبدء، أو Shift+Enter لسطر جديد</p>
          </div>
          
          {new Set(debateConfig.participants).size !== debateConfig.participants.length && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-red-500 text-sm font-bold text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">
              يرجى اختيار شخصيات مختلفة للمناظرة
            </motion.div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button 
            onClick={onClose} 
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-border text-text hover:bg-surface2 transition-colors font-bold"
          >
            إلغاء
          </button>
          {startLiveDebate && (
            <button 
              onClick={startLiveDebate} 
              disabled={!debateConfig.topic.trim() || new Set(debateConfig.participants).size !== debateConfig.participants.length} 
              className="flex-1 py-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.1)] flex items-center justify-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              مناظرة حية (صوتية)
            </button>
          )}
          <button 
            onClick={startDebate} 
            disabled={!debateConfig.topic.trim() || new Set(debateConfig.participants).size !== debateConfig.participants.length} 
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
          >
            بدء (نصياً)
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
