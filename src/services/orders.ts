import { supabase } from '../lib/supabase';
import { isValidDateStr } from '../lib/date';
import { calculateLineTotal } from '../lib/format';
import type {
  OrderItem,
  OrderWithDetails,
  Payment,
  PaymentMode,
} from '../types/database';

export interface OrderLineInput {
  product_id: string | null;
  product_name: string;
  quantity_kg: number;
  unit_price: number;
}

export interface CreateOrderInput {
  customer_id: string;
  order_date: string;
  note?: string;
  items: OrderLineInput[];
  payment_mode: PaymentMode;
  partial_amount?: number;
}

export interface UpdateOrderInput {
  customer_id: string;
  order_date: string;
  note?: string;
  items: OrderLineInput[];
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
  return `Lỗi dữ liệu đơn hàng: ${message}`;
}

function validateAndComputeItems(items: OrderLineInput[]) {
  if (items.length === 0) {
    throw new Error('Vui lòng thêm ít nhất 1 mặt hàng vào đơn.');
  }

  const normalized = items.map((item, idx) => {
    const productName = item.product_name.trim();
    if (!productName) {
      throw new Error(`Dòng hàng số ${idx + 1} chưa có tên mặt hàng.`);
    }
    if (!Number.isFinite(item.quantity_kg) || item.quantity_kg <= 0) {
      throw new Error(`Số ký của "${productName}" phải lớn hơn 0.`);
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      throw new Error(`Giá bán của "${productName}" không được âm.`);
    }

    const quantityKg = Math.round(item.quantity_kg * 1000) / 1000;
    const unitPrice = Math.round(item.unit_price);
    const lineTotal = calculateLineTotal(quantityKg, unitPrice);

    return {
      product_id: item.product_id,
      product_name: productName,
      quantity_kg: quantityKg,
      unit_price: unitPrice,
      line_total: lineTotal,
    };
  });

  const totalAmount = normalized.reduce((sum, item) => sum + item.line_total, 0);
  return { normalized, totalAmount };
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  const client = getClient();

  if (!input.customer_id) {
    throw new Error('Vui lòng chọn khách hàng.');
  }
  if (!isValidDateStr(input.order_date)) {
    throw new Error('Ngày ghi đơn không hợp lệ.');
  }

  const { normalized, totalAmount } = validateAndComputeItems(input.items);

  let paidNow = 0;
  if (input.payment_mode === 'full') {
    paidNow = totalAmount;
  } else if (input.payment_mode === 'partial') {
    const partial = Math.round(input.partial_amount ?? 0);
    if (!Number.isFinite(partial) || partial <= 0) {
      throw new Error('Số tiền khách trả một phần phải lớn hơn 0.');
    }
    if (partial > totalAmount) {
      throw new Error('Số tiền khách trả không được lớn hơn tổng đơn.');
    }
    paidNow = partial;
  }

  const { data: orderRow, error: orderError } = await client
    .from('orders')
    .insert({
      customer_id: input.customer_id,
      order_date: input.order_date,
      total_amount: totalAmount,
      note: input.note?.trim() || null,
    })
    .select('id')
    .single();

  if (orderError || !orderRow) {
    throw new Error(translateDbError(orderError?.message ?? 'Không tạo được đơn hàng.'));
  }

  const orderId = (orderRow as { id: string }).id;

  const { error: itemsError } = await client.from('order_items').insert(
    normalized.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity_kg: item.quantity_kg,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }))
  );

  if (itemsError) {
    await client.from('orders').delete().eq('id', orderId);
    throw new Error(translateDbError(itemsError.message));
  }

  if (paidNow > 0) {
    const { error: paymentError } = await client.from('payments').insert({
      order_id: orderId,
      amount: paidNow,
      payment_date: input.order_date,
      note: input.payment_mode === 'full' ? 'Trả đủ khi mua' : 'Trả trước một phần',
    });

    if (paymentError) {
      await client.from('orders').delete().eq('id', orderId);
      throw new Error(translateDbError(paymentError.message));
    }
  }

  return { id: orderId };
}

interface RawOrderQueryRow {
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

export async function listOrdersByDate(orderDate: string): Promise<OrderWithDetails[]> {
  const client = getClient();
  if (!isValidDateStr(orderDate)) {
    throw new Error('Ngày cần xem không hợp lệ.');
  }

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
    .eq('order_date', orderDate)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(translateDbError(error.message));
  }

  return ((data ?? []) as RawOrderQueryRow[]).map((row) => {
    const customerObj = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const items = [...(row.order_items ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const payments = [...(row.payments ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const debtAmount = Math.max(0, Number(row.total_amount || 0) - paidAmount);

    return {
      id: row.id,
      user_id: row.user_id,
      customer_id: row.customer_id,
      order_date: row.order_date,
      total_amount: Number(row.total_amount || 0),
      note: row.note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customer_name: customerObj?.name ?? 'Khách lẻ',
      customer_phone: customerObj?.phone ?? null,
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
  });
}

export async function updateOrder(orderId: string, input: UpdateOrderInput): Promise<void> {
  const client = getClient();

  if (!input.customer_id) {
    throw new Error('Vui lòng chọn khách hàng.');
  }
  if (!isValidDateStr(input.order_date)) {
    throw new Error('Ngày ghi đơn không hợp lệ.');
  }

  const { normalized, totalAmount } = validateAndComputeItems(input.items);

  const { data: existingPayments, error: payReadErr } = await client
    .from('payments')
    .select('amount')
    .eq('order_id', orderId);

  if (payReadErr) {
    throw new Error(translateDbError(payReadErr.message));
  }

  const paidAmount = (existingPayments ?? []).reduce(
    (sum, p) => sum + Number((p as { amount: number }).amount || 0),
    0
  );

  if (totalAmount < paidAmount) {
    throw new Error(
      `Tổng đơn mới (${totalAmount.toLocaleString('vi-VN')}đ) đang nhỏ hơn số tiền khách đã trả (${paidAmount.toLocaleString('vi-VN')}đ).`
    );
  }

  const { error: updateErr } = await client
    .from('orders')
    .update({
      customer_id: input.customer_id,
      order_date: input.order_date,
      total_amount: totalAmount,
      note: input.note?.trim() || null,
    })
    .eq('id', orderId);

  if (updateErr) {
    throw new Error(translateDbError(updateErr.message));
  }

  const { error: delItemsErr } = await client
    .from('order_items')
    .delete()
    .eq('order_id', orderId);

  if (delItemsErr) {
    throw new Error(translateDbError(delItemsErr.message));
  }

  const { error: insertItemsErr } = await client.from('order_items').insert(
    normalized.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity_kg: item.quantity_kg,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }))
  );

  if (insertItemsErr) {
    throw new Error(translateDbError(insertItemsErr.message));
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  const client = getClient();
  const { error } = await client.from('orders').delete().eq('id', orderId);
  if (error) {
    throw new Error(translateDbError(error.message));
  }
}
