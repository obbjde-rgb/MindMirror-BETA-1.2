import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  FileCode2,
  Loader2,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  XCircle,
  ChevronDown,
  ChevronUp,
  Snowflake,
  RefreshCw,
} from 'lucide-react';
import { useToast } from './Toast';

interface CodingModelInfo {
  id: string;
  label: string;
  badge?: string;
  description?: string;
  recommended?: boolean;
}

interface AgentTraceStep {
  agent: string;
  status: 'done' | 'warn' | 'error';
  title: string;
  detail: string;
}

interface PlanPatchPreview {
  search: string;
  replace: string;
  verifiedOnDisk: boolean;
}

interface PlannedEditPreview {
  filePath: string;
  action: 'modify' | 'create';
  summaryAr: string;
  verifiedOnDisk: boolean;
  patches: PlanPatchPreview[];
  contentPreview?: string;
}

interface AgentPlanPayload {
  planId: string;
  modelUsed: string;
  traceSteps: AgentTraceStep[];
  inspectedFiles: string[];
  understandingAr: string;
  planSummaryAr: string;
  riskLevel: 'low' | 'medium' | 'high';
  consultationMessageAr: string;
  editsPreview: PlannedEditPreview[];
}

interface ExecutionResultPayload {
  success: boolean;
  planId: string;
  modifiedFiles: string[];
  rollbackAvailable: boolean;
  tscPassed: boolean;
  tscOutput?: string;
  buildRevision?: number;
  executionTrace: AgentTraceStep[];
}

interface AgentConversationEntry {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  timestamp: string;
  phase?: 'planning' | 'awaiting_approval' | 'executed' | 'rolled_back' | 'rejected' | 'error';
  plan?: AgentPlanPayload;
  execution?: ExecutionResultPayload;
  errorText?: string;
}

const FREEZE_APP_TEST_INSTRUCTION =
  'أضف زر "تجميد التطبيق" (App Freeze Toggle) في الشريط العلوي (ChatHeader أو الشريط الرئيسي)، بحيث عند النقر عليه يتم تجميد تفاعلات وحركات الواجهة وعرض شارة واضحة "التطبيق مجمّد"، وعند النقر مرة أخرى يتم فك التجميد فوراً.';

const QUICK_TEST_PROMPTS = [
  {
    id: 'freeze_btn',
    title: 'تجربة اختبارية: إضافة زر تجميد التطبيق ❄️',
    subtitle: 'تعليمات جاهزة لاختبار قدرة الوكلاء على التخطيط والاستشارة وتعديل الكود لحظياً',
    prompt: FREEZE_APP_TEST_INSTRUCTION,
    featured: true,
  },
  {
    id: 'msg_counter',
    title: 'إضافة عداد الرسائل في الرأس',
    subtitle: 'يعرض عدد رسائل الجلسة الحالية بجانب اسم الشخصية',
    prompt: 'أضف شارة صغيرة أنيقة في شريط الرأس تعرض عدد الرسائل في المحادثة الحالية.',
    featured: false,
  },
  {
    id: 'scroll_top',
    title: 'إضافة زر الصعود السريع للأعلى',
    subtitle: 'زر عائم مريح للعودة إلى أعلى المحادثة بضغطة واحدة',
    prompt: 'أضف زر عائم أنيق في زاوية الشاشة للعودة السريعة إلى أعلى الصفحة عند التمرير للأسفل.',
    featured: false,
  },
];

const FALLBACK_MODELS: CodingModelInfo[] = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    badge: 'الافتراضي الموصى به • فائق السرعة',
    description: 'نموذج البرمجة الفورية السريع والدقيق لتعديل شيفرة التطبيق لحظياً',
    recommended: true,
  },
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    badge: 'جيل 2026 الحديث',
    description: 'سرعة عالية واستدلال برمجي متوازن لتحرير الواجهات والمنطق',
  },
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon',
    badge: 'تخطيط هندسي متقدم',
    description: 'نموذج متفوق للتغييرات المعمارية المعقدة والمهام متعددة الملفات',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    badge: 'معمارية وتحليل عميق',
    description: 'تحليل عميق للمشاريع الكبيرة وكتابة الرقع البرمجية المعقدة',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    badge: 'موثوق وعالي الدقة',
    description: 'مناسب للتدقيق المنطقي وحل الأعطال البرمجية المعقدة',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    badge: 'سريع وخفيف',
    description: 'تنفيذ سريع للتعديلات المباشرة والبسيطة',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    badge: 'اقتصادي فائق الخفة',
    description: 'مناسب للتعديلات التجميلية والنصوص والأنماط السريعة',
  },
];

