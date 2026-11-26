import { useState, type ReactNode } from 'react';
import { LogOut, Users } from 'lucide-react';
import { BottomNav, type AppTab } from './BottomNav';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const TAB_TITLES: Record<AppTab, string> = {
  'create-order': 'Ghi đơn mới',
  'daily-orders': 'Sổ đơn trong ngày',
  debts: 'Quản lý công nợ',
  purchases: 'Nhập hàng hôm nay',
  summary: 'Tổng kết ngày',
  manage: 'Khách & Mặt hàng',
};

interface AppShellProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  userEmail: string;
  onSignOut: () => Promise<string | null>;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  onChangeTab,
  userEmail,
  onSignOut,
  children,
}: AppShellProps) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onSignOut();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-100 pb-24">
      <header className="sticky top-0 z-20 border-b border-sky-700 bg-sky-600 text-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold leading-tight">
              {TAB_TITLES[activeTab]}
            </h1>
            <p className="truncate text-xs font-medium text-sky-100">{userEmail}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeTab(activeTab === 'manage' ? 'create-order' : 'manage')}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition ${
                activeTab === 'manage'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'bg-sky-700 text-white active:bg-sky-800'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Danh mục</span>
            </button>

            <button
              type="button"
              aria-label="Đăng xuất"
              onClick={() => setConfirmLogout(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-sky-700 px-2.5 text-white active:bg-sky-800"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>

      <BottomNav activeTab={activeTab} onChangeTab={onChangeTab} />

      <ConfirmDialog
        open={confirmLogout}
        title="Đăng xuất tài khoản?"
        message="Bạn có muốn thoát khỏi sổ bán hàng của tài khoản này không?"
        confirmLabel="Đăng xuất"
        danger={false}
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
