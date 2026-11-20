/**
 * @license
 * MindMirror Quantum Edition - 2026
 * Revolutionary AI Persona Engine - V2
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, Cpu, Zap, Shield, Globe, Terminal, Play, Settings, Share2, Layers } from 'lucide-react';

export default function AppQuantum() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100 font-sans selection:bg-purple-500/30 overflow-x-hidden" dir="rtl">
      {/* Dynamic Quantum Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
      </div>

      {/* Futuristic Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-amber-500 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                MINDMIRROR <span className="text-amber-400">QUANTUM</span>
              </h1>
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">Neural Engine V2.0</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            {['النظام', 'العقول', 'الأداء', 'الوثائق'].map((item, idx) => (
              <a key={idx} href="#" className="hover:text-amber-400 transition-colors">{item}</a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white transition-colors">
              <Settings size={20} />
            </button>
            <button className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 rounded-lg text-xs font-bold shadow-lg shadow-purple-600/20 hover:scale-105 transition-transform active:scale-95">
              تسجيل الدخول
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">
              <Sparkles size={14} />
              <span>إصدار كوانتم الجديد 2026</span>
            </div>
            
            <h2 className="text-6xl md:text-7xl font-black leading-[1.1] tracking-tight">
              اعكس <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-amber-400">ذكاءك</span> <br /> 
              في بعدٍ كوانتي جديد
            </h2>
            
            <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
              الجيل القادم من محركات الشخصيات الذكية. MindMirror Quantum يوفر سرعة معالجة تفوق الخيال مع دقة شعورية تصل إلى 99.9%.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <button className="bg-amber-400 text-black px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-amber-300 transition-all shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                <Play size={18} fill="currentColor" />
                ابدأ التجربة الحية
              </button>
              <button className="px-8 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all text-sm font-bold flex items-center gap-3">
                <Terminal size={18} />
                عرض الأكواد المصدرية
              </button>
            </div>

            <div className="flex items-center gap-8 pt-8 grayscale opacity-50">
              <Cpu size={32} />
              <Layers size={32} />
              <Shield size={32} />
              <Globe size={32} />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            {/* Main Visual Asset */}
            <div className="relative z-10 w-full aspect-square rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
              <img 
                src="/icon-quantum.jpg" 
                alt="Quantum Brain" 
                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#02040a] via-transparent to-transparent"></div>
              
              <div className="absolute bottom-8 right-8 left-8 p-6 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Core Status</p>
                    <h4 className="text-lg font-bold">Neural Coherence: 100%</h4>
                  </div>
                  <Zap className="text-amber-400 animate-bounce" />
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-500/20 blur-[60px] rounded-full"></div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/20 blur-[60px] rounded-full"></div>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <section className="mt-40 grid md:grid-cols-3 gap-8">
          {[
            { title: 'التزامن العصبي', desc: 'ربط لحظي بين مدخلات المستخدم واستجابة الشخصية بأقل من 5ms.', icon: Zap, color: 'text-amber-400' },
            { title: 'تشفير الكوانتم', desc: 'بياناتك وخصوصيتك محمية بأقوى بروتوكولات التشفير المستقبلية.', icon: Shield, color: 'text-purple-400' },
            { title: 'الانتشار العالمي', desc: 'خوادم موزعة في 60 منطقة زمنية لضمان استجابة عالمية فائقة.', icon: Globe, color: 'text-blue-400' },
          ].map((feature, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -10 }}
              className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all space-y-4"
            >
              <feature.icon className={`w-8 h-8 ${feature.color}`} />
              <h3 className="text-xl font-bold">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-slate-500 text-xs">
        <p>© 2026 MindMirror Quantum Edition. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  );
}
