import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  Fish,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { listProducts } from '../services/products';
import { createCustomer, listCustomers } from '../services/customers';
import { createOrder, updateOrder } from '../services/orders';
import { getTodayVN } from '../lib/date';
import {
  calculateLineTotal,
  convertToKg,
  formatKg,
  formatVnd,
  normalizeSearchText,
  parseDecimalInput,
  parseVndInput,
  WEIGHT_UNIT_OPTIONS,
} from '../lib/format';
import type {
  Customer,
  OrderWithDetails,
  PaymentMode,
  Product,
  WeightUnit,
} from '../types/database';
import { LoadingState } from '../components/ui/LoadingState';
import { Toast, type ToastMessage } from '../components/ui/Toast';

interface DraftOrderLine {
  localId: string;
  productId: string | null;
  productName: string;
  quantityText: string;
  unit: WeightUnit;
  priceText: string;
}

const QUICK_QUANTITIES: Record<WeightUnit, string[]> = {
  kg: ['0,5', '1', '1,5', '2'],
  lang: ['3', '5', '7'],
  g: ['200', '300', '500'],
  yen: ['1', '2'],
};

interface CreateOrderPageProps {
  editingOrder?: OrderWithDetails | null;
  onSaved?: (savedDate: string, wasEditing: boolean) => void;
  onCancelEdit?: () => void;
  onNavigateManage?: () => void;
}

function makeLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatNumberForInput(n: number): string {
  return String(n).replace('.', ',');
}

