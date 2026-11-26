import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  ActivityEvent,
  AutomatedReport,
  Book,
  CategoryStat,
  DailyCirculationStat,
  LibraryOverviewStats,
  LoanTransaction,
  MemberSummary,
  ReportPeriod,
  ReportScheduleConfig,
} from '../types.ts';

export interface StoredMember {
  id: string;
  name: string;
  email: string;
  memberCode: string;
  passwordHash: string;
  joinedAt: string;
}

export interface LibraryStoreData {
  adminCredentialHash: string | null;
  books: Book[];
  members: StoredMember[];
  loans: LoanTransaction[];
  activities: ActivityEvent[];
  reports: AutomatedReport[];
  reportSchedule: ReportScheduleConfig;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'wonu-library.json');
export const DAILY_FINE_IDR = 2000;
export const MAX_ACTIVE_LOANS_PER_MEMBER = 5;

export function hashSecret(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySecret(plain: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(plain, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function isoDaysAgo(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

function isoDaysFromNow(days: number, hour = 17): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function createInitialSeed(): LibraryStoreData {
  const books: Book[] = [
    {
      id: 'bk-001',
      isbn: '978-602-424-694-5',
      title: 'Filosofi Teras: Filsafat Yunani-Romawi Kuno untuk Mental Tangguh',
      author: 'Henry Manampiring',
      publisher: 'Penerbit Buku Kompas',
      year: 2019,
      category: 'Filsafat & Psikologi',
      callNumber: '188.MAN.f',
      totalCopies: 6,
      availableCopies: 4,
      borrowCount: 28,
      coverUrl: '/src/assets/images/cover_filosofi_teras_1795660558456.jpg',
      coverTone: 'ivory',
      description:
        'Pengantar Stoisisme modern yang relevan untuk menghadapi kecemasan, kendali emosi, dan ketenangan berpikir di era serba cepat.',
      createdAt: isoDaysAgo(60),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'bk-002',
      isbn: '978-623-00-3182-3',
      title: 'Arsitektur Data Modern & Sistem Terdistribusi',
      author: 'Dr. Bagus Prasetyo',
      publisher: 'Pustaka Informatika Nusantara',
      year: 2024,
      category: 'Teknologi & Komputer',
      callNumber: '005.74.PRA.a',
      totalCopies: 5,
      availableCopies: 3,
      borrowCount: 24,
      coverUrl: '/src/assets/images/cover_arsitektur_data_1795660559394.jpg',
      coverTone: 'slate',
      description:
        'Panduan komprehensif merancang pipeline data berketahanan tinggi, konsistensi terdistribusi, dan tata kelola informasi skala organisasi.',
      createdAt: isoDaysAgo(55),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: 'bk-003',
      isbn: '978-602-424-694-9',
      title: 'Laut Bercerita',
      author: 'Leila S. Chudori',
      publisher: 'Kepustakaan Populer Gramedia',
      year: 2017,
      category: 'Sastra & Fiksi',
      callNumber: '899.221.CHU.l',
      totalCopies: 7,
      availableCopies: 5,
      borrowCount: 35,
      coverUrl: '/src/assets/images/cover_laut_bercerita_1795660559961.jpg',
      coverTone: 'indigo',
      description:
        'Novel sastra Indonesia yang merekam persahabatan, keteguhan nurani, dan ingatan keluarga dalam lanskap sejarah kontemporer.',
      createdAt: isoDaysAgo(70),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: 'bk-004',
      isbn: '978-602-03-8912-7',
      title: 'Jalur Rempah & Kartografi Maritim Nusantara',
      author: 'Prof. Ratna Sari Dewi',
      publisher: 'Balai Pustaka Akademia',
      year: 2022,
      category: 'Sejarah & Budaya',
      callNumber: '959.8.DEW.j',
      totalCopies: 4,
      availableCopies: 3,
      borrowCount: 19,
      coverUrl: '/src/assets/images/cover_sejarah_nusantara_1795660560197.jpg',
      coverTone: 'ochre',
      description:
        'Kajian mendalam mengenai jaringan pelayaran dagang rempah, peta bahari klasik, dan pertukaran budaya maritim Asia Tenggara.',
      createdAt: isoDaysAgo(48),
      updatedAt: isoDaysAgo(3),
    },
    {
      id: 'bk-005',
      isbn: '978-602-291-784-2',
      title: 'Ekonomi Sirkular & Kota Berkelanjutan',
      author: 'Nadia Kusumawardhani',
      publisher: 'LP3ES Press',
      year: 2023,
      category: 'Ekonomi & Bisnis',
      callNumber: '338.9.KUS.e',
      totalCopies: 5,
      availableCopies: 4,
      borrowCount: 15,
      coverUrl: '',
      coverTone: 'emerald',
      description:
        'Studi empiris transformasi rantai pasok perkotaan menuju pemanfaatan sumber daya rendah karbon dan efisiensi energi terbarukan.',
      createdAt: isoDaysAgo(40),
      updatedAt: isoDaysAgo(4),
    },
    {
      id: 'bk-006',
      isbn: '978-623-241-552-1',
      title: 'Tipografi Editorial & Tata Letak Publikasi',
      author: 'Hendra Wijaya',
      publisher: 'Kreasi Visual Press',
      year: 2021,
      category: 'Desain & Arsitektur',
      callNumber: '686.22.WIJ.t',
      totalCopies: 4,
      availableCopies: 4,
      borrowCount: 14,
      coverUrl: '',
      coverTone: 'stone',
      description:
        'Prinsip grid Swiss, ritme spasi, pemilihan pasangan huruf serif-sans, dan keterbacaan naskah cetak maupun digital.',
      createdAt: isoDaysAgo(38),
      updatedAt: isoDaysAgo(5),
    },
    {
      id: 'bk-007',
      isbn: '978-602-06-4821-3',
      title: 'Metode Riset Kualitatif untuk Ilmu Sosial',
      author: 'Dr. Arif Budiman',
      publisher: 'Rajawali Pers',
      year: 2020,
      category: 'Sains & Akademik',
      callNumber: '001.42.BUD.m',
      totalCopies: 6,
      availableCopies: 5,
      borrowCount: 21,
      coverUrl: '',
      coverTone: 'slate',
      description:
        'Kerangka metodologi wawancara mendalam, etnografi digital, pengkodean tematik, dan validasi triangulasi data penelitian.',
      createdAt: isoDaysAgo(52),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'bk-008',
      isbn: '978-623-7537-19-4',
      title: 'Kecerdasan Buatan yang Bertanggung Jawab',
      author: 'Siti Aminah & Raka Pratama',
      publisher: 'Pustaka Teknologi Bangsa',
      year: 2025,
      category: 'Teknologi & Komputer',
      callNumber: '006.3.AMI.k',
      totalCopies: 5,
      availableCopies: 3,
      borrowCount: 22,
      coverUrl: '',
      coverTone: 'indigo',
      description:
        'Membahas tata kelola model komputasi modern, audit bias algoritmik, privasi data, dan standar transparansi sistem informasi.',
      createdAt: isoDaysAgo(25),
      updatedAt: isoDaysAgo(1),
    },
  ];

  // Sample non-credential member profiles for realistic statistics & circulation history
  // Note: placeholder hash cannot be logged into; users register their own real member account!
  const members: StoredMember[] = [
    {
      id: 'mem-101',
      name: 'Rani Maharani',
      email: 'rani.maharani@anggota.wonulib.id',
      memberCode: 'WN-2026-0101',
      passwordHash: '',
      joinedAt: isoDaysAgo(45),
    },
    {
      id: 'mem-102',
      name: 'Dimas Aditya',
      email: 'dimas.aditya@anggota.wonulib.id',
      memberCode: 'WN-2026-0102',
      passwordHash: '',
      joinedAt: isoDaysAgo(32),
    },
    {
      id: 'mem-103',
      name: 'Salsa Permata',
      email: 'salsa.permata@anggota.wonulib.id',
      memberCode: 'WN-2026-0103',
      passwordHash: '',
      joinedAt: isoDaysAgo(21),
    },
  ];

  const loans: LoanTransaction[] = [
    {
      id: 'TRX-8901',
      bookId: 'bk-001',
      bookTitle: 'Filosofi Teras: Filsafat Yunani-Romawi Kuno untuk Mental Tangguh',
      bookCallNumber: '188.MAN.f',
      memberId: 'mem-101',
      memberName: 'Rani Maharani',
      memberCode: 'WN-2026-0101',
      borrowedAt: isoDaysAgo(10, 9),
      dueAt: isoDaysAgo(3, 17),
      returnedAt: null,
      extendedCount: 0,
      status: 'overdue',
      fineAmount: 6000,
    },
    {
      id: 'TRX-8902',
      bookId: 'bk-002',
      bookTitle: 'Arsitektur Data Modern & Sistem Terdistribusi',
      bookCallNumber: '005.74.PRA.a',
      memberId: 'mem-102',
      memberName: 'Dimas Aditya',
      memberCode: 'WN-2026-0102',
      borrowedAt: isoDaysAgo(4, 14),
      dueAt: isoDaysFromNow(3, 17),
      returnedAt: null,
      extendedCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'TRX-8903',
      bookId: 'bk-003',
      bookTitle: 'Laut Bercerita',
      bookCallNumber: '899.221.CHU.l',
      memberId: 'mem-103',
      memberName: 'Salsa Permata',
      memberCode: 'WN-2026-0103',
      borrowedAt: isoDaysAgo(2, 11),
      dueAt: isoDaysFromNow(5, 17),
      returnedAt: null,
      extendedCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'TRX-8904',
      bookId: 'bk-008',
      bookTitle: 'Kecerdasan Buatan yang Bertanggung Jawab',
      bookCallNumber: '006.3.AMI.k',
      memberId: 'mem-101',
      memberName: 'Rani Maharani',
      memberCode: 'WN-2026-0101',
      borrowedAt: isoDaysAgo(1, 16),
      dueAt: isoDaysFromNow(6, 17),
      returnedAt: null,
      extendedCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'TRX-8890',
      bookId: 'bk-004',
      bookTitle: 'Jalur Rempah & Kartografi Maritim Nusantara',
      bookCallNumber: '959.8.DEW.j',
      memberId: 'mem-102',
      memberName: 'Dimas Aditya',
      memberCode: 'WN-2026-0102',
      borrowedAt: isoDaysAgo(6, 10),
      dueAt: isoDaysFromNow(1, 17),
      returnedAt: isoDaysAgo(1, 13),
      extendedCount: 0,
      status: 'returned',
      fineAmount: 0,
    },
    {
      id: 'TRX-8888',
      bookId: 'bk-005',
      bookTitle: 'Ekonomi Sirkular & Kota Berkelanjutan',
      bookCallNumber: '338.9.KUS.e',
      memberId: 'mem-103',
      memberName: 'Salsa Permata',
      memberCode: 'WN-2026-0103',
      borrowedAt: isoDaysAgo(5, 15),
      dueAt: isoDaysFromNow(2, 17),
      returnedAt: isoDaysAgo(0, 9),
      extendedCount: 0,
      status: 'returned',
      fineAmount: 0,
    },
    {
      id: 'TRX-8885',
      bookId: 'bk-007',
      bookTitle: 'Metode Riset Kualitatif untuk Ilmu Sosial',
      bookCallNumber: '001.42.BUD.m',
      memberId: 'mem-101',
      memberName: 'Rani Maharani',
      memberCode: 'WN-2026-0101',
      borrowedAt: isoDaysAgo(3, 13),
      dueAt: isoDaysFromNow(4, 17),
      returnedAt: isoDaysAgo(0, 11),
      extendedCount: 0,
      status: 'returned',
      fineAmount: 0,
    },
  ];

  // Adjust available copies accurately to reflect active/overdue seeded loans
  const activeCountByBook = new Map<string, number>();
  for (const loan of loans) {
    if (loan.status !== 'returned') {
      activeCountByBook.set(loan.bookId, (activeCountByBook.get(loan.bookId) || 0) + 1);
    }
  }
  for (const book of books) {
    const active = activeCountByBook.get(book.id) || 0;
    book.availableCopies = Math.max(0, book.totalCopies - active);
  }

  const activities: ActivityEvent[] = [
    {
      id: 'act-1',
      type: 'return',
      actorLabel: 'Anggota Terdaftar',
      actorRole: 'member',
      summary: 'Mengembalikan buku tepat waktu ke loket sirkulasi digital.',
      bookTitle: 'Metode Riset Kualitatif untuk Ilmu Sosial',
      timestamp: isoDaysAgo(0, 11),
    },
    {
      id: 'act-2',
      type: 'return',
      actorLabel: 'Anggota Terdaftar',
      actorRole: 'member',
      summary: 'Pengembalian selesai diverifikasi tanpa keterlambatan.',
      bookTitle: 'Ekonomi Sirkular & Kota Berkelanjutan',
      timestamp: isoDaysAgo(0, 9),
    },
    {
      id: 'act-3',
      type: 'borrow',
      actorLabel: 'Anggota Terdaftar',
      actorRole: 'member',
      summary: 'Meminjam eksemplar dengan tenggat pengembalian 7 hari.',
      bookTitle: 'Kecerdasan Buatan yang Bertanggung Jawab',
      timestamp: isoDaysAgo(1, 16),
    },
    {
      id: 'act-4',
      type: 'borrow',
      actorLabel: 'Anggota Terdaftar',
      actorRole: 'member',
      summary: 'Meminjam eksemplar dari kategori Sastra & Fiksi.',
      bookTitle: 'Laut Bercerita',
      timestamp: isoDaysAgo(2, 11),
    },
  ];

  const seedStore: LibraryStoreData = {
    adminCredentialHash: null,
    books,
    members,
    loans,
    activities,
    reports: [],
    reportSchedule: {
      enabled: true,
      frequency: 'weekly',
      autoRunLabel: 'Setiap Minggu · Pembuatan Otomatis Terjadwal',
      lastRunAt: isoDaysAgo(1, 8),
      nextRunAt: isoDaysFromNow(6, 8),
    },
  };

  // Generate 1 initial baseline automated report
  seedStore.reports.push(buildAutomatedReport(seedStore, 'weekly', 'scheduled', 'Sistem Pelaporan Otomatis'));
  return seedStore;
}

export function recalculateLoanStatuses(store: LibraryStoreData): boolean {
  const now = Date.now();
  let changed = false;
  for (const loan of store.loans) {
    if (loan.returnedAt) {
      if (loan.status !== 'returned') {
        loan.status = 'returned';
        changed = true;
      }
      continue;
    }
    const dueMs = new Date(loan.dueAt).getTime();
    if (now > dueMs) {
      const daysLate = Math.max(1, Math.ceil((now - dueMs) / (1000 * 60 * 60 * 24)));
      const fine = daysLate * DAILY_FINE_IDR;
      if (loan.status !== 'overdue' || loan.fineAmount !== fine) {
        loan.status = 'overdue';
        loan.fineAmount = fine;
        changed = true;
      }
    } else {
      if (loan.status !== 'active' || loan.fineAmount !== 0) {
        loan.status = 'active';
        loan.fineAmount = 0;
        changed = true;
      }
    }
  }
  return changed;
}

export function loadStore(): LibraryStoreData {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = createInitialSeed();
    saveStore(initial);
    return initial;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as LibraryStoreData;
  if (recalculateLoanStatuses(parsed)) {
    saveStore(parsed);
  }
  return parsed;
}

export function saveStore(data: LibraryStoreData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
}

export function computeOverviewStats(store: LibraryStoreData): LibraryOverviewStats {
  recalculateLoanStatuses(store);
  const totalTitles = store.books.length;
  const totalCopies = store.books.reduce((acc, b) => acc + b.totalCopies, 0);
  const availableCopies = store.books.reduce((acc, b) => acc + b.availableCopies, 0);
  const activeLoans = store.loans.filter((l) => l.status === 'active').length;
  const overdueLoans = store.loans.filter((l) => l.status === 'overdue').length;
  const returnedLoans = store.loans.filter((l) => l.status === 'returned');
  const onTimeReturns = returnedLoans.filter((l) => l.fineAmount === 0).length;
  const onTimeRate =
    returnedLoans.length > 0 ? Math.round((onTimeReturns / returnedLoans.length) * 100) : 100;
  const totalFinesAccrued = store.loans.reduce((acc, l) => acc + l.fineAmount, 0);

  // Build 7-day trend
  const dailyTrend: DailyCirculationStat[] = [];
  const dayFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric' });
  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - i);
    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayDate.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const borrows = store.loans.filter((l) => l.borrowedAt.slice(0, 10) === dateKey).length;
    const returns = store.loans.filter((l) => l.returnedAt && l.returnedAt.slice(0, 10) === dateKey).length;

    dailyTrend.push({
      date: dateKey,
      label: dayFormatter.format(dayDate),
      borrows,
      returns,
    });
  }

  // Category distribution
  const catMap = new Map<string, { borrowCount: number; bookCount: number }>();
  let totalCategoryBorrows = 0;
  for (const book of store.books) {
    const current = catMap.get(book.category) || { borrowCount: 0, bookCount: 0 };
    current.borrowCount += book.borrowCount;
    current.bookCount += 1;
    totalCategoryBorrows += book.borrowCount;
    catMap.set(book.category, current);
  }

  const categoryDistribution: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, info]) => ({
      category,
      borrowCount: info.borrowCount,
      bookCount: info.bookCount,
      sharePct:
        totalCategoryBorrows > 0
          ? Math.round((info.borrowCount / totalCategoryBorrows) * 100)
          : 0,
    }))
    .sort((a, b) => b.borrowCount - a.borrowCount);

  return {
    totalTitles,
    totalCopies,
    availableCopies,
    activeLoans: activeLoans + overdueLoans,
    overdueLoans,
    totalMembers: store.members.length,
    onTimeRate,
    totalFinesAccrued,
    dailyTrend,
    categoryDistribution,
  };
}

