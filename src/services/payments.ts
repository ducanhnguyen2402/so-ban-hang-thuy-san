import { supabase } from '../lib/supabase';
import { isValidDateStr } from '../lib/date';
import type {
  CustomerDebtSummary,
  OrderItem,
  OrderWithDetails,
  Payment,
} from '../types/database';

export interface AddPaymentInput {
  order_id: string;
  amount: number;
  payment_date: string;
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
  return `Lỗi dữ liệu thanh toán: ${message}`;
}

interface RawDebtOrderRow {
  id: string;
  user_id: string;
  customer_id: string | null;
  order_date: string;
  total_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  customers: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
  order_items: OrderItem[] | null;
  payments: Payment[] | null;
}

export async function listCustomerDebts(): Promise<{
  totalDebt: number;
  customers: CustomerDebtSummary[];
}> {
  const client = getClient();

  const { data, error } = await client
    .from('orders')
    .select(
      `
      id,
      user_id,
      customer_id,
      order_date,
      total_amount,
      note,
      created_at,
      updated_at,
      customers ( name, phone ),
      order_items ( id, user_id, order_id, product_id, product_name, quantity_kg, unit_price, line_total, created_at ),
      payments ( id, user_id, order_id, amount, payment_date, note, created_at )
    `
    )
    .order('order_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(translateDbError(error.message));
  }

  const byCustomer = new Map<string, CustomerDebtSummary>();

  for (const row of (data ?? []) as RawDebtOrderRow[]) {
    const customerObj = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const items = [...(row.order_items ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const payments = [...(row.payments ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const totalAmount = Number(row.total_amount || 0);
    const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const debtAmount = Math.max(0, totalAmount - paidAmount);

    if (debtAmount <= 0) continue;

    const customerId = row.customer_id ?? '__walkin__';
    const customerName = customerObj?.name ?? 'Khách lẻ';
    const customerPhone = customerObj?.phone ?? null;

    const detailedOrder: OrderWithDetails = {
      id: row.id,
      user_id: row.user_id,
      customer_id: row.customer_id,
      order_date: row.order_date,
      total_amount: totalAmount,
      note: row.note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customer_name: customerName,
      customer_phone: customerPhone,
      items: items.map((item) => ({
        ...item,
        quantity_kg: Number(item.quantity_kg),
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total),
      })),
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      paid_amount: paidAmount,
      debt_amount: debtAmount,
    };

    const existing = byCustomer.get(customerId);
    if (existing) {
      existing.total_debt += debtAmount;
      existing.unpaid_orders_count += 1;
      existing.unpaid_orders.push(detailedOrder);
    } else {
      byCustomer.set(customerId, {
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total_debt: debtAmount,
        unpaid_orders_count: 1,
        unpaid_orders: [detailedOrder],
      });
    }
  }

  const customers = Array.from(byCustomer.values()).sort(
    (a, b) => b.total_debt - a.total_debt
  );
  const totalDebt = customers.reduce((sum, c) => sum + c.total_debt, 0);

  return { totalDebt, customers };
}

export async function addOrderPayment(input: AddPaymentInput): Promise<Payment> {
  const client = getClient();

  if (!input.order_id) {
    throw new Error('Không xác định được đơn hàng cần thu tiền.');
  }
  if (!isValidDateStr(input.payment_date)) {
    throw new Error('Ngày trả tiền không hợp lệ.');
  }

  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền trả phải lớn hơn 0.');
  }

  const { data: orderData, error: orderErr } = await client
    .from('orders')
    .select('total_amount, payments(amount)')
    .eq('id', input.order_id)
    .single();

  if (orderErr || !orderData) {
    throw new Error(translateDbError(orderErr?.message ?? 'Không tìm thấy đơn hàng.'));
  }

  const typedOrder = orderData as {
    total_amount: number;
    payments: { amount: number }[] | null;
  };
  const alreadyPaid = (typedOrder.payments ?? []).reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );
  const remainingDebt = Math.max(0, Number(typedOrder.total_amount || 0) - alreadyPaid);

  if (remainingDebt === 0) {
    throw new Error('Đơn hàng này đã được trả đủ trước đó.');
  }
  if (amount > remainingDebt) {
    throw new Error(
      `Số tiền nhập (${amount.toLocaleString('vi-VN')}đ) vượt quá số còn nợ (${remainingDebt.toLocaleString('vi-VN')}đ).`
    );
  }

  const { data, error } = await client
    .from('payments')
    .insert({
      order_id: input.order_id,
      amount,
      payment_date: input.payment_date,
      note: input.note?.trim() || 'Khách trả nợ',
    })
    .select()
    .single();

  if (error) {
    throw new Error(translateDbError(error.message));
  }
  return data as Payment;
}

export async function deletePayment(paymentId: string): Promise<void> {
  const client = getClient();
  const { error } = await client.from('payments').delete().eq('id', paymentId);
  if (error) {
    throw new Error(translateDbError(error.message));
  }
}
