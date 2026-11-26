import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Book, CoverTone } from '../types';

export interface BookFormValues {
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  year: number;
  category: string;
  callNumber: string;
  totalCopies: number;
  coverTone: CoverTone;
  coverUrl: string;
  description: string;
}

interface CollectionFormModalProps {
  isOpen: boolean;
  editingBook: Book | null;
  onClose: () => void;
  onSubmit: (values: BookFormValues, bookId?: string) => Promise<void>;
}

const CATEGORIES = [
  'Filsafat & Psikologi',
  'Teknologi & Komputer',
  'Sastra & Fiksi',
  'Sejarah & Budaya',
  'Ekonomi & Bisnis',
  'Desain & Arsitektur',
  'Sains & Akademik',
];

const COVER_PRESETS = [
  { label: 'Sampul Tipografi Minimalis (Tanpa Gambar)', url: '' },
  {
    label: 'Ilustrasi Klasik — Filsafat & Linen',
    url: '/src/assets/images/cover_filosofi_teras_1795660558456.jpg',
  },
  {
    label: 'Ilustrasi Teknis — Cetak Biru Arsitektur',
    url: '/src/assets/images/cover_arsitektur_data_1795660559394.jpg',
  },
  {
    label: 'Lukisan Sastra — Horizon Samudera',
    url: '/src/assets/images/cover_laut_bercerita_1795660559961.jpg',
  },
  {
    label: 'Arsip Nusantara — Kartografi & Rempah',
    url: '/src/assets/images/cover_sejarah_nusantara_1795660560197.jpg',
  },
];

export function CollectionFormModal({
  isOpen,
  editingBook,
  onClose,
  onSubmit,
}: CollectionFormModalProps) {
  const [form, setForm] = useState<BookFormValues>({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    year: 2025,
    category: CATEGORIES[0],
    callNumber: '',
    totalCopies: 3,
    coverTone: 'emerald',
    coverUrl: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (editingBook) {
        setForm({
          title: editingBook.title,
          author: editingBook.author,
          isbn: editingBook.isbn,
          publisher: editingBook.publisher,
          year: editingBook.year,
          category: editingBook.category,
          callNumber: editingBook.callNumber,
          totalCopies: editingBook.totalCopies,
          coverTone: editingBook.coverTone,
          coverUrl: editingBook.coverUrl,
          description: editingBook.description,
        });
      } else {
        setForm({
          title: '',
          author: '',
          isbn: '',
          publisher: '',
          year: 2025,
          category: CATEGORIES[0],
          callNumber: '',
          totalCopies: 3,
          coverTone: 'emerald',
          coverUrl: '',
          description: '',
        });
      }
    }
  }, [isOpen, editingBook]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form, editingBook?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan buku.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {editingBook ? 'Edit Koleksi Buku' : 'Tambah Judul Koleksi Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form koleksi"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Judul Buku</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Pengantar Sistem Basis Data"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Penulis</label>
              <input
                type="text"
                required
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="Nama penulis"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ISBN</label>
              <input
                type="text"
                required
                value={form.isbn}
                onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                placeholder="978-602-xxx-xxx-x"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Terbit</label>
              <input
                type="number"
                min={1900}
                max={2030}
                required
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Total Eksemplar
              </label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={form.totalCopies}
                onChange={(e) => setForm({ ...form, totalCopies: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Penerbit</label>
              <input
                type="text"
                value={form.publisher}
                onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                placeholder="Nama penerbit"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kode Panggil / Rak
              </label>
              <input
                type="text"
                value={form.callNumber}
                onChange={(e) => setForm({ ...form, callNumber: e.target.value })}
                placeholder="005.74.WNL"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Gaya Sampul Editorial
              </label>
              <select
                value={form.coverUrl}
                onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {COVER_PRESETS.map((p) => (
                  <option key={p.label} value={p.url}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Warna Sampul Tipografi
              </label>
              <select
                value={form.coverTone}
                onChange={(e) => setForm({ ...form, coverTone: e.target.value as CoverTone })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value="emerald">Emerald Hutan</option>
                <option value="slate">Slate Gelap</option>
                <option value="ivory">Gading Klasik</option>
                <option value="ochre">Ochre Arsip</option>
                <option value="indigo">Indigo Senja</option>
                <option value="stone">Batu Netral</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Sinopsis Singkat</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ringkasan materi atau topik utama buku..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-medium bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-md"
            >
              {saving ? 'Menyimpan...' : editingBook ? 'Simpan Perubahan' : 'Tambahkan Koleksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
