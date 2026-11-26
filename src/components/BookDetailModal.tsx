import { useState } from 'react';
import { BookOpen, CheckCircle2, X } from 'lucide-react';
import type { AuthUser, Book } from '../types';
import { BookCover } from './BookCover';

interface BookDetailModalProps {
  book: Book | null;
  currentUser: AuthUser | null;
  onClose: () => void;
  onBorrow: (bookId: string, durationDays: 7 | 14) => Promise<void>;
  onRequireAuth: () => void;
}

export function BookDetailModal({
  book,
  currentUser,
  onClose,
  onBorrow,
  onRequireAuth,
}: BookDetailModalProps) {
  const [duration, setDuration] = useState<7 | 14>(7);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  if (!book) return null;

  async function handleBorrowClick() {
    if (!book) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await onBorrow(book.id, duration);
      setFeedback({
        type: 'ok',
        text: `Peminjaman berhasil dicatat untuk durasi ${duration} hari.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memproses peminjaman.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-detail-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="font-mono text-xs text-slate-500">
            Kode Rak {book.callNumber} · ISBN {book.isbn}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail buku"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-12 gap-6">
          <div className="sm:col-span-4 flex justify-center sm:justify-start">
            <BookCover
              title={book.title}
              author={book.author}
              callNumber={book.callNumber}
              coverUrl={book.coverUrl}
              coverTone={book.coverTone}
              size="lg"
            />
          </div>

          <div className="sm:col-span-8 flex flex-col justify-between space-y-4">
            <div>
              <div className="text-xs text-slate-500 mb-1.5">
                {book.category} · {book.publisher} · {book.year}
              </div>
              <h2
                id="book-detail-title"
                className="font-display text-2xl font-semibold text-slate-900 leading-tight text-balance"
              >
                {book.title}
              </h2>
              <p className="text-sm font-medium text-slate-700 mt-1.5">{book.author}</p>

              <p className="text-sm text-slate-600 leading-relaxed mt-4">{book.description}</p>

              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Stok Tersedia</span>
                  <span
                    className={`font-mono tabular-nums text-base font-semibold mt-0.5 block ${
                      book.availableCopies > 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {book.availableCopies} / {book.totalCopies}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Dipinjam</span>
                  <span className="font-mono tabular-nums text-base font-semibold text-slate-900 mt-0.5 block">
                    {book.borrowCount} kali
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Denda Terlambat</span>
                  <span className="font-mono tabular-nums text-base font-semibold text-slate-900 mt-0.5 block">
                    Rp 2.000/hari
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              {feedback && (
                <div
                  className={`px-3.5 py-2.5 rounded-md text-xs flex items-center gap-2 ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {feedback.type === 'ok' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                  <button
                    type="button"
                    onClick={() => setDuration(7)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      duration === 7
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Durasi 7 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration(14)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      duration === 14
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Durasi 14 Hari
                  </button>
                </div>

                <button
                  type="button"
                  disabled={book.availableCopies <= 0 || submitting}
                  onClick={handleBorrowClick}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-medium rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4" />
                  {book.availableCopies <= 0
                    ? 'Stok Sedang Habis'
                    : submitting
                      ? 'Memproses...'
                      : currentUser
                        ? 'Pinjam Buku Ini'
                        : 'Masuk untuk Meminjam'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
