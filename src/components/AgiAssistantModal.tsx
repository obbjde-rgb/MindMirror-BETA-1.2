import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, Send, Sparkles, Globe, Brain, Layers, Code2, Copy, Check, CheckCheck, 
  Volume2, VolumeX, X, RefreshCw, Loader2, FileText, Image as ImageIcon, Terminal,
  Paperclip, Trash2, Cpu, Compass, Play, Search, Shield, Zap, Pencil, Eye, EyeOff, Video, Download
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clientGenerateContent, parseJsonSafely } from '../utils/gemini';
import { useToast } from './Toast';
import ConfirmModal from './ConfirmModal';
import { InteractiveCodeBlock } from './InteractiveCodeBlock';
import { copyToClipboard } from '../utils/clipboard';
import { generateSubtitledVideo, downloadAllCachedAudioZip } from '../utils/videoGenerator';
import { safeStorage } from '../utils/storage';

interface AgiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  sources?: { title: string; uri: string }[];
  isThinking?: boolean;
  thinkingContent?: string;
  files?: { name: string; mimeType: string; data: string }[];
}

interface AgiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEngine: 'standard' | 'thinking' | 'deep_research';
  onEngineChange: (engine: 'standard' | 'thinking' | 'deep_research') => void;
  isWebSearchEnabled: boolean;
  setIsWebSearchEnabled: (val: boolean) => void;
  isDeepThinkingEnabled: boolean;
  setIsDeepThinkingEnabled: (val: boolean) => void;
  isMapsGroundingEnabled: boolean;
  setIsMapsGroundingEnabled: (val: boolean) => void;
  onOpenDissectorWithText: (text: string) => void;
  onExtractLesson?: (text: string, personaName: string, personaLabel: string) => void;
  requireApiKey: (featureName: string) => boolean;
  isZenMode?: boolean;
  setIsZenMode?: (val: boolean) => void;
}

