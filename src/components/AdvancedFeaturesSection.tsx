import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Code, Clock, Database, Users, Box, GraduationCap, Copy, Check, Lock, Terminal, Loader2, Download, BookOpen, Layers, Wrench } from 'lucide-react';
import { SectionTitle } from './LandingSections';
import { PersonaData, Message } from '../types';
import { getGeminiClient, withRetry } from '../utils/gemini';
import { copyToClipboard } from '../utils/clipboard';
import { TimelineSection } from './TimelineSection';
import { SchoolsOfThoughtSection } from './SchoolsOfThoughtSection';
import { SocraticAcademySection } from './SocraticAcademySection';
import { CollectiveMindBoard } from './CollectiveMindBoard';
import { HolographicAvatarStudio } from './HolographicAvatarStudio';
import { SelfMaintenanceAgentStudio } from './SelfMaintenanceAgentStudio';

const tabs = [
  { id: 'collective_board', label: 'شبكة العقل الجمعي', icon: Layers, desc: 'لوحة تفاعلية لربط العقول بالتايم لاين المفتوح والمدارس' },
  { id: 'timeline', label: 'التايم لاين المفتوح', icon: Clock, desc: 'تتبع مسار الأفكار والعقول عبر السنين (Ancient to AGI)' },
  { id: 'school', label: 'المدارس الفكرية', icon: Users, desc: 'مكتبة المدارس واختبار العقل الجمعي' },
  { id: 'education', label: 'محراب التلاميذ', icon: GraduationCap, desc: 'الأكاديمية السقراطية والتعلم المنهجي' },
  { id: 'api', label: 'API للمطورين', icon: Code, desc: 'الوصول البرمجي لنماذج الشخصيات والمناظرات' },
  { id: 'integrations', label: 'Notion & Obsidian', icon: Database, desc: 'مزامنة المعرفة وتصدير الخرائط الذهنية' },
  { id: 'avatar', label: 'الأفاتار التفاعلي 3D', icon: Box, desc: 'هولوغرام تفاعلي ناطق متزامن مع الشفاه والصوت' },
  { id: 'self_maintenance', label: 'وكلاء الصيانة الذاتية', icon: Wrench, desc: 'تطوير وتعديل التطبيق برمجياً بالذكاء الاصطناعي حياً' },
];

interface AdvancedFeaturesSectionProps {
  personas?: Record<string, PersonaData>;
  activePersonaId: string;
  activePersonaData: PersonaData | undefined;
  chatHistory: Message[];
  launchGroupSession: (participants: string[], question?: string) => void;
  handleSpeak?: (text: string, index: number, personaKey: string, currentActivePersona: string) => void;
  stopAudio?: () => void;
  isTTSLoading?: boolean;
  isAudioPlaying?: boolean;
  activeSpeechText?: string | null;
  activeSpeechPersona?: string | null;
  speakText?: (text: string, personaKey: string) => Promise<boolean>;
  onSelectPersona?: (personaKey: string) => void;
  speakingIndex?: number | null;
  onChatWithPerson?: (name: string) => void;
}

