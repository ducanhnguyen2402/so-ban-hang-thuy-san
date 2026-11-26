import { supabase } from '../lib/supabase';
import type { Customer } from '../types/database';

export interface CustomerInput {
  name: string;
  phone?: string;
  note?: string;
}

function getClient() {
  if (!supabase) {
    throw new Error('Chưa cấu hình kết nối Supabase.');
  }
  return supabase;
}

function validateCustomerInput(input: CustomerInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Vui lòng nhập tên khách hàng.');
  }
  const phone = input.phone?.trim() || null;
  const note = input.note?.trim() || null;
  return { name, phone, note };
}

function translateDbError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng.';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Phiên đăng nhập hết hạn hoặc không có quyền thao tác. Vui lòng đăng nhập lại.';
  }
  return `Lỗi dữ liệu khách hàng: ${message}`;
}

export async function listCustomers(includeHidden = true): Promise<Customer[]> {
  const client = getClient();
  let query = client
    .from('customers')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (!includeHidden) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return (data ?? []) as Customer[];
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const client = getClient();
  const validated = validateCustomerInput(input);

  const { data, error } = await client
    .from('customers')
    .insert({
      name: validated.name,
      phone: validated.phone,
      note: validated.note,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return data as Customer;
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const client = getClient();
  const validated = validateCustomerInput(input);

  const { data, error } = await client
    .from('customers')
    .update({
      name: validated.name,
      phone: validated.phone,
      note: validated.note,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return data as Customer;
}

export async function setCustomerActive(id: string, isActive: boolean): Promise<Customer> {
  const client = getClient();

  const { data, error } = await client
    .from('customers')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return data as Customer;
}
