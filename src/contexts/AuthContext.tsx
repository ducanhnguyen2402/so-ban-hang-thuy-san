import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthActionResult {
  error: string | null;
  needsEmailConfirm?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tài khoản chưa xác nhận email. Vui lòng kiểm tra hộp thư hoặc tắt Confirm email trong Supabase.';
  }
  if (lower.includes('user already registered')) {
    return 'Email này đã được đăng ký. Bạn hãy chuyển sang mục Đăng nhập.';
  }
  if (lower.includes('password should be at least')) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  }
  if (lower.includes('unable to validate email address') || lower.includes('invalid email')) {
    return 'Địa chỉ email không hợp lệ.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng hoặc cấu hình Supabase.';
  }
  return `Lỗi xác thực: ${message}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<AuthActionResult> {
    if (!supabase) {
      return { error: 'Chưa cấu hình kết nối Supabase.' };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { error: translateAuthError(error.message) };
    }
    return { error: null };
  }

  async function signUp(email: string, password: string): Promise<AuthActionResult> {
    if (!supabase) {
      return { error: 'Chưa cấu hình kết nối Supabase.' };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      return { error: translateAuthError(error.message) };
    }
    const needsEmailConfirm = Boolean(data.user && !data.session);
    return { error: null, needsEmailConfirm };
  }

  async function signOut(): Promise<string | null> {
    if (!supabase) return null;
    const { error } = await supabase.auth.signOut();
    return error ? translateAuthError(error.message) : null;
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return ctx;
}