export const SelfMaintenanceAgentStudio: React.FC = () => {
  const { toast } = useToast();
  const [models, setModels] = useState<CodingModelInfo[]>(FALLBACK_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-flash-preview');
  const [workspaceCount, setWorkspaceCount] = useState<number>(0);
  const [inputPrompt, setInputPrompt] = useState<string>(FREEZE_APP_TEST_INSTRUCTION);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [rollingBackPlanId, setRollingBackPlanId] = useState<string | null>(null);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [entries, setEntries] = useState<AgentConversationEntry[]>([]);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/self-agent/models')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.models) && data.models.length > 0) {
          setModels(data.models);
          if (data.defaultModel) setSelectedModel(data.defaultModel);
        }
      })
      .catch(() => {});

    fetch('/api/self-agent/workspace-files')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.count === 'number') setWorkspaceCount(data.count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [entries.length, isPlanning, executingPlanId]);

  const activeModelMeta = models.find((m) => m.id === selectedModel) || models[0];

  const handlePlanSubmit = async (customPrompt?: string) => {
    const promptToRun = (customPrompt ?? inputPrompt).trim();
    if (!promptToRun || isPlanning || executingPlanId) return;

    const userMsgId = `u_${Date.now()}`;
    const assistantMsgId = `a_${Date.now() + 1}`;
    const nowLabel = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    setEntries((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text: promptToRun, timestamp: nowLabel },
      { id: assistantMsgId, role: 'assistant', phase: 'planning', timestamp: nowLabel },
    ]);
    if (!customPrompt) setInputPrompt('');
    setIsPlanning(true);

    try {
      const historyPayload = entries.map((e) => ({
        role: e.role,
        text: e.text || e.plan?.understandingAr || e.errorText || '',
      }));

      const res = await fetch('/api/self-agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToRun,
          model: selectedModel,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'فشل وكيل التخطيط في إعداد الخطة البرمجية.');
      }

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === assistantMsgId
            ? {
                ...entry,
                phase: 'awaiting_approval',
                plan: data as AgentPlanPayload,
              }
            : entry
        )
      );

      // Expand first diff automatically so user inspects exact code changes immediately
      if (data?.planId) {
        setExpandedDiffs((prev) => ({ ...prev, [data.planId]: true }));
      }
    } catch (err: any) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === assistantMsgId
            ? {
                ...entry,
                phase: 'error',
                errorText: err?.message || 'حدث خطأ أثناء الفحص والتخطيط.',
              }
            : entry
        )
      );
    } finally {
      setIsPlanning(false);
    }
  };

  const handleApproveAndExecute = async (entryId: string, planId: string) => {
    if (executingPlanId) return;
    setExecutingPlanId(planId);

    try {
      const res = await fetch('/api/self-agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, model: selectedModel }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  phase: 'error',
                  errorText: data?.error || 'تعذر تنفيذ التعديل وتمت حماية النسخة الأصلية.',
                  execution: data,
                }
              : entry
          )
        );
        toast({
          type: 'error',
          title: 'تعذر إتمام التنفيذ البرمجي',
          message: data?.error || 'تم التراجع الآمن حفاظاً على استقرار التطبيق.',
        });
        return;
      }

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                phase: 'executed',
                execution: data as ExecutionResultPayload,
              }
            : entry
        )
      );

      toast({
        type: 'success',
        title: 'تم تعديل الشيفرة والتحقق بنجاح',
        message: 'جاري تطبيق التحديث مباشرة على المعاينة الحية خلال ثوانٍ...',
      });

      // Trigger immediate live preview refresh across the app without manual user refresh
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mindmirror-trigger-live-sync'));
      }, 900);
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'خطأ في الاتصال بالوكيل المنفذ',
        message: err?.message || 'حدث عطل غير متوقع.',
      });
    } finally {
      setExecutingPlanId(null);
    }
  };

  const handleRejectPlan = (entryId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? { ...entry, phase: 'rejected' }
          : entry
      )
    );
    toast({
      type: 'info',
      title: 'تم إلغاء التنفيذ',
      message: 'لم يتم المساس بأي ملف في المنصة بناءً على اختيارك.',
    });
  };

  const handleRollback = async (entryId: string, planId: string) => {
    if (rollingBackPlanId) return;
    setRollingBackPlanId(planId);
    try {
      const res = await fetch('/api/self-agent/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'تعذر التراجع عن التعديل.');
      }

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, phase: 'rolled_back' } : entry
        )
      );

      toast({
        type: 'success',
        title: 'تم التراجع بنجاح',
        message: 'تمت استعادة الشيفرة الأصلية وتحديث المعاينة الحية.',
      });

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mindmirror-trigger-live-sync'));
      }, 800);
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'فشل التراجع',
        message: err?.message || 'حدث خطأ أثناء استعادة النسخة.',
      });
    } finally {
      setRollingBackPlanId(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Model Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
              <Wrench size={20} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-text flex items-center gap-2 flex-wrap">
                <span>وكلاء الصيانة الذاتية والتطوير البرمجي الحي</span>
                <span className="text-[11px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  LIVE CODE ENGINE • {workspaceCount || '50+'} ملفاً • مخرجات ديناميكية بلا حد
                </span>
              </h3>
              <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
                اكتب أي تعديل أو ميزة تريدها في المنصة؛ يقوم الوكلاء بفحص الشيفرة الفعلية، عرض خطة كاملة، استشارتك قبل التنفيذ، ثم تعديل الكود والتحقق عبر TypeScript وتحديث المعاينة فوراً.
              </p>
            </div>
          </div>
        </div>

        {/* Model Selector Box */}
        <div className="bg-surface/80 border border-border rounded-2xl p-3 sm:min-w-[320px] shrink-0">
          <label className="text-[11px] font-bold text-muted flex items-center gap-1.5 mb-1.5">
            <Cpu size={13} className="text-accent" />
            <span>نموذج الوكيل البرمجي المنفذ:</span>
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-[#02040a] text-text border border-border/80 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent cursor-pointer"
            dir="ltr"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} {m.recommended ? '★ (الافتراضي الموصى به)' : ''}
              </option>
            ))}
          </select>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-emerald-400 font-bold truncate">
              {activeModelMeta?.badge || 'جاهز للتعديل الفوري'}
            </span>
            <span className="text-muted font-mono text-[10px]" dir="ltr">
              {selectedModel}
            </span>
          </div>
        </div>
      </div>

      {/* Featured Interactive Test Instruction Card (App Freeze Button Test) */}
      <div className="bg-gradient-to-l from-cyan-500/10 via-sky-500/5 to-surface border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
              <Snowflake size={18} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-text">
                تعليمات تجربة حية لاختبار الوكلاء: إضافة «زر تجميد التطبيق»
              </h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                انقر على زر الإرسال أدناه لتوجيه الوكلاء لإضافة زر تجميد فعلي داخل المنصة؛ ستشاهد الوكيل يفحص الملفات، يضع الخطة، ويستشيرك أولاً قبل لمس أي سطر برمجي.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setInputPrompt(FREEZE_APP_TEST_INSTRUCTION);
              handlePlanSubmit(FREEZE_APP_TEST_INSTRUCTION);
            }}
            disabled={isPlanning || Boolean(executingPlanId)}
            className="bg-cyan-500 hover:bg-cyan-400 text-[#02040a] font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Play size={14} />
            <span>اختبار إضافة زر تجميد التطبيق الآن</span>
          </button>
        </div>

        {/* Additional Quick Instructions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {QUICK_TEST_PROMPTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setInputPrompt(item.prompt)}
              className={`text-[11px] px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                item.featured
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 font-bold hover:bg-cyan-500/25'
                  : 'bg-surface2/60 border-border/70 text-muted hover:text-text hover:border-border'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* Live Transparent Multi-Agent Conversation Feed */}
      <div className="bg-[#02040a]/75 border border-border/80 rounded-2xl p-4 sm:p-5 min-h-[340px] max-h-[620px] overflow-y-auto space-y-5 scrollbar-custom">
        {entries.length === 0 ? (
          <div className="py-12 text-center space-y-3 max-w-xl mx-auto">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
              <Bot size={28} />
            </div>
            <h4 className="text-base font-bold text-text">
              غرفة عمليات الوكلاء جاهزة للتنفيذ الفوري
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              تعمل المنظومة عبر 4 وكلاء متسلسلين أمامك بشفافية تامة:
              <br />
              <strong className="text-accent">1) وكيل الفحص</strong> ← <strong className="text-accent">2) وكيل التخطيط الهندسي</strong> ← <strong className="text-amber-400">3) استشارتك وموافقتك الصريحة</strong> ← <strong className="text-emerald-400">4) وكيل البرمجة والتحقق والمزامنة الحية</strong>
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            if (entry.role === 'user') {
              return (
                <div key={entry.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-accent/15 border border-accent/35 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-text shadow-sm">
                    <div className="text-[10px] text-accent font-bold mb-1 flex items-center justify-between gap-4">
                      <span>أنت (طلب تطوير برمجي)</span>
                      <span className="font-mono opacity-75">{entry.timestamp}</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                  </div>
                </div>
              );
            }

            // Assistant multi-agent trace & interactive cards
            const plan = entry.plan;
            const execution = entry.execution;
            const isExpanded = plan?.planId ? Boolean(expandedDiffs[plan.planId]) : false;

            return (
              <div key={entry.id} className="flex justify-start">
                <div className="w-full bg-surface/90 border border-border rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
                  {/* Agent Status Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-accent" />
                      <span className="text-xs font-extrabold text-text">تقرير الوكلاء الهندسي المباشر</span>
                      {plan?.modelUsed && (
                        <span className="text-[10px] font-mono bg-surface2 border border-border px-2 py-0.5 rounded-md text-accent" dir="ltr">
                          {plan.modelUsed}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted">{entry.timestamp}</span>
                  </div>

                  {/* Phase: Planning spinner */}
                  {entry.phase === 'planning' && (
                    <div className="flex items-center gap-3 py-4 text-xs text-accent font-bold">
                      <Loader2 size={18} className="animate-spin" />
                      <span>جاري فحص ملفات التطبيق الفعلية وإعداد الخطة البرمجية قبل استشارتك...</span>
                    </div>
                  )}

                  {/* Error view */}
                  {entry.phase === 'error' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-300 space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <XCircle size={15} />
                        <span>{entry.errorText || 'حدث خطأ أثناء تنفيذ العملية'}</span>
                      </div>
                      {execution?.tscOutput && (
                        <pre className="bg-[#02040a] p-2.5 rounded-lg font-mono text-[11px] text-red-300 overflow-x-auto" dir="ltr">
                          {execution.tscOutput}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Trace steps (Plan + Inspect) */}
                  {plan && (
                    <div className="space-y-4">
                      {/* Live Pipeline Steps */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {plan.traceSteps.map((st, idx) => (
                          <div key={idx} className="bg-surface2/60 border border-border/70 rounded-xl p-3 space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                              {st.status === 'done' ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} className="text-amber-400" />}
                              <span>{st.agent}</span>
                            </div>
                            <div className="text-xs font-bold text-text">{st.title}</div>
                            <p className="text-[11px] text-muted leading-relaxed">{st.detail}</p>
                          </div>
                        ))}
                      </div>

                      {/* Inspected Files Pills */}
                      {plan.inspectedFiles?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="text-muted font-bold">الملفات التي تم فحصها فعلياً:</span>
                          {plan.inspectedFiles.map((fp) => (
                            <span key={fp} className="font-mono text-[10px] bg-[#02040a] border border-border/80 px-2 py-0.5 rounded-md text-sky-300" dir="ltr">
                              {fp}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Plan Summary */}
                      <div className="bg-surface2/40 border border-border/80 rounded-xl p-4 space-y-2">
                        <div className="text-xs font-extrabold text-accent">فهم الطلب وخطة التنفيذ المقترحة:</div>
                        <p className="text-xs text-text leading-relaxed">{plan.understandingAr}</p>
                        {plan.planSummaryAr && (
                          <div className="text-xs text-muted whitespace-pre-wrap leading-relaxed pt-1 border-t border-border/50">
                            {plan.planSummaryAr}
                          </div>
                        )}
                      </div>

                      {/* Proposed File Edits & Visual Code Diff Toggle */}
                      <div className="border border-border/80 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDiffs((prev) => ({
                              ...prev,
                              [plan.planId]: !prev[plan.planId],
                            }))
                          }
                          className="w-full px-4 py-2.5 bg-surface2/70 flex items-center justify-between text-xs font-bold text-text hover:bg-surface2 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <FileCode2 size={15} className="text-accent" />
                            <span>
                              معاينة التعديلات البرمجية الدقيقة ({plan.editsPreview.length} ملف)
                            </span>
                          </span>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>

                        {isExpanded && (
                          <div className="p-3 sm:p-4 bg-[#02040a] space-y-4 max-h-[340px] overflow-y-auto scrollbar-custom">
                            {plan.editsPreview.map((ed, i) => (
                              <div key={i} className="border border-border/60 rounded-xl p-3 space-y-2 bg-surface/30">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-amber-300" dir="ltr">
                                    {ed.action === 'create' ? '+ CREATE ' : '~ EDIT '}
                                    {ed.filePath}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      ed.verifiedOnDisk
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    }`}
                                  >
                                    {ed.verifiedOnDisk ? 'متطابق مع القرص ✓' : 'تطابق ذكي عند التنفيذ'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted">{ed.summaryAr}</p>

                                {ed.patches.map((pt, pIdx) => (
                                  <div key={pIdx} className="space-y-1.5 font-mono text-[11px]" dir="ltr">
                                    {pt.search && (
                                      <pre className="bg-red-950/35 border border-red-500/25 text-red-200 p-2.5 rounded-lg overflow-auto max-h-[320px] whitespace-pre-wrap">
                                        {`- ${pt.search}`}
                                      </pre>
                                    )}
                                    <pre className="bg-emerald-950/35 border border-emerald-500/25 text-emerald-200 p-2.5 rounded-lg overflow-auto max-h-[420px] whitespace-pre-wrap">
                                      {`+ ${pt.replace}`}
                                    </pre>
                                  </div>
                                ))}

                                {ed.contentPreview && (
                                  <pre className="bg-emerald-950/35 border border-emerald-500/25 text-emerald-200 p-2.5 rounded-lg overflow-auto max-h-[460px] font-mono text-[11px] whitespace-pre-wrap" dir="ltr">
                                    {ed.contentPreview}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Mandatory User Consultation Gate */}
                      {entry.phase === 'awaiting_approval' && (
                        <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <ShieldCheck size={18} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs font-extrabold text-amber-300">
                                استشارة قبل التنفيذ الفعلي (موافقة مطلوبة):
                              </div>
                              <p className="text-xs text-text mt-1 leading-relaxed">
                                {plan.consultationMessageAr}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleApproveAndExecute(entry.id, plan.planId)}
                              disabled={Boolean(executingPlanId)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-[#02040a] font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                              {executingPlanId === plan.planId ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Code2 size={15} />
                              )}
                              <span>
                                {executingPlanId === plan.planId
                                  ? 'جاري كتابة الكود والتحقق (TSC)...'
                                  : 'اعتماد وتنفيذ التعديل برمجياً الآن'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRejectPlan(entry.id)}
                              disabled={Boolean(executingPlanId)}
                              className="bg-surface2 hover:bg-red-500/15 text-muted hover:text-red-300 border border-border px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                              إلغاء دون تعديل
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Rejected state */}
                      {entry.phase === 'rejected' && (
                        <div className="text-xs font-bold text-muted bg-surface2/60 border border-border rounded-xl px-4 py-2.5">
                          تم إلغاء هذه الخطة بناءً على قرارك ولم يُعدّل أي ملف.
                        </div>
                      )}

                      {/* Executed Result + Compiler Trace + Rollback */}
                      {entry.phase === 'executed' && execution && (
                        <div className="bg-emerald-500/10 border border-emerald-500/35 rounded-2xl p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
                              <Terminal size={15} />
                              <span>تم التطبيق الفعلي + نجاح فحص TypeScript (النسخة الحية #{execution.buildRevision})</span>
                            </div>
                            {execution.rollbackAvailable && (
                              <button
                                type="button"
                                onClick={() => handleRollback(entry.id, plan.planId)}
                                disabled={rollingBackPlanId === plan.planId}
                                className="bg-surface border border-border hover:border-amber-400 text-amber-300 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                {rollingBackPlanId === plan.planId ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={12} />
                                )}
                                <span>تراجع عن هذا التعديل</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {execution.executionTrace.map((step, sIdx) => (
                              <div key={sIdx} className="bg-[#02040a]/70 border border-border/60 rounded-xl p-2.5 text-[11px] space-y-0.5">
                                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                                  <CheckCircle2 size={12} />
                                  <span>{step.agent}: {step.title}</span>
                                </div>
                                <p className="text-muted">{step.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rolled back state */}
                      {entry.phase === 'rolled_back' && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs font-bold text-amber-300 flex items-center gap-2">
                          <RefreshCw size={14} />
                          <span>تم التراجع واستعادة النسخة السابقة وإعادة مزامنة المعاينة الحية.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Prompt Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handlePlanSubmit();
        }}
        className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
      >
        <div className="flex-1">
          <label className="text-xs font-bold text-muted block mb-1.5">
            صف للوكلاء ما تريد تعديله أو إضافته برمجياً في المنصة:
          </label>
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            rows={2}
            placeholder="مثال: أضف زر تجميد التطبيق في الشريط العلوي لتجميد الحركات والتحديثات..."
            className="w-full bg-[#02040a] border border-border rounded-2xl px-4 py-3 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-accent resize-y"
          />
        </div>
        <button
          type="submit"
          disabled={!inputPrompt.trim() || isPlanning || Boolean(executingPlanId)}
          className="bg-accent hover:bg-accent/90 text-white font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isPlanning ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          <span>{isPlanning ? 'جاري الفحص والتخطيط...' : 'فحص وتخطيط (بدون تنفيذ)'}</span>
        </button>
      </form>
    </div>
  );
};
