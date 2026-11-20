import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';

interface LiveChatInputProps {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  onSendText: (text: string) => void;
}

export const LiveChatInput: React.FC<LiveChatInputProps> = ({
  isMuted,
  setIsMuted,
  onSendText,
}) => {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [inputText]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 bg-surface border-t border-border shrink-0">
      <div className="w-full relative flex flex-col rounded-[24px] border border-border bg-surface shadow-sm focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20">
        <div className="flex items-end gap-2 p-2">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "تشغيل الميكروفون" : "كتم الميكروفون"}
            className={`p-2.5 shrink-0 transition-all rounded-full cursor-pointer ${
              isMuted 
                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' 
                : 'text-muted hover:text-accent bg-transparent hover:bg-surface2'
            }`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <textarea 
            ref={textareaRef} 
            dir="auto"
            value={inputText}
            onChange={e => setInputText(e.target.value)} 
            onKeyDown={handleKeyDown} 
            placeholder="أرسل رسالة نصية..." 
            className="flex-1 bg-transparent py-3 px-2 min-h-[44px] max-h-[150px] resize-none focus:outline-none text-[15px] leading-relaxed text-text placeholder-muted self-center scrollbar-hide text-right"
            rows={1}
          />
          
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="bg-accent text-bg p-2.5 hover:scale-105 rounded-full shadow-md hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center disabled:shadow-none cursor-pointer shrink-0"
          >
            <Send size={20} className="rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
};
