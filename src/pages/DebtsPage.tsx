import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  addOrderPayment,
  deletePayment,
  listCustomerDebts,
} from '../services/payments';
import { formatDateVN, getTodayVN } from '../lib/date';
import {
  formatKg,
  formatVnd,
  normalizeSearchText,
  parseVndInput,
} from '../lib/format';
import type {
  CustomerDebtSummary,
  OrderWithDetails,
  Payment,
} from '../types/database';
import { LoadingState } from '../components/ui/LoadingState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast, type ToastMessage } from '../components/ui/Toast';

export function DebtsPage() {
  const [totalDebt, setTotalDebt] = useState(0);
  const [customers, setCustomers] = useState<CustomerDebtSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Modal ghi nhận trả nợ
  const [payingOrder, setPayingOrder] = useState<OrderWithDetails | null>(null);
  const [payAmountText, setPayAmountText] = useState('');
  const [payDate, setPayDate] = useState(getTodayVN());
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  // Xác nhận xóa 1 khoản thu tiền nhầm
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ id: Date.now(), type, text });
  }, []);

  const loadDebts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listCustomerDebts();
      setTotalDebt(result.totalDebt);
      setCustomers(result.customers);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Không tải được danh sách công nợ.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDebts();
  }, [loadDebts]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.customer_id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = normalizeSearchText(searchText);
    if (!q) return customers;
    return customers.filter(
      (c) =>
        normalizeSearchText(c.customer_name).includes(q) ||
        (c.customer_phone ?? '').toLowerCase().includes(q)
    );
  }, [customers, searchText]);

  const totalUnpaidOrders = useMemo(
    () => customers.reduce((sum, c) => sum + c.unpaid_orders_count, 0),
    [customers]
  );

  function openPaymentModal(order: OrderWithDetails) {
    setPayError(null);
    setPayingOrder(order);
    setPayAmountText(String(order.debt_amount));
    setPayDate(getTodayVN());
    setPayNote('');
  }

  async function handleConfirmPayment(e: FormEvent) {
    e.preventDefault();
    if (!payingOrder) return;
    setPayError(null);

    const parsedAmount = parseVndInput(payAmountText);
    if (parsedAmount === null || parsedAmount <= 0) {
      setPayError('Số tiền trả phải lớn hơn 0.');
      return;
    }
    if (parsedAmount > payingOrder.debt_amount) {
      setPayError(
        `Số tiền trả không được lớn hơn số còn nợ (${formatVnd(payingOrder.debt_amount)}).`
      );
      return;
    }

    setSavingPayment(true);
    try {
      await addOrderPayment({
        order_id: payingOrder.id,
        amount: parsedAmount,
        payment_date: payDate,
        note: payNote,
      });

      const paidCustomerName = payingOrder.customer_name;
      const isFullPay = parsedAmount === payingOrder.debt_amount;
      setPayingOrder(null);
      await loadDebts();
      showToast(
        'success',
        isFullPay
          ? `Đã thu đủ nợ của "${paidCustomerName}" (${formatVnd(parsedAmount)}).`
          : `Đã thu ${formatVnd(parsedAmount)} của "${paidCustomerName}".`
      );
    } catch (err) {
      setPayError(
        err instanceof Error ? err.message : 'Không lưu được khoản trả tiền.'
      );
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleDeletePayment() {
    if (!deletePaymentTarget) return;
    setDeletingPayment(true);
    try {
      await deletePayment(deletePaymentTarget.id);
      setDeletePaymentTarget(null);
      await loadDebts();
      showToast('success', 'Đã xóa khoản trả tiền vừa chọn.');
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Không xóa được khoản trả tiền.'
      );
    } finally {
      setDeletingPayment(false);
    }
  }

  const parsedPayInput = parseVndInput(payAmountText);
  const previewRemaining = payingOrder
    ? Math.max(0, payingOrder.debt_amount - (parsedPayInput ?? 0))
    : 0;

  if (loading) {
    return <LoadingState message="Đang tính công nợ khách hàng..." />;
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border-2 border-red-300 bg-white p-5 text-center shadow-sm">
        <p className="text-base font-bold text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadDebts()}
          className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-sky-600 px-5 text-base font-bold text-white active:bg-sky-700"
        >
          <RefreshCw className="h-5 w-5" />
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {selectedCustomer ? (
        /* CHI TIẾT CÔNG NỢ CỦA 1 KHÁCH */
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSelectedCustomerId(null)}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-base font-extrabold text-slate-800 active:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Quay lại danh sách nợ</span>
          </button>

          <section className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-red-800">
                  Khách hàng còn nợ
                </p>
                <h2 className="text-xl font-black text-slate-900">
                  {selectedCustomer.customer_name}
                </h2>
                {selectedCustomer.customer_phone && (
                  <a
                    href={`tel:${selectedCustomer.customer_phone}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-base font-bold text-sky-700 underline-offset-2 hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    <span>{selectedCustomer.customer_phone}</span>
                  </a>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold uppercase text-red-800">Tổng còn nợ</p>
                <p className="text-2xl font-black text-red-700">
                  {formatVnd(selectedCustomer.total_debt)}
                </p>
              </div>
            </div>
          </section>

          <div className="space-y-3">
            {selectedCustomer.unpaid_orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-sky-800">
                      Đơn ngày {formatDateVN(order.order_date)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {order.items
                        .map((it) => `${it.product_name} (${formatKg(it.quantity_kg)})`)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-slate-500">Còn nợ</p>
                    <p className="text-lg font-black text-red-700">
                      {formatVnd(order.debt_amount)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold">
                  <span className="text-slate-700">
                    Tổng đơn: {formatVnd(order.total_amount)}
                  </span>
                  <span className="text-emerald-800">
                    Đã trả: {formatVnd(order.paid_amount)}
                  </span>
                </div>

                {order.payments.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      Các lần đã trả
                    </p>
                    {order.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900"
                      >
                        <span className="min-w-0 truncate">
                          {formatDateVN(p.payment_date)} · +{formatVnd(p.amount)}
                          {p.note ? ` (${p.note})` : ''}
                        </span>
                        <button
                          type="button"
                          aria-label="Xóa khoản trả này"
                          onClick={() => setDeletePaymentTarget(p)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-700 active:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openPaymentModal(order)}
                  className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-extrabold text-white shadow-sm active:bg-emerald-700"
                >
                  <Banknote className="h-5 w-5" />
                  <span>Thu tiền / Trả nợ</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* DANH SÁCH KHÁCH CÒN NỢ (XẾP TỪ NHIỀU ĐẾN ÍT) */
        <div className="space-y-4">
          <section className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-extrabold uppercase text-red-800">
              Tổng công nợ toàn quán
            </p>
            <p className="mt-1 text-3xl font-black text-red-700">
              {formatVnd(totalDebt)}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-700">
              {customers.length} khách đang nợ · {totalUnpaidOrders} đơn chưa thu hết
            </p>
          </section>

          {customers.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm tên khách hoặc số điện thoại..."
                className="min-h-[50px] w-full rounded-2xl border-2 border-slate-300 bg-white pr-4 pl-11 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
              />
            </div>
          )}

          {customers.length === 0 ? (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
              <p className="mt-2 text-lg font-extrabold text-emerald-950">
                Tuyệt vời! Hiện không có khách nào còn nợ.
              </p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-base text-slate-600">
              Không tìm thấy khách nào khớp từ khóa.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredCustomers.map((cust, index) => (
                <button
                  key={cust.customer_id}
                  type="button"
                  onClick={() => setSelectedCustomerId(cust.customer_id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:border-sky-600 active:bg-sky-50/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-800">
                        {index + 1}
                      </span>
                      <h3 className="truncate text-lg font-extrabold text-slate-900">
                        {cust.customer_name}
                      </h3>
                    </div>
                    <p className="mt-1 pl-9 text-sm font-semibold text-slate-600">
                      {cust.unpaid_orders_count} đơn còn nợ
                      {cust.customer_phone ? ` · ${cust.customer_phone}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-lg font-black text-red-700">
                      {formatVnd(cust.total_debt)}
                    </span>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal ghi nhận trả nợ */}
      {payingOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmPayment}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-emerald-700">
                  Thu tiền công nợ
                </p>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {payingOrder.customer_name}
                </h2>
                <p className="text-sm font-semibold text-slate-600">
                  Đơn ngày {formatDateVN(payingOrder.order_date)} · Còn nợ{' '}
                  <span className="font-black text-red-700">
                    {formatVnd(payingOrder.debt_amount)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setPayingOrder(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <button
                type="button"
                onClick={() => setPayAmountText(String(payingOrder.debt_amount))}
                className="min-h-[46px] w-full rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 text-base font-extrabold text-emerald-900 active:bg-emerald-100"
              >
                Trả hết toàn bộ ({formatVnd(payingOrder.debt_amount)})
              </button>

              <div>
                <label className="block text-base font-bold text-slate-800">
                  Số tiền khách trả lần này (đ) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  autoFocus
                  value={payAmountText}
                  onChange={(e) => setPayAmountText(e.target.value)}
                  placeholder="Nhập số tiền..."
                  className="mt-1.5 min-h-[54px] w-full rounded-xl border-2 border-slate-300 px-4 text-xl font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                <div className="mt-1.5 flex justify-between text-sm font-bold">
                  <span className="text-emerald-800">
                    Thu: {parsedPayInput !== null ? formatVnd(parsedPayInput) : '0đ'}
                  </span>
                  <span className="text-red-700">
                    Còn nợ sau trả: {formatVnd(previewRemaining)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Ngày trả
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1 min-h-[48px] w-full rounded-xl border-2 border-slate-300 px-3 text-base font-bold text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Ghi chú (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="VD: Chuyển khoản..."
                    className="mt-1 min-h-[48px] w-full rounded-xl border-2 border-slate-300 px-3 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              {payError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-800">
                  {payError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={savingPayment}
                  onClick={() => setPayingOrder(null)}
                  className="min-h-[52px] rounded-xl border-2 border-slate-300 bg-white text-base font-bold text-slate-800 active:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="min-h-[52px] rounded-xl bg-emerald-600 text-base font-extrabold text-white shadow-md active:bg-emerald-700 disabled:opacity-60"
                >
                  {savingPayment ? 'Đang lưu...' : 'XÁC NHẬN ĐÃ THU'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletePaymentTarget)}
        title="Xóa khoản trả tiền này?"
        message={`Bạn có chắc muốn xóa lần trả ${
          deletePaymentTarget ? formatVnd(deletePaymentTarget.amount) : ''
        } ngày ${
          deletePaymentTarget ? formatDateVN(deletePaymentTarget.payment_date) : ''
        } không? Số nợ của đơn sẽ tăng lại tương ứng.`}
        confirmLabel="Xóa khoản trả"
        danger
        loading={deletingPayment}
        onConfirm={() => void handleDeletePayment()}
        onCancel={() => setDeletePaymentTarget(null)}
      />
    </div>
  );
}
