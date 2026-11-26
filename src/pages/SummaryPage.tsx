import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  PackagePlus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { getDailySummary } from '../services/summary';
import { formatVnd } from '../lib/format';
import type { DailySummary } from '../types/database';
import { DateSwitcher } from '../components/ui/DateSwitcher';
import { LoadingState } from '../components/ui/LoadingState';

interface SummaryPageProps {
  selectedDate: string;
  onDateChange: (nextDate: string) => void;
  onOpenDailyOrders: () => void;
  onOpenPurchases: () => void;
}

export function SummaryPage({
  selectedDate,
  onDateChange,
  onOpenDailyOrders,
  onOpenPurchases,
}: SummaryPageProps) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDailySummary(selectedDate);
      setSummary(data);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Không tính được tổng kết ngày.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <div className="space-y-4">
      <DateSwitcher date={selectedDate} onChange={onDateChange} />

      {loading ? (
        <LoadingState message="Đang tổng hợp số liệu trong ngày..." />
      ) : loadError || !summary ? (
        <div className="rounded-2xl border-2 border-red-300 bg-white p-5 text-center shadow-sm">
          <p className="text-base font-bold text-red-700">
            {loadError ?? 'Không có dữ liệu tổng kết.'}
          </p>
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-sky-600 px-5 text-base font-bold text-white active:bg-sky-700"
          >
            <RefreshCw className="h-5 w-5" />
            Thử lại
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Thẻ Lời / Lỗ nổi bật */}
          <section
            className={`rounded-3xl border-2 p-5 shadow-md ${
              summary.profit >= 0
                ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                : 'border-red-400 bg-red-50 text-red-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-extrabold uppercase">
                {summary.profit >= 0 ? 'Lời trong ngày' : 'Lỗ trong ngày'}
              </span>
              {summary.profit >= 0 ? (
                <TrendingUp className="h-7 w-7 text-emerald-700" />
              ) : (
                <TrendingDown className="h-7 w-7 text-red-700" />
              )}
            </div>
            <p
              className={`mt-2 text-4xl font-black ${
                summary.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {summary.profit > 0 ? `+${formatVnd(summary.profit)}` : formatVnd(summary.profit)}
            </p>
            <p className="mt-2 text-sm font-bold opacity-85">
              Doanh thu ({formatVnd(summary.revenue)}) − Vốn nhập (
              {formatVnd(summary.purchase_cost)})
            </p>
          </section>

          {/* 4 chỉ số chi tiết */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-sm font-extrabold uppercase">Doanh thu</span>
                <ArrowUpRight className="h-5 w-5 text-sky-700" />
              </div>
              <p className="mt-1.5 text-2xl font-black text-slate-900">
                {formatVnd(summary.revenue)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {summary.order_count} đơn bán trong ngày (gồm cả phần nợ)
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-sm font-extrabold uppercase">
                  Tiền đã thu trong ngày
                </span>
              </div>
              <p className="mt-1.5 text-2xl font-black text-emerald-700">
                {formatVnd(summary.collected_total)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Từ đơn hôm đó: {formatVnd(summary.collected_from_today_orders)}
                {summary.collected_from_old_debts > 0
                  ? ` · Thu nợ cũ: ${formatVnd(summary.collected_from_old_debts)}`
                  : ''}
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-red-800">
                <span className="text-sm font-extrabold uppercase">
                  Nợ phát sinh trong ngày
                </span>
              </div>
              <p className="mt-1.5 text-2xl font-black text-red-700">
                {formatVnd(summary.new_debt)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Phần chưa thu của các đơn bán ngày này
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-amber-900">
                <span className="text-sm font-extrabold uppercase">Vốn nhập hàng</span>
                <ArrowDownRight className="h-5 w-5 text-amber-700" />
              </div>
              <p className="mt-1.5 text-2xl font-black text-slate-900">
                {formatVnd(summary.purchase_cost)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {summary.purchase_count} lượt nhập hàng trong ngày
              </p>
            </div>
          </div>

          {/* Nút đi nhanh tới Sổ ngày & Nhập hàng của ngày đang xem */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenDailyOrders}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-sky-600 bg-white px-3 text-base font-extrabold text-sky-700 active:bg-sky-50"
            >
              <BookOpen className="h-5 w-5" />
              <span>Xem Sổ đơn</span>
            </button>
            <button
              type="button"
              onClick={onOpenPurchases}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-sky-600 bg-white px-3 text-base font-extrabold text-sky-700 active:bg-sky-50"
            >
              <PackagePlus className="h-5 w-5" />
              <span>Xem Nhập hàng</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
