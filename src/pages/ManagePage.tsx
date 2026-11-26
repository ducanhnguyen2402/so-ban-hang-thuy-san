import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Eye,
  EyeOff,
  Fish,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  createProduct,
  listProducts,
  seedSampleProducts,
  setProductActive,
  updateProduct,
} from '../services/products';
import {
  createCustomer,
  listCustomers,
  setCustomerActive,
  updateCustomer,
} from '../services/customers';
import { formatVnd, normalizeSearchText, parseVndInput } from '../lib/format';
import type { Customer, Product } from '../types/database';
import { LoadingState } from '../components/ui/LoadingState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast, type ToastMessage } from '../components/ui/Toast';

type ManageSection = 'products' | 'customers';

interface ProductModalState {
  open: boolean;
  editing: Product | null;
  name: string;
  priceText: string;
}

interface CustomerModalState {
  open: boolean;
  editing: Customer | null;
  name: string;
  phone: string;
  note: string;
}

interface HideTarget {
  kind: 'product' | 'customer';
  id: string;
  name: string;
  nextActive: boolean;
}

export function ManagePage() {
  const [section, setSection] = useState<ManageSection>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showHiddenProducts, setShowHiddenProducts] = useState(false);
  const [showHiddenCustomers, setShowHiddenCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [seeding, setSeeding] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [productModal, setProductModal] = useState<ProductModalState>({
    open: false,
    editing: null,
    name: '',
    priceText: '',
  });

  const [customerModal, setCustomerModal] = useState<CustomerModalState>({
    open: false,
    editing: null,
    name: '',
    phone: '',
    note: '',
  });

  const [hideTarget, setHideTarget] = useState<HideTarget | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ id: Date.now(), type, text });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [productList, customerList] = await Promise.all([
        listProducts(true),
        listCustomers(true),
      ]);
      setProducts(productList);
      setCustomers(customerList);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu danh mục.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeProductCount = useMemo(
    () => products.filter((p) => p.is_active).length,
    [products]
  );

  const activeCustomerCount = useMemo(
    () => customers.filter((c) => c.is_active).length,
    [customers]
  );

  const visibleProducts = useMemo(() => {
    return products.filter((p) => (showHiddenProducts ? true : p.is_active));
  }, [products, showHiddenProducts]);

  const visibleCustomers = useMemo(() => {
    const query = normalizeSearchText(customerSearch);
    return customers.filter((c) => {
      if (!showHiddenCustomers && !c.is_active) return false;
      if (!query) return true;
      const inName = normalizeSearchText(c.name).includes(query);
      const inPhone = (c.phone ?? '').toLowerCase().includes(query);
      return inName || inPhone;
    });
  }, [customers, showHiddenCustomers, customerSearch]);

  function openNewProductModal() {
    setFormError(null);
    setProductModal({
      open: true,
      editing: null,
      name: '',
      priceText: '',
    });
  }

  function openEditProductModal(product: Product) {
    setFormError(null);
    setProductModal({
      open: true,
      editing: product,
      name: product.name,
      priceText: String(product.default_price),
    });
  }

  function openNewCustomerModal() {
    setFormError(null);
    setCustomerModal({
      open: true,
      editing: null,
      name: '',
      phone: '',
      note: '',
    });
  }

  function openEditCustomerModal(customer: Customer) {
    setFormError(null);
    setCustomerModal({
      open: true,
      editing: customer,
      name: customer.name,
      phone: customer.phone ?? '',
      note: customer.note ?? '',
    });
  }

  async function handleSeedSamples() {
    setSeeding(true);
    try {
      await seedSampleProducts();
      const updated = await listProducts(true);
      setProducts(updated);
      showToast('success', 'Đã thêm các mặt hàng mẫu (Cua, Ốc, Ngao, Trạch, Lươn).');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Không thêm được mặt hàng mẫu.');
    } finally {
      setSeeding(false);
    }
  }

  async function handleSubmitProduct(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = productModal.name.trim();
    if (!trimmedName) {
      setFormError('Vui lòng nhập tên mặt hàng.');
      return;
    }

    const parsedPrice = parseVndInput(productModal.priceText);
    if (parsedPrice === null || parsedPrice < 0) {
      setFormError('Giá bán phải là số nguyên không âm (ví dụ: 180000).');
      return;
    }

    setSavingForm(true);
    try {
      if (productModal.editing) {
        const updated = await updateProduct(productModal.editing.id, {
          name: trimmedName,
          default_price: parsedPrice,
          unit: 'kg',
        });
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast('success', `Đã cập nhật mặt hàng "${updated.name}".`);
      } else {
        const created = await createProduct({
          name: trimmedName,
          default_price: parsedPrice,
          unit: 'kg',
        });
        setProducts((prev) => [...prev, created]);
        showToast('success', `Đã thêm mặt hàng "${created.name}".`);
      }
      setProductModal((prev) => ({ ...prev, open: false }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không lưu được mặt hàng.');
    } finally {
      setSavingForm(false);
    }
  }

  async function handleSubmitCustomer(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = customerModal.name.trim();
    if (!trimmedName) {
      setFormError('Vui lòng nhập tên khách hàng.');
      return;
    }

    setSavingForm(true);
    try {
      if (customerModal.editing) {
        const updated = await updateCustomer(customerModal.editing.id, {
          name: trimmedName,
          phone: customerModal.phone,
          note: customerModal.note,
        });
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast('success', `Đã cập nhật khách "${updated.name}".`);
      } else {
        const created = await createCustomer({
          name: trimmedName,
          phone: customerModal.phone,
          note: customerModal.note,
        });
        setCustomers((prev) => [...prev, created]);
        showToast('success', `Đã thêm khách "${created.name}".`);
      }
      setCustomerModal((prev) => ({ ...prev, open: false }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không lưu được khách hàng.');
    } finally {
      setSavingForm(false);
    }
  }

  async function handleToggleActive(target: HideTarget) {
    setTogglingActive(true);
    try {
      if (target.kind === 'product') {
        const updated = await setProductActive(target.id, target.nextActive);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast(
          'success',
          target.nextActive
            ? `Đã hiện lại "${target.name}".`
            : `Đã ẩn mặt hàng "${target.name}".`
        );
      } else {
        const updated = await setCustomerActive(target.id, target.nextActive);
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast(
          'success',
          target.nextActive
            ? `Đã hiện lại khách "${target.name}".`
            : `Đã ẩn khách "${target.name}".`
        );
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Không cập nhật được trạng thái.');
    } finally {
      setTogglingActive(false);
      setHideTarget(null);
    }
  }

  function handleRequestActiveChange(target: HideTarget) {
    if (!target.nextActive) {
      setHideTarget(target);
    } else {
      void handleToggleActive(target);
    }
  }

  const parsedPreviewPrice = parseVndInput(productModal.priceText);

  if (loading) {
    return <LoadingState message="Đang tải danh sách mặt hàng và khách hàng..." />;
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border-2 border-red-300 bg-white p-5 text-center shadow-sm">
        <p className="text-base font-bold text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-sky-600 px-5 text-base font-bold text-white active:bg-sky-700"
        >
          <RefreshCw className="h-5 w-5" />
          Thử tải lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Thanh chuyển Mặt hàng / Khách hàng */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setSection('products')}
          className={`flex min-h-[50px] items-center justify-center gap-2 rounded-xl text-base font-extrabold transition ${
            section === 'products'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-700 active:bg-slate-100'
          }`}
        >
          <Fish className="h-5 w-5" />
          <span>Mặt hàng ({activeProductCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('customers')}
          className={`flex min-h-[50px] items-center justify-center gap-2 rounded-xl text-base font-extrabold transition ${
            section === 'customers'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-700 active:bg-slate-100'
          }`}
        >
          <Users className="h-5 w-5" />
          <span>Khách ({activeCustomerCount})</span>
        </button>
      </div>

      {section === 'products' ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={openNewProductModal}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-lg font-extrabold text-white shadow-md active:bg-sky-700"
          >
            <Plus className="h-6 w-6" />
            <span>Thêm mặt hàng mới</span>
          </button>

          {activeProductCount === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-4 text-center">
              <p className="text-base font-bold text-slate-800">
                Chưa có mặt hàng nào trong sổ
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Bấm nút dưới để tạo nhanh 5 mặt hàng hay bán (có thể sửa giá lại sau):
              </p>
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedSamples}
                className="mt-3 inline-flex min-h-[50px] items-center gap-2 rounded-xl bg-emerald-600 px-5 text-base font-extrabold text-white shadow-sm active:bg-emerald-700 disabled:opacity-60"
              >
                <Sparkles className="h-5 w-5" />
                {seeding ? 'Đang tạo...' : 'Tạo mẫu: Cua, Ốc, Ngao, Trạch, Lươn'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-bold text-slate-600">
              Hiển thị {visibleProducts.length} mặt hàng
            </span>
            <button
              type="button"
              onClick={() => setShowHiddenProducts((v) => !v)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 active:bg-slate-100"
            >
              {showHiddenProducts ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span>Bớt mặt hàng ẩn</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span>Xem cả mặt hàng ẩn</span>
                </>
              )}
            </button>
          </div>

          {visibleProducts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-base text-slate-600">
              Không có mặt hàng nào đang hiển thị.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleProducts.map((product) => (
                <div
                  key={product.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    product.is_active
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-300 bg-slate-100 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {product.name}
                        </h3>
                        {!product.is_active && (
                          <span className="rounded-lg bg-slate-300 px-2 py-0.5 text-xs font-bold text-slate-800">
                            Đang ẩn
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-base font-bold text-sky-700">
                        {formatVnd(product.default_price)} / {product.unit}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditProductModal(product)}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 active:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Sửa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleRequestActiveChange({
                            kind: 'product',
                            id: product.id,
                            name: product.name,
                            nextActive: !product.is_active,
                          })
                        }
                        className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold ${
                          product.is_active
                            ? 'border-amber-300 bg-amber-50 text-amber-900 active:bg-amber-100'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-900 active:bg-emerald-100'
                        }`}
                      >
                        {product.is_active ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            <span>Ẩn</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            <span>Hiện lại</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <button
            type="button"
            onClick={openNewCustomerModal}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-lg font-extrabold text-white shadow-md active:bg-sky-700"
          >
            <UserPlus className="h-6 w-6" />
            <span>Thêm khách hàng mới</span>
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Tìm tên khách hoặc số điện thoại..."
              className="min-h-[50px] w-full rounded-2xl border-2 border-slate-300 bg-white pr-4 pl-11 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-bold text-slate-600">
              Hiển thị {visibleCustomers.length} khách hàng
            </span>
            <button
              type="button"
              onClick={() => setShowHiddenCustomers((v) => !v)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 active:bg-slate-100"
            >
              {showHiddenCustomers ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span>Bớt khách ẩn</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span>Xem cả khách ẩn</span>
                </>
              )}
            </button>
          </div>

          {visibleCustomers.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-base text-slate-600">
              {customerSearch.trim()
                ? 'Không tìm thấy khách hàng nào khớp từ khóa.'
                : 'Chưa có khách hàng nào. Bấm "Thêm khách hàng mới" để lưu khách quen.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    customer.is_active
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-300 bg-slate-100 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {customer.name}
                        </h3>
                        {!customer.is_active && (
                          <span className="rounded-lg bg-slate-300 px-2 py-0.5 text-xs font-bold text-slate-800">
                            Đang ẩn
                          </span>
                        )}
                      </div>

                      {customer.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          className="mt-1 inline-flex items-center gap-1.5 text-base font-semibold text-sky-700 underline-offset-2 hover:underline"
                        >
                          <Phone className="h-4 w-4" />
                          <span>{customer.phone}</span>
                        </a>
                      )}

                      {customer.note && (
                        <p className="mt-1 text-sm text-slate-600">{customer.note}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditCustomerModal(customer)}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 active:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Sửa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleRequestActiveChange({
                            kind: 'customer',
                            id: customer.id,
                            name: customer.name,
                            nextActive: !customer.is_active,
                          })
                        }
                        className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold ${
                          customer.is_active
                            ? 'border-amber-300 bg-amber-50 text-amber-900 active:bg-amber-100'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-900 active:bg-emerald-100'
                        }`}
                      >
                        {customer.is_active ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            <span>Ẩn</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            <span>Hiện lại</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal Thêm / Sửa Mặt hàng */}
      {productModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitProduct}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">
                {productModal.editing ? 'Sửa mặt hàng' : 'Thêm mặt hàng mới'}
              </h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setProductModal((prev) => ({ ...prev, open: false }))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-base font-bold text-slate-800">
                  Tên mặt hàng *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={productModal.name}
                  onChange={(e) =>
                    setProductModal((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ví dụ: Cua gạch, Ốc hương, Ngao..."
                  className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-800">
                  Giá bán mặc định (đồng / kg) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={productModal.priceText}
                  onChange={(e) =>
                    setProductModal((prev) => ({ ...prev, priceText: e.target.value }))
                  }
                  placeholder="Ví dụ: 180000"
                  className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-4 text-base font-bold text-slate-900 focus:border-sky-600 focus:outline-none"
                />
                <p className="mt-1.5 text-sm font-semibold text-sky-700">
                  Hiển thị:{' '}
                  {parsedPreviewPrice !== null
                    ? `${formatVnd(parsedPreviewPrice)} / kg`
                    : 'Nhập số tiền không âm'}
                </p>
              </div>

              {formError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={savingForm}
                  onClick={() => setProductModal((prev) => ({ ...prev, open: false }))}
                  className="min-h-[52px] rounded-xl border-2 border-slate-300 bg-white text-base font-bold text-slate-800 active:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="min-h-[52px] rounded-xl bg-sky-600 text-base font-extrabold text-white active:bg-sky-700 disabled:opacity-60"
                >
                  {savingForm ? 'Đang lưu...' : 'Lưu lại'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Thêm / Sửa Khách hàng */}
      {customerModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitCustomer}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">
                {customerModal.editing ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}
              </h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setCustomerModal((prev) => ({ ...prev, open: false }))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-base font-bold text-slate-800">
                  Tên khách hàng *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={customerModal.name}
                  onChange={(e) =>
                    setCustomerModal((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ví dụ: Chị Lan quán lẩu, Anh Hùng..."
                  className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-800">
                  Số điện thoại (không bắt buộc)
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={customerModal.phone}
                  onChange={(e) =>
                    setCustomerModal((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="Ví dụ: 0912345678"
                  className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-800">
                  Ghi chú (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={customerModal.note}
                  onChange={(e) =>
                    setCustomerModal((prev) => ({ ...prev, note: e.target.value }))
                  }
                  placeholder="Ví dụ: Hay lấy cua buổi sáng, giao cổng sau..."
                  className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={savingForm}
                  onClick={() => setCustomerModal((prev) => ({ ...prev, open: false }))}
                  className="min-h-[52px] rounded-xl border-2 border-slate-300 bg-white text-base font-bold text-slate-800 active:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="min-h-[52px] rounded-xl bg-sky-600 text-base font-extrabold text-white active:bg-sky-700 disabled:opacity-60"
                >
                  {savingForm ? 'Đang lưu...' : 'Lưu lại'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Xác nhận khi ẩn mặt hàng hoặc khách hàng */}
      <ConfirmDialog
        open={Boolean(hideTarget)}
        title={
          hideTarget?.kind === 'product'
            ? 'Ẩn mặt hàng này?'
            : 'Ẩn khách hàng này?'
        }
        message={
          hideTarget?.kind === 'product'
            ? `"${hideTarget.name}" sẽ không hiện ở màn hình Ghi đơn mới, nhưng các đơn cũ vẫn giữ nguyên. Bạn có thể hiện lại bất kỳ lúc nào.`
            : `"${hideTarget?.name ?? ''}" sẽ được ẩn khỏi danh sách chọn nhanh, lịch sử đơn và công nợ cũ vẫn được giữ nguyên.`
        }
        confirmLabel="Đồng ý ẩn"
        danger={false}
        loading={togglingActive}
        onConfirm={() => hideTarget && void handleToggleActive(hideTarget)}
        onCancel={() => setHideTarget(null)}
      />
    </div>
  );
}
