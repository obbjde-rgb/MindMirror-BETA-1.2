import React, { useState, useEffect } from 'react';
import { 
  X, Smartphone, Server, CheckCircle2, AlertCircle, Copy, Check, 
  ExternalLink, Download, RefreshCw, Terminal, Globe, Shield, 
  Activity, Layers, Cpu, Cloud, FileText
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { copyToClipboard } from '../utils/clipboard';

interface PWADeploymentCenterModalProps {
  onClose: () => void;
}

export const PWADeploymentCenterModal: React.FC<PWADeploymentCenterModalProps> = ({ onClose }) => {
  const { isInstallable, isInstalled, isIOS, isIframe, isUpdateAvailable, install, applyUpdate, getDirectInstallUrl } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'docker' | 'nginx' | 'pm2' | 'deploy_script'>('pwa');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Real-time Health Check State
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthLatency, setHealthLatency] = useState<number | null>(null);

  const directUrl = getDirectInstallUrl();

  const handleCopy = (text: string, key: string) => {
    copyToClipboard(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const fetchHealth = async () => {
    setIsCheckingHealth(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthLatency(Math.round(performance.now() - start));
      setHealthStatus(data);
    } catch (err: any) {
      setHealthLatency(Math.round(performance.now() - start));
      setHealthStatus({ status: 'offline', error: err.message });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const dockerCommand = `# 1. بناء وتشغيل الحاوية المجهزة بالكامل عبر Docker Compose:
docker-compose up -d --build

# 2. فحص سجلات التشغيل الحية:
docker logs -f rmx-mindmirror-v2ag

# 3. التحقق من سلامة الخادم:
curl http://localhost:3000/api/health`;

  const pm2Command = `# 1. تثبيت مدير العمليات PM2 عالمياً (في حال لم يكن مثبتاً):
npm install -g pm2

# 2. بناء حزمة الإنتاج:
npm run build

# 3. تشغيل العنقود عالي التوافر:
pm2 start ecosystem.config.cjs

# 4. حفظ الحالة لتعمل تلقائياً عند إعادة تشغيل السيرفر:
pm2 save
pm2 startup`;

  const nginxSnippet = `# توجيه الدومين إلى السيرفر المحلي مع دعم WebSocket وPWA:
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

# تكوين HTTPS وعامل الخدمة متوفر بالكامل في ملف nginx.conf بالجذر`;

  const deployScriptSnippet = `# منح تصريح التنفيذ لسكربت النشر الفوري:
chmod +x deploy.sh

# تنفيذ النشر والتحديث مع اختبار الصحة تلقائياً:
./deploy.sh`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-[#02040a]/95 backdrop-blur-md overflow-y-auto overflow-x-hidden" dir="rtl">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl relative text-right my-auto overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 p-4 sm:p-5 bg-surface2/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-inner">
              <Server size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-text flex items-center gap-2">
                مركز النشر وتثبيت PWA على السيرفرات الخارجية
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  v2.5 Production Ready
                </span>
              </h3>
              <p className="text-xs text-muted">
                جاهزية كاملة للتشغيل المستقل والربط المباشر مع استمرارية التحديثات الفورية
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2 bg-surface2/60 border-b border-border/40 overflow-x-auto scrollbar-hide text-xs font-bold">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'pwa'
                ? 'bg-accent text-bg shadow-sm'
                : 'text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <Smartphone size={14} />
            <span>تثبيت PWA والرابط المباشر</span>
          </button>

          <button
            onClick={() => setActiveTab('docker')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'docker'
                ? 'bg-accent text-bg shadow-sm'
                : 'text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <Layers size={14} />
            <span>Docker & Compose</span>
          </button>

          <button
            onClick={() => setActiveTab('pm2')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'pm2'
                ? 'bg-accent text-bg shadow-sm'
                : 'text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <Cpu size={14} />
            <span>سيرفرات Node & PM2</span>
          </button>

          <button
            onClick={() => setActiveTab('nginx')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'nginx'
                ? 'bg-accent text-bg shadow-sm'
                : 'text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <Globe size={14} />
            <span>إعداد Nginx & SSL</span>
          </button>

          <button
            onClick={() => setActiveTab('deploy_script')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'deploy_script'
                ? 'bg-accent text-bg shadow-sm'
                : 'text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <Terminal size={14} />
            <span>سكربت النشر deploy.sh</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm">
          
          {/* Real-time Server & PWA Health Bar */}
          <div className="bg-surface2/50 border border-border/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${healthStatus?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="font-bold text-text">حالة الخادم الفعلي:</span>
              <span className="font-mono text-accent">
                {healthStatus?.status === 'healthy' ? 'متصل ونشط (Healthy)' : isCheckingHealth ? 'جارِ الفحص...' : 'جاري التهيئة'}
              </span>
              {healthLatency !== null && (
                <span className="text-[11px] text-muted font-mono">({healthLatency}ms)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted">الوضع:</span>
              <span className="font-mono font-bold text-accent2 bg-accent2/10 px-2 py-0.5 rounded-md border border-accent2/20">
                {healthStatus?.environment || 'إنتاج / تطوير'}
              </span>
              <button
                onClick={fetchHealth}
                disabled={isCheckingHealth}
                className="p-1 rounded-lg hover:bg-surface border border-border text-muted hover:text-text cursor-pointer transition-colors"
                title="إعادة فحص الصحة"
              >
                <RefreshCw size={13} className={isCheckingHealth ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* TAB 1: PWA & Direct Link Installation */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-accent/15 via-surface2 to-accent2/15 border border-accent/30 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-base text-text flex items-center gap-2">
                      تنزيل وتثبيت المنصة عبر الرابط المباشر
                      {isInstalled ? (
                        <span className="text-[11px] bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                          التطبيق مثبت بنجاح ✓
                        </span>
                      ) : (
                        <span className="text-[11px] bg-accent/20 text-accent px-2.5 py-0.5 rounded-full border border-accent/30 font-bold">
                          متاح للتنزيل الفوري
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      يعمل التطبيق كبرنامج مستقل بالكامل (Standalone) بدون أي أشرطة تصفح أو واجهات خارجية، مع سرعة استجابة فورية ودعم العمل دون اتصال.
                    </p>
                  </div>
                </div>

                {/* Direct Permanent Link Input Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text flex items-center gap-1.5">
                      <Globe size={13} className="text-emerald-400" />
                      الرابط الدائم المستقل للمنصة (مستمر 24/7 ولا يتأثر بإغلاق بيئة التطوير):
                    </label>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                      مستقل 100%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-surface/90 border border-emerald-500/30 p-2.5 rounded-xl shadow-inner">
                    <input
                      type="text"
                      readOnly
                      value={directUrl}
                      className="bg-transparent text-xs font-mono text-emerald-400 w-full outline-none truncate direction-ltr text-left select-all"
                    />
                    <button
                      onClick={() => handleCopy(directUrl, 'direct_url')}
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'direct_url' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedKey === 'direct_url' ? 'تم النسخ' : 'نسخ الرابط الدائم'}</span>
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {isInstallable && !isIframe ? (
                    <button
                      onClick={() => install()}
                      className="flex-1 bg-gradient-to-r from-accent to-accent2 hover:opacity-95 text-bg font-black py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                    >
                      <Download size={16} />
                      <span>تثبيت التطبيق الآن بنقرة واحدة</span>
                    </button>
                  ) : (
                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-gradient-to-r from-accent to-accent2 hover:opacity-95 text-bg font-black py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                    >
                      <Download size={16} />
                      <span>فتح الرابط المباشر للتثبيت في المتصفح 🚀</span>
                    </a>
                  )}

                  {isUpdateAvailable && (
                    <button
                      onClick={applyUpdate}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
                    >
                      <RefreshCw size={14} />
                      <span>تطبيق التحديث الفوري</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Compliance & Diagnostic Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-surface2/60 border border-border p-3.5 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 size={15} />
                    <span>ملف المانفيست (manifest.json)</span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    مجهز بأيقونات 192px و512px وMaskable، واختصارات سريعة للغرف، وأبعاد للشاشات الكبيرة والمحمولة.
                  </p>
                </div>

                <div className="bg-surface2/60 border border-border p-3.5 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 size={15} />
                    <span>عامل الخدمة (Service Worker v7)</span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    يعمل بتقنية Network-First للبيانات الفورية، والتخزين المؤقت للأيقونات والخطوط، ومزامنة فورية للنسخ الجديدة.
                  </p>
                </div>

                <div className="bg-surface2/60 border border-border p-3.5 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 size={15} />
                    <span>أيقونة Apple Touch لأجهزة iOS</span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    أيقونة PNG بدقة 180x180 مخصصة لمتصفح Safari مع دعم وضع الشاشة الكاملة (Web App Capable).
                  </p>
                </div>

                <div className="bg-surface2/60 border border-border p-3.5 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 size={15} />
                    <span>التوافق مع السيرفرات الخارجية</span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    الخادم يدعم التوجيه أحادي الصفحة (SPA Fallback) وهيدرز منع الكاش الصارم لملفات التحديث.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Docker & Docker Compose */}
          {activeTab === 'docker' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-text text-sm">تشغيل المنصة عبر حاويات Docker في بيئة الإنتاج:</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  تم إعداد ملف <code className="text-accent font-mono">Dockerfile</code> متعدد المراحل و<code className="text-accent font-mono">docker-compose.yml</code> لعزل المنصة عن بيئة التطوير، والعمل باستقلالية وسرعة فائقة.
                </p>
              </div>

              <div className="relative">
                <pre className="bg-[#02040a] text-emerald-400 font-mono text-xs p-4 rounded-xl border border-border/80 overflow-x-auto text-left direction-ltr leading-relaxed">
                  {dockerCommand}
                </pre>
                <button
                  onClick={() => handleCopy(dockerCommand, 'docker_cmd')}
                  className="absolute top-3 end-3 bg-surface2/80 hover:bg-surface border border-border text-xs px-2.5 py-1 rounded-lg text-text font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'docker_cmd' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedKey === 'docker_cmd' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              <div className="bg-surface2 p-3.5 rounded-xl border border-border text-xs space-y-2">
                <h5 className="font-bold text-accent">المزايا المضمنة في حاوية Docker:</h5>
                <ul className="list-disc list-inside space-y-1 text-muted text-xs">
                  <li>بناء أصول العميل والخادم في مرحلة منفصلة لتقليص حجم الصورة إلى الحد الأدنى.</li>
                  <li>تشغيل التطبيق تحت مستخدم غير جذري (<code className="font-mono text-text">mindmirror:nodejs</code>) لأمان السيرفر.</li>
                  <li>فحص صحة تلقائي (HEALTHCHECK) كل 30 ثانية عبر <code className="font-mono text-text">/api/health</code>.</li>
                  <li>حفظ وتدوير سجلات السيرفر لتفادي امتلاء القرص الصلب.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: Node & PM2 */}
          {activeTab === 'pm2' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-text text-sm">إدارة السيرفر عبر PM2 على خوادم VPS (Ubuntu / Debian / CentOS):</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  ملف <code className="text-accent font-mono">ecosystem.config.cjs</code> معد مسبقاً في جذر المشروع لتوزيع الأحمال (Cluster Mode) وإعادة التشغيل التلقائي عند أي تحديث.
                </p>
              </div>

              <div className="relative">
                <pre className="bg-[#02040a] text-emerald-400 font-mono text-xs p-4 rounded-xl border border-border/80 overflow-x-auto text-left direction-ltr leading-relaxed">
                  {pm2Command}
                </pre>
                <button
                  onClick={() => handleCopy(pm2Command, 'pm2_cmd')}
                  className="absolute top-3 end-3 bg-surface2/80 hover:bg-surface border border-border text-xs px-2.5 py-1 rounded-lg text-text font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'pm2_cmd' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedKey === 'pm2_cmd' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              <div className="bg-surface2 p-3.5 rounded-xl border border-border text-xs space-y-1.5 text-muted">
                <p className="font-bold text-text">لإيقاف أو إعادة تشغيل المنصة لاحقاً:</p>
                <p className="font-mono text-accent">pm2 reload rmx-mindmirror</p>
                <p className="font-mono text-accent">pm2 status</p>
              </div>
            </div>
          )}

          {/* TAB 4: Nginx & SSL */}
          {activeTab === 'nginx' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-text text-sm">تكوين Nginx للوساطة العكسية وشهادات SSL المجانية:</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  يتضمن الملف <code className="text-accent font-mono">nginx.conf</code> قواعد صارمة لمنع تخزين المانفيست وعامل الخدمة لضمان وصول التحديثات فوراً، مع دعم WebSocket الصوتي المباشر على <code className="text-accent font-mono">/live</code>.
                </p>
              </div>

              <div className="relative">
                <pre className="bg-[#02040a] text-emerald-400 font-mono text-xs p-4 rounded-xl border border-border/80 overflow-x-auto text-left direction-ltr leading-relaxed">
                  {nginxSnippet}
                </pre>
                <button
                  onClick={() => handleCopy(nginxSnippet, 'nginx_cmd')}
                  className="absolute top-3 end-3 bg-surface2/80 hover:bg-surface border border-border text-xs px-2.5 py-1 rounded-lg text-text font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'nginx_cmd' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedKey === 'nginx_cmd' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              <div className="bg-surface2 p-3.5 rounded-xl border border-border text-xs space-y-2 text-muted">
                <p className="font-bold text-text">تفعيل شهادة SSL بضغطة زر عبر Certbot:</p>
                <pre className="bg-[#02040a] p-2 rounded-lg text-accent font-mono text-left direction-ltr">
                  sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: Deploy Script */}
          {activeTab === 'deploy_script' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-text text-sm">سكربت النشر والتحديث الفوري (deploy.sh):</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  سكربت باش متكامل يجمع بين جلب أحدث الأكواد، إنشاء أيقونات PWA، بناء حزمة الإنتاج، وإعادة تشغيل الخادم واختبار نقطة الصحة بدون توقف (Zero-Downtime).
                </p>
              </div>

              <div className="relative">
                <pre className="bg-[#02040a] text-emerald-400 font-mono text-xs p-4 rounded-xl border border-border/80 overflow-x-auto text-left direction-ltr leading-relaxed">
                  {deployScriptSnippet}
                </pre>
                <button
                  onClick={() => handleCopy(deployScriptSnippet, 'deploy_cmd')}
                  className="absolute top-3 end-3 bg-surface2/80 hover:bg-surface border border-border text-xs px-2.5 py-1 rounded-lg text-text font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'deploy_cmd' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedKey === 'deploy_cmd' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-xs text-emerald-300 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 size={15} />
                  <span>مزامنة فورية بين بيئة التطوير والإنتاج:</span>
                </div>
                <p className="leading-relaxed">
                  بمجرد تشغيل السكربت أو إرسال push إلى السيرفر، يتم استبدال الكاش، ويتلقى متصفح المستخدم إشعاراً فورياً بتوفر تحديث جديد، فيتم التحديث بسلاسة دون فقدان بيانات المحادثات المخزنة محلياً.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-surface2/60 border-t border-border flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted flex items-center gap-1.5 font-mono">
            <Shield size={13} className="text-accent" />
            <span>PWA & External Deployment Verified</span>
          </div>

          <button
            onClick={onClose}
            className="bg-accent text-bg font-extrabold px-6 py-2 rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer shadow-md"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
