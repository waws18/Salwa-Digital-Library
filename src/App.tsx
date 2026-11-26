import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, LogIn, LogOut, Menu, Search, X } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { BookCover } from './components/BookCover';
import { BookDetailModal } from './components/BookDetailModal';
import { CirculationCharts } from './components/CirculationCharts';
import type { BookFormValues } from './components/CollectionFormModal';
import { MemberDashboard } from './components/MemberDashboard';
import { RealtimeActivityFeed } from './components/RealtimeActivityFeed';
import type {
  ActivityEvent,
  AuthUser,
  AutomatedReport,
  Book,
  LibraryOverviewStats,
  LoanTransaction,
  MemberSummary,
  ReportPeriod,
  ReportScheduleConfig,
} from './types';

type AppView = 'catalog' | 'stats' | 'member' | 'admin';

const EMPTY_STATS: LibraryOverviewStats = {
  totalTitles: 0,
  totalCopies: 0,
  availableCopies: 0,
  activeLoans: 0,
  overdueLoans: 0,
  totalMembers: 0,
  onTimeRate: 100,
  totalFinesAccrued: 0,
  dailyTrend: [],
  categoryDistribution: [],
};

const HERO_IMAGE = '/src/assets/images/hero_wonu_library_1795660558900.jpg';

