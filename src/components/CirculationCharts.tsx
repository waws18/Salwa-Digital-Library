import { useState } from 'react';
import type { CategoryStat, DailyCirculationStat } from '../types';

interface CirculationChartsProps {
  dailyTrend: DailyCirculationStat[];
  categoryDistribution: CategoryStat[];
}

export function CirculationCharts({
  dailyTrend,
  categoryDistribution,
}: CirculationChartsProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    3,
    ...dailyTrend.map((d) => Math.max(d.borrows, d.returns))
  );

  const chartHeight = 176;
  const chartWidth = 520;
  const paddingLeft = 28;
  const paddingRight = 12;
  const paddingTop = 14;
  const paddingBottom = 28;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const groupWidth = dailyTrend.length > 0 ? innerWidth / dailyTrend.length : innerWidth;

  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 7-Day Borrowing vs Return Trend */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">
              Tren Sirkulasi 7 Hari Terakhir
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan transaksi peminjaman dan pengembalian harian
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700 inline-block" />
              Peminjaman
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" />
              Pengembalian
            </span>
          </div>
        </div>

        <div className="relative">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="Grafik tren peminjaman dan pengembalian 7 hari terakhir"
          >
            {yTicks.map((tick) => {
              const y = paddingTop + innerHeight - (tick / maxVal) * innerHeight;
              return (
                <g key={tick}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                    strokeWidth={1}
                  />
                  <text
                    x={paddingLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-slate-400 font-mono text-[10px]"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {dailyTrend.map((day, idx) => {
              const gx = paddingLeft + idx * groupWidth;
              const barW = Math.min(18, groupWidth * 0.28);
              const borrowH = (day.borrows / maxVal) * innerHeight;
              const returnH = (day.returns / maxVal) * innerHeight;
              const borrowX = gx + groupWidth / 2 - barW - 2;
              const returnX = gx + groupWidth / 2 + 2;
              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={day.date}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={gx + 4}
                    y={paddingTop}
                    width={Math.max(10, groupWidth - 8)}
                    height={innerHeight}
                    rx={4}
                    fill={isHovered ? '#F1F5F9' : 'transparent'}
                  />
                  <rect
                    x={borrowX}
                    y={paddingTop + innerHeight - borrowH}
                    width={barW}
                    height={Math.max(2, borrowH)}
                    rx={2}
                    fill="#047857"
                  />
                  <rect
                    x={returnX}
                    y={paddingTop + innerHeight - returnH}
                    width={barW}
                    height={Math.max(2, returnH)}
                    rx={2}
                    fill="#CBD5E1"
                  />
                  <text
                    x={gx + groupWidth / 2}
                    y={chartHeight - 6}
                    textAnchor="middle"
                    className="fill-slate-500 font-mono text-[10px]"
                  >
                    {day.label}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 min-h-[24px]">
            {hoveredIdx !== null && dailyTrend[hoveredIdx] ? (
              <>
                <span className="font-medium text-slate-900">
                  {dailyTrend[hoveredIdx].label} ({dailyTrend[hoveredIdx].date})
                </span>
                <span className="font-mono tabular-nums">
                  {dailyTrend[hoveredIdx].borrows} dipinjam · {dailyTrend[hoveredIdx].returns} dikembalikan
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-400">Arahkan kursor ke batang grafik untuk rincian harian</span>
                <span className="font-mono tabular-nums text-slate-700">
                  Total 7 hari: {dailyTrend.reduce((a, b) => a + b.borrows, 0)} pinjam ·{' '}
                  {dailyTrend.reduce((a, b) => a + b.returns, 0)} kembali
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Category Popularity Breakdown */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
        <div className="mb-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            Distribusi Peminjaman per Kategori
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Akumulasi frekuensi peminjaman berdasarkan subjek koleksi
          </p>
        </div>

        <div className="space-y-4">
          {categoryDistribution.slice(0, 6).map((cat) => (
            <div key={cat.category}>
              <div className="flex items-baseline justify-between gap-3 text-xs mb-1.5">
                <span className="font-medium text-slate-800 truncate">{cat.category}</span>
                <span className="font-mono tabular-nums text-slate-500 shrink-0">
                  {cat.borrowCount} kali · {cat.sharePct}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-emerald-700 transition-all duration-300"
                  style={{ width: `${Math.max(4, cat.sharePct)}%` }}
                />
              </div>
            </div>
          ))}
          {categoryDistribution.length === 0 && (
            <p className="text-sm text-slate-500 py-8 text-center">
              Belum ada data distribusi kategori.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
