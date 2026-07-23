// 轻量 SVG 血压折线（高压红 / 低压蓝），无第三方图表库依赖。
const W = 320
const H = 140
const PAD = 10
const MIN = 40
const MAX = 200

function yFor(v: number) {
  return H - PAD - ((v - MIN) / (MAX - MIN)) * (H - PAD * 2)
}

export type BpChartPoint = { sys: number; dia: number }

export function BpChart({ points }: { points: BpChartPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">无数据</p>
  }
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0
  const xFor = (i: number) => PAD + i * stepX
  const sysPts = points.map((p, i) => `${xFor(i)},${yFor(p.sys)}`).join(' ')
  const diaPts = points.map((p, i) => `${xFor(i)},${yFor(p.dia)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {/* 正常带（90-140，粗略参考） */}
      <rect
        x={PAD}
        y={yFor(140)}
        width={W - PAD * 2}
        height={yFor(90) - yFor(140)}
        fill="#f0fdf4"
      />
      {[60, 90, 140, 180].map((v) => (
        <g key={v}>
          <line
            x1={PAD}
            y1={yFor(v)}
            x2={W - PAD}
            y2={yFor(v)}
            stroke="#e5e7eb"
            strokeDasharray="4"
          />
          <text x={2} y={yFor(v) + 3} fontSize="9" fill="#9ca3af">
            {v}
          </text>
        </g>
      ))}
      <polyline
        points={sysPts}
        fill="none"
        stroke="#ef4444"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={diaPts}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={xFor(i)}
            cy={yFor(p.sys)}
            r={3}
            fill="white"
            stroke="#ef4444"
            strokeWidth={1.5}
          />
          <circle
            cx={xFor(i)}
            cy={yFor(p.dia)}
            r={3}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5}
          />
        </g>
      ))}
    </svg>
  )
}