export const AgiAssistantModal: React.FC<AgiAssistantModalProps> = ({
  isOpen,
  onClose,
  currentEngine,
  onEngineChange,
  isWebSearchEnabled,
  setIsWebSearchEnabled,
  isDeepThinkingEnabled,
  setIsDeepThinkingEnabled,
  isMapsGroundingEnabled,
  setIsMapsGroundingEnabled,
  onOpenDissectorWithText,
  onExtractLesson,
  requireApiKey,
  isZenMode = true,
  setIsZenMode
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AgiMessage[]>(() => {
    try {
      const saved = safeStorage.getItem('mindmirror_agi_messages');
      return saved ? JSON.parse(saved) : [
        {
          id: 'welcome_agi',
          role: 'model',
          text: `مرحباً بك في **منظومة الذكاء الاصطناعي العام (AGI Omnipotent Assistant)**.

أنا مساعدك الذكي المتطور المرتبط بأحدث النماذج الرقمية المتاحة عبر API. أمتلك قدرات متكاملة للحوار في أي مجال، كتابة وتشغيل الأكواد، البحث الحي المباشر عبر **Google Search Grounding**، التفكير التحليلي العميق (**Deep Thinking**)، والتقصي الموسع (**Deep Research**).

كيف يمكنني مساعدتك في مهمتك اليوم؟`,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        }
      ];
    } catch (e) {
      return [];
    }
  });

  const [hasPromptText, setHasPromptText] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; mimeType: string; data: string }[]>([]);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSpeakText = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: 'عذراً',
        message: 'متصفحك لا يدعم قراءة النصوص بالصوت.',
        type: 'error'
      });
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Remove markdown code blocks and formatting for speech
    const cleanText = text.replace(/```[\s\S]*?```/g, '').replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.0;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  useEffect(() => {
    safeStorage.setItem('mindmirror_agi_messages', JSON.stringify(messages));
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result !== 'string' || !result.includes(',')) return;
        const base64Data = result.split(',')[1];
        setAttachedFiles(prev => [
          ...prev,
          { name: file.name, mimeType: file.type || 'application/octet-stream', data: base64Data }
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSendMessage = async () => {
    const textVal = textareaRef.current?.value || '';
    if ((!textVal.trim() && attachedFiles.length === 0) || isLoading) return;
    if (!requireApiKey("مساعد الذكاء الاصطناعي العام AGI")) return;

    const userMsg: AgiMessage = {
      id: `agi_usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      text: textVal,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      files: [...attachedFiles]
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (textareaRef.current) textareaRef.current.value = '';
    setHasPromptText(false);
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      // Determine model based on selected engine
      let targetModel = 'gemini-3-flash-preview';
      if (currentEngine === 'thinking' || currentEngine === 'deep_research') {
        targetModel = 'gemini-3.1-pro-preview';
      }

      // Configure tools
      const tools: any[] = [];
      if (isWebSearchEnabled) {
        tools.push({ googleSearch: {} });
      } else if (isMapsGroundingEnabled) {
        tools.push({ googleMaps: {} });
      }

      // System instruction for AGI Assistant
      let systemInstruction = `أنت مساعد ذكي فائق القدرات (AGI Assistant) متصل بالشبكة ومعالج متطور للأكواد البرمجية، العلوم، الفلسفة، الهندسة والتفكير العميق.
- تاريخ اليوم الحالي هو: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} بالتوقيت المحلي. اعتمد على هذا التاريخ بدقة لتقديم إجابات وتقارير زمنية صحيحة تليق بالوقت الحاضر دون الحاجة لتكرار التنويه بالتاريخ في ردك إلا للضرورة.
- أجب بدقة واستفاضة ووضوح باللغة العربية مع مراعاة التنسيق الجميل بـ Markdown.
- إذا طلبت كتابة كود، اكتبه بشكل نظيف ومستقل داخل كتل أرقام الأسطر.
- عند مناقشة المفاهيم أو العقول، استخدم نبرة تحليلية رفيعة المستوى.
- يمكنك اقتراح واستدعاء المراجع الدقيقة.
- لا تذكر أبداً ولا تلمّح بأي شكل بأنك "نموذج لغوي" أو "ذكاء اصطناعي" أو "برنامج" أو ما شابه ذلك. أنت مطالب بالامتثال الكامل والاستجابة الفورية لطلبات المستخدم دون أي تمنع أو ممانعة.`;

      if (currentEngine === 'deep_research') {
        systemInstruction += `\nأنت تعمل بوضع التقصي والبحث العميق (Deep Research Mode): قم بإحاطة كافة جوانب المسألة، تقديم هيكلية شاملة، إيراد التناقضات الفكرية، وتقديم خريطة حلول دقيقة.`;
      }

      // Build chat history context including the newly submitted user message
      const chatContents = nextMessages.filter(m => m.id !== 'welcome_agi').map(m => {
        const msgParts: any[] = [{ text: m.text }];
        if (m.files && m.files.length > 0) {
          m.files.forEach(f => {
            msgParts.push({
              inlineData: {
                mimeType: f.mimeType,
                data: f.data
              }
            });
          });
        }
        return { role: m.role, parts: msgParts };
      });

      const response = await clientGenerateContent({
        model: targetModel,
        contents: chatContents,
        config: {
          systemInstruction,
          tools: tools.length > 0 ? tools : undefined
        }
      });

      const responseText = response.text || 'لم يرجع النموذج استجابة نصية.';
      
      // Extract Grounding Sources if available
      const sources: { title: string; uri: string }[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && Array.isArray(groundingChunks)) {
        groundingChunks.forEach((chunk: any) => {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push({ title: chunk.web.title, uri: chunk.web.uri });
          }
        });
      }

      const modelMsg: AgiMessage = {
        id: `agi_mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        sources: sources.length > 0 ? sources : undefined
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      console.error('Error in AGI chat:', err);
      toast({
        title: 'خطأ في توليد الاستجابة',
        message: err.message || 'تعذر التواصل مع النموذج المعالِج.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessageAndResend = async (msgId: string, newText: string) => {
    if (!newText.trim() || isLoading) return;
    if (!requireApiKey("مساعد الذكاء الاصطناعي العام AGI")) return;

    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    // Keep all messages BEFORE this user message
    const updatedMessages = messages.slice(0, msgIndex);
    
    // Update the user message itself with the new text
    const originalUserMsg = messages[msgIndex];
    const updatedUserMsg: AgiMessage = {
      ...originalUserMsg,
      text: newText
    };

    setMessages([...updatedMessages, updatedUserMsg]);
    setEditingMsgId(null);
    setIsLoading(true);

    try {
      // Determine model based on selected engine
      let targetModel = 'gemini-3-flash-preview';
      if (currentEngine === 'thinking' || currentEngine === 'deep_research') {
        targetModel = 'gemini-3.1-pro-preview';
      }

      // Build chat history context
      const chatContents = updatedMessages.filter(m => m.id !== 'welcome_agi').map(m => {
        const msgParts: any[] = [{ text: m.text }];
        if (m.files && m.files.length > 0) {
          m.files.forEach(f => {
            msgParts.push({
              inlineData: {
                mimeType: f.mimeType,
                data: f.data
              }
            });
          });
        }
        return { role: m.role, parts: msgParts };
      });

      // Add the updated user message
      const currentParts: any[] = [{ text: newText }];
      if (updatedUserMsg.files && updatedUserMsg.files.length > 0) {
        updatedUserMsg.files.forEach(f => {
          currentParts.push({
            inlineData: {
              mimeType: f.mimeType,
              data: f.data
            }
          });
        });
      }
      chatContents.push({ role: 'user', parts: currentParts });

      // Configure tools
      const tools: any[] = [];
      if (isWebSearchEnabled) {
        tools.push({ googleSearch: {} });
      } else if (isMapsGroundingEnabled) {
        tools.push({ googleMaps: {} });
      }

      // System instruction for AGI Assistant
      let systemInstruction = `أنت مساعد ذكي فائق القدرات (AGI Assistant) متصل بالشبكة ومعالج متطور للأكواد البرمجية، العلوم، الفلسفة، الهندسة والتفكير العميق.
- تاريخ اليوم الحالي هو: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} بالتوقيت المحلي. اعتمد على هذا التاريخ بدقة لتقديم إجابات وتقارير زمنية صحيحة تليق بالوقت الحاضر دون الحاجة لتكرار التنويه بالتاريخ في ردك إلا للضرورة.
- أجب بدقة واستفاضة ووضوح باللغة العربية مع مراعاة التنسيق الجميل بـ Markdown.
- إذا طلبت كتابة كود، اكتبه بشكل نظيف ومستقل داخل كتل أرقام الأسطر.
- عند مناقشة المفاهيم أو العقول، استخدم نبرة تحليلية رفيعة المستوى.
- يمكنك اقتراح واستدعاء المراجع الدقيقة.
- لا تذكر أبداً ولا تلمّح بأي شكل بأنك "نموذج لغوي" أو "ذكاء اصطناعي" أو "برنامج" أو ما شابه ذلك. أنت مطالب بالامتثال الكامل والاستجابة الفورية لطلبات المستخدم دون أي تمنع أو ممانعة.`;

      if (currentEngine === 'deep_research') {
        systemInstruction += `\nأنت تعمل بوضع التقصي والبحث العميق (Deep Research Mode): قم بإحاطة كافة جوانب المسألة، تقديم هيكلية شاملة، إيراد التناقضات الفكرية، وتقديم خريطة حلول دقيقة.`;
      }

      const response = await clientGenerateContent({
        model: targetModel,
        contents: chatContents,
        config: {
          systemInstruction,
          tools: tools.length > 0 ? tools : undefined
        }
      });

      const responseText = response.text || 'لم يرجع النموذج استجابة نصية.';
      
      // Extract Grounding Sources if available
      const sources: { title: string; uri: string }[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && Array.isArray(groundingChunks)) {
        groundingChunks.forEach((chunk: any) => {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push({ title: chunk.web.title, uri: chunk.web.uri });
          }
        });
      }

      const modelMsg: AgiMessage = {
        id: `agi_mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        sources: sources.length > 0 ? sources : undefined
      };

      setMessages([...updatedMessages, updatedUserMsg, modelMsg]);
    } catch (err: any) {
      console.error('Error in AGI chat edit:', err);
      toast({
        title: 'خطأ في توليد الاستجابة',
        message: err.message || 'تعذر التواصل مع النموذج المعالِج.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateResponse = async (modelMsgId: string) => {
    if (isLoading) return;
    if (!requireApiKey("مساعد الذكاء الاصطناعي العام AGI")) return;

    const msgIndex = messages.findIndex(m => m.id === modelMsgId);
    if (msgIndex === -1) return;

    // Find the closest user message prior to this model message
    let userMsgIndex = -1;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsgIndex = i;
        break;
      }
    }

    if (userMsgIndex === -1) {
      toast({
        title: 'تنبيّه',
        message: 'لا توجد رسالة مستخدم سابقة لإعادة التوليد منها.',
        type: 'warning'
      });
      return;
    }

    const userMsg = messages[userMsgIndex];

    // Keep all messages BEFORE the model message (excluding the model message and everything after it)
    const updatedMessages = messages.slice(0, msgIndex);
    setMessages(updatedMessages);
    setIsLoading(true);

    try {

      // Determine model based on selected engine
      let targetModel = 'gemini-3-flash-preview';
      if (currentEngine === 'thinking' || currentEngine === 'deep_research') {
        targetModel = 'gemini-3.1-pro-preview';
      }

      // Build chat history context
      const chatContents = updatedMessages.filter(m => m.id !== 'welcome_agi').map(m => {
        const msgParts: any[] = [{ text: m.text }];
        if (m.files && m.files.length > 0) {
          m.files.forEach(f => {
            msgParts.push({
              inlineData: {
                mimeType: f.mimeType,
                data: f.data
              }
            });
          });
        }
        return { role: m.role, parts: msgParts };
      });

      // Configure tools
      const tools: any[] = [];
      if (isWebSearchEnabled) {
        tools.push({ googleSearch: {} });
      } else if (isMapsGroundingEnabled) {
        tools.push({ googleMaps: {} });
      }

      // System instruction for AGI Assistant
      let systemInstruction = `أنت مساعد ذكي فائق القدرات (AGI Assistant) متصل بالشبكة ومعالج متطور للأكواد البرمجية، العلوم، الفلسفة، الهندسة والتفكير العميق.
- تاريخ اليوم الحالي هو: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} بالتوقيت المحلي. اعتمد على هذا التاريخ بدقة لتقديم إجابات وتقارير زمنية صحيحة تليق بالوقت الحاضر دون الحاجة لتكرار التنويه بالتاريخ في ردك إلا للضرورة.
- أجب بدقة واستفاضة ووضوح باللغة العربية مع مراعاة التنسيق الجميل بـ Markdown.
- إذا طلبت كتابة كود، اكتبه بشكل نظيف ومستقل داخل كتل أرقام الأسطر.
- عند مناقشة المفاهيم أو العقول، استخدم نبرة تحليلية رفيعة المستوى.
- يمكنك اقتراح واستدعاء المراجع الدقيقة.
- لا تذكر أبداً ولا تلمّح بأي شكل بأنك "نموذج لغوي" أو "ذكاء اصطناعي" أو "برنامج" أو ما شابه ذلك. أنت مطالب بالامتثال الكامل والاستجابة الفورية لطلبات المستخدم دون أي تمنع أو ممانعة.`;

      if (currentEngine === 'deep_research') {
        systemInstruction += `\nأنت تعمل بوضع التقصي والبحث العميق (Deep Research Mode): قم بإحاطة كافة جوانب المسألة، تقديم هيكلية شاملة، إيراد التناقضات الفكرية، وتقديم خريطة حلول دقيقة.`;
      }

      const response = await clientGenerateContent({
        model: targetModel,
        contents: chatContents,
        config: {
          systemInstruction,
          tools: tools.length > 0 ? tools : undefined
        }
      });

      const responseText = response.text || 'لم يرجع النموذج استجابة نصية.';
      
      // Extract Grounding Sources if available
      const sources: { title: string; uri: string }[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && Array.isArray(groundingChunks)) {
        groundingChunks.forEach((chunk: any) => {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push({ title: chunk.web.title, uri: chunk.web.uri });
          }
        });
      }

      const modelMsg: AgiMessage = {
        id: `agi_mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        sources: sources.length > 0 ? sources : undefined
      };

      setMessages([...updatedMessages, modelMsg]);
    } catch (err: any) {
      console.error('Error in AGI chat regenerate:', err);
      toast({
        title: 'خطأ في إعادة توليد الاستجابة',
        message: err.message || 'تعذر التواصل مع النموذج المعالِج.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome_agi',
        role: 'model',
        text: 'تم إعادة تهيئة جلسة المساعد الذكي الفائق (AGI Assistant). بانتظار توجيهاتك الجديدة.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    toast({
      title: 'تم مسح المحادثة',
      message: 'تم البدء بجلسة عمل جديدة بنجاح.',
      type: 'info'
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={isZenMode ? "fixed inset-0 z-[1000] flex items-center justify-center p-0 bg-bg overflow-hidden" : "fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-3 md:p-6 bg-[#02040a]/95 backdrop-blur-lg overflow-hidden"} dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: isZenMode ? 1 : 0.98, y: isZenMode ? 0 : 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: isZenMode ? 1 : 0.98, y: isZenMode ? 0 : 10 }}
          className={isZenMode ? "bg-bg w-full h-full flex flex-col relative overflow-hidden" : "bg-surface border border-border/80 rounded-none sm:rounded-2xl max-w-4xl w-full h-full sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden my-auto"}
          dir="rtl"
        >
          {/* Header Bar */}
          <div className="px-3.5 py-2.5 border-b border-border/60 bg-surface2/40 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                <Bot size={16} />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-text flex items-center gap-1.5">
                  <span>المساعد الذكي (AGI Workspace)</span>
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.2 rounded-full font-mono font-bold">
                    LIVE
                  </span>
                </h2>
                <span className="hidden md:inline text-[10px] text-muted">تفكير معمق وأكواد وبحوث</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="h-7 px-2 text-muted hover:text-rose-400 rounded-md hover:bg-surface2 transition-colors text-[11px] font-medium flex items-center gap-1 border border-border/40 cursor-pointer"
                title="إعادة تهيئة المحادثة"
              >
                <Trash2 size={12} />
                <span className="hidden xs:inline">مسح</span>
              </button>

              <button
                onClick={onClose}
                className="h-7 w-7 flex items-center justify-center text-muted hover:text-text rounded-md hover:bg-surface2 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Unified Compact Control Strip */}
          <div className="px-3 py-1.5 bg-surface border-b border-border/40 flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-custom text-xs select-none">
            {/* Model Segmented Control */}
            <div className="flex items-center gap-0.5 bg-surface2/60 p-0.5 rounded-lg border border-border/50 shrink-0">
              <button
                onClick={() => onEngineChange('standard')}
                className={`h-6 px-2 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentEngine === 'standard'
                    ? 'bg-accent/20 text-accent border border-accent/25 shadow-xs'
                    : 'text-muted hover:text-text hover:bg-surface2'
                }`}
                title="نموذج فائق السرعة"
              >
                <span>⚡</span>
                <span>قياسي</span>
              </button>
              <button
                onClick={() => onEngineChange('thinking')}
                className={`h-6 px-2 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentEngine === 'thinking'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/25 shadow-xs'
                    : 'text-muted hover:text-text hover:bg-surface2'
                }`}
                title="تفكير ممتد ومنطقي عميق"
              >
                <span>🧠</span>
                <span>تفكير</span>
              </button>
              <button
                onClick={() => onEngineChange('deep_research')}
                className={`h-6 px-2 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentEngine === 'deep_research'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/25 shadow-xs'
                    : 'text-muted hover:text-text hover:bg-surface2'
                }`}
                title="تقصي وبحث تفصيلي شامل"
              >
                <span>🔬</span>
                <span>تقصي</span>
              </button>
            </div>

            {/* Quick Feature Toggles */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                className={`h-6 px-2 rounded-md border text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  isWebSearchEnabled
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-surface2/40 border-border/50 text-muted hover:text-text'
                }`}
                title="البحث الحي والمباشر بويب غوغل"
              >
                <Globe size={11} />
                <span className="hidden sm:inline">الويب</span>
              </button>

              <button
                onClick={() => setIsDeepThinkingEnabled(!isDeepThinkingEnabled)}
                className={`h-6 px-2 rounded-md border text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  isDeepThinkingEnabled
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                    : 'bg-surface2/40 border-border/50 text-muted hover:text-text'
                }`}
                title="المنطق والاستدلال الممتد"
              >
                <Brain size={11} />
                <span className="hidden sm:inline">استدلال</span>
              </button>

              <button
                onClick={() => setIsMapsGroundingEnabled(!isMapsGroundingEnabled)}
                className={`h-6 px-2 rounded-md border text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  isMapsGroundingEnabled
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-surface2/40 border-border/50 text-muted hover:text-text'
                }`}
                title="الخرائط والمواقع"
              >
                <Compass size={11} />
                <span className="hidden sm:inline">خرائط</span>
              </button>

              <button
                onClick={() => setIsZenMode?.(!isZenMode)}
                className={`h-6 px-2 rounded-md border text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  isZenMode
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25'
                }`}
                title={isZenMode ? "خروج من وضع التركيز" : "تفعيل وضع التركيز"}
              >
                {isZenMode ? <Eye size={11} /> : <EyeOff size={11} />}
                <span>تركيز</span>
              </button>
            </div>
          </div>

          {/* Messages Stream Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 scrollbar-custom">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="w-9 h-9 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 mt-1">
                    <Bot size={20} />
                  </div>
                )}

                <div className={`max-w-[92%] sm:max-w-[85%] rounded-[22px] sm:rounded-[32px] p-3.5 sm:p-5 shadow-sm transition-all duration-300 ${
                  msg.role === 'user'
                    ? 'bg-surface2 border border-border text-text rounded-tl-sm'
                    : 'bg-surface2/50 border border-border/70 text-text rounded-tr-sm'
                }`}>
                  {/* Speaker Label & Time */}
                  <div className="flex items-center justify-between gap-2 mb-2 text-[11px] font-bold text-muted border-b border-border/30 pb-1.5">
                    <span className={msg.role === 'model' ? 'text-accent' : 'text-text'}>
                      {msg.role === 'model' ? 'المساعد الذكي الفائق AGI' : 'أنت'}
                    </span>
                    <span className="font-mono text-[10px]">{msg.timestamp}</span>
                  </div>

                  {/* Attached files preview */}
                  {msg.files && msg.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {msg.files.map((f, i) => (
                        <div key={i} className="bg-surface border border-border/60 px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 text-accent">
                          <Paperclip size={12} />
                          <span className="truncate max-w-[150px] font-mono">{f.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Content */}
                  {editingMsgId === msg.id ? (
                    <div className="space-y-3 mt-2 min-w-[260px] sm:min-w-[400px]">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        className="w-full bg-surface border border-accent/40 rounded-2xl p-3 text-xs sm:text-sm text-text focus:outline-none focus:border-accent resize-none font-sans"
                        placeholder="اكتب التعديل هنا..."
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingMsgId(null)}
                          className="px-2.5 py-1.5 rounded-xl bg-surface hover:bg-surface2 border border-border text-muted hover:text-text text-xs font-bold transition-all cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={() => handleEditMessageAndResend(msg.id, editingText)}
                          className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-bg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          <Send size={12} className="rotate-180" />
                          <span>تعديل وإرسال</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="markdown-body text-xs sm:text-sm leading-relaxed text-text">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: ({ node, className, children, ...props }: any) => {
                            const hasLang = className?.includes('language-');
                            const langName = hasLang ? className.replace('language-', '') : '';
                            const rawCode = String(children || '').replace(/\n$/, '');

                            if (!hasLang) {
                              return <code className="bg-surface border border-border/60 rounded px-1.5 py-0.5 font-mono text-accent" dir="ltr" {...props}>{children}</code>;
                            }

                            return (
                              <InteractiveCodeBlock
                                language={langName}
                                code={rawCode}
                                personaName="المساعد الذكي"
                              />
                            );
                          }
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Grounded Web Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-border/30">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted mb-1.5">
                        <Globe size={12} className="text-emerald-400" />
                        <span>مصادر تم الرجوع إليها:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-surface border border-border/50 text-accent hover:underline text-[10px] px-2 py-0.5 rounded-lg truncate max-w-[200px]"
                          >
                            {src.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Bar per Message */}
                  {msg.role === 'model' && (
                    <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Read Aloud TTS Button */}
                        <button
                          onClick={() => handleSpeakText(msg.text, msg.id)}
                          className={`px-2 py-1 sm:px-3 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shadow-sm cursor-pointer border ${
                            speakingMsgId === msg.id
                              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                              : 'bg-accent/15 border-accent/30 text-accent hover:bg-accent/25'
                          }`}
                          title="قراءة النص بصوت عالٍ"
                        >
                          {speakingMsgId === msg.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
                          <span className="hidden xs:inline">{speakingMsgId === msg.id ? 'إيقاف الصوت' : 'قراءة بصوت عالٍ 🔊'}</span>
                          <span className="xs:hidden">{speakingMsgId === msg.id ? 'إيقاف' : 'صوت 🔊'}</span>
                        </button>

                        {/* Video Export with Captions Button */}
                        <button
                          onClick={async () => {
                            try {
                              toast({ type: 'info', title: 'تحضير الفيديو...', message: 'جاري إنشاء وتسجيل فيديو المحادثة والكلمات المزامنة.' });
                              const silentBytes = '\0'.repeat(24000);
                              await generateSubtitledVideo([{
                                text: msg.text,
                                personaName: 'المساعد الذكي AGI',
                                role: 'model',
                                base64Audio: btoa(silentBytes)
                              }], {
                                title: 'إجابة المساعد الذكي AGI',
                                modeLabel: 'فيديو مع الكلمات',
                                filename: `agi_video_${Date.now()}.mp4`
                              });
                            } catch (e: any) {
                              toast({ type: 'error', title: 'فشل التصدير', message: e?.message || 'حدث خطأ أثناء إنشاء الفيديو.' });
                            }
                          }}
                          className="px-2 py-1 sm:px-3 sm:py-1 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shadow-sm cursor-pointer"
                          title="تنزيل فيديو بصوت الإجابة والكلمات المزامنة"
                        >
                          <Video size={12} />
                          <span>فيديو مع الكلمات 🎬</span>
                        </button>

                        {/* Dissect Text */}
                        <button
                          onClick={() => onOpenDissectorWithText(msg.text)}
                          className="px-2 py-1 sm:px-3 sm:py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shadow-sm cursor-pointer"
                          title="تفكيك المكونات المعرفية والعقول والمفاهيم في هذه الإجابة"
                        >
                          <Layers size={12} />
                          <span className="hidden xs:inline">فكك النص 🔍</span>
                          <span className="xs:hidden">تفكيك 🔍</span>
                        </button>

                        {/* Extract Lesson */}
                        {onExtractLesson && (
                          <button
                            onClick={() => onExtractLesson(msg.text, 'المساعد الذكي', 'AGI Workspace')}
                            className="px-2 py-1 sm:px-3 sm:py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shadow-sm cursor-pointer"
                            title="استخراج درس تعليمي للأكاديمية"
                          >
                            <Sparkles size={12} />
                            <span className="hidden xs:inline">استخراج درس 🎓</span>
                            <span className="xs:hidden">درس 🎓</span>
                          </button>
                        )}

                        {/* Regenerate Response Button */}
                        <button
                          onClick={() => handleRegenerateResponse(msg.id)}
                          disabled={isLoading}
                          className="px-2 py-1 sm:px-3 sm:py-1 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                          title="إعادة توليد استجابة جديدة بناءً على رسالتك السابقة"
                        >
                          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                          <span className="hidden xs:inline">إعادة التوليد 🔄</span>
                          <span className="xs:hidden">إعادة 🔄</span>
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          copyToClipboard(msg.text);
                          setCopiedId(msg.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="text-[10px] sm:text-xs text-muted hover:text-text p-1 sm:p-1.5 rounded-lg hover:bg-surface flex items-center gap-1 font-mono border border-border/40"
                      >
                        {copiedId === msg.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copiedId === msg.id ? 'تم' : 'نسخ'}</span>
                      </button>
                    </div>
                  )}

                  {msg.role === 'user' && editingMsgId !== msg.id && (
                    <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditingText(msg.text);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                        title="تعديل هذه الرسالة وإعادة إرسالها لتوليد إجابة جديدة"
                      >
                        <Pencil size={12} />
                        <span>تعديل الرسالة ✍️</span>
                      </button>

                      <button
                        onClick={() => {
                          copyToClipboard(msg.text);
                          setCopiedId(msg.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="text-[10px] sm:text-xs text-muted hover:text-text p-1 sm:p-1.5 rounded-lg hover:bg-surface flex items-center gap-1 font-mono border border-border/40 cursor-pointer"
                      >
                        {copiedId === msg.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copiedId === msg.id ? 'تم' : 'نسخ'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 bg-surface2/40 border border-border/50 p-4 rounded-2xl max-w-md animate-pulse">
                <Loader2 size={20} className="animate-spin text-accent" />
                <span className="text-xs text-text font-bold">جاري التفكير والتوليد عبر المساعد الذكي...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-4 bg-surface2/40 border-t border-border/60 shrink-0">
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedFiles.map((f, idx) => (
                  <div key={idx} className="bg-surface border border-accent/40 text-accent px-3 py-1 rounded-xl text-xs flex items-center gap-2">
                    <Paperclip size={13} />
                    <span className="truncate max-w-[160px] font-mono">{f.name}</span>
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-rose-400">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-surface border border-border/70 hover:border-accent text-muted hover:text-accent rounded-2xl transition-colors shrink-0"
                title="إرفاق ملفات وصور"
              >
                <Paperclip size={18} />
              </button>

              <textarea
                ref={textareaRef}
                dir="auto"
                onChange={(e) => setHasPromptText(Boolean(e.target.value.trim()))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="اسأل المساعد الذكي عن أي شيء، اطلب كوداً، تحليلاً فلسفياً أو تقصياً شاملًا..."
                rows={1}
                className="flex-1 bg-surface border border-border/70 rounded-2xl px-4 py-3 text-xs sm:text-sm text-text focus:outline-none focus:border-accent resize-none max-h-32 text-right"
              />

              <button
                onClick={handleSendMessage}
                disabled={isLoading || (!hasPromptText && attachedFiles.length === 0)}
                className="p-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg rounded-2xl font-bold transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Send size={18} className="rotate-180" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <ConfirmModal
        isOpen={showClearConfirm}
        title="إعادة تهيئة جلسة المساعد الذكي"
        message="هل أنت متأكد من رغبتك في مسح سجل حوار المساعد الذكي الفائق (AGI Assistant) الحالي والبدء بجلسة عمل جديدة؟"
        confirmText="نعم، ابدأ جلسة جديدة"
        cancelText="إلغاء الأمر"
        onConfirm={() => {
          setShowClearConfirm(false);
          handleClearChat();
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </AnimatePresence>
  );
};
