import { ArrowDownLeft, ArrowUpRight, BookPlus, Clock, FileSpreadsheet, RefreshCw, UserPlus } from 'lucide-react';
import type { ActivityEvent, ActivityType } from '../types';
import { formatRelativeTimeID } from '../utils/format';

interface RealtimeActivityFeedProps {
  activities: ActivityEvent[];
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  maxItems?: number;
}

const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: typeof ArrowUpRight; toneClass: string }
> = {
  borrow: {
    label: 'Peminjaman',
    icon: ArrowUpRight,
    toneClass: 'text-emerald-700',
  },
  return: {
    label: 'Pengembalian',
    icon: ArrowDownLeft,
    toneClass: 'text-slate-700',
  },
  extend: {
    label: 'Perpanjangan',
    icon: Clock,
    toneClass: 'text-amber-700',
  },
  collection_add: {
    label: 'Koleksi Baru',
    icon: BookPlus,
    toneClass: 'text-emerald-800',
  },
  collection_update: {
    label: 'Pembaruan Stok',
    icon: RefreshCw,
    toneClass: 'text-slate-700',
  },
  report_generated: {
    label: 'Laporan Otomatis',
    icon: FileSpreadsheet,
    toneClass: 'text-slate-900',
  },
  member_joined: {
    label: 'Anggota Baru',
    icon: UserPlus,
    toneClass: 'text-emerald-700',
  },
};

export function RealtimeActivityFeed({
  activities,
  wsStatus,
  maxItems = 12,
}: RealtimeActivityFeedProps) {
  const visible = activities.slice(0, maxItems);

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900">
            Aktivitas Transaksi Realtime
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Pembaruan langsung sirkulasi buku, stok koleksi, dan pelaporan
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected'
                ? 'bg-emerald-600'
                : wsStatus === 'reconnecting'
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
            }`}
            aria-hidden="true"
          />
          <span className="text-slate-600">
            {wsStatus === 'connected'
              ? 'Aliran Langsung Aktif'
              : wsStatus === 'reconnecting'
                ? 'Menyambungkan Ulang'
                : 'Terputus'}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {visible.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            Belum ada aktivitas transaksi tercatat.
          </div>
        ) : (
          visible.map((item) => {
            const meta = ACTIVITY_META[item.type] || ACTIVITY_META.borrow;
            const Icon = meta.icon;
            return (
              <div
                key={item.id}
                className="px-6 py-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 shrink-0 ${meta.toneClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className={`font-semibold ${meta.toneClass}`}>{meta.label}</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="font-medium text-slate-700">{item.actorLabel}</span>
                    </div>
                    {item.bookTitle && (
                      <p className="text-sm font-medium text-slate-900 truncate mt-0.5">
                        {item.bookTitle}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">{item.summary}</p>
                  </div>
                </div>
                <div className="font-mono tabular-nums text-[11px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                  {formatRelativeTimeID(item.timestamp)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
