import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Pencil,
  PlusCircle,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { deleteOrder, listOrdersByDate } from '../services/orders';
import { formatDateVN } from '../lib/date';
import { formatKg, formatVnd } from '../lib/format';
import type { OrderWithDetails } from '../types/database';
import { DateSwitcher } from '../components/ui/DateSwitcher';
import { LoadingState } from '../components/ui/LoadingState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast, type ToastMessage } from '../components/ui/Toast';

interface DailyOrdersPageProps {
  selectedDate: string;
  onDateChange: (nextDate: string) => void;
  onEditOrder: (order: OrderWithDetails) => void;
  onNewOrder: () => void;
}

function formatTimeVN(isoStr: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoStr));
  } catch {
    return '';
  }
}

export function DailyOrdersPage({
  selectedDate,
  onDateChange,
  onEditOrder,
  onNewOrder,
}: DailyOrdersPageProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detailOrder, setDetailOrder] = useState<OrderWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listOrdersByDate(selectedDate);
      setOrders(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Không tải được sổ đơn.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const summary = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.totalSales += order.total_amount;
        acc.totalPaid += order.paid_amount;
        acc.totalDebt += order.debt_amount;
        return acc;
      },
      { totalSales: 0, totalPaid: 0, totalDebt: 0 }
    );
  }, [orders]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteOrder(deleteTarget.id);
      setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      if (detailOrder?.id === deleteTarget.id) {
        setDetailOrder(null);
      }
      setToast({
        id: Date.now(),
        type: 'success',
        text: `Đã xóa đơn của "${deleteTarget.customer_name}".`,
      });
    } catch (err) {
      setToast({
        id: Date.now(),
        type: 'error',
        text: err instanceof Error ? err.message : 'Không xóa được đơn hàng.',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <DateSwitcher date={selectedDate} onChange={onDateChange} />

      {/* Thống kê nhanh trong ngày */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Tổng bán ({orders.length} đơn)</p>
          <p className="mt-1 text-base font-black text-slate-900">
            {formatVnd(summary.totalSales)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
          <p className="text-xs font-bold text-emerald-800">Đã thu đơn</p>
          <p className="mt-1 text-base font-black text-emerald-900">
            {formatVnd(summary.totalPaid)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 shadow-sm">
          <p className="text-xs font-bold text-red-800">Còn nợ</p>
          <p className="mt-1 text-base font-black text-red-800">
            {formatVnd(summary.totalDebt)}
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Đang mở trang sổ ngày..." />
      ) : loadError ? (
        <div className="rounded-2xl border-2 border-red-300 bg-white p-5 text-center shadow-sm">
          <p className="text-base font-bold text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => void fetchOrders()}
            className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-sky-600 px-5 text-base font-bold text-white active:bg-sky-700"
          >
            <RefreshCw className="h-5 w-5" />
            Thử lại
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-700">
            Chưa có đơn hàng nào trong ngày {formatDateVN(selectedDate)}.
          </p>
          <button
            type="button"
            onClick={onNewOrder}
            className="mt-4 inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-sky-600 px-5 text-base font-extrabold text-white shadow-sm active:bg-sky-700"
          >
            <PlusCircle className="h-5 w-5" />
            <span>Ghi đơn ngay</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isPaidFull = order.debt_amount === 0;
            const isUnpaid = order.paid_amount === 0 && order.total_amount > 0;
            const statusLabel = isPaidFull
              ? 'Trả đủ'
              : isUnpaid
                ? `Nợ ${formatVnd(order.debt_amount)}`
                : `Thiếu ${formatVnd(order.debt_amount)}`;
            const badgeClass = isPaidFull
              ? 'bg-emerald-100 text-emerald-900'
              : isUnpaid
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-900';

            return (
              <button
                key={order.id}
                type="button"
                onClick={() => setDetailOrder(order)}
                className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:border-sky-600 active:bg-sky-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-extrabold text-slate-900">
                      {order.customer_name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimeVN(order.created_at)}
                      </span>
                      <span>· {order.items.length} món</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-black text-slate-900">
                      {formatVnd(order.total_amount)}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-lg px-2.5 py-0.5 text-xs font-extrabold ${badgeClass}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </div>

                <p className="mt-2.5 line-clamp-2 border-t border-slate-100 pt-2 text-sm font-medium text-slate-700">
                  {order.items
                    .map((it) => `${it.product_name} (${formatKg(it.quantity_kg)})`)
                    .join(' · ')}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal chi tiết đơn hàng */}
      {detailOrder && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/60 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-sky-700">
                  Chi tiết đơn · {formatDateVN(detailOrder.order_date)}
                </p>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {detailOrder.customer_name}
                </h2>
                {detailOrder.customer_phone && (
                  <p className="text-sm font-semibold text-slate-600">
                    SĐT: {detailOrder.customer_phone}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Đóng chi tiết"
                onClick={() => setDetailOrder(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50">
              {detailOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-base font-extrabold text-slate-900">
                      {item.product_name}
                    </p>
                    <p className="text-sm font-semibold text-slate-600">
                      {formatKg(item.quantity_kg)} × {formatVnd(item.unit_price)}/kg
                    </p>
                  </div>
                  <p className="text-base font-black text-slate-900">
                    {formatVnd(item.line_total)}
                  </p>
                </div>
              ))}
            </div>

            {detailOrder.note && (
              <p className="mt-3 rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-700">
                Ghi chú: {detailOrder.note}
              </p>
            )}

            <div className="mt-4 space-y-1.5 rounded-2xl border border-slate-200 p-4">
              <div className="flex justify-between text-base font-bold text-slate-800">
                <span>Tổng đơn:</span>
                <span className="text-lg font-black">{formatVnd(detailOrder.total_amount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-emerald-800">
                <span>Đã trả:</span>
                <span>{formatVnd(detailOrder.paid_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-extrabold text-red-700">
                <span>Còn nợ:</span>
                <span>{formatVnd(detailOrder.debt_amount)}</span>
              </div>
            </div>

            {detailOrder.payments.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Lịch sử trả tiền
                </p>
                <div className="mt-1.5 space-y-1">
                  {detailOrder.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900"
                    >
                      <span>
                        {formatDateVN(p.payment_date)}
                        {p.note ? ` (${p.note})` : ''}
                      </span>
                      <span>+{formatVnd(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = detailOrder;
                  setDetailOrder(null);
                  onEditOrder(target);
                }}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-sky-600 bg-sky-50 text-base font-extrabold text-sky-800 active:bg-sky-100"
              >
                <Pencil className="h-5 w-5" />
                <span>Sửa đơn</span>
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(detailOrder)}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 text-base font-extrabold text-red-700 active:bg-red-100"
              >
                <Trash2 className="h-5 w-5" />
                <span>Xóa đơn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa đơn hàng này?"
        message={`Bạn có chắc muốn xóa đơn ${
          deleteTarget ? formatVnd(deleteTarget.total_amount) : ''
        } của "${deleteTarget?.customer_name ?? ''}" không? Các khoản thanh toán gắn với đơn này cũng sẽ bị xóa.`}
        confirmLabel="Xóa đơn"
        danger
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
