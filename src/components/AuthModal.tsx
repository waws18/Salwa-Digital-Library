import { useEffect, useState } from 'react';
import { ShieldCheck, UserCheck, X } from 'lucide-react';
import type { AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: 'login' | 'register' | 'admin';
  onClose: () => void;
  onAuthenticated: (token: string, user: AuthUser) => void;
}

export function AuthModal({
  isOpen,
  initialTab = 'login',
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register' | 'admin'>(initialTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminName, setAdminName] = useState('Pustakawan Kepala');
  const [adminStatus, setAdminStatus] = useState<{
    configured: boolean;
    source: 'env' | 'claimed' | 'unclaimed';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError(null);
      fetch('/api/auth/admin-status')
        .then((r) => r.json())
        .then((data) => setAdminStatus(data))
        .catch(() => setAdminStatus(null));
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  async function handleMemberLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal masuk ke akun anggota.');
        return;
      }
      onAuthenticated(data.token, data.user);
      onClose();
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMemberRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Pendaftaran gagal.');
        return;
      }
      onAuthenticated(data.token, data.user);
      onClose();
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const isSetup = adminStatus?.source === 'unclaimed';
    const endpoint = isSetup ? '/api/auth/admin-setup' : '/api/auth/admin-login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isSetup
            ? { name: adminName, passcode: adminPasscode }
            : { passcode: adminPasscode }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Otentikasi admin gagal.');
        return;
      }
      onAuthenticated(data.token, data.user);
      onClose();
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="auth-modal-title" className="font-display text-lg font-semibold text-slate-900">
              Akses Akun Wonu Library
            </h2>
            <p className="text-xs text-slate-500">
              Masuk sebagai anggota untuk meminjam buku atau buka portal admin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog akses"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
              }}
              className={`py-2 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                tab === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk Member
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`py-2 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                tab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Member
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('admin');
                setError(null);
              }}
              className={`py-2 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                tab === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Portal Admin
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              {error}
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleMemberLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Alamat Email Anggota
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors inline-flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard Member'}
              </button>
              <p className="text-xs text-slate-500 text-center">
                Belum punya kartu anggota?{' '}
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="text-emerald-800 font-medium hover:underline"
                >
                  Daftar instan di sini
                </button>
              </p>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleMemberRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Putri Kirania"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Alamat Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Buat Kata Sandi
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors"
              >
                {loading ? 'Mendaftarkan...' : 'Buat Kartu Anggota Digital'}
              </button>
            </form>
          )}

          {tab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              {adminStatus?.source === 'unclaimed' ? (
                <>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 leading-relaxed">
                    Akses Admin belum diklaim pada server ini. Buat kata sandi administrator
                    pertama untuk mengelola koleksi, sirkulasi, dan pelaporan otomatis.
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Nama Petugas Admin
                    </label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Masukkan kata sandi petugas untuk membuka Dashboard Admin, Manajemen Koleksi, dan
                  Sistem Pelaporan Otomatis.
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {adminStatus?.source === 'unclaimed'
                    ? 'Atur Kata Sandi Admin Baru'
                    : 'Kata Sandi Admin'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors inline-flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading
                  ? 'Memproses...'
                  : adminStatus?.source === 'unclaimed'
                    ? 'Klaim & Masuk Dashboard Admin'
                    : 'Masuk Dashboard Admin'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
