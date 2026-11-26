import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Đang tải dữ liệu...' }: LoadingStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-sky-600" />
      <p className="text-base font-semibold text-slate-700">{message}</p>
    </div>
  );
}
