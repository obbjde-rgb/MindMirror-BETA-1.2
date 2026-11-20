import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TooltipProps {
  content: string;
  subContent?: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  subContent,
  children,
  position = 'top',
  delay = 200
}) => {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShow(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShow(false);
  };

  // Positions classes for the tooltip popover
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  // Arrow style orientations
  const arrowClasses = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t border-r border-border bg-surface rotate-[135deg]',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-t border-r border-border bg-surface -rotate-45',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r border-border bg-surface rotate-45',
    right: 'left-[-4px] top-1/2 -translate-y-1/2 border-t border-r border-border bg-surface rotate-[225deg]'
  };

  // Motion animation presets
  const animationVariants = {
    top: { initial: { opacity: 0, y: 4, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 4, scale: 0.96 } },
    bottom: { initial: { opacity: 0, y: -4, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -4, scale: 0.96 } },
    left: { initial: { opacity: 0, x: 4, scale: 0.96 }, animate: { opacity: 1, x: 0, scale: 1 }, exit: { opacity: 0, x: 4, scale: 0.96 } },
    right: { initial: { opacity: 0, x: -4, scale: 0.96 }, animate: { opacity: 1, x: 0, scale: 1 }, exit: { opacity: 0, x: -4, scale: 0.96 } }
  };

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={animationVariants[position].initial}
            animate={animationVariants[position].animate}
            exit={animationVariants[position].exit}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-[9999] pointer-events-none whitespace-nowrap px-3 py-1.5 rounded-xl bg-surface/95 backdrop-blur border border-border/80 shadow-xl shadow-black/30 flex flex-col items-center gap-0.5 ${positionClasses[position]}`}
          >
            <div className="text-[11px] font-bold text-text text-center font-sans tracking-wide leading-none select-none">
              {content}
            </div>
            {subContent && (
              <div className="text-[9px] text-muted font-normal text-center font-sans leading-none mt-0.5 select-none opacity-85">
                {subContent}
              </div>
            )}
            <div className={`absolute w-1.5 h-1.5 ${arrowClasses[position]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
