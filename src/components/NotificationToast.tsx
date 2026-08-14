import React from 'react';
import { usePatient } from '../context/PatientContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export const NotificationToast: React.FC = () => {
  const { toasts, dismissToast } = usePatient();

  return (
    <div
      id="toast-container"
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none sm:bottom-6 sm:right-6"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border text-sm font-medium ${
                isSuccess
                  ? 'bg-emerald-900/95 text-emerald-50 border-emerald-700'
                  : isError
                  ? 'bg-rose-900/95 text-rose-50 border-rose-700'
                  : 'bg-slate-900/95 text-slate-100 border-slate-700'
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}

              <div className="flex-1 leading-snug">{toast.message}</div>

              <button
                id={`dismiss-toast-${toast.id}`}
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-white transition-colors p-0.5 -mr-1"
                aria-label="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
