export type WeightUnit = 'kg' | 'lang' | 'g' | 'yen';

export type PaymentMode = 'full' | 'partial' | 'debt';

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  default_price: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  customer_id: string | null;
  order_date: string;
  total_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity_kg: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  order_id: string;
  amount: number;
  payment_date: string;
  note: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  purchase_date: string;
  quantity_kg: number;
  cost_amount: number;
  note: string | null;
  created_at: string;
}

export interface OrderWithDetails extends Order {
  customer_name: string;
  customer_phone: string | null;
  items: OrderItem[];
  payments: Payment[];
  paid_amount: number;
  debt_amount: number;
}

export interface CustomerDebtSummary {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  total_debt: number;
  unpaid_orders_count: number;
  unpaid_orders: OrderWithDetails[];
}

export interface DailySummary {
  date: string;
  order_count: number;
  revenue: number;
  collected_total: number;
  collected_from_today_orders: number;
  collected_from_old_debts: number;
  new_debt: number;
  purchase_count: number;
  purchase_cost: number;
  profit: number;
}
