import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getTrendsData } from '~/server/trends'
import { Button, buttonVariants } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  BpBars,
  BpCalendar,
  BpDist,
  BpDonut,
  BpLineChart,
  BpScatter,
  type ChartPoint,
} from '~/components/charts'
import {
  average,
  controlRate,
  getBpStatus,
  isMorningHypertension,
} from '~/lib/bp'
import { formatDateTime } from '~/lib/datetime'
import { downloadBpCsv } from '~/lib/csv'
import type { BpRecord } from '~/db'

const RANGES = ['7次', '14次', '30次', '7天', '30天', '90天'] as const
type Range = (typeof RANGES)[number]

function dsOf(r: BpRecord): string {
  return formatDateTime(r.measuredAt).slice(0, 5) // MM-DD
}
function toPoint(r: BpRecord): ChartPoint {
  return { sys: r.sys, dia: r.dia, ds: dsOf(r) }
}

function byRange(readings: BpRecord[], r: Range): BpRecord[] {
  if (r.endsWith('次')) return readings.slice(0, Number.parseInt(r))
  const days = Number.parseInt(r)
  const cutoff = Date.now() - days * 24 * 3600 * 1000
  return readings.filter((x) => x.measuredAt >= cutoff)
}

export const Route = createFileRoute('/trends')({
  component: TrendsPage,
  loader: async () => await getTrendsData(),
})

function TrendsPage() {
  const d = Route.useLoaderData()
  const [range, setRange] = useState<Range>('7次')
  const [historyPage, setHistoryPage] = useState(0)
  const [historyFilter, setHistoryFilter] = useState<string>('all')
  const all = d.readings
  const filtered = byRange(all, range)
  const points = filtered.map(toPoint)
  const avg = average(filtered)
  const rate = controlRate(filtered)
  const highCount = filtered.filter((r) => {
    const lv = getBpStatus(r.sys, r.dia).level
    return lv === 'high' || lv === 'crisis'
  }).length

  const FILTER_LABELS: Record<string, string> = {
    all: '全部', healthy: '健康', acceptable: '尚可', high: '偏高', crisis: '危象', low: '偏低',
  }
  const filteredHistory = historyFilter === 'all' ? all : all.filter((r) => getBpStatus(r.sys, r.dia).level === historyFilter)
  const PAGE_SIZE = 20
  const historyPageCount = Math.ceil(filteredHistory.length / PAGE_SIZE)
  const pageItems = filteredHistory.slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4 p-4 pt-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">趋势</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadBpCsv(all)}>
            导出 CSV
          </Button>
          <Link to="/report" className={buttonVariants({ size: 'sm' })}>
            医生报告
          </Link>
        </div>
      </div>

      {/* 范围选择 */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={
              r === range
                ? 'rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground'
                : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground'
            }
          >
            {r}
          </button>
        ))}
      </div>

      {/* 概览 */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow">
        <p className="text-sm opacity-90">
          {range}（{filtered.length} 条）
        </p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-xs opacity-80">平均血压</p>
            <div className="text-4xl font-bold">
              {avg ? `${avg.sys}/${avg.dia}` : '--'}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">达标率</p>
            <div className="text-3xl font-bold text-green-300">{rate}%</div>
          </div>
        </div>
      </div>

      {/* A 折线 */}
      <Card>
        <CardHeader>
          <CardTitle>A · 趋势折线</CardTitle>
        </CardHeader>
        <CardContent>
          <BpLineChart points={points} />
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
              高压
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />
              低压
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-300" />
              正常带
            </span>
          </div>
        </CardContent>
      </Card>

      {/* B 散点 */}
      <Card>
        <CardHeader>
          <CardTitle>B · 散点分布</CardTitle>
        </CardHeader>
        <CardContent>
          <BpScatter points={points} />
          <p className="mt-2 text-xs text-muted-foreground">
            每次一个点，颜色=达标情况；虚线=家庭高血压临界 135。
          </p>
        </CardContent>
      </Card>

      {/* C 柱状 */}
      <Card>
        <CardHeader>
          <CardTitle>C · 每日均值（近 14 天）</CardTitle>
        </CardHeader>
        <CardContent>
          <BpBars points={points} />
        </CardContent>
      </Card>

      {/* D 达标率 + 分布 */}
      <Card>
        <CardHeader>
          <CardTitle>D · 达标率与区间分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <BpDonut rate={rate} />
            <div className="min-w-[200px] flex-1">
              <BpDist points={points} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            当区间内偏高/危象 {highCount} 次。
          </p>
        </CardContent>
      </Card>

      {/* E 日历热力 */}
      <Card>
        <CardHeader>
          <CardTitle>E · 日历热力（近 28 天）</CardTitle>
        </CardHeader>
        <CardContent>
          <BpCalendar points={all.map(toPoint)} />
          <p className="mt-2 text-xs text-muted-foreground">
            每格=当日均值达标情况（绿=达标、黄=高值、红=偏高）。
          </p>
        </CardContent>
      </Card>

      {/* 历史（分页 + 筛选） */}
      <section>
        <h2 className="mb-2 px-1 text-lg font-bold">历史记录（{filteredHistory.length} 条）</h2>
        {all.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">还没有记录。</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(FILTER_LABELS).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setHistoryFilter(k); setHistoryPage(0) }}
                  className={historyFilter === k
                    ? 'rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground'
                    : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground'}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {pageItems.map((r) => {
              const st = getBpStatus(r.sys, r.dia)
              const morning = isMorningHypertension(r)
              return (
                <Card key={r.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(r.measuredAt)}
                        {r.isMorning ? ' · 晨' : ''}
                      </div>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] ${st.className}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xl font-bold">
                      {r.sys}/{r.dia}
                    </div>
                    {(r.symptoms.length > 0 || r.notes || morning) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {morning && (
                          <span className="mr-2 text-amber-600">清晨高血压</span>
                        )}
                        {r.symptoms.length > 0 && (
                          <span className="mr-2 text-destructive">
                            {r.symptoms.join('、')}
                          </span>
                        )}
                        {r.notes}
                      </div>
                    )}
                    {(r.hr || r.spo2) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.hr && `心率 ${r.hr}  `}
                        {r.spo2 && `血氧 ${r.spo2}%`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {historyPageCount > 1 && (
            <div className="flex items-center justify-between pt-3">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                disabled={historyPage === 0}
                className="text-sm text-primary disabled:opacity-30"
              >
                ← 上一页
              </button>
              <span className="text-xs text-muted-foreground">
                第 {historyPage + 1}/{historyPageCount} 页
              </span>
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.min(historyPageCount - 1, p + 1))}
                disabled={historyPage >= historyPageCount - 1}
                className="text-sm text-primary disabled:opacity-30"
              >
                下一页 →
              </button>
            </div>
          )}
          </>
        )}
      </section>
    </div>
  )
}
