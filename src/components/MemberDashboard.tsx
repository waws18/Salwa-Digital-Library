import { useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import type {
  ActivityEvent,
  AuthUser,
  LibraryOverviewStats,
  LoanTransaction,
} from '../types';
import { formatDateID, formatIDR } from '../utils/format';
import { CirculationCharts } from './CirculationCharts';
import { RealtimeActivityFeed } from './RealtimeActivityFeed';

interface MemberDashboardProps {
  user: AuthUser;
  loans: LoanTransaction[];
  summary: {
    activeCount: number;
    overdueCount: number;
    completedCount: number;
    quotaRemaining: number;
    maxQuota: number;
    totalFines: number;
  };
  stats: LibraryOverviewStats;
  activities: ActivityEvent[];
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  loading: boolean;
  onReturnLoan: (loanId: string) => Promise<void>;
  onExtendLoan: (loanId: string) => Promise<void>;
  onNavigateCatalog: () => void;
}

export function MemberDashboard({
  user,
  loans,
  summary,
  stats,
  activities,
  wsStatus,
  loading,
  onReturnLoan,
  onExtendLoan,
  onNavigateCatalog,
}: MemberDashboardProps) {
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const activeLoans = loans.filter((l) => l.status !== 'returned');
  const historyLoans = loans.filter((l) => l.status === 'returned');

  async function handleAction(loanId: string, kind: 'return' | 'extend') {
    setBusyLoanId(loanId);
    setActionMessage(null);
    try {
      if (kind === 'return') {
        await onReturnLoan(loanId);
        setActionMessage({ type: 'ok', text: 'Buku berhasil dikembalikan ke koleksi.' });
      } else {
        await onExtendLoan(loanId);
        setActionMessage({ type: 'ok', text: 'Durasi pinjaman diperpanjang +7 hari.' });
      }
    } catch (err) {
      setActionMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memproses permintaan.',
      });
    } finally {
      setBusyLoanId(null);
    }
  }

  function getDueNote(dueIso: string, status: LoanTransaction['status']) {
    if (status === 'overdue') {
      const daysLate = Math.max(
        1,
        Math.ceil((Date.now() - new Date(dueIso).getTime()) / (1000 * 60 * 60 * 24))
      );
      return {
        label: `Terlambat ${daysLate} hari`,
        tone: 'text-red-700',
        Icon: AlertTriangle,
      };
    }
    const daysLeft = Math.ceil((new Date(dueIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 2) {
      return {
        label: `Tenggat ${Math.max(0, daysLeft)} hari lagi`,
        tone: 'text-amber-700',
        Icon: Clock,
      };
    }
    return {
      label: `Aktif · ${daysLeft} hari lagi`,
      tone: 'text-emerald-700',
      Icon: CheckCircle2,
    };
  }

  return (
    <div className="space-y-8">
      {/* Member Identity Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-slate-500">
            Kartu Anggota {user.memberCode} · Terdaftar {formatDateID(user.joinedAt)}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 mt-1">
            Dashboard Member — {user.name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pantau pinjaman aktif, perpanjang durasi baca, serta lihat statistik sirkulasi real-time.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateCatalog}
          className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium rounded-md transition-colors inline-flex items-center gap-2 self-start md:self-auto whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-4 h-4" />
          Jelajahi Katalog Buku
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Pinjaman Aktif</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1.5">
            {summary.activeCount} / {summary.maxQuota}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Sisa kuota {summary.quotaRemaining} judul
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Pinjaman Terlambat</div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1.5 ${
              summary.overdueCount > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {summary.overdueCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summary.overdueCount > 0 ? 'Segera kembalikan buku' : 'Tidak ada keterlambatan'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Riwayat Selesai</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1.5">
            {summary.completedCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Total buku telah dikembalikan</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Total Denda Tercatat</div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1.5 ${
              summary.totalFines > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {formatIDR(summary.totalFines)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Tarif keterlambatan Rp 2.000/hari</div>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`px-4 py-3 rounded-md border text-sm ${
            actionMessage.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Active Loans Section */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Pinjaman Aktif Saya
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perpanjang tenggat maksimal 2 kali atau lakukan pengembalian langsung
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500">
            {activeLoans.length} transaksi aktif
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : activeLoans.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-600">
              Anda belum memiliki buku yang sedang dipinjam saat ini.
            </p>
            <button
              type="button"
              onClick={onNavigateCatalog}
              className="mt-4 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-md transition-colors"
            >
              Pinjam Buku Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-6">Transaksi</th>
                  <th className="py-3 px-4">Judul Buku</th>
                  <th className="py-3 px-4">Tanggal Pinjam</th>
                  <th className="py-3 px-4">Tenggat</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Denda</th>
                  <th className="py-3 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {activeLoans.map((loan) => {
                  const note = getDueNote(loan.dueAt, loan.status);
                  const NoteIcon = note.Icon;
                  const isBusy = busyLoanId === loan.id;
                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-6 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {loan.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{loan.bookTitle}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          Rak {loan.bookCallNumber} · Perpanjangan {loan.extendedCount}/2
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {formatDateID(loan.borrowedAt)}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-900 whitespace-nowrap">
                        {formatDateID(loan.dueAt)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${note.tone}`}>
                          <NoteIcon className="w-3.5 h-3.5" />
                          {note.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-right text-slate-800 whitespace-nowrap">
                        {loan.fineAmount > 0 ? formatIDR(loan.fineAmount) : 'Rp 0'}
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={
                              isBusy || loan.status === 'overdue' || loan.extendedCount >= 2
                            }
                            onClick={() => handleAction(loan.id, 'extend')}
                            className="px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 rounded transition-colors whitespace-nowrap"
                          >
                            +7 Hari
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleAction(loan.id, 'return')}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Kembalikan
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Borrowing History */}
      {historyLoans.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Riwayat Peminjaman Selesai
            </h2>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {historyLoans.length} selesai
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-6">Transaksi</th>
                  <th className="py-3 px-4">Judul Buku</th>
                  <th className="py-3 px-4">Dipinjam</th>
                  <th className="py-3 px-4">Dikembalikan</th>
                  <th className="py-3 px-6 text-right">Denda Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {historyLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-6 font-mono tabular-nums text-xs text-slate-500">
                      {loan.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{loan.bookTitle}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                      {formatDateID(loan.borrowedAt)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-emerald-700 whitespace-nowrap">
                      {formatDateID(loan.returnedAt)}
                    </td>
                    <td className="py-3 px-6 font-mono tabular-nums text-xs text-right text-slate-700 whitespace-nowrap">
                      {formatIDR(loan.fineAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Real-time Feed + Library Stats */}
      <CirculationCharts
        dailyTrend={stats.dailyTrend}
        categoryDistribution={stats.categoryDistribution}
      />
      <RealtimeActivityFeed activities={activities} wsStatus={wsStatus} maxItems={8} />
    </div>
  );
}