export default function App() {
  const [view, setView] = useState<AppView>('catalog');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Auth held strictly in JS memory
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register' | 'admin'>('login');
  const [pendingViewAfterAuth, setPendingViewAfterAuth] = useState<AppView | null>(null);

  // Public Library Data
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<LibraryOverviewStats>(EMPTY_STATS);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Member Dashboard State
  const [memberLoans, setMemberLoans] = useState<LoanTransaction[]>([]);
  const [memberSummary, setMemberSummary] = useState({
    activeCount: 0,
    overdueCount: 0,
    completedCount: 0,
    quotaRemaining: 5,
    maxQuota: 5,
    totalFines: 0,
  });
  const [loadingMember, setLoadingMember] = useState(false);

  // Admin Dashboard State
  const [adminLoans, setAdminLoans] = useState<LoanTransaction[]>([]);
  const [adminMembers, setAdminMembers] = useState<MemberSummary[]>([]);
  const [adminReports, setAdminReports] = useState<AutomatedReport[]>([]);
  const [reportSchedule, setReportSchedule] = useState<ReportScheduleConfig>({
    enabled: true,
    frequency: 'weekly',
    autoRunLabel: 'Setiap Minggu',
    lastRunAt: null,
    nextRunAt: null,
  });
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Real-time WebSocket Status
  const [wsStatus, setWsStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>(
    'reconnecting'
  );
  const catalogSectionRef = useRef<HTMLElement | null>(null);
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    tokenRef.current = token;
    userRef.current = user;
  }, [token, user]);

  const fetchPublicOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/public/overview');
      if (!res.ok) throw new Error('Gagal memuat data perpustakaan.');
      const data = await res.json();
      setBooks(data.books || []);
      setStats(data.stats || EMPTY_STATS);
      setActivities(data.activities || []);
      setPublicError(null);
    } catch (err) {
      setPublicError(err instanceof Error ? err.message : 'Gagal terhubung ke server.');
    } finally {
      setLoadingPublic(false);
    }
  }, []);

  const fetchMemberDashboard = useCallback(async (authToken: string) => {
    setLoadingMember(true);
    try {
      const res = await fetch('/api/member/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMemberLoans(data.loans || []);
        if (data.summary) setMemberSummary(data.summary);
      }
    } finally {
      setLoadingMember(false);
    }
  }, []);

  const fetchAdminDashboard = useCallback(async (authToken: string) => {
    setLoadingAdmin(true);
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books || []);
        setAdminLoans(data.loans || []);
        setAdminMembers(data.members || []);
        setStats(data.stats || EMPTY_STATS);
        setActivities(data.activities || []);
        setAdminReports(data.reports || []);
        if (data.reportSchedule) setReportSchedule(data.reportSchedule);
      }
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  useEffect(() => {
    fetchPublicOverview();
  }, [fetchPublicOverview]);

  // WebSocket Real-time Connection with automatic reconnect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!disposed) {
          setWsStatus('connected');
          fetchPublicOverview();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; payload: unknown };
          if (msg.type === 'activity:new') {
            const act = msg.payload as ActivityEvent;
            setActivities((prev) => {
              if (prev.some((a) => a.id === act.id)) return prev;
              return [act, ...prev].slice(0, 40);
            });
          } else if (msg.type === 'library:sync') {
            const syncPayload = msg.payload as {
              books: Book[];
              stats: LibraryOverviewStats;
            };
            if (syncPayload.books) setBooks(syncPayload.books);
            if (syncPayload.stats) setStats(syncPayload.stats);

            // Keep selectedBook synced if open
            setSelectedBook((prev) =>
              prev ? syncPayload.books.find((b) => b.id === prev.id) || null : null
            );

            if (tokenRef.current && userRef.current) {
              if (userRef.current.role === 'admin') {
                fetchAdminDashboard(tokenRef.current);
              } else {
                fetchMemberDashboard(tokenRef.current);
              }
            }
          } else if (msg.type === 'loan:changed') {
            if (tokenRef.current && userRef.current) {
              if (userRef.current.role === 'admin') {
                fetchAdminDashboard(tokenRef.current);
              } else {
                fetchMemberDashboard(tokenRef.current);
              }
            }
          } else if (msg.type === 'report:generated') {
            const rpt = msg.payload as AutomatedReport;
            setAdminReports((prev) => {
              if (prev.some((r) => r.id === rpt.id)) return prev;
              return [rpt, ...prev];
            });
          } else if (msg.type === 'report:schedule') {
            setReportSchedule(msg.payload as ReportScheduleConfig);
          }
        } catch {
          // Ignore malformed ws frames
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setWsStatus('reconnecting');
        reconnectTimer = setTimeout(connect, 2500);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [fetchAdminDashboard, fetchMemberDashboard, fetchPublicOverview]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(books.map((b) => b.category)));
    return ['Semua', ...unique];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((b) => {
      if (selectedCategory !== 'Semua' && b.category !== selectedCategory) return false;
      if (onlyAvailable && b.availableCopies <= 0) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [books, searchQuery, selectedCategory, onlyAvailable]);

  function handleNavigate(target: AppView) {
    setMobileNavOpen(false);
    if (target === 'member') {
      if (!user || !token) {
        setAuthInitialTab('login');
        setPendingViewAfterAuth('member');
        setAuthModalOpen(true);
        return;
      }
      fetchMemberDashboard(token);
      setView('member');
      return;
    }

    if (target === 'admin') {
      if (!user || !token || user.role !== 'admin') {
        setAuthInitialTab('admin');
        setPendingViewAfterAuth('admin');
        setAuthModalOpen(true);
        return;
      }
      fetchAdminDashboard(token);
      setView('admin');
      return;
    }

    setView(target);
  }

  function handleAuthenticated(newToken: string, authUser: AuthUser) {
    setToken(newToken);
    setUser(authUser);

    if (authUser.role === 'admin') {
      fetchAdminDashboard(newToken);
      setView(pendingViewAfterAuth === 'member' ? 'member' : 'admin');
    } else {
      fetchMemberDashboard(newToken);
      setView(pendingViewAfterAuth === 'admin' ? 'member' : pendingViewAfterAuth || 'member');
    }
    setPendingViewAfterAuth(null);
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setMemberLoans([]);
    setAdminLoans([]);
    setAdminReports([]);
    if (view === 'admin' || view === 'member') {
      setView('catalog');
    }
  }

  // --- API Mutations ---
  async function apiBorrowBook(bookId: string, durationDays: 7 | 14, memberId?: string) {
    if (!token) throw new Error('Silakan masuk terlebih dahulu.');
    const res = await fetch('/api/loans/borrow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bookId, durationDays, memberId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal meminjam buku.');
    await fetchPublicOverview();
    if (user?.role === 'admin') await fetchAdminDashboard(token);
    else await fetchMemberDashboard(token);
  }

  async function apiReturnLoan(loanId: string) {
    if (!token) throw new Error('Sesi berakhir.');
    const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/return`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengembalikan buku.');
    await fetchPublicOverview();
    if (user?.role === 'admin') await fetchAdminDashboard(token);
    else await fetchMemberDashboard(token);
  }

  async function apiExtendLoan(loanId: string) {
    if (!token) throw new Error('Sesi berakhir.');
    const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/extend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memperpanjang durasi.');
    if (user?.role === 'admin') await fetchAdminDashboard(token);
    else await fetchMemberDashboard(token);
  }

  async function apiCreateBook(values: BookFormValues) {
    if (!token) throw new Error('Otentikasi admin diperlukan.');
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menambahkan koleksi.');
    await fetchAdminDashboard(token);
  }

  async function apiUpdateBook(bookId: string, values: BookFormValues) {
    if (!token) throw new Error('Otentikasi admin diperlukan.');
    const res = await fetch(`/api/books/${encodeURIComponent(bookId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memperbarui koleksi.');
    await fetchAdminDashboard(token);
  }

  async function apiDeleteBook(bookId: string) {
    if (!token) throw new Error('Otentikasi admin diperlukan.');
    const res = await fetch(`/api/books/${encodeURIComponent(bookId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus koleksi.');
    await fetchAdminDashboard(token);
  }

  async function apiGenerateReport(period: ReportPeriod): Promise<AutomatedReport> {
    if (!token) throw new Error('Otentikasi admin diperlukan.');
    const res = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ period }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menerbitkan laporan.');
    await fetchAdminDashboard(token);
    return data.report as AutomatedReport;
  }

  async function apiUpdateSchedule(enabled: boolean, frequency: ReportPeriod) {
    if (!token) throw new Error('Otentikasi admin diperlukan.');
    const res = await fetch('/api/reports/schedule', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled, frequency }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jadwal.');
    setReportSchedule(data.reportSchedule);
  }

  async function apiDeleteReport(id: string) {
    if (!token) throw new Error('Otentikasi admin diperlukan.');
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setAdminReports((prev) => prev.filter((r) => r.id !== id));
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-slate-900">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark only */}
          <button
            type="button"
            onClick={() => handleNavigate('catalog')}
            className="font-display text-xl font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
          >
            Wonu Library
          </button>

          {/* Zone 2: 4 Single-Line Text Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => handleNavigate('catalog')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                view === 'catalog'
                  ? 'border-emerald-800 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Katalog
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('stats')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                view === 'stats'
                  ? 'border-emerald-800 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Statistik
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('member')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                view === 'member'
                  ? 'border-emerald-800 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Member
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('admin')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                view === 'admin'
                  ? 'border-emerald-800 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Admin
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-medium border border-slate-300 text-slate-800 hover:bg-slate-50 rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthInitialTab('login');
                  setPendingViewAfterAuth(null);
                  setAuthModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-medium bg-emerald-800 hover:bg-emerald-900 text-white rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                Masuk Akun
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Menu navigasi"
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-md"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1">
            {(
              [
                { id: 'catalog', label: 'Katalog Buku' },
                { id: 'stats', label: 'Statistik & Realtime' },
                { id: 'member', label: 'Dashboard Member' },
                { id: 'admin', label: 'Dashboard Admin' },
              ] as { id: AppView; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`text-left px-3 py-2.5 text-sm font-medium rounded-md ${
                  view === item.id
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 py-8">
        {publicError && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {publicError}
          </div>
        )}

        {/* VIEW 1: CATALOG & EDITORIAL OVERVIEW */}
        {view === 'catalog' && (
          <div className="space-y-10">
            {/* Editorial 2-Column Hero Split */}
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-6 p-8 sm:p-10 lg:p-12 flex flex-col justify-between space-y-6">
                <div>
                  <div className="text-xs font-medium text-emerald-800">
                    Perpustakaan Digital Terpadu · Sirkulasi Real-Time
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-semibold text-slate-900 leading-[1.15] mt-3 text-balance">
                    Akses Koleksi Bacaan dan Pantau Sirkulasi Buku Secara Langsung
                  </h1>
                  <p className="text-base text-slate-600 leading-relaxed mt-4 max-w-xl">
                    Wonu Library menghadirkan layanan peminjaman buku mandiri bagi anggota,
                    manajemen inventaris koleksi untuk pustakawan, serta sistem pelaporan periodik
                    otomatis dalam satu ruang kerja terintegrasi.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <BookOpen className="w-4 h-4" />
                    Jelajahi Koleksi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate(user?.role === 'admin' ? 'admin' : 'member')}
                    className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-300 rounded-md transition-colors whitespace-nowrap"
                  >
                    {user ? `Buka Dashboard ${user.role === 'admin' ? 'Admin' : 'Member'}` : 'Buka Dashboard'}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 min-h-[260px] lg:min-h-[380px] relative bg-slate-100">
                {!heroImgFailed ? (
                  <img
                    src={HERO_IMAGE}
                    alt="Interior ruang baca Wonu Library dengan rak kayu oak dan meja baca terang"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 text-slate-100 p-10 flex flex-col justify-end">
                    <span className="font-display text-2xl font-semibold">Wonu Library</span>
                    <span className="text-sm text-slate-300 mt-1">
                      Ruang Baca & Repositori Digital
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Full-Width 4-Column KPI Strip below Hero */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-xs text-slate-500">Judul Terdaftar</div>
                <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
                  {stats.totalTitles}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  {stats.totalCopies} total eksemplar
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-xs text-slate-500">Siap Dipinjam</div>
                <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-1">
                  {stats.availableCopies}
                </div>
                <div className="text-xs text-slate-500 mt-1">Eksemplar tersedia di rak</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-xs text-slate-500">Sedang Dipinjam</div>
                <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
                  {stats.activeLoans}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  {stats.totalMembers} anggota aktif
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-xs text-slate-500">Ketepatan Kembali</div>
                <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
                  {stats.onTimeRate}%
                </div>
                <div className="text-xs text-slate-500 mt-1">Rata-rata sirkulasi tepat waktu</div>
              </div>
            </section>

            {/* Catalog Filter & Book Grid */}
            <section ref={catalogSectionRef} className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-slate-900">
                    Katalog Koleksi Buku
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Pilih buku untuk melihat rincian bibliografi dan ketersediaan real-time
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari judul, penulis, atau ISBN..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-md cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={onlyAvailable}
                      onChange={(e) => setOnlyAvailable(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-800"
                    />
                    Hanya Tersedia
                  </label>
                </div>
              </div>

              {/* Category Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {loadingPublic ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="bg-white border border-slate-200 rounded-lg p-5 h-96 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg py-14 px-6 text-center">
                  <p className="text-sm text-slate-600">
                    Tidak ada judul buku yang sesuai dengan pencarian atau filter kategori.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('Semua');
                      setOnlyAvailable(false);
                    }}
                    className="mt-4 px-4 py-2 text-xs font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                  >
                    Atur Ulang Filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredBooks.map((book) => (
                    <article
                      key={book.id}
                      className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
                    >
                      <div>
                        <BookCover
                          title={book.title}
                          author={book.author}
                          callNumber={book.callNumber}
                          coverUrl={book.coverUrl}
                          coverTone={book.coverTone}
                        />
                        <div className="mt-4 text-xs text-slate-500 truncate">
                          {book.category} · {book.year}
                        </div>
                        <h3 className="font-display text-base font-semibold text-slate-900 leading-snug mt-1 line-clamp-2">
                          {book.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 truncate">{book.author}</p>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span
                          className={`font-mono tabular-nums text-xs font-medium ${
                            book.availableCopies > 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {book.availableCopies > 0
                            ? `Tersedia ${book.availableCopies}/${book.totalCopies}`
                            : 'Stok Habis'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedBook(book)}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded transition-colors whitespace-nowrap"
                        >
                          Detail & Pinjam
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* VIEW 2: PUBLIC STATISTICS & REAL-TIME FEED */}
        {view === 'stats' && (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="font-mono text-xs text-slate-500">
                Analitik Sirkulasi · Wonu Library
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 mt-1">
                Statistik Peminjaman & Aktivitas Real-Time
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Data transaksi diperbarui langsung melalui koneksi WebSocket setiap kali anggota
                meminjam, mengembalikan, atau memperpanjang buku.
              </p>
            </div>

            <CirculationCharts
              dailyTrend={stats.dailyTrend}
              categoryDistribution={stats.categoryDistribution}
            />

            <RealtimeActivityFeed activities={activities} wsStatus={wsStatus} maxItems={20} />
          </div>
        )}

        {/* VIEW 3: MEMBER DASHBOARD */}
        {view === 'member' && user && (
          <MemberDashboard
            user={user}
            loans={memberLoans}
            summary={memberSummary}
            stats={stats}
            activities={activities}
            wsStatus={wsStatus}
            loading={loadingMember}
            onReturnLoan={apiReturnLoan}
            onExtendLoan={apiExtendLoan}
            onNavigateCatalog={() => setView('catalog')}
          />
        )}

        {/* VIEW 4: ADMIN DASHBOARD */}
        {view === 'admin' && user?.role === 'admin' && (
          <AdminDashboard
            books={books}
            loans={adminLoans}
            members={adminMembers}
            stats={stats}
            activities={activities}
            reports={adminReports}
            reportSchedule={reportSchedule}
            wsStatus={wsStatus}
            loading={loadingAdmin}
            onCreateBook={apiCreateBook}
            onUpdateBook={apiUpdateBook}
            onDeleteBook={apiDeleteBook}
            onAdminBorrow={(bookId, memberId, duration) =>
              apiBorrowBook(bookId, duration, memberId)
            }
            onReturnLoan={apiReturnLoan}
            onExtendLoan={apiExtendLoan}
            onGenerateReport={apiGenerateReport}
            onUpdateSchedule={apiUpdateSchedule}
            onDeleteReport={apiDeleteReport}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>Wonu Library · Sistem Perpustakaan Digital & Sirkulasi Terpadu</div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => handleNavigate('catalog')}
              className="hover:text-slate-900"
            >
              Katalog
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('stats')}
              className="hover:text-slate-900"
            >
              Statistik
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('admin')}
              className="hover:text-slate-900"
            >
              Portal Admin
            </button>
          </div>
        </div>
      </footer>

      <BookDetailModal
        book={selectedBook}
        currentUser={user}
        onClose={() => setSelectedBook(null)}
        onBorrow={(bookId, durationDays) => apiBorrowBook(bookId, durationDays)}
        onRequireAuth={() => {
          setSelectedBook(null);
          setAuthInitialTab('login');
          setAuthModalOpen(true);
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        initialTab={authInitialTab}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingViewAfterAuth(null);
        }}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
