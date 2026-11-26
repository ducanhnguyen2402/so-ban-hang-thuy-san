import { supabase } from '../lib/supabase';
import { isValidDateStr } from '../lib/date';
import type { DailySummary } from '../types/database';

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
  return `Lỗi tổng kết ngày: ${message}`;
}

interface OrderSummaryRow {
  id: string;
  total_amount: number;
  payments: { amount: number; payment_date: string }[] | null;
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  const client = getClient();
  if (!isValidDateStr(date)) {
    throw new Error('Ngày tổng kết không hợp lệ.');
  }

  const [ordersRes, paymentsRes, purchasesRes] = await Promise.all([
    client
      .from('orders')
      .select('id, total_amount, payments(amount, payment_date)')
      .eq('order_date', date),
    client.from('payments').select('amount').eq('payment_date', date),
    client.from('purchases').select('cost_amount').eq('purchase_date', date),
  ]);

  if (ordersRes.error) {
    throw new Error(translateDbError(ordersRes.error.message));
  }
  if (paymentsRes.error) {
    throw new Error(translateDbError(paymentsRes.error.message));
  }
  if (purchasesRes.error) {
    throw new Error(translateDbError(purchasesRes.error.message));
  }

  const orders = (ordersRes.data ?? []) as OrderSummaryRow[];
  const dayPayments = (paymentsRes.data ?? []) as { amount: number }[];
  const dayPurchases = (purchasesRes.data ?? []) as { cost_amount: number }[];

  let revenue = 0;
  let collectedFromTodayOrders = 0;
  let newDebt = 0;

  for (const order of orders) {
    const orderTotal = Number(order.total_amount || 0);
    revenue += orderTotal;

    const orderPayments = order.payments ?? [];
    const paidOnThatDay = orderPayments
      .filter((p) => p.payment_date === date)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    collectedFromTodayOrders += paidOnThatDay;

    const paidUpToDate = orderPayments
      .filter((p) => p.payment_date <= date)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    newDebt += Math.max(0, orderTotal - paidUpToDate);
  }

  const collectedTotal = dayPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );
  const collectedFromOldDebts = Math.max(0, collectedTotal - collectedFromTodayOrders);
  const purchaseCost = dayPurchases.reduce(
    (sum, p) => sum + Number(p.cost_amount || 0),
    0
  );
  const profit = revenue - purchaseCost;

  return {
    date,
    order_count: orders.length,
    revenue,
    collected_total: collectedTotal,
    collected_from_today_orders: collectedFromTodayOrders,
    collected_from_old_debts: collectedFromOldDebts,
    new_debt: newDebt,
    purchase_count: dayPurchases.length,
    purchase_cost: purchaseCost,
    profit,
  };
}
