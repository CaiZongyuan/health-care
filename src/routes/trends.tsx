import { createFileRoute } from '@tanstack/react-router'
import { getTrendsData } from '~/server/trends'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { BpChart } from '~/components/bp-chart'
import { getBpStatus, isMorningHypertension } from '~/lib/bp'
import { formatDateTime } from '~/lib/datetime'

export const Route = createFileRoute('/trends')({
  component: TrendsPage,
  loader: async () => await getTrendsData(),
})

function TrendsPage() {
  const d = Route.useLoaderData()
  return (
    <div className="space-y-4 p-4 pt-6">
      <h1 className="text-2xl font-bold">趋势</h1>

      {/* 概览 */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow">
        <p className="text-sm opacity-90">近 {d.window} 次血压概览</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-xs opacity-80">平均血压</p>
            <div className="text-4xl font-bold">
              {d.average ? `${d.average.sys}/${d.average.dia}` : '--'}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">达标率</p>
            <div className="text-3xl font-bold text-green-300">
              {d.controlRate}%
            </div>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-white/10 p-2 text-xs">
          {d.window === 0
            ? '还没有记录。'
            : d.controlRate >= 80
              ? '控制良好，请继续保持规律记录。'
              : '近期波动较大，建议关注并咨询医生。'}
          （达标：家庭血压 ≤135/85）
        </p>
      </div>

      {/* 折线 */}
      <Card>
        <CardHeader>
          <CardTitle>近 {d.chart.length} 次趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <BpChart points={d.chart} />
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
              高压
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />
              低压
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 历史 */}
      <section>
        <h2 className="mb-2 px-1 text-lg font-bold">历史记录</h2>
        {d.history.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">还没有记录。</p>
        ) : (
          <div className="space-y-2">
            {d.history.map((r) => {
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
                          <span className="mr-2 text-amber-600">
                            清晨高血压
                          </span>
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
        )}
      </section>
    </div>
  )
}
