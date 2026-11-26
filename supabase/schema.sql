-- Sổ Bán Hàng Thủy Sản - Schema & Row Level Security
-- Chạy script này một lần trong Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Hàm cập nhật updated_at tự động
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Khách hàng
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  phone text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Mặt hàng thủy sản
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  unit text not null default 'kg' check (char_length(trim(unit)) > 0),
  default_price integer not null default 0 check (default_price >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Đơn hàng
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_date date not null,
  total_amount integer not null default 0 check (total_amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Chi tiết dòng hàng trong đơn
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null check (char_length(trim(product_name)) > 0),
  quantity_kg numeric(10, 3) not null check (quantity_kg > 0),
  unit_price integer not null check (unit_price >= 0),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

-- 5. Thanh toán / trả nợ (hỗ trợ trả từng phần nhiều lần)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount integer not null check (amount > 0),
  payment_date date not null,
  note text,
  created_at timestamptz not null default now()
);

-- 6. Nhập hàng trong ngày
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null check (char_length(trim(product_name)) > 0),
  purchase_date date not null,
  quantity_kg numeric(10, 3) not null check (quantity_kg > 0),
  cost_amount integer not null check (cost_amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

-- Indexes phục vụ truy vấn nhanh theo cửa hàng và ngày
create index if not exists idx_customers_user_active on public.customers(user_id, is_active, name);
create index if not exists idx_products_user_active on public.products(user_id, is_active, sort_order, name);
create index if not exists idx_orders_user_date on public.orders(user_id, order_date desc, created_at desc);
create index if not exists idx_orders_customer on public.orders(user_id, customer_id);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_user on public.order_items(user_id);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_payments_user_date on public.payments(user_id, payment_date desc);
create index if not exists idx_purchases_user_date on public.purchases(user_id, purchase_date desc, created_at desc);

-- Triggers cập nhật updated_at
drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Bật Row Level Security trên toàn bộ bảng
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.purchases enable row level security;

-- Cấp quyền cho user đã đăng nhập (RLS kiểm soát theo user_id)
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.purchases to authenticated;

-- Policies RLS cho từng bảng (xóa trước nếu đã tồn tại để chạy lại an toàn)
drop policy if exists "customers_select_own" on public.customers;
drop policy if exists "customers_insert_own" on public.customers;
drop policy if exists "customers_update_own" on public.customers;
drop policy if exists "customers_delete_own" on public.customers;
create policy "customers_select_own" on public.customers for select using (auth.uid() = user_id);
create policy "customers_insert_own" on public.customers for insert with check (auth.uid() = user_id);
create policy "customers_update_own" on public.customers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "customers_delete_own" on public.customers for delete using (auth.uid() = user_id);

drop policy if exists "products_select_own" on public.products;
drop policy if exists "products_insert_own" on public.products;
drop policy if exists "products_update_own" on public.products;
drop policy if exists "products_delete_own" on public.products;
create policy "products_select_own" on public.products for select using (auth.uid() = user_id);
create policy "products_insert_own" on public.products for insert with check (auth.uid() = user_id);
create policy "products_update_own" on public.products for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "products_delete_own" on public.products for delete using (auth.uid() = user_id);

drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_own" on public.orders;
drop policy if exists "orders_delete_own" on public.orders;
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);
create policy "orders_insert_own" on public.orders for insert with check (auth.uid() = user_id);
create policy "orders_update_own" on public.orders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "orders_delete_own" on public.orders for delete using (auth.uid() = user_id);

drop policy if exists "order_items_select_own" on public.order_items;
drop policy if exists "order_items_insert_own" on public.order_items;
drop policy if exists "order_items_update_own" on public.order_items;
drop policy if exists "order_items_delete_own" on public.order_items;
create policy "order_items_select_own" on public.order_items for select using (auth.uid() = user_id);
create policy "order_items_insert_own" on public.order_items for insert with check (auth.uid() = user_id);
create policy "order_items_update_own" on public.order_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "order_items_delete_own" on public.order_items for delete using (auth.uid() = user_id);

drop policy if exists "payments_select_own" on public.payments;
drop policy if exists "payments_insert_own" on public.payments;
drop policy if exists "payments_update_own" on public.payments;
drop policy if exists "payments_delete_own" on public.payments;
create policy "payments_select_own" on public.payments for select using (auth.uid() = user_id);
create policy "payments_insert_own" on public.payments for insert with check (auth.uid() = user_id);
create policy "payments_update_own" on public.payments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payments_delete_own" on public.payments for delete using (auth.uid() = user_id);

drop policy if exists "purchases_select_own" on public.purchases;
drop policy if exists "purchases_insert_own" on public.purchases;
drop policy if exists "purchases_update_own" on public.purchases;
drop policy if exists "purchases_delete_own" on public.purchases;
create policy "purchases_select_own" on public.purchases for select using (auth.uid() = user_id);
create policy "purchases_insert_own" on public.purchases for insert with check (auth.uid() = user_id);
create policy "purchases_update_own" on public.purchases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "purchases_delete_own" on public.purchases for delete using (auth.uid() = user_id);
