import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  text: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 2600);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
      <div
        role="status"
        className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-base font-bold text-white shadow-xl ${
          isSuccess ? 'bg-emerald-700' : 'bg-red-700'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-6 w-6 shrink-0" />
        ) : (
          <AlertCircle className="h-6 w-6 shrink-0" />
        )}
        <span className="flex-1">{toast.text}</span>
        <button
          type="button"
          aria-label="Đóng thông báo"
          onClick={onDismiss}
          className="rounded-lg p-1 active:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
