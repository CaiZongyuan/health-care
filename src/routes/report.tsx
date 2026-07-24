import { createFileRoute, Link } from '@tanstack/react-router'
import { getReportData } from '~/server/report'
import { Button, buttonVariants } from '~/components/ui/button'
import { BpLineChart, type ChartPoint } from '~/components/charts'
import { formatDateTime } from '~/lib/datetime'
import { downloadBpCsv } from '~/lib/csv'
import { getBpStatus } from '~/lib/bp'

export const Route = createFileRoute('/report')({
  component: ReportPage,
  loader: async () => await getReportData(),
})

function Kpi({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-center">
      <b className="block text-xl" style={color ? { color } : undefined}>
        {value}
      </b>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  )
}

function ReportPage() {
  const d = Route.useLoaderData()
  const points: ChartPoint[] = [...d.readings]
    .reverse()
    .map((r) => ({ sys: r.sys, dia: r.dia, ds: formatDateTime(r.measuredAt).slice(0, 5) }))
  const highCount = d.highs.length

  return (
    <div className="space-y-4 p-4 pt-6">
      <div className="no-print flex items-center justify-between gap-2">
        <Link to="/trends" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          ← 返回
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadBpCsv(d.readings)}>
            导出 CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            打印 / 导出 PDF
          </Button>
        </div>
      </div>

      {/* 一页摘要 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-base font-bold">一页摘要</h2>
        <div className="grid grid-cols-3 gap-2">
          <Kpi value={d.avg ? `${d.avg.sys}/${d.avg.dia}` : '--'} label="平均血压" />
          <Kpi value={`${d.rate}%`} label="达标率" />
          <Kpi value={String(highCount)} label="偏高次数" color={highCount ? '#dc2626' : undefined} />
        </div>
        <div className="mt-2 space-y-1 text-sm">
          {highCount > 0 && (
            <div className="rounded-md border-l-4 border-red-500 bg-red-50 px-2 py-1">
              ⚠ 近 30 天 {highCount} 次偏高/危象
              {d.highs[0] ? `（最近 ${formatDateTime(d.highs[0].measuredAt)}）` : ''}
            </div>
          )}
          <div className="rounded-md border-l-4 border-green-500 bg-green-50 px-2 py-1">
            ✓ 近 30 天共 {d.count} 次记录
          </div>
        </div>
      </div>

      {/* 完整报告 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 border-b-2 border-blue-600 pb-2 text-center">
          <div className="text-lg font-bold">健康随访报告</div>
          <div className="text-xs text-gray-500">
            生成于 {formatDateTime(Date.now())} · 健康随访管家
          </div>
        </div>

        <table className="w-full text-sm">
          <tbody>
            <tr>
              <th className="text-left text-gray-500">档案</th>
              <td>{d.profile.age ? `${d.profile.age} 岁` : '—'}</td>
              <th className="text-left text-gray-500">身高/体重</th>
              <td>
                {[d.profile.height, d.profile.weight].filter(Boolean).join(' / ') || '—'}
              </td>
            </tr>
            <tr>
              <th className="text-left text-gray-500">病史</th>
              <td colSpan={3}>{d.profile.history || '—'}</td>
            </tr>
          </tbody>
        </table>

        <div className="my-3 grid grid-cols-3 gap-2">
          <Kpi value={d.avg ? `${d.avg.sys}/${d.avg.dia}` : '--'} label="平均血压" />
          <Kpi value={`${d.rate}%`} label="达标率(≤135/85)" />
          <Kpi value={String(d.count)} label="读数(近30天)" />
        </div>

        <div className="mb-1 text-xs text-gray-500">近 30 天血压趋势</div>
        <BpLineChart points={points} />

        <div className="mb-1 mt-4 text-sm font-bold">需关注的读数（偏高/危象）</div>
        {d.highs.length === 0 ? (
          <p className="text-sm text-gray-500">无偏高记录。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-gray-500">时间</th>
                <th className="text-left text-gray-500">血压</th>
                <th className="text-left text-gray-500">状态</th>
                <th className="text-left text-gray-500">症状</th>
              </tr>
            </thead>
            <tbody>
              {d.highs.slice(0, 10).map((r) => (
                <tr key={r.id}>
                  <td className="py-1">{formatDateTime(r.measuredAt)}</td>
                  <td className="py-1">
                    {r.sys}/{r.dia}
                  </td>
                  <td className="py-1 font-semibold text-red-600">
                    {getBpStatus(r.sys, r.dia).label}
                  </td>
                  <td className="py-1">{r.symptoms.join('、') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mb-1 mt-4 text-sm font-bold">当前用药</div>
        <div className="text-sm text-gray-700">
          {d.meds.length === 0
            ? '—'
            : d.meds.map((m) => `${m.name} ${m.dosage}`.trim()).join('｜')}
        </div>

        {d.lastAi && (
          <>
            <div className="mb-1 mt-4 text-sm font-bold">AI 健康小结</div>
            <div className="rounded-md bg-gray-50 p-2 text-sm text-gray-700">
              {d.lastAi}
            </div>
          </>
        )}

        <p className="mt-4 text-[11px] text-gray-400">
          本报告由工具自动生成，仅供参考，不作为诊断或处方依据。
        </p>
      </div>
    </div>
  )
}
