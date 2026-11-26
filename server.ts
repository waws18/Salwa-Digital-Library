import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import {
  buildAutomatedReport,
  computeOverviewStats,
  getMemberSummaries,
  hashSecret,
  loadStore,
  MAX_ACTIVE_LOANS_PER_MEMBER,
  recalculateLoanStatuses,
  saveStore,
  verifySecret,
} from './src/server/store.ts';
import type {
  ActivityEvent,
  AuthUser,
  Book,
  CoverTone,
  ReportPeriod,
  UserRole,
} from './src/types.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface TokenPayload {
  sub: string;
  role: UserRole;
  name: string;
  email: string;
  memberCode: string;
  joinedAt: string;
  exp: number;
}

function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encoded)
      .digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
    if (!decoded.exp || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function sanitizeString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function sanitizeCoverUrl(val: unknown): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('/src/assets/images/') && !trimmed.includes('..')) {
    return trimmed.slice(0, 240);
  }
  return '';
}

const VALID_TONES: CoverTone[] = ['ivory', 'slate', 'indigo', 'ochre', 'emerald', 'stone'];

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

function extractBearer(req: Request): TokenPayload | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7).trim());
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const payload = extractBearer(req);
  if (!payload) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
    return;
  }
  req.user = {
    id: payload.sub,
    role: payload.role,
    name: payload.name,
    email: payload.email,
    memberCode: payload.memberCode,
    joinedAt: payload.joinedAt,
  };
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const payload = extractBearer(req);
  if (!payload) {
    res.status(401).json({ error: 'Otentikasi admin diperlukan.' });
    return;
  }
  if (payload.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Hanya petugas admin yang diizinkan.' });
    return;
  }
  req.user = {
    id: payload.sub,
    role: payload.role,
    name: payload.name,
    email: payload.email,
    memberCode: payload.memberCode,
    joinedAt: payload.joinedAt,
  };
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const store = loadStore();

  function broadcast(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload, sentAt: new Date().toISOString() });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  function pushActivity(activity: ActivityEvent): void {
    store.activities.unshift(activity);
    if (store.activities.length > 60) {
      store.activities = store.activities.slice(0, 60);
    }
    broadcast('activity:new', activity);
  }

  function broadcastStateRefresh(): void {
    broadcast('library:sync', {
      books: store.books,
      stats: computeOverviewStats(store),
    });
  }

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'connected',
        payload: { message: 'Terhubung ke aliran sirkulasi real-time Wonu Library' },
        sentAt: new Date().toISOString(),
      })
    );
  });

  // --- Health ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Wonu Library', timestamp: new Date().toISOString() });
  });

  // --- Public Non-PII Overview ---
  app.get('/api/public/overview', (_req, res) => {
    const changed = recalculateLoanStatuses(store);
    if (changed) saveStore(store);

    res.json({
      books: store.books,
      stats: computeOverviewStats(store),
      activities: store.activities.slice(0, 25),
    });
  });

  // --- Admin Auth Status & Setup/Login ---
  app.get('/api/auth/admin-status', (_req, res) => {
    const envPass = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPass.length > 0) {
      res.json({ configured: true, source: 'env' });
      return;
    }
    if (store.adminCredentialHash) {
      res.json({ configured: true, source: 'claimed' });
      return;
    }
    res.json({ configured: false, source: 'unclaimed' });
  });

  app.post('/api/auth/admin-setup', (req, res) => {
    const envPass = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPass.length > 0 || store.adminCredentialHash) {
      res.status(409).json({
        error: 'Kata sandi admin sudah dikonfigurasi. Silakan masuk melalui tab Masuk Admin.',
      });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const adminName = sanitizeString(req.body?.name, 80) || 'Pustakawan Kepala';
    if (passcode.length < 6 || passcode.length > 100) {
      res.status(400).json({ error: 'Kata sandi admin harus terdiri dari 6 hingga 100 karakter.' });
      return;
    }

    store.adminCredentialHash = hashSecret(passcode);
    saveStore(store);

    const adminUser: AuthUser = {
      id: 'admin-root',
      name: adminName,
      email: 'admin@wonulib.id',
      memberCode: 'ADM-001',
      role: 'admin',
      joinedAt: new Date().toISOString(),
    };
    const token = signToken({
      sub: adminUser.id,
      role: 'admin',
      name: adminUser.name,
      email: adminUser.email,
      memberCode: adminUser.memberCode,
      joinedAt: adminUser.joinedAt,
    });
    res.status(201).json({ token, user: adminUser });
  });

  app.post('/api/auth/admin-login', (req, res) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    if (!passcode) {
      res.status(400).json({ error: 'Kata sandi admin wajib diisi.' });
      return;
    }

    const envPass = (process.env.ADMIN_PASSCODE || '').trim();
    let valid = false;
    if (envPass.length > 0) {
      valid = constantTimeEquals(passcode, envPass);
    } else if (store.adminCredentialHash) {
      valid = verifySecret(passcode, store.adminCredentialHash);
    } else {
      res.status(409).json({
        error: 'Akses admin belum diklaim. Silakan atur kata sandi admin pertama kali.',
      });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: 'Kata sandi admin tidak sesuai.' });
      return;
    }

    const adminUser: AuthUser = {
      id: 'admin-root',
      name: 'Pustakawan Admin',
      email: 'admin@wonulib.id',
      memberCode: 'ADM-001',
      role: 'admin',
      joinedAt: new Date().toISOString(),
    };
    const token = signToken({
      sub: adminUser.id,
      role: 'admin',
      name: adminUser.name,
      email: adminUser.email,
      memberCode: adminUser.memberCode,
      joinedAt: adminUser.joinedAt,
    });
    res.json({ token, user: adminUser });
  });

  // --- Member Registration & Login ---
  app.post('/api/auth/register', (req, res) => {
    const name = sanitizeString(req.body?.name, 80);
    const email = sanitizeString(req.body?.email, 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Format alamat email tidak valid.' });
      return;
    }
    if (password.length < 6 || password.length > 100) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    const exists = store.members.some((m) => m.email.toLowerCase() === email);
    if (exists) {
      res.status(409).json({ error: 'Email tersebut sudah terdaftar sebagai anggota.' });
      return;
    }

    const nextNum = 101 + store.members.length;
    const newMember = {
      id: `mem-${Date.now().toString().slice(-6)}`,
      name,
      email,
      memberCode: `WN-2026-${String(nextNum).padStart(4, '0')}`,
      passwordHash: hashSecret(password),
      joinedAt: new Date().toISOString(),
    };

    store.members.push(newMember);
    pushActivity({
      id: `act-${Date.now()}`,
      type: 'member_joined',
      actorLabel: 'Anggota Baru',
      actorRole: 'member',
      summary: `Anggota baru bergabung dengan nomor kartu ${newMember.memberCode}.`,
      timestamp: new Date().toISOString(),
    });
    saveStore(store);
    broadcastStateRefresh();

    const authUser: AuthUser = {
      id: newMember.id,
      name: newMember.name,
      email: newMember.email,
      memberCode: newMember.memberCode,
      role: 'member',
      joinedAt: newMember.joinedAt,
    };

    const token = signToken({
      sub: authUser.id,
      role: 'member',
      name: authUser.name,
      email: authUser.email,
      memberCode: authUser.memberCode,
      joinedAt: authUser.joinedAt,
    });

    res.status(201).json({ token, user: authUser });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = sanitizeString(req.body?.email, 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const member = store.members.find((m) => m.email.toLowerCase() === email);
    if (!member || !member.passwordHash || !verifySecret(password, member.passwordHash)) {
      res.status(401).json({ error: 'Email atau kata sandi anggota tidak sesuai.' });
      return;
    }

    const authUser: AuthUser = {
      id: member.id,
      name: member.name,
      email: member.email,
      memberCode: member.memberCode,
      role: 'member',
      joinedAt: member.joinedAt,
    };

    const token = signToken({
      sub: authUser.id,
      role: 'member',
      name: authUser.name,
      email: authUser.email,
      memberCode: authUser.memberCode,
      joinedAt: authUser.joinedAt,
    });

    res.json({ token, user: authUser });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // --- Member Dashboard ---
  app.get('/api/member/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const changed = recalculateLoanStatuses(store);
    if (changed) saveStore(store);

    const myLoans = store.loans
      .filter((l) => l.memberId === user.id)
      .sort((a, b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime());

    const activeLoans = myLoans.filter((l) => l.status !== 'returned');
    const overdueLoans = activeLoans.filter((l) => l.status === 'overdue');
    const totalFines = myLoans.reduce((sum, l) => sum + l.fineAmount, 0);

    res.json({
      user,
      loans: myLoans,
      summary: {
        activeCount: activeLoans.length,
        overdueCount: overdueLoans.length,
        completedCount: myLoans.filter((l) => l.status === 'returned').length,
        quotaRemaining: Math.max(0, MAX_ACTIVE_LOANS_PER_MEMBER - activeLoans.length),
        maxQuota: MAX_ACTIVE_LOANS_PER_MEMBER,
        totalFines,
      },
    });
  });

  // --- Book Borrowing & Return & Extension ---
  app.post('/api/loans/borrow', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const bookId = sanitizeString(req.body?.bookId, 64);
    const durationDays = Number(req.body?.durationDays) === 14 ? 14 : 7;

    let targetMemberId = user.id;
    let targetMemberName = user.name;
    let targetMemberCode = user.memberCode;

    if (user.role === 'admin' && typeof req.body?.memberId === 'string' && req.body.memberId.trim()) {
      const foundMember = store.members.find((m) => m.id === req.body.memberId.trim());
      if (!foundMember) {
        res.status(404).json({ error: 'Anggota tujuan tidak ditemukan.' });
        return;
      }
      targetMemberId = foundMember.id;
      targetMemberName = foundMember.name;
      targetMemberCode = foundMember.memberCode;
    }

    const book = store.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan dalam katalog.' });
      return;
    }
    if (book.availableCopies <= 0) {
      res.status(409).json({ error: 'Seluruh eksemplar buku ini sedang dipinjam.' });
      return;
    }

    recalculateLoanStatuses(store);
    const memberActiveLoans = store.loans.filter(
      (l) => l.memberId === targetMemberId && l.status !== 'returned'
    );

    if (memberActiveLoans.length >= MAX_ACTIVE_LOANS_PER_MEMBER) {
      res.status(409).json({
        error: `Batas maksimal peminjaman aktif (${MAX_ACTIVE_LOANS_PER_MEMBER} buku) telah tercapai.`,
      });
      return;
    }

    if (memberActiveLoans.some((l) => l.bookId === book.id)) {
      res.status(409).json({ error: 'Anda sedang meminjam judul buku ini.' });
      return;
    }

    const now = new Date();
    const due = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    due.setHours(17, 0, 0, 0);

    const newLoan = {
      id: `TRX-${Date.now().toString().slice(-5)}`,
      bookId: book.id,
      bookTitle: book.title,
      bookCallNumber: book.callNumber,
      memberId: targetMemberId,
      memberName: targetMemberName,
      memberCode: targetMemberCode,
      borrowedAt: now.toISOString(),
      dueAt: due.toISOString(),
      returnedAt: null,
      extendedCount: 0,
      status: 'active' as const,
      fineAmount: 0,
    };

    book.availableCopies -= 1;
    book.borrowCount += 1;
    book.updatedAt = now.toISOString();
    store.loans.unshift(newLoan);

    pushActivity({
      id: `act-${Date.now()}`,
      type: 'borrow',
      actorLabel: user.role === 'admin' ? 'Sirkulasi Loket Admin' : 'Anggota Terdaftar',
      actorRole: user.role,
      summary: `Peminjaman baru untuk durasi ${durationDays} hari (${newLoan.id}).`,
      bookTitle: book.title,
      timestamp: now.toISOString(),
    });

    saveStore(store);
    broadcastStateRefresh();
    broadcast('loan:changed', { loanId: newLoan.id, action: 'borrow' });

    res.status(201).json({ loan: newLoan });
  });

  app.post('/api/loans/:id/return', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const loanId = sanitizeString(req.params.id, 64);
    const loan = store.loans.find((l) => l.id === loanId);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi peminjaman tidak ditemukan.' });
      return;
    }
    if (user.role !== 'admin' && loan.memberId !== user.id) {
      res.status(403).json({ error: 'Anda tidak berwenang mengembalikan transaksi ini.' });
      return;
    }
    if (loan.status === 'returned' || loan.returnedAt) {
      res.status(409).json({ error: 'Buku pada transaksi ini sudah dikembalikan sebelumnya.' });
      return;
    }

    recalculateLoanStatuses(store);
    const now = new Date();
    loan.returnedAt = now.toISOString();
    loan.status = 'returned';

    const book = store.books.find((b) => b.id === loan.bookId);
    if (book) {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      book.updatedAt = now.toISOString();
    }

    pushActivity({
      id: `act-${Date.now()}`,
      type: 'return',
      actorLabel: user.role === 'admin' ? 'Verifikasi Admin' : 'Anggota Terdaftar',
      actorRole: user.role,
      summary:
        loan.fineAmount > 0
          ? `Pengembalian diproses dengan catatan keterlambatan (${loan.id}).`
          : `Pengembalian selesai tepat waktu (${loan.id}).`,
      bookTitle: loan.bookTitle,
      timestamp: now.toISOString(),
    });

    saveStore(store);
    broadcastStateRefresh();
    broadcast('loan:changed', { loanId: loan.id, action: 'return' });

    res.json({ loan });
  });

  app.post('/api/loans/:id/extend', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const loanId = sanitizeString(req.params.id, 64);
    const loan = store.loans.find((l) => l.id === loanId);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      return;
    }
    if (user.role !== 'admin' && loan.memberId !== user.id) {
      res.status(403).json({ error: 'Anda tidak berwenang memperpanjang transaksi ini.' });
      return;
    }
    if (loan.status === 'returned') {
      res.status(409).json({ error: 'Buku sudah dikembalikan dan tidak dapat diperpanjang.' });
      return;
    }
    recalculateLoanStatuses(store);
    if (loan.status === 'overdue' && user.role !== 'admin') {
      res.status(409).json({
        error: 'Pinjaman yang sudah melewati tenggat hanya dapat diperpanjang oleh Admin.',
      });
      return;
    }
    if (loan.extendedCount >= 2) {
      res.status(409).json({ error: 'Batas maksimal perpanjangan (2 kali) telah tercapai.' });
      return;
    }

    const baseDate = new Date(Math.max(Date.now(), new Date(loan.dueAt).getTime()));
    baseDate.setDate(baseDate.getDate() + 7);
    baseDate.setHours(17, 0, 0, 0);

    loan.dueAt = baseDate.toISOString();
    loan.extendedCount += 1;
    loan.status = 'active';
    loan.fineAmount = 0;

    pushActivity({
      id: `act-${Date.now()}`,
      type: 'extend',
      actorLabel: user.role === 'admin' ? 'Perpanjangan Admin' : 'Anggota Terdaftar',
      actorRole: user.role,
      summary: `Tenggat pinjaman diperpanjang +7 hari (${loan.id}).`,
      bookTitle: loan.bookTitle,
      timestamp: new Date().toISOString(),
    });

    saveStore(store);
    broadcastStateRefresh();
    broadcast('loan:changed', { loanId: loan.id, action: 'extend' });

    res.json({ loan });
  });

  // --- Admin Dashboard & Collection CRUD & Reporting ---
  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const changed = recalculateLoanStatuses(store);
    if (changed) saveStore(store);

    const sortedLoans = [...store.loans].sort(
      (a, b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime()
    );

    res.json({
      books: store.books,
      loans: sortedLoans,
      members: getMemberSummaries(store),
      stats: computeOverviewStats(store),
      activities: store.activities.slice(0, 40),
      reports: store.reports,
      reportSchedule: store.reportSchedule,
    });
  });

  app.post('/api/books', requireAdmin, (req, res) => {
    const title = sanitizeString(req.body?.title, 180);
    const author = sanitizeString(req.body?.author, 120);
    const isbn = sanitizeString(req.body?.isbn, 40);
    const publisher = sanitizeString(req.body?.publisher, 120) || 'Penerbit Nasional';
    const category = sanitizeString(req.body?.category, 60) || 'Umum';
    const callNumber = sanitizeString(req.body?.callNumber, 40) || '000.WNL';
    const description = sanitizeString(req.body?.description, 800);
    const year = Math.min(2030, Math.max(1900, Number(req.body?.year) || 2025));
    const totalCopies = Math.min(500, Math.max(1, Math.floor(Number(req.body?.totalCopies) || 1)));
    const coverTone: CoverTone = VALID_TONES.includes(req.body?.coverTone)
      ? req.body.coverTone
      : 'emerald';
    const coverUrl = sanitizeCoverUrl(req.body?.coverUrl);

    if (title.length < 2 || author.length < 2 || isbn.length < 5) {
      res.status(400).json({ error: 'Judul, penulis, dan ISBN wajib diisi dengan valid.' });
      return;
    }

    const now = new Date().toISOString();
    const newBook: Book = {
      id: `bk-${Date.now().toString().slice(-6)}`,
      isbn,
      title,
      author,
      publisher,
      year,
      category,
      callNumber,
      totalCopies,
      availableCopies: totalCopies,
      borrowCount: 0,
      coverUrl,
      coverTone,
      description:
        description ||
        `Koleksi resmi perpustakaan Wonu Library kategori ${category}, karya ${author}.`,
      createdAt: now,
      updatedAt: now,
    };

    store.books.unshift(newBook);
    pushActivity({
      id: `act-${Date.now()}`,
      type: 'collection_add',
      actorLabel: 'Admin Koleksi',
      actorRole: 'admin',
      summary: `Menambahkan judul baru (${totalCopies} eksemplar) ke katalog.`,
      bookTitle: newBook.title,
      timestamp: now,
    });

    saveStore(store);
    broadcastStateRefresh();
    res.status(201).json({ book: newBook });
  });

  app.put('/api/books/:id', requireAdmin, (req, res) => {
    const bookId = sanitizeString(req.params.id, 64);
    const book = store.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const title = sanitizeString(req.body?.title, 180) || book.title;
    const author = sanitizeString(req.body?.author, 120) || book.author;
    const isbn = sanitizeString(req.body?.isbn, 40) || book.isbn;
    const publisher = sanitizeString(req.body?.publisher, 120) || book.publisher;
    const category = sanitizeString(req.body?.category, 60) || book.category;
    const callNumber = sanitizeString(req.body?.callNumber, 40) || book.callNumber;
    const description = sanitizeString(req.body?.description, 800) || book.description;
    const year = Math.min(2030, Math.max(1900, Number(req.body?.year) || book.year));
    const requestedTotal = Math.min(500, Math.max(1, Math.floor(Number(req.body?.totalCopies) || book.totalCopies)));

    const activeLoanedCount = store.loans.filter(
      (l) => l.bookId === book.id && l.status !== 'returned'
    ).length;

    if (requestedTotal < activeLoanedCount) {
      res.status(409).json({
        error: `Total eksemplar tidak boleh kurang dari jumlah yang sedang dipinjam (${activeLoanedCount} eksemplar).`,
      });
      return;
    }

    book.title = title;
    book.author = author;
    book.isbn = isbn;
    book.publisher = publisher;
    book.category = category;
    book.callNumber = callNumber;
    book.description = description;
    book.year = year;
    book.totalCopies = requestedTotal;
    book.availableCopies = requestedTotal - activeLoanedCount;
    if (VALID_TONES.includes(req.body?.coverTone)) {
      book.coverTone = req.body.coverTone;
    }
    if (req.body?.coverUrl !== undefined) {
      book.coverUrl = sanitizeCoverUrl(req.body.coverUrl);
    }
    book.updatedAt = new Date().toISOString();

    pushActivity({
      id: `act-${Date.now()}`,
      type: 'collection_update',
      actorLabel: 'Admin Koleksi',
      actorRole: 'admin',
      summary: `Memperbarui metadata & stok koleksi (${book.availableCopies}/${book.totalCopies} tersedia).`,
      bookTitle: book.title,
      timestamp: book.updatedAt,
    });

    saveStore(store);
    broadcastStateRefresh();
    res.json({ book });
  });

  app.delete('/api/books/:id', requireAdmin, (req, res) => {
    const bookId = sanitizeString(req.params.id, 64);
    const idx = store.books.findIndex((b) => b.id === bookId);
    if (idx === -1) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const activeLoansCount = store.loans.filter(
      (l) => l.bookId === bookId && l.status !== 'returned'
    ).length;
    if (activeLoansCount > 0) {
      res.status(409).json({
        error: `Buku tidak dapat dihapus karena masih ada ${activeLoansCount} eksemplar yang sedang dipinjam.`,
      });
      return;
    }

    const [removed] = store.books.splice(idx, 1);
    pushActivity({
      id: `act-${Date.now()}`,
      type: 'collection_update',
      actorLabel: 'Admin Koleksi',
      actorRole: 'admin',
      summary: `Menghapus judul koleksi dari katalog aktif.`,
      bookTitle: removed.title,
      timestamp: new Date().toISOString(),
    });

    saveStore(store);
    broadcastStateRefresh();
    res.json({ deletedId: bookId });
  });

  // --- Automated Reporting System ---
  app.post('/api/reports/generate', requireAdmin, (req: AuthenticatedRequest, res) => {
    const rawPeriod = req.body?.period;
    const period: ReportPeriod =
      rawPeriod === 'daily' || rawPeriod === 'weekly' || rawPeriod === 'monthly'
        ? rawPeriod
        : 'weekly';

    const report = buildAutomatedReport(
      store,
      period,
      'manual',
      req.user?.name || 'Pustakawan Admin'
    );
    store.reports.unshift(report);
    if (store.reports.length > 30) {
      store.reports = store.reports.slice(0, 30);
    }

    pushActivity({
      id: `act-${Date.now()}`,
      type: 'report_generated',
      actorLabel: 'Sistem Pelaporan',
      actorRole: 'admin',
      summary: `Menerbitkan ${report.title}.`,
      timestamp: report.generatedAt,
    });

    saveStore(store);
    broadcast('report:generated', report);
    res.status(201).json({ report });
  });

  app.put('/api/reports/schedule', requireAdmin, (req, res) => {
    const enabled = Boolean(req.body?.enabled);
    const rawFreq = req.body?.frequency;
    const frequency: ReportPeriod =
      rawFreq === 'daily' || rawFreq === 'weekly' || rawFreq === 'monthly'
        ? rawFreq
        : 'weekly';

    const labelMap: Record<ReportPeriod, string> = {
      daily: 'Setiap Hari · Otomatis Pukul 08:00',
      weekly: 'Setiap Minggu · Pembuatan Otomatis Terjadwal',
      monthly: 'Setiap Bulan · Rekap Akhir Periode',
    };

    const days = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
    const nextRun = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    nextRun.setHours(8, 0, 0, 0);

    store.reportSchedule = {
      enabled,
      frequency,
      autoRunLabel: labelMap[frequency],
      lastRunAt: store.reportSchedule.lastRunAt,
      nextRunAt: enabled ? nextRun.toISOString() : null,
    };

    saveStore(store);
    broadcast('report:schedule', store.reportSchedule);
    res.json({ reportSchedule: store.reportSchedule });
  });

  app.delete('/api/reports/:id', requireAdmin, (req, res) => {
    const id = sanitizeString(req.params.id, 64);
    store.reports = store.reports.filter((r) => r.id !== id);
    saveStore(store);
    res.json({ deletedId: id });
  });

  // Real background automated report scheduler check (every 60s)
  setInterval(() => {
    if (!store.reportSchedule.enabled || !store.reportSchedule.nextRunAt) return;
    const nextMs = new Date(store.reportSchedule.nextRunAt).getTime();
    if (Date.now() >= nextMs) {
      const freq = store.reportSchedule.frequency;
      const report = buildAutomatedReport(
        store,
        freq,
        'scheduled',
        'Sistem Pelaporan Otomatis'
      );
      store.reports.unshift(report);
      if (store.reports.length > 30) {
        store.reports = store.reports.slice(0, 30);
      }
      const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : 30;
      const upcoming = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      upcoming.setHours(8, 0, 0, 0);
      store.reportSchedule.lastRunAt = report.generatedAt;
      store.reportSchedule.nextRunAt = upcoming.toISOString();

      pushActivity({
        id: `act-${Date.now()}`,
        type: 'report_generated',
        actorLabel: 'Pelaporan Otomatis',
        actorRole: 'system',
        summary: `Laporan terjadwal otomatis diterbitkan: ${report.title}.`,
        timestamp: report.generatedAt,
      });

      saveStore(store);
      broadcast('report:generated', report);
    }
  }, 60 * 1000);

  // --- Vite Dev Middleware / Production Static ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Wonu Library server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Wonu Library server:', err);
  process.exit(1);
});
