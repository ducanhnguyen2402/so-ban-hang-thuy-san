import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import { getTodayVN } from './lib/date';
import { AuthPage } from './pages/AuthPage';
import { ManagePage } from './pages/ManagePage';
import { CreateOrderPage } from './pages/CreateOrderPage';
import { DailyOrdersPage } from './pages/DailyOrdersPage';
import { DebtsPage } from './pages/DebtsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { SummaryPage } from './pages/SummaryPage';
import { AppShell } from './components/layout/AppShell';
import { type AppTab } from './components/layout/BottomNav';
import { LoadingState } from './components/ui/LoadingState';
import type { OrderWithDetails } from './types/database';

function SetupGuideScreen() {
  return (
    <div className="min-h-dvh bg-amber-50 px-4 py-8">
      <div className="mx-auto max-w-lg rounded-3xl border-2 border-amber-300 bg-white p-6 shadow-md">
        <div className="flex items-center gap-3 text-amber-700">
          <KeyRound className="h-8 w-8 shrink-0" />
          <h1 className="text-xl font-extrabold text-slate-900">
            Cần cấu hình kết nối Supabase
          </h1>
        </div>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Ứng dụng chưa tìm thấy{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
            VITE_SUPABASE_URL
          </code>{' '}
          và{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
            VITE_SUPABASE_ANON_KEY
          </code>
          .
        </p>

        <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-base text-slate-800">
          <li>
            Tạo file{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
              .env.local
            </code>{' '}
            ở thư mục gốc dự án (copy từ{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
              .env.example
            </code>
            ).
          </li>
          <li>
            Dán <strong>Project URL</strong> và <strong>Publishable / anon key</strong> từ
            Supabase vào file đó.
          </li>
          <li>
            Mở <strong>SQL Editor</strong> trong Supabase và chạy toàn bộ nội dung file{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
              supabase/schema.sql
            </code>
            .
          </li>
          <li>
            Khởi động lại lệnh{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
              npm run dev
            </code>{' '}
            và tải lại trang.
          </li>
        </ol>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>('create-order');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayVN());
  const [editingOrder, setEditingOrder] = useState<OrderWithDetails | null>(null);

  function handleChangeTab(nextTab: AppTab) {
    if (nextTab !== 'create-order') {
      setEditingOrder(null);
    }
    setActiveTab(nextTab);
  }

  function handleOrderSaved(savedDate: string, wasEditing: boolean) {
    setSelectedDate(savedDate);
    if (wasEditing) {
      setEditingOrder(null);
      setActiveTab('daily-orders');
    }
  }

  function renderMainContent() {
    switch (activeTab) {
      case 'create-order':
        return (
          <CreateOrderPage
            editingOrder={editingOrder}
            onSaved={handleOrderSaved}
            onCancelEdit={() => {
              setEditingOrder(null);
              setActiveTab('daily-orders');
            }}
            onNavigateManage={() => setActiveTab('manage')}
          />
        );
      case 'daily-orders':
        return (
          <DailyOrdersPage
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onEditOrder={(order) => {
              setEditingOrder(order);
              setActiveTab('create-order');
            }}
            onNewOrder={() => {
              setEditingOrder(null);
              setActiveTab('create-order');
            }}
          />
        );
      case 'debts':
        return <DebtsPage />;
      case 'purchases':
        return (
          <PurchasesPage
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        );
      case 'summary':
        return (
          <SummaryPage
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onOpenDailyOrders={() => setActiveTab('daily-orders')}
            onOpenPurchases={() => setActiveTab('purchases')}
          />
        );
      case 'manage':
        return <ManagePage />;
    }
  }

  return (
    <AppShell
      activeTab={activeTab}
      onChangeTab={handleChangeTab}
      userEmail={user?.email ?? ''}
      onSignOut={signOut}
    >
      {renderMainContent()}
    </AppShell>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) {
    return <SetupGuideScreen />;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <LoadingState message="Đang kiểm tra đăng nhập..." />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AuthenticatedApp />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
