import { getBpStatus, type BpLevel } from '~/lib/bp'

// 血压图表组件（轻量 SVG，无第三方库）。几何与 docs/references/trends-export-mockup.html 一致。

const W = 340
const H = 150
const P = 26
const YMIN = 50
const YMAX = 180
const YGRID = [60, 90, 140, 180]

const ny = (v: number) => H - P - ((v - YMIN) / (YMAX - YMIN)) * (H - P * 2)

export type ChartPoint = { sys: number; dia: number; ds: string }

const LEVEL_COLOR: Record<BpLevel, string> = {
  low: '#ca8a04',
  acceptable: '#16a34a',
  high: '#ea580c',
  crisis: '#dc2626',
}

function Empty() {
  return <p className="text-sm text-muted-foreground">无数据</p>
}

/** A 增强折线：正常带 + 网格 + 高低压线/点 + 首末日期。 */
export function BpLineChart({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) return <Empty />
  const nx = (i: number) =>
    P + (points.length > 1 ? i * ((W - P * 2) / (points.length - 1)) : (W - P * 2) / 2)
  const sysPts = points.map((x, i) => `${nx(i)},${ny(x.sys)}`).join(' ')
  const diaPts = points.map((x, i) => `${nx(i)},${ny(x.dia)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      <rect
        x={P}
        y={ny(140)}
        width={W - P * 2}
        height={ny(90) - ny(140)}
        fill="#bbf7d0"
        opacity={0.5}
      />
      {YGRID.map((v) => (
        <g key={v}>
          <line x1={P} y1={ny(v)} x2={W - P} y2={ny(v)} stroke="#e5e7eb" strokeDasharray="3" />
          <text x={2} y={ny(v) + 3} fontSize={8} fill="#9ca3af">
            {v}
          </text>
        </g>
      ))}
      <polyline points={sysPts} fill="none" stroke="#dc2626" strokeWidth={2} />
      <polyline points={diaPts} fill="none" stroke="#2563eb" strokeWidth={2} />
      {points.map((x, i) => (
        <g key={i}>
          <circle cx={nx(i)} cy={ny(x.sys)} r={2.5} fill="#fff" stroke="#dc2626" strokeWidth={1.5} />
          <circle cx={nx(i)} cy={ny(x.dia)} r={2.5} fill="#fff" stroke="#2563eb" strokeWidth={1.5} />
        </g>
      ))}
      <text x={P} y={H - 6} fontSize={8} fill="#9ca3af">
        {points[0].ds}
      </text>
      <text x={W - P - 24} y={H - 6} fontSize={8} fill="#9ca3af">
        {points[points.length - 1].ds}
      </text>
    </svg>
  )
}

/** B 散点：每次一个点（高压），颜色=状态；135 参考线。 */
export function BpScatter({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) return <Empty />
  const nx = (i: number) => P + i * ((W - P * 2) / (points.length - 1 || 1))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {YGRID.map((v) => (
        <g key={v}>
          <line x1={P} y1={ny(v)} x2={W - P} y2={ny(v)} stroke="#e5e7eb" strokeDasharray="3" />
          <text x={2} y={ny(v) + 3} fontSize={8} fill="#9ca3af">
            {v}
          </text>
        </g>
      ))}
      <line
        x1={P}
        y1={ny(135)}
        x2={W - P}
        y2={ny(135)}
        stroke="#dc2626"
        strokeDasharray="4"
        opacity={0.4}
      />
      {points.map((x, i) => (
        <circle
          key={i}
          cx={nx(i)}
          cy={ny(x.sys)}
          r={3.5}
          fill={LEVEL_COLOR[getBpStatus(x.sys, x.dia).level]}
        />
      ))}
    </svg>
  )
}

/** C 每日均值柱状：按天分组的均值（高压红 / 低压蓝）+ 90/135 参考线。 */
export function BpBars({ points }: { points: ChartPoint[] }) {
  const byDay = new Map<string, { s: number; d: number; n: number }>()
  for (const p of points) {
    const cur = byDay.get(p.ds) ?? { s: 0, d: 0, n: 0 }
    cur.s += p.sys
    cur.d += p.dia
    cur.n += 1
    byDay.set(p.ds, cur)
  }
  const days = [...byDay.entries()].slice(-14)
  if (days.length === 0) return <Empty />
  const bw = ((W - P * 2) / days.length) * 0.4
  const by = (v: number) => H - P - (v / 180) * (H - P * 2)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {[90, 135].map((v) => (
        <g key={v}>
          <line
            x1={P}
            y1={by(v)}
            x2={W - P}
            y2={by(v)}
            stroke={v >= 135 ? '#dc2626' : '#16a34a'}
            strokeDasharray="3"
            opacity={0.5}
          />
          <text x={2} y={by(v) + 3} fontSize={8} fill="#9ca3af">
            {v}
          </text>
        </g>
      ))}
      {days.map(([ds, a], i) => {
        const avgS = a.s / a.n
        const avgD = a.d / a.n
        const x = P + i * ((W - P * 2) / days.length) + 2
        return (
          <g key={ds}>
            <rect x={x} y={by(avgS)} width={bw} height={H - P - by(avgS)} fill="#dc2626" />
            <rect x={x + bw + 1} y={by(avgD)} width={bw} height={H - P - by(avgD)} fill="#2563eb" />
          </g>
        )
      })}
    </svg>
  )
}

/** D 环形达标率。 */
export function BpDonut({ rate }: { rate: number }) {
  const R = 52
  const r = 34
  const cx = 70
  const cy = 60
  const C = 2 * Math.PI * R
  const off = C * (1 - rate / 100)
  return (
    <svg viewBox="0 0 140 120" style={{ maxWidth: 160 }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#fee2e2" strokeWidth={R - r} />
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="#16a34a"
        strokeWidth={R - r}
        strokeDasharray={C}
        strokeDashoffset={off}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={20} fontWeight={700} fill="#16a34a">
        {rate}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9} fill="#6b7280">
        达标率
      </text>
    </svg>
  )
}

/** D 区间分布柱（偏低/正常/正常高值/偏高/危象 计数）。 */
export function BpDist({ points }: { points: ChartPoint[] }) {
  const order: BpLevel[] = ['low', 'acceptable', 'high', 'crisis']
  const labels: Record<BpLevel, string> = {
    low: '偏低',
    acceptable: '尚可',
    high: '偏高',
    crisis: '危象',
  }
  const c: Record<BpLevel, number> = { low: 0, acceptable: 0, high: 0, crisis: 0 }
  for (const p of points) c[getBpStatus(p.sys, p.dia).level] += 1
  const max = Math.max(1, ...Object.values(c))
  const DW = 260
  const bw = ((DW - 20) / 4) * 0.6
  const by = (v: number) => H - 20 - (v / max) * (H - 36)
  return (
    <svg viewBox={`0 0 ${DW} ${H}`} className="h-auto w-full">
      {order.map((lv, i) => {
        const n = c[lv]
        const x = 10 + i * ((DW - 20) / 5) + 6
        return (
          <g key={lv}>
            <rect x={x} y={by(n)} width={bw} height={H - 20 - by(n)} fill={LEVEL_COLOR[lv]} />
            <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize={8} fill="#6b7280">
              {labels[lv]}
            </text>
            <text x={x + bw / 2} y={by(n) - 3} textAnchor="middle" fontSize={9} fontWeight={700}>
              {n}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** E 日历热力图：按天均值着色（近 N 天）。 */
export function BpCalendar({ points }: { points: ChartPoint[] }) {
  const byDay = new Map<string, { s: number; d: number; n: number }>()
  for (const p of points) {
    const cur = byDay.get(p.ds) ?? { s: 0, d: 0, n: 0 }
    cur.s += p.sys
    cur.d += p.dia
    cur.n += 1
    byDay.set(p.ds, cur)
  }
  const days = [...byDay.entries()].slice(-28)
  if (days.length === 0) return <Empty />
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map(([ds, a]) => {
        const avgS = a.s / a.n
        const avgD = a.d / a.n
        const lv = getBpStatus(avgS, avgD).level
        const col =
          lv === 'acceptable'
            ? '#16a34a'
            : lv === 'high'
              ? '#ea580c'
              : lv === 'low'
                ? '#ca8a04'
                : '#dc2626'
        return (
          <span
            key={ds}
            className="flex aspect-square items-center justify-center rounded text-[9px] text-white"
            style={{ background: col }}
            title={`${ds} 均值 ${Math.round(avgS)}/${Math.round(avgD)}`}
          >
            {ds.split('-')[1]}
          </span>
        )
      })}
    </div>
  )
}
