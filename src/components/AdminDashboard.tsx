import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  ActivityEvent,
  AutomatedReport,
  Book,
  LibraryOverviewStats,
  LoanTransaction,
  MemberSummary,
  ReportPeriod,
  ReportScheduleConfig,
} from '../types';
import { formatDateID, formatIDR } from '../utils/format';
import { AutomatedReportsPanel } from './AutomatedReportsPanel';
import { BookCover } from './BookCover';
import { CirculationCharts } from './CirculationCharts';
import { type BookFormValues, CollectionFormModal } from './CollectionFormModal';
import { RealtimeActivityFeed } from './RealtimeActivityFeed';

type AdminTab = 'overview' | 'collection' | 'transactions' | 'reports';

interface AdminDashboardProps {
  books: Book[];
  loans: LoanTransaction[];
  members: MemberSummary[];
  stats: LibraryOverviewStats;
  activities: ActivityEvent[];
  reports: AutomatedReport[];
  reportSchedule: ReportScheduleConfig;
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  loading: boolean;
  onCreateBook: (values: BookFormValues) => Promise<void>;
  onUpdateBook: (bookId: string, values: BookFormValues) => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  onAdminBorrow: (bookId: string, memberId: string, durationDays: 7 | 14) => Promise<void>;
  onReturnLoan: (loanId: string) => Promise<void>;
  onExtendLoan: (loanId: string) => Promise<void>;
  onGenerateReport: (period: ReportPeriod) => Promise<AutomatedReport>;
  onUpdateSchedule: (enabled: boolean, frequency: ReportPeriod) => Promise<void>;
  onDeleteReport: (id: string) => Promise<void>;
}

