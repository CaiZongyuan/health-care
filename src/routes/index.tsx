import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { count } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { bpRecords, createDb } from '~/db'

const getStats = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const [row] = await db.select({ value: count() }).from(bpRecords)
  return { recordCount: Number(row?.value ?? 0) }
})

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async () => await getStats(),
})

function HomePage() {
  const stats = Route.useLoaderData()
  return (
    <div className="space-y-4 p-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-800">健康随访管家</h1>
        <p className="mt-1 text-sm text-gray-500">
          个人自用 · 血压随访 · 已记录 {stats.recordCount} 条
        </p>
      </header>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800">记录健康数据</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          血压、心率、血氧、症状记录，用药待办，AI 健康小结。功能开发中。
        </p>
      </section>
    </div>
  )
}
