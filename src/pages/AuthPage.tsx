import { useState, type FormEvent } from 'react';
import { Fish, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(trimmedEmail, password);
        if (error) setErrorMsg(error);
      } else {
        const { error, needsEmailConfirm } = await signUp(trimmedEmail, password);
        if (error) {
          setErrorMsg(error);
        } else if (needsEmailConfirm) {
          setSuccessMsg(
            'Đăng ký thành công! Vui lòng mở email bấm xác nhận (hoặc tắt Confirm email trong Supabase) rồi quay lại đăng nhập.'
          );
          setMode('login');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-sky-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-sky-200 bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md">
            <Fish className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
            Sổ Bán Hàng Thủy Sản
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Ghi đơn nhanh, tính tiền chính xác, theo dõi công nợ ngoài chợ
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`min-h-[48px] rounded-xl text-base font-bold transition ${
              mode === 'login'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`min-h-[48px] rounded-xl text-base font-bold transition ${
              mode === 'register'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Tạo tài khoản
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-base font-bold text-slate-800">
              Email cửa hàng
            </label>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vidu@gmail.com"
              className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-base font-bold text-slate-800">
              Mật khẩu
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
              className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="auth-confirm" className="block text-base font-bold text-slate-800">
                Nhập lại mật khẩu
              </label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại giống mật khẩu trên"
                className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
              />
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-800">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-800">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 text-lg font-extrabold text-white shadow-md active:bg-sky-700 disabled:opacity-60"
          >
            {mode === 'login' ? <LogIn className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
            {submitting
              ? 'Đang xử lý...'
              : mode === 'login'
                ? 'Vào sổ bán hàng'
                : 'Đăng ký cửa hàng mới'}
          </button>
        </form>
      </div>
    </div>
  );
}
