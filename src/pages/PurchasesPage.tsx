import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { listProducts } from '../services/products';
import {
  createPurchase,
  deletePurchase,
  listPurchasesByDate,
  updatePurchase,
} from '../services/purchases';
import { formatDateVN } from '../lib/date';
import {
  convertToKg,
  formatKg,
  formatVnd,
  parseDecimalInput,
  parseVndInput,
  WEIGHT_UNIT_OPTIONS,
} from '../lib/format';
import type { Product, Purchase, WeightUnit } from '../types/database';
import { DateSwitcher } from '../components/ui/DateSwitcher';
import { LoadingState } from '../components/ui/LoadingState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast, type ToastMessage } from '../components/ui/Toast';

interface PurchasesPageProps {
  selectedDate: string;
  onDateChange: (nextDate: string) => void;
}

export function PurchasesPage({ selectedDate, onDateChange }: PurchasesPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [quantityText, setQuantityText] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [costText, setCostText] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ id: Date.now(), type, text });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [prodList, purchaseList] = await Promise.all([
        listProducts(false),
        listPurchasesByDate(selectedDate),
      ]);
      setProducts(prodList);
      setPurchases(purchaseList);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Không tải được dữ liệu nhập hàng.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetForm() {
    setEditingId(null);
    setSelectedProductId(null);
    setProductName('');
    setQuantityText('');
    setUnit('kg');
    setCostText('');
    setNote('');
    setFormError(null);
  }

  function handleSelectProduct(product: Product) {
    setSelectedProductId(product.id);
    setProductName(product.name);
    setFormError(null);
  }

  function startEditPurchase(item: Purchase) {
    setEditingId(item.id);
    setSelectedProductId(item.product_id);
    setProductName(item.product_name);
    setQuantityText(String(item.quantity_kg).replace('.', ','));
    setUnit('kg');
    setCostText(String(item.cost_amount));
    setNote(item.note ?? '');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const parsedQty = parseDecimalInput(quantityText);
  const convertedKg =
    parsedQty !== null && parsedQty > 0 ? convertToKg(parsedQty, unit) : 0;
  const parsedCost = parseVndInput(costText);
  const avgCostPerKg =
    convertedKg > 0 && parsedCost !== null ? Math.round(parsedCost / convertedKg) : null;

  const totals = useMemo(() => {
    return purchases.reduce(
      (acc, item) => {
        acc.totalCost += item.cost_amount;
        acc.totalKg += item.quantity_kg;
        return acc;
      },
      { totalCost: 0, totalKg: 0 }
    );
  }, [purchases]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = productName.trim();
    if (!trimmedName) {
      setFormError('Vui lòng chọn hoặc nhập tên mặt hàng.');
      return;
    }
    if (parsedQty === null || convertedKg <= 0) {
      setFormError('Số lượng nhập phải lớn hơn 0.');
      return;
    }
    if (parsedCost === null || parsedCost < 0) {
      setFormError('Tiền vốn nhập phải là số không âm.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updatePurchase(editingId, {
          product_id: selectedProductId,
          product_name: trimmedName,
          purchase_date: selectedDate,
          quantity_kg: convertedKg,
          cost_amount: parsedCost,
          note,
        });
        setPurchases((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        showToast('success', `Đã cập nhật nhập "${updated.product_name}".`);
      } else {
        const created = await createPurchase({
          product_id: selectedProductId,
          product_name: trimmedName,
          purchase_date: selectedDate,
          quantity_kg: convertedKg,
          cost_amount: parsedCost,
          note,
        });
        setPurchases((prev) => [created, ...prev]);
        showToast(
          'success',
          `Đã ghi nhập ${created.product_name} (${formatVnd(created.cost_amount)}).`
        );
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không lưu được phiếu nhập.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePurchase(deleteTarget.id);
      setPurchases((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      showToast('success', `Đã xóa mục nhập "${deleteTarget.product_name}".`);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Không xóa được mục nhập.'
      );
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <DateSwitcher
        date={selectedDate}
        onChange={(next) => {
          resetForm();
          onDateChange(next);
        }}
      />

      {/* Tóm tắt vốn nhập trong ngày */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3.5 shadow-sm">
          <p className="text-xs font-bold uppercase text-sky-800">
            Tổng vốn nhập ({purchases.length} lần)
          </p>
          <p className="mt-1 text-xl font-black text-sky-900">
            {formatVnd(totals.totalCost)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-600">Tổng lượng nhập</p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {formatKg(Math.round(totals.totalKg * 1000) / 1000)}
          </p>
        </div>
      </div>

      {/* Form ghi nhanh nhập hàng */}
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${
          editingId ? 'border-amber-400' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-slate-900">
            {editingId ? 'Sửa phiếu nhập hàng' : 'Ghi nhanh nhập hàng'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 active:bg-slate-100"
            >
              Hủy sửa
            </button>
          )}
        </div>

        {products.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase text-slate-600">
              Bấm chọn nhanh mặt hàng
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {products.map((p) => {
                const isSelected =
                  selectedProductId === p.id ||
                  productName.trim().toLowerCase() === p.name.toLowerCase();
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={`min-h-[44px] rounded-xl border-2 px-3.5 text-base font-extrabold transition ${
                      isSelected
                        ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                        : 'border-slate-300 bg-slate-50 text-slate-800 active:bg-sky-50'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-bold text-slate-800">
              Tên mặt hàng *
            </label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value);
                setSelectedProductId(null);
              }}
              placeholder="Ví dụ: Cua gạch, Ốc hương..."
              className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-slate-300 px-3.5 text-base font-bold text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          {/* Đơn vị quy đổi */}
          <div>
            <p className="text-xs font-bold uppercase text-slate-600">
              Đơn vị cân nhập
            </p>
            <div className="mt-1 grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1">
              {WEIGHT_UNIT_OPTIONS.map((opt) => (
                <button
                  key={opt.unit}
                  type="button"
                  onClick={() => setUnit(opt.unit)}
                  className={`min-h-[42px] rounded-lg text-sm font-extrabold transition ${
                    unit === opt.unit
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-700 active:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-800">
                Số lượng ({WEIGHT_UNIT_OPTIONS.find((u) => u.unit === unit)?.label}) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={quantityText}
                onChange={(e) => setQuantityText(e.target.value)}
                placeholder="VD: 15"
                className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-slate-300 px-3.5 text-lg font-extrabold text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800">
                Tiền vốn (đ) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={costText}
                onChange={(e) => setCostText(e.target.value)}
                placeholder="VD: 2500000"
                className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-slate-300 px-3.5 text-lg font-extrabold text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          {(convertedKg > 0 || parsedCost !== null) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-3.5 py-2.5 text-sm font-bold text-sky-900">
              <span>
                Quy đổi: {convertedKg > 0 ? formatKg(convertedKg) : '0 kg'}
                {avgCostPerKg !== null ? ` (~${formatVnd(avgCostPerKg)}/kg)` : ''}
              </span>
              <span>Vốn: {parsedCost !== null ? formatVnd(parsedCost) : '0đ'}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-800">
              Ghi chú (tùy chọn)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Lấy từ vựa anh Tư..."
              className="mt-1 min-h-[48px] w-full rounded-xl border-2 border-slate-300 px-3.5 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          {formError && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-bold text-red-800">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-lg font-extrabold text-white shadow-md active:bg-sky-700 disabled:opacity-60"
          >
            {editingId ? <Save className="h-6 w-6" /> : <PackagePlus className="h-6 w-6" />}
            <span>
              {saving
                ? 'Đang lưu...'
                : editingId
                  ? 'CẬP NHẬT NHẬP HÀNG'
                  : 'LƯU NHẬP HÀNG'}
            </span>
          </button>
        </div>
      </form>

      {/* Danh sách các lần nhập trong ngày */}
      <section className="space-y-2.5">
        <h3 className="px-1 text-base font-extrabold text-slate-800">
          Danh sách nhập ngày {formatDateVN(selectedDate)}
        </h3>

        {loading ? (
          <LoadingState message="Đang tải danh sách nhập hàng..." />
        ) : loadError ? (
          <div className="rounded-2xl border-2 border-red-300 bg-white p-5 text-center shadow-sm">
            <p className="text-base font-bold text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-sky-600 px-5 text-base font-bold text-white active:bg-sky-700"
            >
              <RefreshCw className="h-5 w-5" />
              Thử lại
            </button>
          </div>
        ) : purchases.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-base text-slate-600">
            Chưa có lượt nhập hàng nào trong ngày này.
          </div>
        ) : (
          purchases.map((item) => {
            const unitCost =
              item.quantity_kg > 0 ? Math.round(item.cost_amount / item.quantity_kg) : 0;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-lg font-extrabold text-slate-900">
                      {item.product_name}
                    </h4>
                    <p className="mt-0.5 text-sm font-bold text-slate-700">
                      {formatKg(item.quantity_kg)} · Vốn {formatVnd(unitCost)}/kg
                    </p>
                    {item.note && (
                      <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                    )}
                  </div>

                  <p className="shrink-0 text-lg font-black text-sky-800">
                    {formatVnd(item.cost_amount)}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => startEditPurchase(item)}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white text-sm font-bold text-slate-800 active:bg-slate-100"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 border-red-200 bg-red-50 text-sm font-bold text-red-700 active:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa mục nhập hàng này?"
        message={`Bạn có chắc muốn xóa phiếu nhập "${deleteTarget?.product_name ?? ''}" (${
          deleteTarget ? formatVnd(deleteTarget.cost_amount) : ''
        }) không?`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