export function AdminDashboard({
  books,
  loans,
  members,
  stats,
  activities,
  reports,
  reportSchedule,
  wsStatus,
  loading,
  onCreateBook,
  onUpdateBook,
  onDeleteBook,
  onAdminBorrow,
  onReturnLoan,
  onExtendLoan,
  onGenerateReport,
  onUpdateSchedule,
  onDeleteReport,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [bookSearch, setBookSearch] = useState('');
  const [loanFilter, setLoanFilter] = useState<'all' | 'active' | 'overdue' | 'returned'>('all');
  const [loanSearch, setLoanSearch] = useState('');
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Admin quick loan desk state
  const [showLendDesk, setShowLendDesk] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || '');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [lendDuration, setLendDuration] = useState<7 | 14>(7);

  const availableBooks = useMemo(
    () => books.filter((b) => b.availableCopies > 0),
    [books]
  );

  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [books, bookSearch]);

  const filteredLoans = useMemo(() => {
    const q = loanSearch.trim().toLowerCase();
    return loans.filter((l) => {
      if (loanFilter !== 'all' && l.status !== loanFilter) return false;
      if (!q) return true;
      return (
        l.id.toLowerCase().includes(q) ||
        l.bookTitle.toLowerCase().includes(q) ||
        l.memberName.toLowerCase().includes(q) ||
        l.memberCode.toLowerCase().includes(q)
      );
    });
  }, [loans, loanFilter, loanSearch]);

  async function handleCollectionSubmit(values: BookFormValues, bookId?: string) {
    if (bookId) {
      await onUpdateBook(bookId, values);
      setFeedback({ type: 'ok', text: `Koleksi "${values.title}" berhasil diperbarui.` });
    } else {
      await onCreateBook(values);
      setFeedback({ type: 'ok', text: `Judul baru "${values.title}" ditambahkan ke katalog.` });
    }
  }

  async function handleDeleteBookClick(book: Book) {
    setBusyId(book.id);
    setFeedback(null);
    try {
      await onDeleteBook(book.id);
      setFeedback({ type: 'ok', text: `Koleksi "${book.title}" telah dihapus.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus buku.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleLoanAction(loanId: string, action: 'return' | 'extend') {
    setBusyId(loanId);
    setFeedback(null);
    try {
      if (action === 'return') {
        await onReturnLoan(loanId);
        setFeedback({ type: 'ok', text: `Transaksi ${loanId} selesai dikembalikan.` });
      } else {
        await onExtendLoan(loanId);
        setFeedback({ type: 'ok', text: `Tenggat transaksi ${loanId} diperpanjang +7 hari.` });
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memproses transaksi.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdminLendSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetBook = selectedBookId || availableBooks[0]?.id;
    const targetMember = selectedMemberId || members[0]?.id;
    if (!targetBook || !targetMember) return;
    setBusyId('lend-desk');
    setFeedback(null);
    try {
      await onAdminBorrow(targetBook, targetMember, lendDuration);
      setShowLendDesk(false);
      setFeedback({ type: 'ok', text: 'Peminjaman loket berhasil dicatat ke sistem.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mencatat peminjaman.',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Workspace Header & Tab Switcher */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="font-mono text-xs text-slate-500">
              Konsol Administrasi · Wonu Library
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 mt-1">
              Dashboard Admin & Sirkulasi Real-Time
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
            {(
              [
                { id: 'overview', label: 'Ringkasan & Realtime' },
                { id: 'collection', label: 'Manajemen Koleksi' },
                { id: 'transactions', label: 'Transaksi Peminjaman' },
                { id: 'reports', label: 'Pelaporan Otomatis' },
              ] as { id: AdminTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id);
                  setFeedback(null);
                }}
                className={`px-3.5 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-md border text-sm no-print ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* TAB 1: OVERVIEW & REALTIME */}
      {!loading && activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="text-xs text-slate-500">Total Koleksi & Stok</div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1.5">
                {stats.totalTitles} Judul
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {stats.availableCopies} / {stats.totalCopies} eksemplar tersedia
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="text-xs text-slate-500">Sirkulasi Aktif</div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1.5">
                {stats.activeLoans}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {stats.totalMembers} anggota terdaftar
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="text-xs text-slate-500">Keterlambatan Aktif</div>
              <div
                className={`font-mono tabular-nums text-2xl font-semibold mt-1.5 ${
                  stats.overdueLoans > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {stats.overdueLoans}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                Akumulasi denda {formatIDR(stats.totalFinesAccrued)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="text-xs text-slate-500">Ketepatan Pengembalian</div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-1.5">
                {stats.onTimeRate}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Rasio selesai tepat waktu
              </div>
            </div>
          </div>

          <CirculationCharts
            dailyTrend={stats.dailyTrend}
            categoryDistribution={stats.categoryDistribution}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <RealtimeActivityFeed activities={activities} wsStatus={wsStatus} maxItems={12} />
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    Direktori Anggota
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ringkasan aktivitas peminjaman per kartu anggota
                  </p>
                </div>
                <span className="font-mono tabular-nums text-xs text-slate-500">
                  {members.length} anggota
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {members.map((m) => (
                  <div key={m.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{m.name}</div>
                      <div className="font-mono text-xs text-slate-500 truncate">
                        {m.memberCode} · {m.email}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums text-xs">
                      <div className="font-semibold text-slate-900">{m.activeLoansCount} aktif</div>
                      <div className="text-slate-400">{m.totalLoansCount} total</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COLLECTION MANAGEMENT */}
      {!loading && activeTab === 'collection' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Cari judul, penulis, ISBN, atau kategori..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingBook(null);
                setCollectionModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Koleksi Baru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-6">Buku</th>
                  <th className="py-3 px-4">Kategori & Tahun</th>
                  <th className="py-3 px-4">ISBN / Rak</th>
                  <th className="py-3 px-4 text-right">Stok Tersedia</th>
                  <th className="py-3 px-4 text-right">Dipinjam</th>
                  <th className="py-3 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <BookCover
                          title={book.title}
                          author={book.author}
                          callNumber={book.callNumber}
                          coverUrl={book.coverUrl}
                          coverTone={book.coverTone}
                          size="sm"
                        />
                        <div className="min-w-0 max-w-xs">
                          <div className="font-medium text-slate-900 truncate">{book.title}</div>
                          <div className="text-xs text-slate-500 truncate">{book.author}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {book.category} · {book.year}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      <div>{book.isbn}</div>
                      <div className="text-slate-400">Rak {book.callNumber}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-right whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          book.availableCopies > 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {book.availableCopies}
                      </span>
                      <span className="text-slate-400"> / {book.totalCopies}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-right text-slate-700 whitespace-nowrap">
                      {book.borrowCount} kali
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBook(book);
                            setCollectionModalOpen(true);
                          }}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          aria-label={`Edit ${book.title}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === book.id}
                          onClick={() => handleDeleteBookClick(book)}
                          className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                          aria-label={`Hapus ${book.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBooks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 px-6 text-center text-sm text-slate-500">
                      Tidak ada koleksi yang sesuai dengan kata kunci pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRANSACTIONS */}
      {!loading && activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'active', label: 'Aktif' },
                    { id: 'overdue', label: 'Terlambat' },
                    { id: 'returned', label: 'Dikembalikan' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLoanFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      loanFilter === f.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={loanSearch}
                    onChange={(e) => setLoanSearch(e.target.value)}
                    placeholder="Cari TRX, anggota, buku..."
                    className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowLendDesk((prev) => !prev)}
                  className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Catat Peminjaman Loket
                </button>
              </div>
            </div>

            {showLendDesk && (
              <form
                onSubmit={handleAdminLendSubmit}
                className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pilih Anggota
                  </label>
                  <select
                    value={selectedMemberId || members[0]?.id || ''}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.memberCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pilih Buku Tersedia
                  </label>
                  <select
                    value={selectedBookId || availableBooks[0]?.id || ''}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    {availableBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} (Sisa {b.availableCopies})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Durasi</label>
                  <select
                    value={lendDuration}
                    onChange={(e) => setLendDuration(Number(e.target.value) === 14 ? 14 : 7)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    <option value={7}>7 Hari</option>
                    <option value={14}>14 Hari</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={busyId === 'lend-desk' || availableBooks.length === 0}
                    className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md"
                  >
                    Simpan Transaksi
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLendDesk(false)}
                    className="py-2 px-3 border border-slate-300 text-xs text-slate-600 rounded-md"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/60">
                    <th className="py-3 px-6">Transaksi</th>
                    <th className="py-3 px-4">Anggota</th>
                    <th className="py-3 px-4">Judul Buku</th>
                    <th className="py-3 px-4">Pinjam / Tenggat</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Denda</th>
                    <th className="py-3 px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-6 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {loan.id}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-900">{loan.memberName}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {loan.memberCode}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-xs font-medium text-slate-900 truncate">
                          {loan.bookTitle}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          Rak {loan.bookCallNumber}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        <div>{formatDateID(loan.borrowedAt)}</div>
                        <div className="text-slate-400">Tenggat {formatDateID(loan.dueAt)}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium">
                        {loan.status === 'returned' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Dikembalikan
                          </span>
                        ) : loan.status === 'overdue' ? (
                          <span className="inline-flex items-center gap-1.5 text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Terlambat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <Clock className="w-3.5 h-3.5" />
                            Dipinjam
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-right text-slate-800 whitespace-nowrap">
                        {formatIDR(loan.fineAmount)}
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        {loan.status !== 'returned' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === loan.id || loan.extendedCount >= 2}
                              onClick={() => handleLoanAction(loan.id, 'extend')}
                              className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 rounded"
                            >
                              +7 Hari
                            </button>
                            <button
                              type="button"
                              disabled={busyId === loan.id}
                              onClick={() => handleLoanAction(loan.id, 'return')}
                              className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Selesai
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-400">
                            {formatDateID(loan.returnedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredLoans.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 px-6 text-center text-sm text-slate-500">
                        Tidak ada transaksi yang cocok dengan filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUTOMATED REPORTS */}
      {!loading && activeTab === 'reports' && (
        <AutomatedReportsPanel
          reports={reports}
          schedule={reportSchedule}
          onGenerateReport={onGenerateReport}
          onUpdateSchedule={onUpdateSchedule}
          onDeleteReport={onDeleteReport}
        />
      )}

      <CollectionFormModal
        isOpen={collectionModalOpen}
        editingBook={editingBook}
        onClose={() => setCollectionModalOpen(false)}
        onSubmit={handleCollectionSubmit}
      />
    </div>
  );
}
