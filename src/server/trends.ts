import { createServerFn } from '@tanstack/react-start'
import { desc } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { bpRecords, createDb, type BpRecord } from '~/db'
import { average, controlRate } from '~/lib/bp'

/** 趋势数据：近 30 次统计 + 近 7 次折线（升序）+ 历史（近 50 条，倒序）。 */
export const getTrendsData = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const all = (await db
    .select()
    .from(bpRecords)
    .orderBy(desc(bpRecords.measuredAt))) as BpRecord[]
  const last30 = all.slice(0, 30)
  const chart = last30.slice(0, 7).slice().reverse()
  return {
    average: average(last30),
    controlRate: controlRate(last30),
    window: Math.min(30, last30.length),
    chart,
    history: all.slice(0, 50),
  }
})
