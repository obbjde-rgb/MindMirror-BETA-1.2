import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Code, Terminal, Key, BookOpen, ArrowRight, Check, Copy, ArrowLeft, User, Send, Sparkles, Box } from 'lucide-react';
import { Link } from 'react-router-dom';
import { copyToClipboard } from '../utils/clipboard';

export default function DeveloperGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (code: string, sectionId: string) => {
    copyToClipboard(code);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const CodeBlock = ({ code, id, language = 'bash' }: { code: string, id: string, language?: string }) => (
    <div className="relative group rounded-xl overflow-hidden bg-[#02040a] border border-border mt-3">
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => handleCopy(code, id)}
          className="bg-surface border border-border/50 text-muted p-1.5 rounded-md hover:text-text transition-colors"
        >
          {copiedSection === id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="px-4 py-2 bg-surface2/50 border-b border-border/50 flex gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed text-left whitespace-pre-wrap break-words" dir="ltr" style={{ textAlign: 'left', direction: 'ltr' }}>
        <code className={language === 'json' ? 'text-amber-400' : 'text-emerald-400'}>
          {code}
        </code>
      </pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/30 selection:text-accent font-sans" dir="rtl">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent3 flex items-center justify-center shadow-lg shadow-accent/20">
              <Sparkles size={18} className="text-bg" />
            </div>
            <span className="font-bold text-lg tracking-tight">MindMirror <span className="text-muted font-normal">Developers</span></span>
          </div>
          <Link to="/" className="text-sm font-semibold text-muted hover:text-text flex items-center gap-2 transition-colors">
            <ArrowLeft size={16} /> العودة للتطبيق
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent3/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border mb-6">
            <Sparkles size={14} className="text-accent" />
            <span className="text-xs font-bold text-muted">MindMirror Character Engine v2.0</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
            بناء تجارب استثنائية مع <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent3">محرك الشخصيات الخاص بنا</span>
          </h1>
          <p className="text-xl text-muted leading-relaxed mb-10">
            واجهة برمجة التطبيقات (API) المستقلة الخاصة بـ MindMirror تتيح لك دمج عقول مبرمجة مسبقاً بدقة في تطبيقاتك. محرك الشخصيات الخاص بنا يوفر استجابات سريعة، عميقة، وموجهة بالكامل دون الاعتماد المباشر على نماذج عامة خارجية.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => document.getElementById('quickstart')?.scrollIntoView({ behavior: 'smooth' })} 
              className="bg-accent text-bg px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Terminal size={18} /> البدء السريع
            </button>
            <button 
              onClick={() => document.getElementById('authentication')?.scrollIntoView({ behavior: 'smooth' })} 
              className="bg-surface border border-border text-text px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-surface2 transition-colors cursor-pointer"
            >
              <Key size={18} /> مفاتيح API
            </button>
          </div>
        </motion.div>
      </div>

      <div className="border-t border-border/50 bg-surface/30">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-4 gap-12">
          
          {/* Sidebar */}
          <div className="hidden lg:block space-y-8 sticky top-24 self-start">
            <div>
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">الأساسيات</h4>
              <ul className="space-y-3">
                <li>
                  <button 
                    onClick={() => document.getElementById('quickstart')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-semibold text-text hover:text-accent transition-colors text-start w-full cursor-pointer"
                  >
                    البدء السريع
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => document.getElementById('authentication')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-semibold text-muted hover:text-accent transition-colors text-start w-full cursor-pointer"
                  >
                    المصادقة
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">النقاط النهائية (Endpoints)</h4>
              <ul className="space-y-3">
                <li>
                  <button 
                    onClick={() => document.getElementById('list-personas')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-semibold text-muted hover:text-accent transition-colors text-start w-full cursor-pointer"
                  >
                    جلب الشخصيات
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => document.getElementById('send-message')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-semibold text-muted hover:text-accent transition-colors text-start w-full cursor-pointer"
                  >
                    إرسال رسالة
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => document.getElementById('manage-sessions')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-semibold text-muted hover:text-accent transition-colors text-start w-full cursor-pointer"
                  >
                    إدارة الجلسات
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => document.getElementById('debates-api')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-semibold text-muted hover:text-accent transition-colors text-start w-full cursor-pointer"
                  >
                    المناظرات الذكية (Debates)
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => document.getElementById('symposiums-api')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-semibold text-muted hover:text-accent transition-colors text-start w-full cursor-pointer"
                  >
                    الندوات الجماعية (Symposiums)
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-16">
            
            <section id="quickstart" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Terminal size={24} />
                </div>
                <h2 className="text-2xl font-bold">البدء السريع</h2>
              </div>
              <p className="text-muted leading-relaxed mb-6">
                استخدم أداة cURL أو أي مكتبة طلبات HTTP في لغتك المفضلة للاتصال بـ API. النقاط النهائية الأساسية مبنية بتنسيق RESTful لسهولة الاستخدام والتكامل.
              </p>
              <div className="bg-surface border border-border rounded-xl p-6">
                <h3 className="font-bold mb-2">رابط الأساس (Base URL)</h3>
                <code className="text-sm text-accent3 font-mono bg-bg px-2 py-1 rounded">https://api.mindmirror.ai/v1</code>
              </div>
            </section>

            <section id="authentication" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <Key size={24} />
                </div>
                <h2 className="text-2xl font-bold">المصادقة (Authentication)</h2>
              </div>
              <p className="text-muted leading-relaxed mb-6">
                جميع الطلبات يجب أن تتضمن مفتاح API الخاص بك في رأس الطلب (Header) كالتالي: <code className="text-xs font-mono text-text bg-surface px-1.5 py-0.5 rounded">Authorization: Bearer YOUR_API_KEY</code>
              </p>
              <CodeBlock 
                id="auth-curl"
                code={`curl -X GET https://api.mindmirror.ai/v1/personas \\\n  -H "Authorization: Bearer sk_mindmirror_live_..." \\\n  -H "Content-Type: application/json"`}
              />
            </section>

            <section id="list-personas" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <User size={24} />
                </div>
                <h2 className="text-2xl font-bold">جلب الشخصيات المتاحة</h2>
              </div>
              <p className="text-muted leading-relaxed mb-4">
                الحصول على قائمة بجميع الشخصيات التاريخية والخبراء المتاحين للاستخدام في تطبيقك.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-emerald-500/20 text-emerald-500 text-xs font-bold px-2 py-1 rounded uppercase">GET</span>
                <code className="text-sm font-mono text-muted">/v1/personas</code>
              </div>
              <CodeBlock 
                id="res-personas"
                language="json"
                code={`{\n  "status": "success",\n  "data": [\n    {\n      "id": "steve_jobs",\n      "name": "Steve Jobs",\n      "description": "Visionary entrepreneur and Apple co-founder.",\n      "capabilities": ["chat", "debate", "tts"]\n    },\n    {\n      "id": "einstein",\n      "name": "Albert Einstein",\n      "description": "Theoretical physicist.",\n      "capabilities": ["chat", "education"]\n    }\n  ]\n}`}
              />
            </section>

            <section id="send-message" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-accent/10 text-accent">
                  <Send size={24} />
                </div>
                <h2 className="text-2xl font-bold">إرسال رسالة لشخصية</h2>
              </div>
              <p className="text-muted leading-relaxed mb-4">
                تفاعل مع شخصية محددة. سيتم الرد بناءً على نمط تفكير وقناعات تلك الشخصية.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-blue-500/20 text-blue-500 text-xs font-bold px-2 py-1 rounded uppercase">POST</span>
                <code className="text-sm font-mono text-muted">/v1/chat</code>
              </div>
              <div className="flex flex-col gap-6 mt-6">
                <div>
                  <h3 className="font-bold mb-3 text-text flex items-center gap-2"><Terminal size={18} className="text-muted"/> باستخدام cURL</h3>
                  <CodeBlock 
                    id="req-chat-curl"
                    language="bash"
                    code={`curl -X POST https://api.mindmirror.ai/v1/chat \\\n  -H "Authorization: Bearer sk_mindmirror_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"persona_id": "steve_jobs", "message": "ما هو سر تصميم المنتجات العظيمة؟"}'`}
                  />
                </div>
                
                <div>
                  <h3 className="font-bold mb-3 text-text flex items-center gap-2"><Code size={18} className="text-muted"/> باستخدام حزمة Node.js</h3>
                  <p className="text-sm text-muted mb-3">يمكنك تثبيت الحزمة الرسمية لمحرك الشخصيات عبر <code className="bg-surface px-1.5 py-0.5 rounded text-accent3">npm install mindmirror-sdk</code></p>
                  <CodeBlock 
                    id="req-chat-node"
                    language="typescript"
                    code={`const { MindMirror } = require("mindmirror-sdk");\n\nconst client = new MindMirror({\n  apiKey: "sk_mindmirror_live_..."\n});\n\nasync function chat() {\n  const response = await client.chat.create({\n    persona_id: "steve_jobs",\n    message: "ما هو سر تصميم المنتجات العظيمة؟"\n  });\n\n  console.log(response.content);\n}\n\nchat();`}
                  />
                </div>
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-bold text-muted mb-2">استجابة ناجحة (200 OK)</h4>
                <CodeBlock 
                  id="res-chat"
                  language="json"
                  code={`{\n  "id": "msg_893k2390a",\n  "persona_id": "steve_jobs",\n  "role": "model",\n  "content": "السر ليس فقط في المظهر، بل في كيفية عمله. يجب أن تفهم بعمق حاجة المستخدم وتزيل كل ما هو غير ضروري حتى تصل إلى الجوهر النقي.",\n  "created_at": 1718302910\n}`}
                />
              </div>
            </section>

            <section id="manage-sessions" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                  <BookOpen size={24} />
                </div>
                <h2 className="text-2xl font-bold">إدارة الجلسات برمجياً</h2>
              </div>
              <p className="text-muted leading-relaxed mb-4">
                إنشاء جلسة محادثة لحفظ سياق الحديث مع الشخصية. يمكن استرجاع الجلسة لاحقاً للبناء عليها.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-blue-500/20 text-blue-500 text-xs font-bold px-2 py-1 rounded uppercase">POST</span>
                <code className="text-sm font-mono text-muted">/v1/sessions</code>
              </div>
              <CodeBlock 
                id="req-session"
                language="json"
                code={`{\n  "title": "نقاش حول مستقبل الحوسبة",\n  "persona_ids": ["steve_jobs", "alan_turing"],\n  "session_type": "debate"\n}`}
              />
              <div className="mt-4">
                <h4 className="text-sm font-bold text-muted mb-2">استجابة الجلسة الجديدة</h4>
                <CodeBlock 
                  id="res-session"
                  language="json"
                  code={`{\n  "session_id": "sess_x89j2ll2",\n  "status": "created",\n  "participants": ["steve_jobs", "alan_turing"],\n  "url": "https://api.mindmirror.ai/v1/sessions/sess_x89j2ll2"\n}`}
                />
              </div>
            </section>

            <section id="debates-api" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <Terminal size={24} />
                </div>
                <h2 className="text-2xl font-bold">المناظرات الفكرية الذكية (Debates API)</h2>
              </div>
              <p className="text-muted leading-relaxed mb-4">
                إطلاق مناظرة تفاعلية حية بين شخصيتين أو أكثر حول موضوع فكري أو علمي مع تحديد عدد الجولات ومستوى التباين الفكري.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-amber-500/20 text-amber-500 text-xs font-bold px-2 py-1 rounded uppercase">POST</span>
                <code className="text-sm font-mono text-muted">/v1/debates</code>
              </div>
              <CodeBlock 
                id="req-debate"
                language="json"
                code={`{\n  "topic": "هل البساطة أم المعادلات المجردة هما جوهر الفهم الكوني؟",\n  "participants": ["steve_jobs", "einstein"],\n  "rounds": 2\n}`}
              />
              <div className="mt-4">
                <h4 className="text-sm font-bold text-muted mb-2">استجابة المناظرة (200 OK)</h4>
                <CodeBlock 
                  id="res-debate"
                  language="json"
                  code={`{\n  "id": "debate_991823a",\n  "topic": "البساطة أم المعادلات المجردة؟",\n  "status": "200_ok",\n  "rounds": [\n    {\n      "speaker_id": "steve_jobs",\n      "speaker_name": "ستيف جوبز",\n      "argument": "البساطة هي نهاية المطاف في التعقيد..."\n    },\n    {\n      "speaker_id": "einstein",\n      "speaker_name": "ألبيرت أينشتاين",\n      "argument": "لكن قوانين الطبيعة المنسوجة بالرياضيات هي الجمال الخالص..."\n    }\n  ]\n}`}
                />
              </div>
            </section>

            <section id="symposiums-api" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                  <Send size={24} />
                </div>
                <h2 className="text-2xl font-bold">الندوات وسؤال المجموعات (Symposiums API)</h2>
              </div>
              <p className="text-muted leading-relaxed mb-4">
                طرح سؤال موجه لندوة فكرية كاملة (عدة شخصيات تاريخية أو علمية) للرد التكاملي أو التحليلي بضربة API واحدة.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-purple-500/20 text-purple-500 text-xs font-bold px-2 py-1 rounded uppercase">POST</span>
                <code className="text-sm font-mono text-muted">/v1/symposiums</code>
              </div>
              <CodeBlock 
                id="req-symposium"
                language="json"
                code={`{\n  "question": "كيف تشكل التكنولوجيا الحيوية والذكاء الاصطناعي مستقبل العمران البشري؟",\n  "participants": ["steve_jobs", "turing", "khaldun"],\n  "style": "cooperative"\n}`}
              />
              <div className="mt-4">
                <h4 className="text-sm font-bold text-muted mb-2">استجابة الندوة الجماعية (200 OK)</h4>
                <CodeBlock 
                  id="res-symposium"
                  language="json"
                  code={`{\n  "id": "symp_772183b",\n  "question": "كيف تشكل التكنولوجيا مستقبل العمران؟",\n  "status": "200_ok",\n  "responses": [\n    { "speaker_id": "steve_jobs", "contribution": "تمكين الأفراد بإدراك أعمق..." },\n    { "speaker_id": "turing", "contribution": "معالجة الأنماط المعقدة وتوسيع الوعي..." },\n    { "speaker_id": "khaldun", "contribution": "إعادة هيكلة الاقتصاد والعصبية الاجتماعية..." }\n  ]\n}`}
                />
              </div>
            </section>

            <section id="pwa-deployment" className="scroll-mt-24 border-t border-border pt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Box size={24} />
                </div>
                <h2 className="text-2xl font-bold">تثبيت PWA والنشر على السيرفرات الخارجية (Deployment & PWA)</h2>
              </div>
              <p className="text-muted leading-relaxed mb-4">
                المنصة مجهزة للعمل المستقل خارج بيئة التطوير مع إمكانية التثبيت الفوري كـ Progressive Web App (PWA) عبر الرابط المباشر، وتدعم خيارات النشر السحابي عالية التوافر (Docker، Nginx، PM2).
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-text mb-2">1. الرابط المباشر لتثبيت التطبيق (PWA Direct Link)</h3>
                  <p className="text-sm text-muted mb-2 leading-relaxed">
                    لتثبيت التطبيق مباشرة في متصفحات Chrome وEdge وSafari دون قيود الإطارات المضمنة، استخدم الرابط المباشر المرفق مع اللاحقة:
                  </p>
                  <CodeBlock 
                    id="pwa-direct-link"
                    language="bash"
                    code="https://yourdomain.com/?pwa=install"
                  />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-text mb-2">2. النشر السريع عبر سكربت الباش الموحد (deploy.sh)</h3>
                  <p className="text-sm text-muted mb-2 leading-relaxed">
                    يقوم السكربت تلقائياً بجلب التحديثات، إنشاء أيقونات PWA، بناء الحزمة، إعادة تشغيل الخادم والتحقق من نقطة الصحة:
                  </p>
                  <CodeBlock 
                    id="deploy-sh-cmd"
                    language="bash"
                    code={`chmod +x deploy.sh\n./deploy.sh`}
                  />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-text mb-2">3. النشر عبر حاويات Docker وDocker Compose</h3>
                  <CodeBlock 
                    id="docker-cmd-guide"
                    language="bash"
                    code={`# بناء وتشغيل الحاوية في الخلفية\ndocker-compose up -d --build\n\n# فحص سجلات الخادم\ndocker logs -f rmx-mindmirror-v2ag`}
                  />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-text mb-2">4. نقطة فحص الصحة ومراقبة السيرفر (Health Endpoint)</h3>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded uppercase">GET</span>
                    <code className="text-sm font-mono text-muted">/api/health</code>
                  </div>
                  <CodeBlock 
                    id="health-response"
                    language="json"
                    code={`{\n  "status": "healthy",\n  "service": "RMX Live MindMirror V2Ag",\n  "version": "2.5.0-prod",\n  "environment": "production",\n  "uptimeSeconds": 1420,\n  "timestamp": "2026-11-01T21:00:00.000Z",\n  "pwa": {\n    "active": true,\n    "manifest": "/manifest.json",\n    "serviceWorker": "/sw.js"\n  }\n}`}
                  />
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
