import { useState } from 'react'
import { getBpStatus, type BpLevel } from '~/lib/bp'

// 血压图表组件（轻量 SVG）。按天聚合、可点看值、散点拟合。

const W = 340
const H = 150
const P = 26
const YMIN = 50
const YMAX = 180
const YGRID = [60, 90, 120, 140, 170]

const ny = (v: number) => H - P - ((v - YMIN) / (YMAX - YMIN)) * (H - P * 2)

export type ChartPoint = { sys: number; dia: number; ds: string }

const LEVEL_COLOR: Record<BpLevel, string> = {
  low: '#ca8a04',
  healthy: '#16a34a',
  acceptable: '#0891b2',
  high: '#ea580c',
  crisis: '#dc2626',
}

function Empty() {
  return <p className="text-sm text-muted-foreground">无数据</p>
}

/** 按天聚合，计算每日均值 */
function dailyAvg(points: ChartPoint[]): { ds: string; sys: number; dia: number; n: number }[] {
  const byDay = new Map<string, { s: number; d: number; n: number }>()
  for (const p of points) {
    const cur = byDay.get(p.ds) ?? { s: 0, d: 0, n: 0 }
    cur.s += p.sys
    cur.d += p.dia
    cur.n++
    byDay.set(p.ds, cur)
  }
  return [...byDay.entries()]
    .map(([ds, a]) => ({ ds, sys: Math.round(a.s / a.n), dia: Math.round(a.d / a.n), n: a.n }))
    .sort((a, b) => a.ds.localeCompare(b.ds))
}

/** A 按天均值折线（点击点看数值） */
export function BpDailyChart({ points }: { points: ChartPoint[] }) {
  const [sel, setSel] = useState<string | null>(null)
  const days = dailyAvg(points)
  if (days.length === 0) return <Empty />

  const nx = (i: number) => P + (days.length > 1 ? i * ((W - P * 2) / (days.length - 1)) : (W - P * 2) / 2)
  const sysPts = days.map((d, i) => `${nx(i)},${ny(d.sys)}`).join(' ')
  const diaPts = days.map((d, i) => `${nx(i)},${ny(d.dia)}`).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <rect x={P} y={ny(140)} width={W - P * 2} height={ny(90) - ny(140)} fill="#bbf7d0" opacity={0.4} />
        {YGRID.map((v) => (
          <g key={v}>
            <line x1={P} y1={ny(v)} x2={W - P} y2={ny(v)} stroke="#e5e7eb" strokeDasharray="3" />
            <text x={2} y={ny(v) + 3} fontSize={8} fill="#9ca3af">{v}</text>
          </g>
        ))}
        <polyline points={sysPts} fill="none" stroke="#dc2626" strokeWidth={2} />
        <polyline points={diaPts} fill="none" stroke="#2563eb" strokeWidth={2} />
        {days.map((d, i) => (
          <g key={d.ds}>
            <circle cx={nx(i)} cy={ny(d.sys)} r={4} fill="#fff" stroke="#dc2626" strokeWidth={2}
              onClick={() => setSel(`${d.ds}: ${d.sys}/${d.dia} (日均${d.n}次) ${getBpStatus(d.sys, d.dia).label}`)}
              style={{ cursor: 'pointer' }}>
              <title>{d.ds}: {d.sys}/{d.dia}</title>
            </circle>
            <circle cx={nx(i)} cy={ny(d.dia)} r={4} fill="#fff" stroke="#2563eb" strokeWidth={2}
              onClick={() => setSel(`${d.ds}: ${d.sys}/${d.dia} (日均${d.n}次) ${getBpStatus(d.sys, d.dia).label}`)}
              style={{ cursor: 'pointer' }}>
              <title>{d.ds}: {d.sys}/{d.dia}</title>
            </circle>
          </g>
        ))}
        {days.length > 1 && <text x={P} y={H - 6} fontSize={8} fill="#9ca3af">{days[0].ds}</text>}
        {days.length > 1 && <text x={W - P - 24} y={H - 6} fontSize={8} fill="#9ca3af">{days[days.length - 1].ds}</text>}
      </svg>
      {sel && <p className="mt-1 rounded bg-muted px-2 py-1 text-xs text-foreground">{sel}</p>}
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />高压</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />低压</span>
      </div>
    </div>
  )
}