export function buildAutomatedReport(
  store: LibraryStoreData,
  period: ReportPeriod,
  triggerType: 'manual' | 'scheduled',
  generatedBy: string
): AutomatedReport {
  recalculateLoanStatuses(store);
  const now = new Date();
  const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  const periodStartDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const periodBorrows = store.loans.filter(
    (l) => new Date(l.borrowedAt).getTime() >= periodStartDate.getTime()
  );
  const periodReturns = store.loans.filter(
    (l) => l.returnedAt && new Date(l.returnedAt).getTime() >= periodStartDate.getTime()
  );

  const stats = computeOverviewStats(store);
  const periodLabelMap: Record<ReportPeriod, string> = {
    daily: 'Harian',
    weekly: 'Mingguan',
    monthly: 'Bulanan',
  };

  const overdueItems = store.loans
    .filter((l) => l.status === 'overdue')
    .map((l) => {
      const daysLate = Math.max(
        1,
        Math.ceil((Date.now() - new Date(l.dueAt).getTime()) / (1000 * 60 * 60 * 24))
      );
      return {
        loanId: l.id,
        bookTitle: l.bookTitle,
        memberName: l.memberName,
        memberCode: l.memberCode,
        dueAt: l.dueAt,
        daysLate,
        fineAmount: l.fineAmount,
      };
    });

  const topBooks = [...store.books]
    .sort((a, b) => b.borrowCount - a.borrowCount)
    .slice(0, 5)
    .map((b) => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      borrowCount: b.borrowCount,
    }));

  const dateFmt = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return {
    id: `RPT-${Date.now().toString().slice(-6)}`,
    title: `Laporan Sirkulasi ${periodLabelMap[period]} (${dateFmt.format(now)})`,
    period,
    triggerType,
    generatedAt: now.toISOString(),
    generatedBy,
    periodStart: periodStartDate.toISOString(),
    periodEnd: now.toISOString(),
    metrics: {
      totalBooks: stats.totalTitles,
      totalCopies: stats.totalCopies,
      availableCopies: stats.availableCopies,
      totalBorrowsInPeriod: periodBorrows.length,
      totalReturnsInPeriod: periodReturns.length,
      activeLoansNow: stats.activeLoans,
      overdueLoansNow: stats.overdueLoans,
      onTimeReturnRate: stats.onTimeRate,
      totalFinesAccrued: stats.totalFinesAccrued,
    },
    topCategories: stats.categoryDistribution.slice(0, 5),
    topBooks,
    overdueItems,
  };
}

export function getMemberSummaries(store: LibraryStoreData): MemberSummary[] {
  return store.members.map((m) => {
    const memberLoans = store.loans.filter((l) => l.memberId === m.id);
    const activeLoansCount = memberLoans.filter((l) => l.status !== 'returned').length;
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      memberCode: m.memberCode,
      joinedAt: m.joinedAt,
      activeLoansCount,
      totalLoansCount: memberLoans.length,
    };
  });
}
