import { useEffect, useState } from 'react';
import { CalendarClock, Download, FileSpreadsheet, Printer, Trash2 } from 'lucide-react';
import type { AutomatedReport, ReportPeriod, ReportScheduleConfig } from '../types';
import { downloadReportCSV, formatDateID, formatIDR } from '../utils/format';

interface AutomatedReportsPanelProps {
  reports: AutomatedReport[];
  schedule: ReportScheduleConfig;
  onGenerateReport: (period: ReportPeriod) => Promise<AutomatedReport>;
  onUpdateSchedule: (enabled: boolean, frequency: ReportPeriod) => Promise<void>;
  onDeleteReport: (id: string) => Promise<void>;
}

export function AutomatedReportsPanel({
  reports,
  schedule,
  onGenerateReport,
  onUpdateSchedule,
  onDeleteReport,
}: AutomatedReportsPanelProps) {
  const [selectedId, setSelectedId] = useState<string>(reports[0]?.id || '');
  const [manualPeriod, setManualPeriod] = useState<ReportPeriod>('weekly');
  const [schedEnabled, setSchedEnabled] = useState(schedule.enabled);
  const [schedFreq, setSchedFreq] = useState<ReportPeriod>(schedule.frequency);
  const [generating, setGenerating] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setSchedEnabled(schedule.enabled);
    setSchedFreq(schedule.frequency);
  }, [schedule]);

  useEffect(() => {
    if (!reports.some((r) => r.id === selectedId) && reports[0]) {
      setSelectedId(reports[0].id);
    }
  }, [reports, selectedId]);

  const activeReport = reports.find((r) => r.id === selectedId) || reports[0] || null;

  async function handleGenerateNow() {
    setGenerating(true);
    setStatusMsg(null);
    try {
      const created = await onGenerateReport(manualPeriod);
      setSelectedId(created.id);
      setStatusMsg(`Laporan baru (${created.id}) berhasil diterbitkan dan disimpan.`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Gagal menerbitkan laporan.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSavingSchedule(true);
    setStatusMsg(null);
    try {
      await onUpdateSchedule(schedEnabled, schedFreq);
      setStatusMsg('Pengaturan penjadwalan laporan otomatis telah diperbarui.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Gagal menyimpan jadwal.');
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Control Row: Automated Schedule + On-Demand Generation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        <form
          onSubmit={handleSaveSchedule}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-emerald-700" />
                Penjadwalan Pelaporan Otomatis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Server menyusun rekap sirkulasi dan daftar keterlambatan secara periodik tanpa
                input manual
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={schedEnabled}
                onChange={(e) => setSchedEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-800 rounded"
              />
              Aktifkan Otomatis
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setSchedFreq(freq)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    schedFreq === freq
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {freq === 'daily' ? 'Harian' : freq === 'weekly' ? 'Mingguan' : 'Bulanan'}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={savingSchedule}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap"
            >
              {savingSchedule ? 'Menyimpan...' : 'Simpan Jadwal Otomatis'}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>
              Terakhir jalan:{' '}
              <strong className="font-mono text-slate-700">
                {formatDateID(schedule.lastRunAt, true)}
              </strong>
            </span>
            <span>
              Jadwal berikutnya:{' '}
              <strong className="font-mono text-slate-700">
                {schedule.enabled ? formatDateID(schedule.nextRunAt, true) : 'Nonaktif'}
              </strong>
            </span>
          </div>
        </form>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Terbitkan Laporan Sekarang
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Buat snapshot laporan instan dari transaksi sirkulasi dan stok terbaru
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
              {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setManualPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    manualPeriod === p
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === 'daily' ? 'Harian' : p === 'weekly' ? 'Mingguan' : 'Bulanan'}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateNow}
              className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors"
            >
              {generating ? 'Menyusun Data Laporan...' : 'Buat Laporan Otomatis'}
            </button>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 no-print">
          {statusMsg}
        </div>
      )}

      {/* Report Archive List + Official Printable Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden no-print">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Arsip Laporan
            </h3>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {reports.length} dokumen
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {reports.map((rpt) => {
              const active = activeReport?.id === rpt.id;
              return (
                <div
                  key={rpt.id}
                  className={`p-4 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                    active ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                  }`}
                  onClick={() => setSelectedId(rpt.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                      <span>{rpt.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className={rpt.triggerType === 'scheduled' ? 'text-emerald-700' : ''}>
                        {rpt.triggerType === 'scheduled' ? 'Otomatis' : 'Manual'}
                      </span>
                    </div>
                    <div
                      className={`text-sm mt-1 truncate ${
                        active ? 'font-semibold text-emerald-900' : 'font-medium text-slate-800'
                      }`}
                    >
                      {rpt.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDateID(rpt.generatedAt, true)}
                    </div>
                  </div>
                  {reports.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Hapus laporan ${rpt.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteReport(rpt.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-700 rounded transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Printable Report Preview */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
          {!activeReport ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Belum ada laporan tersimpan. Klik &ldquo;Buat Laporan Otomatis&rdquo; untuk
              memulai.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <div className="font-mono text-xs text-slate-500">
                    Wonu Library · {activeReport.id} ·{' '}
                    {activeReport.triggerType === 'scheduled'
                      ? 'Terjadwal Otomatis'
                      : 'Penerbitan Manual'}
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-slate-900 mt-1">
                    {activeReport.title}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">
                    Rentang data: {formatDateID(activeReport.periodStart)} s.d.{' '}
                    {formatDateID(activeReport.periodEnd)} · Disusun oleh {activeReport.generatedBy}
                  </div>
                </div>

                <div className="flex items-center gap-2 no-print shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadReportCSV(activeReport)}
                    className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak / PDF
                  </button>
                </div>
              </div>

              {/* 6-Metric Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-xs text-slate-500">Peminjaman Periode</div>
                  <div className="font-mono tabular-nums text-xl font-semibold text-slate-900 mt-1">
                    {activeReport.metrics.totalBorrowsInPeriod}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-xs text-slate-500">Pengembalian Periode</div>
                  <div className="font-mono tabular-nums text-xl font-semibold text-slate-900 mt-1">
                    {activeReport.metrics.totalReturnsInPeriod}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-xs text-slate-500">Ketepatan Waktu</div>
                  <div className="font-mono tabular-nums text-xl font-semibold text-emerald-700 mt-1">
                    {activeReport.metrics.onTimeReturnRate}%
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-xs text-slate-500">Ketersediaan Stok</div>
                  <div className="font-mono tabular-nums text-xl font-semibold text-slate-900 mt-1">
                    {activeReport.metrics.availableCopies}/{activeReport.metrics.totalCopies}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-xs text-slate-500">Pinjaman Terlambat</div>
                  <div
                    className={`font-mono tabular-nums text-xl font-semibold mt-1 ${
                      activeReport.metrics.overdueLoansNow > 0 ? 'text-red-700' : 'text-slate-900'
                    }`}
                  >
                    {activeReport.metrics.overdueLoansNow}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-xs text-slate-500">Akumulasi Denda</div>
                  <div className="font-mono tabular-nums text-xl font-semibold text-slate-900 mt-1">
                    {formatIDR(activeReport.metrics.totalFinesAccrued)}
                  </div>
                </div>
              </div>

              {/* Top Books Table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2.5">
                  Koleksi Paling Sering Dipinjam
                </h4>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 px-4">Judul Buku</th>
                        <th className="py-2.5 px-4">Penulis</th>
                        <th className="py-2.5 px-4 text-right">Frekuensi Pinjam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeReport.topBooks.map((b) => (
                        <tr key={b.bookId}>
                          <td className="py-2.5 px-4 font-medium text-slate-900">{b.title}</td>
                          <td className="py-2.5 px-4 text-slate-600">{b.author}</td>
                          <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-900">
                            {b.borrowCount} kali
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Overdue Items */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2.5">
                  Rekap Keterlambatan Pengembalian
                </h4>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 px-4">Anggota</th>
                        <th className="py-2.5 px-4">Judul Buku</th>
                        <th className="py-2.5 px-4">Tenggat</th>
                        <th className="py-2.5 px-4 text-right">Terlambat</th>
                        <th className="py-2.5 px-4 text-right">Denda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeReport.overdueItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 px-4 text-center text-slate-500">
                            Seluruh pinjaman aktif berada dalam tenggat waktu normal.
                          </td>
                        </tr>
                      ) : (
                        activeReport.overdueItems.map((item) => (
                          <tr key={item.loanId}>
                            <td className="py-2.5 px-4">
                              <span className="font-medium text-slate-900">{item.memberName}</span>
                              <span className="block font-mono text-[11px] text-slate-400">
                                {item.memberCode}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-800">{item.bookTitle}</td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                              {formatDateID(item.dueAt)}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-right text-red-700">
                              {item.daysLate} hari
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-right font-medium text-slate-900">
                              {formatIDR(item.fineAmount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
