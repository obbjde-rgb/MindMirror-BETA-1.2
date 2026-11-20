import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info } from 'lucide-react';

interface RagTooltipProps {
  children: React.ReactNode;
  context: string;
  onClickConcept?: () => void;
}

export const RagTooltip: React.FC<RagTooltipProps> = ({ children, context, onClickConcept }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span 
      className="relative inline-flex items-baseline cursor-pointer group select-none"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onClickConcept) {
          onClickConcept();
        } else {
          setIsOpen(!isOpen);
        }
      }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <span className="text-accent underline decoration-accent/30 decoration-dashed underline-offset-4 hover:decoration-accent/80 transition-all font-semibold hover:text-accent2">
        {children}
      </span>
      <AnimatePresence>
        {isOpen && (
          <motion.span
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-surface border border-accent/20 rounded-xl shadow-xl shadow-black/40 pointer-events-none"
          >
            <span className="flex flex-col gap-1.5 text-start font-sans">
              <span className="flex items-start gap-2">
                <Info size={14} className="text-accent shrink-0 mt-0.5" />
                <span className="text-[12px] leading-relaxed text-text font-normal text-start block break-words">
                  {context}
                </span>
              </span>
              <span className="text-[10px] text-accent/80 font-bold block pe-5">
                💡 اضغط للشرح الفوري بالذكاء الاصطناعي
              </span>
            </span>
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface border-b border-l border-accent/20 transform -rotate-45" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};
