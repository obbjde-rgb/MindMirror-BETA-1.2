import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10001] flex flex-col items-center p-4 bg-[#02040a]/95 backdrop-blur-sm overflow-y-auto overflow-x-hidden"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-surface border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative my-auto flex flex-col"
        >
          <div className="p-6">
            <div className="flex justify-center mb-4 text-red-500">
              <AlertTriangle size={48} strokeWidth={1.5} />
              <span className="plain-text-indicator hidden font-bold text-xs text-black border border-black px-2 py-0.5">[تنبيه تأكيدي]</span>
            </div>
            <h2 className="text-xl font-bold text-center mb-2 text-text">{title}</h2>
            <p className="text-center text-muted text-sm leading-relaxed mb-6">{message}</p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-lg border border-border text-muted hover:text-text hover:bg-surface2 transition-colors font-semibold"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 border border-red-500/20 hover:text-white transition-colors font-semibold"
              >
                {confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConfirmModal;
