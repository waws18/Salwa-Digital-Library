import type { AutomatedReport } from '../types';

export function formatDateID(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatRelativeTimeID(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 45) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function downloadReportCSV(report: AutomatedReport): void {
  const escape = (val: string | number) => {
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [];
  rows.push(['Wonu Library - Laporan Sirkulasi Otomatis', report.title].map(escape).join(','));
  rows.push(['ID Laporan', report.id, 'Diterbitkan', formatDateID(report.generatedAt, true)].map(escape).join(','));
  rows.push(['Metode', report.triggerType === 'scheduled' ? 'Terjadwal Otomatis' : 'Manual Admin', 'Oleh', report.generatedBy].map(escape).join(','));
  rows.push('');
  rows.push(['RINGKASAN METRIK', 'NILAI'].map(escape).join(','));
  rows.push(['Total Judul Koleksi', report.metrics.totalBooks].map(escape).join(','));
  rows.push(['Total Eksemplar', report.metrics.totalCopies].map(escape).join(','));
  rows.push(['Eksemplar Tersedia', report.metrics.availableCopies].map(escape).join(','));
  rows.push(['Peminjaman dalam Periode', report.metrics.totalBorrowsInPeriod].map(escape).join(','));
  rows.push(['Pengembalian dalam Periode', report.metrics.totalReturnsInPeriod].map(escape).join(','));
  rows.push(['Pinjaman Aktif Saat Ini', report.metrics.activeLoansNow].map(escape).join(','));
  rows.push(['Pinjaman Terlambat', report.metrics.overdueLoansNow].map(escape).join(','));
  rows.push(['Ketepatan Waktu Pengembalian (%)', `${report.metrics.onTimeReturnRate}%`].map(escape).join(','));
  rows.push(['Akumulasi Denda (IDR)', report.metrics.totalFinesAccrued].map(escape).join(','));
  rows.push('');
  rows.push(['BUKU PALING SERING DIPINJAM', 'PENULIS', 'TOTAL PINJAMAN'].map(escape).join(','));
  for (const b of report.topBooks) {
    rows.push([b.title, b.author, b.borrowCount].map(escape).join(','));
  }
  rows.push('');
  rows.push(['DAFTAR KETERLAMBATAN', 'PEMINJAM', 'KODE ANGGOTA', 'TENGGAT', 'HARI TERLAMBAT', 'DENDA (IDR)'].map(escape).join(','));
  if (report.overdueItems.length === 0) {
    rows.push(['Tidak ada keterlambatan aktif', '-', '-', '-', 0, 0].map(escape).join(','));
  } else {
    for (const item of report.overdueItems) {
      rows.push(
        [
          item.bookTitle,
          item.memberName,
          item.memberCode,
          formatDateID(item.dueAt),
          item.daysLate,
          item.fineAmount,
        ]
          .map(escape)
          .join(',')
      );
    }
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.id.toLowerCase()}-wonu-library.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
