import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateVN, getTodayVN, shiftDateVN } from '../../lib/date';

interface DateSwitcherProps {
  date: string;
  onChange: (nextDate: string) => void;
}

export function DateSwitcher({ date, onChange }: DateSwitcherProps) {
  const todayVN = getTodayVN();
  const isToday = date === todayVN;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Ngày trước"
          onClick={() => onChange(shiftDateVN(date, -1))}
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-800 active:bg-slate-200"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <label className="relative flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-center active:bg-slate-100">
          <Calendar className="h-5 w-5 shrink-0 text-sky-700" />
          <span className="text-base font-extrabold text-slate-900">
            {isToday ? `Hôm nay · ${formatDateVN(date)}` : formatDateVN(date)}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        <button
          type="button"
          aria-label="Ngày sau"
          onClick={() => onChange(shiftDateVN(date, 1))}
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-800 active:bg-slate-200"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {!isToday && (
        <button
          type="button"
          onClick={() => onChange(todayVN)}
          className="mt-2 min-h-[40px] w-full rounded-xl bg-sky-50 text-sm font-extrabold text-sky-700 active:bg-sky-100"
        >
          Quay về hôm nay
        </button>
      )}
    </div>
  );
}
