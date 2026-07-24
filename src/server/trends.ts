import { createServerFn } from '@tanstack/react-start'
import { desc, gte } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { bpRecords, createDb, type BpRecord } from '~/db'

/** 全部血压记录（倒序）。区间筛选与统计交给客户端，支持任意范围切换。 */
export const getTrendsData = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  // review #17: 服务端收敛到近 90 天，避免全量返回
  const since90 = Date.now() - 90 * 24 * 3600 * 1000
  const readings = (await db
    .select()
    .from(bpRecords)
    .where(gte(bpRecords.measuredAt, since90))
    .orderBy(desc(bpRecords.measuredAt))) as BpRecord[]
  return { readings }
})
