import { supabase } from '../lib/supabase';
import { normalizeSearchText } from '../lib/format';
import type { Product } from '../types/database';

export interface ProductInput {
  name: string;
  default_price: number;
  unit?: string;
}

const SAMPLE_PRODUCTS: ReadonlyArray<ProductInput & { sort_order: number }> = [
  { name: 'Cua', default_price: 350000, unit: 'kg', sort_order: 1 },
  { name: 'Ốc', default_price: 60000, unit: 'kg', sort_order: 2 },
  { name: 'Ngao', default_price: 45000, unit: 'kg', sort_order: 3 },
  { name: 'Trạch', default_price: 160000, unit: 'kg', sort_order: 4 },
  { name: 'Lươn', default_price: 180000, unit: 'kg', sort_order: 5 },
];

function getClient() {
  if (!supabase) {
    throw new Error('Chưa cấu hình kết nối Supabase.');
  }
  return supabase;
}

function validateProductInput(input: ProductInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Vui lòng nhập tên mặt hàng.');
  }
  if (!Number.isFinite(input.default_price) || input.default_price < 0) {
    throw new Error('Giá bán mặc định không được âm.');
  }
  const unit = (input.unit ?? 'kg').trim() || 'kg';
  return {
    name,
    default_price: Math.round(input.default_price),
    unit,
  };
}

function translateDbError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng.';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Phiên đăng nhập hết hạn hoặc không có quyền thao tác. Vui lòng đăng nhập lại.';
  }
  return `Lỗi dữ liệu mặt hàng: ${message}`;
}

export async function listProducts(includeHidden = true): Promise<Product[]> {
  const client = getClient();
  let query = client
    .from('products')
    .select('*')
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!includeHidden) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return (data ?? []) as Product[];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const client = getClient();
  const validated = validateProductInput(input);

  const { data, error } = await client
    .from('products')
    .insert({
      name: validated.name,
      default_price: validated.default_price,
      unit: validated.unit,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return data as Product;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const client = getClient();
  const validated = validateProductInput(input);

  const { data, error } = await client
    .from('products')
    .update({
      name: validated.name,
      default_price: validated.default_price,
      unit: validated.unit,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return data as Product;
}

export async function setProductActive(id: string, isActive: boolean): Promise<Product> {
  const client = getClient();

  const { data, error } = await client
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return data as Product;
}

export async function seedSampleProducts(): Promise<Product[]> {
  const client = getClient();
  const existing = await listProducts(true);
  const existingNames = new Set(existing.map((p) => normalizeSearchText(p.name)));

  const toInsert = SAMPLE_PRODUCTS.filter(
    (item) => !existingNames.has(normalizeSearchText(item.name))
  ).map((item) => ({
    name: item.name,
    default_price: item.default_price,
    unit: item.unit ?? 'kg',
    sort_order: item.sort_order,
    is_active: true,
  }));

  if (toInsert.length === 0) {
    return existing;
  }

  const { data, error } = await client.from('products').insert(toInsert).select();
  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return (data ?? []) as Product[];
}
