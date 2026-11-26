import {
  BarChart3,
  BookOpen,
  PackagePlus,
  PlusCircle,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type AppTab =
  | 'create-order'
  | 'daily-orders'
  | 'debts'
  | 'purchases'
  | 'summary'
  | 'manage';

interface NavItem {
  id: Exclude<AppTab, 'manage'>;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'create-order', label: 'Ghi đơn', icon: PlusCircle },
  { id: 'daily-orders', label: 'Sổ ngày', icon: BookOpen },
  { id: 'debts', label: 'Công nợ', icon: Wallet },
  { id: 'purchases', label: 'Nhập hàng', icon: PackagePlus },
  { id: 'summary', label: 'Tổng kết', icon: BarChart3 },
];

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onChangeTab }: BottomNavProps) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t-2 border-slate-200 bg-white shadow-[0_-4px_12px_rgba(15,23,42,0.06)]"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs font-bold transition ${
                isActive
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-600 active:bg-slate-100'
              }`}
            >
              <Icon className={`h-6 w-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
