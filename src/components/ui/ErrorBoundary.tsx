import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Đã có sự cố bất ngờ.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi ứng dụng:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-red-300 bg-white p-6 text-center shadow-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-slate-900">
              Ứng dụng gặp trục trặc nhỏ
            </h1>
            <p className="mt-2 text-base text-slate-700">
              Dữ liệu đã lưu trên máy chủ vẫn an toàn. Bạn bấm nút dưới để tải lại sổ nhé.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 text-lg font-extrabold text-white shadow-md active:bg-sky-700"
            >
              <RefreshCw className="h-5 w-5" />
              <span>Tải lại sổ bán hàng</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