/** B 散点 + 线性拟合（点击点看数值） */
export function BpScatterFit({ points }: { points: ChartPoint[] }) {
  const [sel, setSel] = useState<string | null>(null)
  if (points.length === 0) return <Empty />

  const nx = (i: number) => P + i * ((W - P * 2) / (points.length - 1 || 1))

  // 简单线性回归（sys ~ index）
  const n = points.length
  const xs = points.map((_, i) => i)
  const ySys = points.map((p) => p.sys)
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = ySys.reduce((a, b) => a + b, 0) / n
  const denom = xs.reduce((a, x) => a + (x - xMean) ** 2, 0)
  const slope = denom > 0 ? xs.reduce((a, x, i) => a + (x - xMean) * (ySys[i] - yMean), 0) / denom : 0
  const intercept = yMean - slope * xMean
  const fitY0 = ny(intercept)
  const fitY1 = ny(slope * (n - 1) + intercept)
  const trendDir = slope < -0.3 ? '↓ 下降' : slope > 0.3 ? '↑ 上升' : '→ 平稳'

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {YGRID.map((v) => (
          <g key={v}>
            <line x1={P} y1={ny(v)} x2={W - P} y2={ny(v)} stroke="#e5e7eb" strokeDasharray="3" />
            <text x={2} y={ny(v) + 3} fontSize={8} fill="#9ca3af">{v}</text>
          </g>
        ))}
        <line x1={P} y1={ny(140)} x2={W - P} y2={ny(140)} stroke="#dc2626" strokeDasharray="4" opacity={0.3} />
        {/* 拟合线 */}
        {n > 1 && (
          <line x1={nx(0)} y1={fitY0} x2={nx(n - 1)} y2={fitY1} stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" />
        )}
        {/* 散点 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={nx(i)}
            cy={ny(p.sys)}
            r={3.5}
            fill={LEVEL_COLOR[getBpStatus(p.sys, p.dia).level]}
            onClick={() => setSel(`${p.ds}: ${p.sys}/${p.dia} ${getBpStatus(p.sys, p.dia).label}`)}
            style={{ cursor: 'pointer' }}
          >
            <title>{p.ds}: {p.sys}/{p.dia}</title>
          </circle>
        ))}
      </svg>
      {sel && <p className="mt-1 rounded bg-muted px-2 py-1 text-xs text-foreground">{sel}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        趋势拟合（紫虚线）：{trendDir}
        {Math.abs(slope) > 0.01 && `，约 ${slope > 0 ? '+' : ''}${slope.toFixed(1)} mmHg/次`}
      </p>
    </div>
  )
}

/** C 每日均值柱状（近 14 天） */
export function BpBars({ points }: { points: ChartPoint[] }) {
  const days = dailyAvg(points).slice(-14)
  if (days.length === 0) return <Empty />
  const bw = ((W - P * 2) / days.length) * 0.4
  const by = (v: number) => H - P - (v / 180) * (H - P * 2)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {[90, 140].map((v) => (
        <g key={v}>
          <line x1={P} y1={by(v)} x2={W - P} y2={by(v)} stroke={v >= 140 ? '#dc2626' : '#16a34a'} strokeDasharray="3" opacity={0.5} />
          <text x={2} y={by(v) + 3} fontSize={8} fill="#9ca3af">{v}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = P + i * ((W - P * 2) / days.length) + 2
        return (
          <g key={d.ds}>
            <rect x={x} y={by(d.sys)} width={bw} height={H - P - by(d.sys)} fill="#dc2626" />
            <rect x={x + bw + 1} y={by(d.dia)} width={bw} height={H - P - by(d.dia)} fill="#2563eb" />
            <text x={x + bw} y={H - 6} fontSize={7} fill="#9ca3af" textAnchor="middle">{d.ds.slice(-2)}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** D 环形达标率 */
export function BpDonut({ rate }: { rate: number }) {
  const R = 52, r = 34, cx = 70, cy = 60, C = 2 * Math.PI * R
  const off = C * (1 - rate / 100)
  return (
    <svg viewBox="0 0 140 120" style={{ maxWidth: 160 }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#fee2e2" strokeWidth={R - r} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#16a34a" strokeWidth={R - r} strokeDasharray={C} strokeDashoffset={off} transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={20} fontWeight={700} fill="#16a34a">{rate}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9} fill="#6b7280">达标率</text>
    </svg>
  )
}

/** D 区间分布柱 */
export function BpDist({ points }: { points: ChartPoint[] }) {
  const order: BpLevel[] = ['low', 'healthy', 'acceptable', 'high', 'crisis']
  const labels: Record<BpLevel, string> = { low: '偏低', healthy: '健康', acceptable: '尚可', high: '偏高', crisis: '危象' }
  const c: Record<BpLevel, number> = { low: 0, healthy: 0, acceptable: 0, high: 0, crisis: 0 }
  for (const p of points) c[getBpStatus(p.sys, p.dia).level] += 1
  const max = Math.max(1, ...Object.values(c))
  const DW = 260
  const bw = ((DW - 20) / 5) * 0.6
  const by = (v: number) => H - 20 - (v / max) * (H - 36)
  return (
    <svg viewBox={`0 0 ${DW} ${H}`} className="h-auto w-full">
      {order.map((lv, i) => {
        const count = c[lv]
        const x = 10 + i * ((DW - 20) / 5) + 6
        return (
          <g key={lv}>
            <rect x={x} y={by(count)} width={bw} height={H - 20 - by(count)} fill={LEVEL_COLOR[lv]} />
            <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize={8} fill="#6b7280">{labels[lv]}</text>
            <text x={x + bw / 2} y={by(count) - 3} textAnchor="middle" fontSize={9} fontWeight={700}>{count}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** E 日历热力图 */
export function BpCalendar({ points }: { points: ChartPoint[] }) {
  const days = dailyAvg(points).slice(-28)
  if (days.length === 0) return <Empty />
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const lv = getBpStatus(d.sys, d.dia).level
        return (
          <span
            key={d.ds}
            className="flex aspect-square items-center justify-center rounded text-[9px] text-white"
            style={{ background: LEVEL_COLOR[lv] }}
            title={`${d.ds} 均值 ${d.sys}/${d.dia}`}
          >
            {d.ds.split('-')[1]}
          </span>
        )
      })}
    </div>
  )
}