export function CreateOrderPage({
  editingOrder = null,
  onSaved,
  onCancelEdit,
  onNavigateManage,
}: CreateOrderPageProps) {
  const isEditing = Boolean(editingOrder);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderDate, setOrderDate] = useState<string>(getTodayVN());
  const [orderNote, setOrderNote] = useState('');
  const [lines, setLines] = useState<DraftOrderLine[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [partialAmountText, setPartialAmountText] = useState('');

  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [savingQuickCust, setSavingQuickCust] = useState(false);
  const [quickCustError, setQuickCustError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ id: Date.now(), type, text });
  }, []);

  const loadMasterData = useCallback(async () => {
    setLoadingData(true);
    setLoadError(null);
    try {
      const [prodList, custList] = await Promise.all([
        listProducts(false),
        listCustomers(false),
      ]);
      setProducts(prodList);
      setCustomers(custList);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Không tải được danh sách hàng và khách.'
      );
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadMasterData();
  }, [loadMasterData]);

  // Đồng bộ form khi chuyển giữa Ghi đơn mới và Sửa đơn
  useEffect(() => {
    setSubmitError(null);
    if (editingOrder) {
      setSelectedCustomerId(editingOrder.customer_id ?? '');
      setCustomerSearch('');
      setOrderDate(editingOrder.order_date);
      setOrderNote(editingOrder.note ?? '');
      setLines(
        editingOrder.items.map((item) => ({
          localId: item.id || makeLocalId(),
          productId: item.product_id,
          productName: item.product_name,
          quantityText: formatNumberForInput(item.quantity_kg),
          unit: 'kg',
          priceText: String(item.unit_price),
        }))
      );
    } else {
      setOrderDate(getTodayVN());
      setOrderNote('');
      setLines([]);
      setPaymentMode('full');
      setPartialAmountText('');
    }
  }, [editingOrder]);

  const filteredCustomers = useMemo(() => {
    const q = normalizeSearchText(customerSearch);
    const list = q
      ? customers.filter(
          (c) =>
            normalizeSearchText(c.name).includes(q) ||
            (c.phone ?? '').toLowerCase().includes(q)
        )
      : customers;
    return list.slice(0, 12);
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const computedLines = useMemo(() => {
    return lines.map((line) => {
      const parsedQty = parseDecimalInput(line.quantityText);
      const quantityKg =
        parsedQty !== null && parsedQty > 0 ? convertToKg(parsedQty, line.unit) : 0;
      const parsedPrice = parseVndInput(line.priceText);
      const unitPrice = parsedPrice !== null ? parsedPrice : 0;
      const lineTotal = calculateLineTotal(quantityKg, unitPrice);

      return {
        ...line,
        parsedQty,
        quantityKg,
        parsedPrice,
        unitPrice,
        lineTotal,
      };
    });
  }, [lines]);

  const orderTotal = useMemo(
    () => computedLines.reduce((sum, l) => sum + l.lineTotal, 0),
    [computedLines]
  );

  const parsedPartialAmount = parseVndInput(partialAmountText);
  const previewDebt = useMemo(() => {
    if (isEditing && editingOrder) {
      return Math.max(0, orderTotal - editingOrder.paid_amount);
    }
    if (paymentMode === 'full') return 0;
    if (paymentMode === 'debt') return orderTotal;
    const paid = parsedPartialAmount ?? 0;
    return Math.max(0, orderTotal - paid);
  }, [isEditing, editingOrder, orderTotal, paymentMode, parsedPartialAmount]);

  function addProductLine(product: Product) {
    setSubmitError(null);
    setLines((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        productId: product.id,
        productName: product.name,
        quantityText: '1',
        unit: 'kg',
        priceText: String(product.default_price),
      },
    ]);
  }

  function updateLine(localId: string, patch: Partial<DraftOrderLine>) {
    setSubmitError(null);
    setLines((prev) =>
      prev.map((line) => (line.localId === localId ? { ...line, ...patch } : line))
    );
  }

  function removeLine(localId: string) {
    setLines((prev) => prev.filter((line) => line.localId !== localId));
  }

  async function handleCreateQuickCustomer(e: FormEvent) {
    e.preventDefault();
    setQuickCustError(null);

    const name = quickCustName.trim();
    if (!name) {
      setQuickCustError('Vui lòng nhập tên khách hàng.');
      return;
    }

    setSavingQuickCust(true);
    try {
      const created = await createCustomer({
        name,
        phone: quickCustPhone,
      });
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomerId(created.id);
      setCustomerSearch('');
      setQuickCustomerOpen(false);
      setQuickCustName('');
      setQuickCustPhone('');
      showToast('success', `Đã thêm và chọn khách "${created.name}".`);
    } catch (err) {
      setQuickCustError(
        err instanceof Error ? err.message : 'Không thêm được khách hàng.'
      );
    } finally {
      setSavingQuickCust(false);
    }
  }

  async function handleSaveOrder(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedCustomerId) {
      setSubmitError('Vui lòng chọn khách hàng (hoặc bấm + Khách mới).');
      return;
    }
    if (lines.length === 0) {
      setSubmitError('Vui lòng chọn ít nhất 1 mặt hàng.');
      return;
    }

    for (const line of computedLines) {
      if (line.parsedQty === null || line.quantityKg <= 0) {
        setSubmitError(`Số lượng của "${line.productName}" phải lớn hơn 0.`);
        return;
      }
      if (line.parsedPrice === null || line.unitPrice < 0) {
        setSubmitError(`Giá/kg của "${line.productName}" không hợp lệ.`);
        return;
      }
    }

    if (!isEditing && paymentMode === 'partial') {
      if (parsedPartialAmount === null || parsedPartialAmount <= 0) {
        setSubmitError('Vui lòng nhập số tiền khách đã trả (lớn hơn 0).');
        return;
      }
      if (parsedPartialAmount > orderTotal) {
        setSubmitError('Số tiền trả một phần không được lớn hơn tổng đơn.');
        return;
      }
    }

    const orderItemsPayload = computedLines.map((l) => ({
      product_id: l.productId,
      product_name: l.productName,
      quantity_kg: l.quantityKg,
      unit_price: l.unitPrice,
    }));

    setSubmitting(true);
    try {
      if (isEditing && editingOrder) {
        await updateOrder(editingOrder.id, {
          customer_id: selectedCustomerId,
          order_date: orderDate,
          note: orderNote,
          items: orderItemsPayload,
        });
        showToast('success', 'Đã cập nhật đơn hàng.');
        onSaved?.(orderDate, true);
      } else {
        await createOrder({
          customer_id: selectedCustomerId,
          order_date: orderDate,
          note: orderNote,
          items: orderItemsPayload,
          payment_mode: paymentMode,
          partial_amount: paymentMode === 'partial' ? parsedPartialAmount ?? 0 : undefined,
        });
        showToast('success', `Đã lưu đơn ${formatVnd(orderTotal)}!`);
        setLines([]);
        setOrderNote('');
        setPaymentMode('full');
        setPartialAmountText('');
        setSelectedCustomerId('');
        onSaved?.(orderDate, false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Không lưu được đơn hàng.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingData) {
    return <LoadingState message="Đang tải danh sách mặt hàng & khách hàng..." />;
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border-2 border-red-300 bg-white p-5 text-center shadow-sm">
        <p className="text-base font-bold text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadMasterData()}
          className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-sky-600 px-5 text-base font-bold text-white active:bg-sky-700"
        >
          <RefreshCw className="h-5 w-5" />
          Thử tải lại
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveOrder} className="space-y-4 pb-6">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {isEditing && editingOrder && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase text-amber-900">
              Đang sửa đơn hàng
            </p>
            <p className="truncate text-base font-bold text-slate-900">
              {editingOrder.customer_name} · Đã trả {formatVnd(editingOrder.paid_amount)}
            </p>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="min-h-[44px] shrink-0 rounded-xl border-2 border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-800 active:bg-slate-100"
            >
              Hủy sửa
            </button>
          )}
        </div>
      )}

      {/* BƯỚC 1: CHỌN KHÁCH HÀNG */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-slate-900">1. Khách hàng</h2>
          <button
            type="button"
            onClick={() => {
              setQuickCustError(null);
              setQuickCustomerOpen(true);
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-extrabold text-white shadow-sm active:bg-emerald-700"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Khách mới</span>
          </button>
        </div>

        {selectedCustomer ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border-2 border-sky-600 bg-sky-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-sky-700">Đang chọn</p>
              <p className="truncate text-lg font-extrabold text-slate-900">
                {selectedCustomer.name}
              </p>
              {selectedCustomer.phone && (
                <p className="text-sm font-semibold text-slate-600">
                  {selectedCustomer.phone}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedCustomerId('')}
              className="min-h-[44px] shrink-0 rounded-xl border border-sky-300 bg-white px-3 text-sm font-bold text-sky-800 active:bg-sky-100"
            >
              Đổi khách
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Tìm tên hoặc SĐT khách..."
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-300 bg-slate-50 pr-4 pl-10 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
              />
            </div>

            {filteredCustomers.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-center text-sm font-medium text-slate-600">
                {customers.length === 0
                  ? 'Chưa có khách nào. Bấm "+ Khách mới" ở góc phải để thêm nhanh.'
                  : 'Không thấy khách khớp từ khóa. Bấm "+ Khách mới" để thêm nhanh.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(c.id)}
                    className="min-h-[46px] rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2 text-left text-base font-bold text-slate-800 active:border-sky-600 active:bg-sky-50"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* BƯỚC 2: BẤM CHỌN MẶT HÀNG */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-slate-900">2. Chọn mặt hàng</h2>
          {onNavigateManage && (
            <button
              type="button"
              onClick={onNavigateManage}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-bold text-slate-700 active:bg-slate-200"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Sửa giá / hàng</span>
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <div className="mt-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 p-4 text-center">
            <p className="text-base font-bold text-slate-800">
              Chưa có mặt hàng nào để chọn
            </p>
            {onNavigateManage && (
              <button
                type="button"
                onClick={onNavigateManage}
                className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-sky-600 px-4 text-base font-extrabold text-white active:bg-sky-700"
              >
                <Fish className="h-5 w-5" />
                <span>Vào Danh mục tạo mặt hàng</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProductLine(p)}
                className="flex min-h-[64px] flex-col items-start justify-center rounded-2xl border-2 border-sky-200 bg-sky-50/70 px-3.5 py-2.5 text-left transition active:scale-[0.98] active:border-sky-600 active:bg-sky-100"
              >
                <span className="flex w-full items-center justify-between gap-1 text-base font-extrabold text-slate-900">
                  <span className="truncate">{p.name}</span>
                  <Plus className="h-5 w-5 shrink-0 text-sky-700" />
                </span>
                <span className="mt-0.5 text-sm font-bold text-sky-800">
                  {formatVnd(p.default_price)}/kg
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* DANH SÁCH CÁC DÒNG ĐÃ CHỌN */}
      {computedLines.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-lg font-extrabold text-slate-900">
            Các món trong đơn ({computedLines.length})
          </h2>

          {computedLines.map((line, index) => (
            <div
              key={line.localId}
              className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-extrabold text-slate-900">
                  {index + 1}. {line.productName}
                </h3>
                <button
                  type="button"
                  aria-label={`Xóa ${line.productName}`}
                  onClick={() => removeLine(line.localId)}
                  className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl bg-red-50 text-red-700 active:bg-red-100"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              {/* Chọn đơn vị quy đổi 1 chạm */}
              <div className="mt-3 grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1">
                {WEIGHT_UNIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.unit}
                    type="button"
                    onClick={() => updateLine(line.localId, { unit: opt.unit })}
                    className={`min-h-[42px] rounded-lg text-sm font-extrabold transition ${
                      line.unit === opt.unit
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-700 active:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Nút chọn nhanh số lượng */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_QUANTITIES[line.unit].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateLine(line.localId, { quantityText: preset })}
                    className="min-h-[38px] rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-bold text-slate-800 active:bg-sky-100"
                  >
                    {preset} {WEIGHT_UNIT_OPTIONS.find((u) => u.unit === line.unit)?.label}
                  </button>
                ))}
              </div>

              {/* Nhập số lượng & Giá/kg */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Số lượng ({WEIGHT_UNIT_OPTIONS.find((u) => u.unit === line.unit)?.label})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={line.quantityText}
                    onChange={(e) =>
                      updateLine(line.localId, { quantityText: e.target.value })
                    }
                    placeholder="VD: 1,5"
                    className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-slate-300 px-3 text-lg font-extrabold text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Giá / kg (đ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={line.priceText}
                    onChange={(e) =>
                      updateLine(line.localId, { priceText: e.target.value })
                    }
                    placeholder="0"
                    className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-slate-300 px-3 text-lg font-extrabold text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Hiển thị quy đổi & thành tiền */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-3.5 py-2.5">
                <span className="text-sm font-bold text-slate-700">
                  {line.quantityKg > 0
                    ? `= ${formatKg(line.quantityKg)} × ${formatVnd(line.unitPrice)}`
                    : 'Nhập số lượng > 0'}
                </span>
                <span className="text-lg font-extrabold text-sky-800">
                  {formatVnd(line.lineTotal)}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* BƯỚC 3: THANH TOÁN & LƯU ĐƠN */}
      <section className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
          <span className="text-base font-extrabold uppercase text-slate-700">
            Tổng đơn
          </span>
          <span className="text-3xl font-black text-sky-700">
            {formatVnd(orderTotal)}
          </span>
        </div>

        {!isEditing ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-extrabold uppercase text-slate-600">
              Hình thức trả tiền
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('full')}
                className={`min-h-[52px] rounded-xl border-2 px-2 text-sm font-extrabold transition ${
                  paymentMode === 'full'
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                Trả đủ
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('partial')}
                className={`min-h-[52px] rounded-xl border-2 px-2 text-sm font-extrabold transition ${
                  paymentMode === 'partial'
                    ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                Trả 1 phần
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('debt')}
                className={`min-h-[52px] rounded-xl border-2 px-2 text-sm font-extrabold transition ${
                  paymentMode === 'debt'
                    ? 'border-red-600 bg-red-600 text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                Ghi nợ
              </button>
            </div>

            {paymentMode === 'partial' && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <label className="block text-sm font-bold text-amber-950">
                  Số tiền khách đưa trước (đ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={partialAmountText}
                  onChange={(e) => setPartialAmountText(e.target.value)}
                  placeholder="Ví dụ: 200000"
                  className="mt-1.5 min-h-[50px] w-full rounded-xl border-2 border-amber-400 bg-white px-3 text-lg font-extrabold text-slate-900 focus:border-amber-600 focus:outline-none"
                />
                <div className="mt-2 flex justify-between text-sm font-bold text-amber-950">
                  <span>
                    Đã trả:{' '}
                    {parsedPartialAmount !== null ? formatVnd(parsedPartialAmount) : '0đ'}
                  </span>
                  <span className="text-red-700">Còn nợ: {formatVnd(previewDebt)}</span>
                </div>
              </div>
            )}

            {paymentMode === 'debt' && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-bold text-red-800">
                Khách ghi nợ toàn bộ: {formatVnd(orderTotal)}
              </p>
            )}
          </div>
        ) : (
          editingOrder && (
            <div className="mt-3 space-y-1 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm font-bold">
              <div className="flex justify-between text-emerald-800">
                <span>Khách đã trả trước đó:</span>
                <span>{formatVnd(editingOrder.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Còn nợ sau khi sửa:</span>
                <span>{formatVnd(previewDebt)}</span>
              </div>
            </div>
          )
        )}

        {/* Ngày & Ghi chú gọn */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600">
              Ngày bán
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="mt-1 min-h-[48px] w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base font-bold text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600">
              Ghi chú đơn (nếu có)
            </label>
            <input
              type="text"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="VD: Giao chiều, làm sạch..."
              className="mt-1 min-h-[48px] w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        {submitError && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-bold text-red-800">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 text-xl font-black text-white shadow-lg active:bg-sky-700 disabled:opacity-60"
        >
          {isEditing ? <Save className="h-6 w-6" /> : <Check className="h-6 w-6" />}
          <span>
            {submitting
              ? 'Đang lưu...'
              : isEditing
                ? 'CẬP NHẬT ĐƠN HÀNG'
                : `LƯU ĐƠN · ${formatVnd(orderTotal)}`}
          </span>
        </button>
      </section>

      {/* Modal thêm nhanh khách hàng ngay lúc ghi đơn */}
      {quickCustomerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">
                Thêm nhanh khách mới
              </h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setQuickCustomerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-base font-bold text-slate-800">
                  Tên khách *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  placeholder="Ví dụ: Cô Ba, Chị Hoa..."
                  className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-800">
                  Số điện thoại (tùy chọn)
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  placeholder="09..."
                  className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              {quickCustError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-800">
                  {quickCustError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={savingQuickCust}
                  onClick={() => setQuickCustomerOpen(false)}
                  className="min-h-[52px] rounded-xl border-2 border-slate-300 bg-white text-base font-bold text-slate-800 active:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={savingQuickCust}
                  onClick={(e) => void handleCreateQuickCustomer(e)}
                  className="min-h-[52px] rounded-xl bg-emerald-600 text-base font-extrabold text-white active:bg-emerald-700 disabled:opacity-60"
                >
                  {savingQuickCust ? 'Đang lưu...' : 'Lưu & Chọn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
