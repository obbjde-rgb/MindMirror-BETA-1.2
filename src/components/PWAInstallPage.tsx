import React from 'react';
import { motion } from 'motion/react';
import { PWAInstallButton } from './PWAInstallButton';
import { Smartphone, Download, ShieldCheck, Zap, Globe, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PWAInstallPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden" dir="rtl">
      {/* Background patterns */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center">
        {/* Header Navigation */}
        <div className="w-full flex justify-start mb-12">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group px-4 py-2 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-bold">العودة للمنصة</span>
          </button>
        </div>

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 mb-16"
        >
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-4 shadow-xl shadow-blue-900/20">
            <Smartphone size={48} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
            ثبّت <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">MindMirror</span> <br />
            كـتطبيق ذكي على جهازك
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            استمتع بتجربة أسرع، أكثر سلاسة، وبدون أشرطة المتصفح المزعجة. احصل على إمكانية الوصول الفوري من شاشتك الرئيسية مباشرة.
          </p>
        </motion.div>

        {/* Call to Action Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-[32px] p-8 md:p-12 mb-16 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full" />
          
          <div className="flex flex-col items-center text-center space-y-8 relative z-10">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">تثبيت فوري بضغطة زر</h2>
              <p className="text-slate-400">يدعم أجهزة Android و iOS و Windows و Mac</p>
            </div>
            
            <div className="w-full max-w-md scale-110 md:scale-125 py-4">
              <PWAInstallButton variant="default" />
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>آمن 100%</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>أداء فائق السرعة</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                <span>يعمل بدون إنترنت</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Instructions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-20">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/60 flex flex-col gap-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Download size={24} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white">لمستخدمي Android / Chrome</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                اضغط على زر التثبيت أعلاه، أو افتح قائمة المتصفح (النقاط الثلاث) واختر "تثبيت التطبيق". سيظهر لك التطبيق فوراً في درج التطبيقات.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/60 flex flex-col gap-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Smartphone size={24} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white">لمستخدمي iOS / Safari</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                اضغط على زر "تثبيت على iOS" أعلاه، أو اضغط على أيقونة "المشاركة" في شريط أدوات Safari، ثم اختر "Add to Home Screen".
              </p>
            </div>
          </motion.div>
        </div>

        {/* Footer info */}
        <footer className="w-full text-center py-12 border-t border-slate-800/60 opacity-60">
          <p className="text-xs text-slate-500 font-mono tracking-widest">
            RMX MINDMIRROR V2AG • PROGRESSIVE WEB APP • PRODUCTION BUILD V13
          </p>
        </footer>
      </main>
    </div>
  );
};

export default PWAInstallPage;
