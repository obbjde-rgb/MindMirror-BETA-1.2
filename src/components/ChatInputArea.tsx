import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Paperclip, X, FileText, Image as ImageIcon, Mic, MicOff, Music } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';

// Add type definition for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface ChatInputAreaProps {
  onSendMessage: (text: string, files: {name: string, mimeType: string, data: string}[]) => void;
  isLoading: boolean;
  onStop: () => void;
  activePersona: string;
  isZenMode?: boolean;
  onOpenGroundedImageAssistant?: () => void;
}

export default function ChatInputArea({ onSendMessage, isLoading, onStop, activePersona, isZenMode, onOpenGroundedImageAssistant }: ChatInputAreaProps) {
  const { toast } = useToast();
  const [hasText, setHasText] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<{name: string, mimeType: string, data: string}[]>([]);
  const recognitionRef = useRef<any>(null);
  const isRecognitionRunningRef = useRef(false);

  // Timer for voice recording
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      setRecordingDuration(0);
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ar-SA'; // Default to Arabic

        recognition.onstart = () => {
          isRecognitionRunningRef.current = true;
          setIsRecording(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            if (textareaRef.current) {
              const currentVal = textareaRef.current.value;
              const newVal = currentVal + (currentVal.length > 0 ? ' ' : '') + finalTranscript;
              textareaRef.current.value = newVal;
              setHasText(true);
              autoResize();
            }
          }
        };

        recognition.onerror = (event: any) => {
          const err = event?.error;
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            console.info("Speech recognition web service error in ChatInputArea:", err);
          }
          isRecognitionRunningRef.current = false;
          setIsRecording(false);
        };

        recognition.onend = () => {
          isRecognitionRunningRef.current = false;
          setIsRecording(false);
        };
      } catch (e) {
        // Safe catch for environment constraints
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast({
        title: 'التعرف الصوتي غير مدعوم',
        message: 'نظام التعرف على الكلام غير مدعوم في متصفحك أو يحتاج لإذن الميكروفون.',
        type: 'info'
      });
      return;
    }

    if (isRecording || isRecognitionRunningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Safe catch
      }
      isRecognitionRunningRef.current = false;
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        isRecognitionRunningRef.current = true;
        setIsRecording(true);
      } catch (err: any) {
        if (err?.name === 'InvalidStateError' || String(err).includes('already started')) {
          isRecognitionRunningRef.current = true;
          setIsRecording(true);
        } else {
          isRecognitionRunningRef.current = false;
          setIsRecording(false);
        }
      }
    }
  };
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHasText(Boolean(e.target.value.trim()));
    autoResize();
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      // Validation for supported Gemini file types (images, audio, text, pdf)
      if (!file.type.match('image.*') && !file.type.match('audio.*') && !file.type.match('text.*') && !file.type.match('application/pdf')) {
         console.warn("Unsupported file type:", file.type);
         return; 
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result !== 'string') return;
        const base64Data = result.split(',')[1] || '';
        if (!base64Data) return;
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          mimeType: file.type || 'audio/mp3',
          data: base64Data
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submitMessage = () => {
    const text = textareaRef.current?.value || '';
    if ((!text.trim() && attachedFiles.length === 0) || isLoading) return;
    onSendMessage(text.trim(), attachedFiles);
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
    }
    setHasText(false);
    setAttachedFiles([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2 md:px-0">
      <div 
        className={`relative flex flex-col rounded-xl sm:rounded-2xl border transition-all shadow-xs
          ${isDragging ? 'border-accent bg-accent/5 scale-[1.01]' : (isZenMode ? 'border-border/10 bg-transparent' : 'border-border bg-surface')} 
          focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80 backdrop-blur-xs rounded-xl sm:rounded-2xl border-2 border-dashed border-accent">
            <span className="text-accent font-bold text-sm flex items-center gap-2">
              <Paperclip size={20} /> أفلِت الملفات هنا
            </span>
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-1 max-h-[90px] overflow-y-auto scrollbar-hide">
            {attachedFiles.map((file, i) => {
              const isImage = file.mimeType?.startsWith('image/') || false;
              const isAudio = file.mimeType?.startsWith('audio/') || false;
              return (
                <div key={i} className="group relative flex items-center gap-1.5 bg-surface2 border border-border/80 rounded-md p-1 pe-2.5 text-xs text-text animate-fade-in">
                  {isImage ? (
                    <div className="w-6 h-6 rounded shrink-0 overflow-hidden bg-bg border border-border/50">
                      <img src={`data:${file.mimeType};base64,${file.data}`} alt={file.name} className="w-full h-full object-cover" />
                    </div>
                  ) : isAudio ? (
                    <div className="w-6 h-6 rounded shrink-0 flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                      <Music size={13} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded shrink-0 flex items-center justify-center bg-accent/10 text-accent">
                      <FileText size={13} />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 max-w-[100px]">
                    <span className="truncate text-[11px] font-medium" title={file.name}>{file.name}</span>
                  </div>
                  <button 
                    onClick={() => removeFile(i)} 
                    className="absolute -top-1.5 -end-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-100 shadow-xs hover:bg-red-600"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-1.5 p-1.5 sm:p-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.ogg,.m4a,.webm,.aac" />
          
          <Tooltip content="إرفاق ملفات" subContent="إرفاق صور، نصوص أو ملفات PDF">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()} 
              className="w-8 h-8 shrink-0 text-muted hover:text-accent bg-transparent hover:bg-surface2 rounded-lg transition-colors flex items-center justify-center self-end cursor-pointer"
              disabled={isLoading}
            >
              <Paperclip size={17} />
            </button>
          </Tooltip>

          {onOpenGroundedImageAssistant && (
            <Tooltip content="مساعد الصور" subContent="جلب الصور الموثوقة من غوغل">
              <button 
                type="button"
                onClick={onOpenGroundedImageAssistant} 
                className="w-8 h-8 shrink-0 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors flex items-center justify-center self-end cursor-pointer border border-amber-500/20"
                disabled={isLoading}
              >
                <ImageIcon size={16} />
              </button>
            </Tooltip>
          )}

          <div className="flex items-center gap-1 self-end">
            {isRecording && (
              <span className="text-red-500 font-mono text-[10px] font-bold animate-pulse bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                {formatTime(recordingDuration)}
              </span>
            )}
            <Tooltip content="الإملاء الصوتي" subContent={isRecording ? "إيقاف التسجيل" : "تحدث بصوتك تحويل الكلام إلى نص"}>
              <button 
                type="button"
                onClick={toggleRecording}
                className={`w-8 h-8 shrink-0 transition-all rounded-lg flex items-center justify-center cursor-pointer ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'text-muted hover:text-accent bg-transparent hover:bg-surface2'
                }`}
                disabled={isLoading}
              >
                {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
            </Tooltip>
          </div>

          <textarea ref={textareaRef} dir="auto"
            onChange={handleInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitMessage();
              }
            }}
            placeholder={activePersona === 'debate' ? "تدخل في المناظرة..." : `تحدث مع ${activePersona}...`}
            className="flex-1 bg-transparent py-2 px-1.5 min-h-[36px] max-h-[120px] resize-none focus:outline-none text-xs sm:text-sm leading-relaxed text-text placeholder-muted self-center scrollbar-hide text-right"
            disabled={isLoading}
            rows={1}
          />

          <div className="shrink-0 self-end">
            {isLoading ? (
              <Tooltip content="إيقاف التوليد" subContent="إيقاف معالجة الرد">
                <button 
                  onClick={onStop}
                  className="w-8 h-8 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                >
                  <StopCircle size={17} className="animate-pulse" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip content="إرسال" subContent="إرسال الرسالة إلى الشخصية">
                <button 
                  onClick={submitMessage}
                  disabled={(!hasText && attachedFiles.length === 0) || isLoading}
                  className="w-8 h-8 bg-accent text-bg hover:bg-accent-hover rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                >
                  <Send size={16} className="rtl:-scale-x-100" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
