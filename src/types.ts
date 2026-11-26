export type UserRole = 'member' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  memberCode: string;
  role: UserRole;
  joinedAt: string;
}

export type CoverTone = 'ivory' | 'slate' | 'indigo' | 'ochre' | 'emerald' | 'stone';

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  year: number;
  category: string;
  callNumber: string;
  totalCopies: number;
  availableCopies: number;
  borrowCount: number;
  coverUrl: string;
  coverTone: CoverTone;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type LoanStatus = 'active' | 'returned' | 'overdue';

export interface LoanTransaction {
  id: string;
  bookId: string;
  bookTitle: string;
  bookCallNumber: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  extendedCount: number;
  status: LoanStatus;
  fineAmount: number;
}

export type ActivityType =
  | 'borrow'
  | 'return'
  | 'extend'
  | 'collection_add'
  | 'collection_update'
  | 'report_generated'
  | 'member_joined';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actorLabel: string;
  actorRole: UserRole | 'system';
  summary: string;
  bookTitle?: string;
  timestamp: string;
}

export interface DailyCirculationStat {
  date: string;
  label: string;
  borrows: number;
  returns: number;
}

export interface CategoryStat {
  category: string;
  borrowCount: number;
  bookCount: number;
  sharePct: number;
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface AutomatedReport {
  id: string;
  title: string;
  period: ReportPeriod;
  triggerType: 'manual' | 'scheduled';
  generatedAt: string;
  generatedBy: string;
  periodStart: string;
  periodEnd: string;
  metrics: {
    totalBooks: number;
    totalCopies: number;
    availableCopies: number;
    totalBorrowsInPeriod: number;
    totalReturnsInPeriod: number;
    activeLoansNow: number;
    overdueLoansNow: number;
    onTimeReturnRate: number;
    totalFinesAccrued: number;
  };
  topCategories: CategoryStat[];
  topBooks: Array<{
    bookId: string;
    title: string;
    author: string;
    borrowCount: number;
  }>;
  overdueItems: Array<{
    loanId: string;
    bookTitle: string;
    memberName: string;
    memberCode: string;
    dueAt: string;
    daysLate: number;
    fineAmount: number;
  }>;
}

export interface ReportScheduleConfig {
  enabled: boolean;
  frequency: ReportPeriod;
  autoRunLabel: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface LibraryOverviewStats {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  activeLoans: number;
  overdueLoans: number;
  totalMembers: number;
  onTimeRate: number;
  totalFinesAccrued: number;
  dailyTrend: DailyCirculationStat[];
  categoryDistribution: CategoryStat[];
}

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  memberCode: string;
  joinedAt: string;
  activeLoansCount: number;
  totalLoansCount: number;
}
