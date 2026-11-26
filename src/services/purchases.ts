import { supabase } from '../lib/supabase';
import { isValidDateStr } from '../lib/date';
import type { Purchase } from '../types/database';

export interface PurchaseInput {
  product_id: string | null;
  product_name: string;
  purchase_date: string;
  quantity_kg: number;
  cost_amount: number;
  note?: string;
}

function getClient() {
  if (!supabase) {
    throw new Error('Chưa cấu hình kết nối Supabase.');
  }
  return supabase;
}

function translateDbError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng.';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Phiên đăng nhập hết hạn hoặc không có quyền thao tác. Vui lòng đăng nhập lại.';
  }
  return `Lỗi dữ liệu nhập hàng: ${message}`;
}

function validatePurchaseInput(input: PurchaseInput) {
  const productName = input.product_name.trim();
  if (!productName) {
    throw new Error('Vui lòng chọn hoặc nhập tên mặt hàng.');
  }
  if (!isValidDateStr(input.purchase_date)) {
    throw new Error('Ngày nhập hàng không hợp lệ.');
  }
  if (!Number.isFinite(input.quantity_kg) || input.quantity_kg <= 0) {
    throw new Error('Số ký nhập phải lớn hơn 0.');
  }
  if (!Number.isFinite(input.cost_amount) || input.cost_amount < 0) {
    throw new Error('Tiền vốn nhập không được âm.');
  }

  return {
    product_id: input.product_id,
    product_name: productName,
    purchase_date: input.purchase_date,
    quantity_kg: Math.round(input.quantity_kg * 1000) / 1000,
    cost_amount: Math.round(input.cost_amount),
    note: input.note?.trim() || null,
  };
}

export async function listPurchasesByDate(purchaseDate: string): Promise<Purchase[]> {
  const client = getClient();
  if (!isValidDateStr(purchaseDate)) {
    throw new Error('Ngày cần xem không hợp lệ.');
  }

  const { data, error } = await client
    .from('purchases')
    .select('*')
    .eq('purchase_date', purchaseDate)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(translateDbError(error.message));
  }

  return ((data ?? []) as Purchase[]).map((row) => ({
    ...row,
    quantity_kg: Number(row.quantity_kg),
    cost_amount: Number(row.cost_amount),
  }));
}

export async function createPurchase(input: PurchaseInput): Promise<Purchase> {
  const client = getClient();
  const validated = validatePurchaseInput(input);

  const { data, error } = await client
    .from('purchases')
    .insert(validated)
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  const row = data as Purchase;
  return {
    ...row,
    quantity_kg: Number(row.quantity_kg),
    cost_amount: Number(row.cost_amount),
  };
}

export async function updatePurchase(id: string, input: PurchaseInput): Promise<Purchase> {
  const client = getClient();
  const validated = validatePurchaseInput(input);

  const { data, error } = await client
    .from('purchases')
    .update(validated)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  const row = data as Purchase;
  return {
    ...row,
    quantity_kg: Number(row.quantity_kg),
    cost_amount: Number(row.cost_amount),
  };
}

export async function deletePurchase(id: string): Promise<void> {
  const client = getClient();
  const { error } = await client.from('purchases').delete().eq('id', id);
  if (error) {
    throw new Error(translateDbError(error.message));
  }
}