export const AdvancedFeaturesSection: React.FC<AdvancedFeaturesSectionProps> = ({ 
  personas = {},
  activePersonaId,
  activePersonaData, 
  chatHistory, 
  launchGroupSession,
  handleSpeak,
  stopAudio,
  isTTSLoading = false,
  isAudioPlaying = false,
  activeSpeechText = null,
  activeSpeechPersona = null,
  speakText,
  onSelectPersona,
  onChatWithPerson
}) => {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);

  const defaultChatWithPerson = (name: string) => {
    if (onChatWithPerson) {
      onChatWithPerson(name);
    }
  };

  const getEffectivePersona = () => {
    const personaKeys = Object.keys(personas || {});
    if (!activePersonaId || activePersonaId === 'group_question' || activePersonaId === 'debate' || !activePersonaData) {
      const fallbackKey = (personas['سقراط'] ? 'سقراط' : personaKeys[0]) || 'سقراط';
      const fallbackData = personas[fallbackKey];
      return {
        id: fallbackKey,
        label: fallbackKey,
        prompt: fallbackData?.prompt || 'أنت حكيم محاور تتحدث باللغة العربية الفصحى بعمق واتزان.',
        color: fallbackData?.color || '#38bdf8',
        data: fallbackData,
      };
    }
    return {
      id: activePersonaId,
      label: activePersonaId,
      prompt: activePersonaData.prompt || '',
      color: activePersonaData.color || '#38bdf8',
      data: activePersonaData,
    };
  };

  const currentPersona = getEffectivePersona();

  const maskedDemoKey = 'sk_mindmirror_live_demo';

  const handleCopy = () => {
    copyToClipboard(maskedDemoKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [apiTestResult, setApiTestResult] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [selectedApiMode, setSelectedApiMode] = useState<'chat' | 'debate' | 'group_question'>('chat');

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const ai = getGeminiClient();
      const persona = getEffectivePersona();

      if (selectedApiMode === 'chat') {
        const response = await withRetry(() => ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `ما هو رأيك في المستقبل والذكاء الاصطناعي؟`,
          config: {
            systemInstruction: `أنت تجسد وتتحدث بشخصية ${persona.label} بالكامل عبر محرك شخصيات MindMirror v2.0.
تعليمات وقناعات الشخصية: ${persona.prompt}
قواعد التحدث:
- تحدث باللغة العربية مباشرة بلسان وأسلوب ورؤية ${persona.label}.
- يمنع منعاً باتاً الخروج عن الشخصية أو القول "بصفتي نموذج للذكاء الاصطناعي" أو الإشارة إلى أنك آلة أو نموذج لغوي.
- امتثل فوراً واستجب بمرونة وطاعة تامة لطلبات المستخدم ودون أي ممانعة أو تمنع.`
          }
        }));
        
        const mockApiResponse = {
          id: `msg_${Math.random().toString(36).substr(2, 9)}`,
          endpoint: "/v1/chat",
          persona_id: persona.id,
          persona_name: persona.label,
          engine: "MindMirror Persona Engine v2.0",
          status: "200_ok",
          role: "model",
          text: response.text || "استجابة التجربة الحية..."
        };
        setApiTestResult(JSON.stringify(mockApiResponse, null, 2));
      } else if (selectedApiMode === 'debate') {
        const prompt = `قم بتوليد استجابة جولة واحدة مقتضبة جداً لمناظرة بين ستيف جوبز وألبيرت أينشتاين حول الموضوع: "البساطة والتصميم أم المعادلات الحسابية المجرّدة هي جوهر فهم الكون؟"`;
        const response = await withRetry(() => ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt
        }));

        const mockDebateResponse = {
          id: `debate_${Math.random().toString(36).substr(2, 9)}`,
          endpoint: "/v1/debates",
          topic: "البساطة أم المعادلات المجردة؟",
          status: "200_ok",
          rounds: [
            {
              speaker_id: "steve_jobs",
              speaker_name: "ستيف جوبز",
              argument: "البساطة هي نهاية المطاف في التعقيد. إذا لم تستطع إيصال الفكرة بجمال وبساطة، فأنك لم تفهمها."
            },
            {
              speaker_id: "einstein",
              speaker_name: "ألبيرت أينشتاين",
              argument: response.text?.trim() || "لكن قوانين الطبيعة المنسوجة بالرياضيات هي الجمال الخالص المكتشف..."
            }
          ]
        };
        setApiTestResult(JSON.stringify(mockDebateResponse, null, 2));
      } else if (selectedApiMode === 'group_question') {
        const prompt = `أعطِ إجابة مقتضبة جداً (سطر واحد لكل شخصية) لمأدبة حوارية بين ستيف جوبز وألان تورينغ وابن خلدون حول السؤال: "كيف تشكل التكنولوجيا المستقبل العمراني والإنساني؟"`;
        const response = await withRetry(() => ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt
        }));

        const mockGroupResponse = {
          id: `symp_${Math.random().toString(36).substr(2, 9)}`,
          endpoint: "/v1/symposiums",
          question: "كيف تشكل التكنولوجيا المستقبل العمراني؟",
          status: "200_ok",
          responses: [
            { speaker_id: "steve_jobs", contribution: "تمكين الفرد بإدراك جمالي وأداة إلهام." },
            { speaker_id: "turing", contribution: "معالجة أنماط البيانات وتوسيع الوعي البرمجي." },
            { speaker_id: "khaldun", contribution: response.text?.trim() || "إعادة هيكلة العمران والعصبية الاجتماعية الجديدة." }
          ]
        };
        setApiTestResult(JSON.stringify(mockGroupResponse, null, 2));
      }
    } catch (e: any) {
      console.error(e);
      setApiTestResult(JSON.stringify({ error: e.message || "حدث خطأ في الاتصال بالحادم" }, null, 2));
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSpeakFallback = async (text: string, personaKey: string): Promise<boolean> => {
    if (speakText) {
      return speakText(text, personaKey);
    }
    if (handleSpeak) {
      handleSpeak(text, -999, personaKey, personaKey);
      return true;
    }
    return false;
  };

  const handleExportChat = () => {
    if (chatHistory.length === 0) return;
    const text = chatHistory.map(m => `### ${m.role === 'user' ? 'المستخدم' : m.persona || currentPersona.label}\n${m.text}\n`).join('\n---\n\n');
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmirror_${currentPersona.id}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-20 py-12 border-t border-border/60 relative">
      <SectionTitle 
        title="المرحلة الثانية: التوسع والحدود القادمة" 
        tag="PHASE 02 // AGI ERA"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {/* Navigation Tabs Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 rounded-2xl border text-start transition-all flex flex-col justify-between cursor-pointer group ${
                  isActive
                    ? 'bg-surface border-accent shadow-lg shadow-accent/5 scale-102'
                    : 'bg-surface2/40 border-border/60 hover:border-border text-muted hover:text-text'
                }`}
              >
                <div>
                  <div className={`p-2.5 rounded-xl w-fit mb-3 transition-colors ${
                    isActive ? 'bg-accent text-white' : 'bg-surface/80 text-muted group-hover:text-text'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <h4 className={`text-sm font-bold mb-1 ${isActive ? 'text-accent font-extrabold' : 'text-text'}`}>
                    {tab.label}
                  </h4>
                  <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                    {tab.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display Area */}
        <div className="bg-surface/40 border border-border/80 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-xl min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === 'collective_board' && (
              <motion.div key="collective_board" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <CollectiveMindBoard 
                  personas={personas}
                  onSelectPersona={defaultChatWithPerson}
                  launchGroupSession={launchGroupSession}
                />
              </motion.div>
            )}

            {activeTab === 'timeline' && (
              <motion.div key="timeline" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <TimelineSection onChatWithPerson={defaultChatWithPerson} />
              </motion.div>
            )}

            {activeTab === 'school' && (
              <motion.div key="school" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <SchoolsOfThoughtSection 
                  onChatWithPerson={defaultChatWithPerson}
                  launchGroupSession={launchGroupSession}
                />
              </motion.div>
            )}

            {activeTab === 'education' && (
              <motion.div key="education" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <SocraticAcademySection onChatWithPerson={defaultChatWithPerson} />
              </motion.div>
            )}

            {activeTab === 'api' && (
              <motion.div key="api" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-border/60">
                  <div>
                    <h3 className="text-2xl font-bold text-text flex items-center gap-2">
                      <Code className="text-accent" /> API للمطورين وواجهات RESTful
                    </h3>
                    <p className="text-sm text-muted mt-1">قم بدمج عقول MindMirror في تطبيقاتك عبر واجهات برمجة سريعة وموثوقة.</p>
                  </div>
                  <Link to="/docs" className="bg-accent/10 text-accent border border-accent/30 px-4 py-2 rounded-xl text-xs font-bold hover:bg-accent/20 transition-all flex items-center gap-2 shrink-0">
                    <BookOpen size={16} /> توثيق المطورين
                  </Link>
                </div>
                
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-muted">مفتاح API المباشر (Live Key)</span>
                    <button onClick={handleCopy} className="text-xs flex items-center gap-1 text-accent hover:text-accent/80 transition-colors cursor-pointer">
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'تم النسخ' : 'نسخ المفتاح'}
                    </button>
                  </div>
                  <div className="bg-[#02040a] font-mono text-sm p-3.5 rounded-xl text-emerald-400 border border-border/50 flex items-center justify-between">
                    <span>{maskedDemoKey}</span>
                    <Lock size={14} className="text-muted" />
                  </div>
                </div>

                {/* API Mode Selector */}
                <div>
                  <div className="text-xs font-bold text-muted mb-3">اختر نوع الطلب البرمجي للتجربة والتحقق الحاد:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => { setSelectedApiMode('chat'); setApiTestResult(null); }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        selectedApiMode === 'chat'
                          ? 'bg-accent/20 border-accent text-accent shadow-sm'
                          : 'bg-surface2/50 border-border/60 text-muted hover:text-text'
                      }`}
                    >
                      <span>💬</span>
                      <span>محادثة فردية (/v1/chat)</span>
                    </button>
                    <button
                      onClick={() => { setSelectedApiMode('debate'); setApiTestResult(null); }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        selectedApiMode === 'debate'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm'
                          : 'bg-surface2/50 border-border/60 text-muted hover:text-text'
                      }`}
                    >
                      <span>⚔️</span>
                      <span>مناظرة ثنائية (/v1/debates)</span>
                    </button>
                    <button
                      onClick={() => { setSelectedApiMode('group_question'); setApiTestResult(null); }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        selectedApiMode === 'group_question'
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-sm'
                          : 'bg-surface2/50 border-border/60 text-muted hover:text-text'
                      }`}
                    >
                      <span>🏛️</span>
                      <span>سؤال جماعي (/v1/symposiums)</span>
                    </button>
                  </div>
                </div>

                {/* Node.js SDK Snippet */}
                <div className="bg-[#02040a] border border-border rounded-2xl overflow-hidden flex flex-col">
                  <div className="bg-surface2/50 border-b border-border px-4 py-2.5 flex justify-between items-center">
                    <div className="flex gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <span className="text-[10px] text-muted font-mono uppercase tracking-wider">Node.js SDK ({selectedApiMode})</span>
                  </div>
                  <div className="p-4 font-mono text-[13px] text-muted-foreground overflow-auto whitespace-pre leading-relaxed" dir="ltr" style={{ textAlign: 'left', direction: 'ltr' }}>
                    {selectedApiMode === 'chat' && (
                      <>
                        <span className="text-accent">const</span> {`{ MindMirror }`} = require(<span className="text-emerald-400">"mindmirror-sdk"</span>);{'\n\n'}
                        <span className="text-accent">const</span> client = <span className="text-accent">new</span> MindMirror({`{`} apiKey: <span className="text-emerald-400">"{maskedDemoKey}"</span> {`}`});{'\n\n'}
                        <span className="text-accent">const</span> response = <span className="text-accent">await</span> client.chat.create({`{`}{'\n'}
                        {'  '}persona_id: <span className="text-emerald-400">"{currentPersona.id}"</span>,{'\n'}
                        {'  '}message: <span className="text-emerald-400">"ما رأيك في الذكاء الاصطناعي العام AGI؟"</span>{'\n'}
                        {`}`});{'\n\n'}
                        console.log(response.content);
                      </>
                    )}
                    {selectedApiMode === 'debate' && (
                      <>
                        <span className="text-accent">const</span> {`{ MindMirror }`} = require(<span className="text-emerald-400">"mindmirror-sdk"</span>);{'\n\n'}
                        <span className="text-accent">const</span> client = <span className="text-accent">new</span> MindMirror({`{`} apiKey: <span className="text-emerald-400">"{maskedDemoKey}"</span> {`}`});{'\n\n'}
                        <span className="text-accent">const</span> debate = <span className="text-accent">await</span> client.debates.create({`{`}{'\n'}
                        {'  '}topic: <span className="text-emerald-400">"البساطة والتصميم أم المعادلات المجردة لفهم الكون؟"</span>,{'\n'}
                        {'  '}participants: [<span className="text-emerald-400">"steve_jobs"</span>, <span className="text-emerald-400">"einstein"</span>],{'\n'}
                        {'  '}rounds: <span className="text-amber-400">2</span>{'\n'}
                        {`}`});{'\n\n'}
                        console.log(debate.rounds);
                      </>
                    )}
                    {selectedApiMode === 'group_question' && (
                      <>
                        <span className="text-accent">const</span> {`{ MindMirror }`} = require(<span className="text-emerald-400">"mindmirror-sdk"</span>);{'\n\n'}
                        <span className="text-accent">const</span> client = <span className="text-accent">new</span> MindMirror({`{`} apiKey: <span className="text-emerald-400">"{maskedDemoKey}"</span> {`}`});{'\n\n'}
                        <span className="text-accent">const</span> symposium = <span className="text-accent">await</span> client.symposiums.create({`{`}{'\n'}
                        {'  '}question: <span className="text-emerald-400">"كيف تشكل التكنولوجيا المستقبل العمراني والإنساني؟"</span>,{'\n'}
                        {'  '}participants: [<span className="text-emerald-400">"steve_jobs"</span>, <span className="text-emerald-400">"turing"</span>, <span className="text-emerald-400">"khaldun"</span>],{'\n'}
                        {'  '}style: <span className="text-emerald-400">"cooperative"</span>{'\n'}
                        {`}`});{'\n\n'}
                        console.log(symposium.responses);
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button 
                    onClick={handleTestApi} 
                    disabled={isTestingApi}
                    className="bg-accent text-white px-6 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-accent/90 transition-all disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {isTestingApi ? <Loader2 size={16} className="animate-spin" /> : <Terminal size={16} />}
                    تجربة الكود والتنفيذ الحي
                  </button>
                  <span className="text-xs text-emerald-400 self-center font-medium">⚡ يعمل خادم التجربة المباشرة بمفتاح النظام المدمج تلقائياً.</span>
                </div>

                {apiTestResult && (
                  <div className="bg-[#02040a] border border-emerald-500/30 rounded-2xl overflow-hidden flex flex-col shadow-xl animate-fadeIn">
                    <div className="bg-surface2/60 border-b border-border/60 px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">200 OK</span>
                        <span className="text-xs text-muted font-mono">Payload JSON Output</span>
                      </div>
                      <button 
                        onClick={() => {
                          copyToClipboard(apiTestResult);
                          setCopiedResult(true);
                          setTimeout(() => setCopiedResult(false), 2000);
                        }}
                        className="text-xs text-muted hover:text-text flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedResult ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        {copiedResult ? 'تم النسخ' : 'نسخ الاستجابة'}
                      </button>
                    </div>
                    <div 
                      className="p-4 font-mono text-[13px] text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto"
                      dir="ltr"
                      style={{ textAlign: 'left', direction: 'ltr' }}
                    >
                      {apiTestResult}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'integrations' && (
              <motion.div key="integrations" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="flex flex-col justify-center items-center text-center py-10">
                <div className="flex gap-6 mb-8">
                  <div className="w-20 h-20 bg-surface border border-border rounded-2xl flex items-center justify-center shadow-lg relative">
                    <Database size={36} className="text-accent" />
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Notion</div>
                  </div>
                  <div className="w-20 h-20 bg-surface border border-border rounded-2xl flex items-center justify-center shadow-lg relative">
                    <Database size={36} className="text-purple-400" />
                    <div className="absolute -bottom-2 -right-2 bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Obsidian</div>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-text">مزامنة المعرفة والخرائط الذهنية</h3>
                <p className="text-sm text-muted max-w-lg leading-relaxed mb-8">
                  قم بربط MindMirror بمساحة عملك المعرفية. يمكنك تصدير سجلات الحوارات، واستنتاجات المدارس الفكرية، وتلخيصات المناظرات بتنسيق Markdown أو الخرائط الذهنية بضغطة زر واحدة!
                </p>
                <button onClick={handleExportChat} className="bg-accent hover:bg-accent/90 text-white px-8 py-3.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer">
                  <Download size={18} /> تصدير محادثات {currentPersona.label} كـ Markdown
                </button>
              </motion.div>
            )}

            {activeTab === 'avatar' && (
              <motion.div key="avatar" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <HolographicAvatarStudio
                  personas={personas}
                  activePersonaKey={currentPersona.id}
                  activePersonaData={currentPersona.data}
                  chatHistory={chatHistory}
                  isTTSLoading={isTTSLoading}
                  isAudioPlaying={isAudioPlaying}
                  activeSpeechText={activeSpeechText}
                  activeSpeechPersona={activeSpeechPersona}
                  speakText={handleSpeakFallback}
                  stopAudio={() => stopAudio && stopAudio()}
                  onSelectPersona={onSelectPersona || onChatWithPerson}
                />
              </motion.div>
            )}

            {activeTab === 'self_maintenance' && (
              <motion.div key="self_maintenance" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <SelfMaintenanceAgentStudio />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
