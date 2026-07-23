import { createServerFn } from '@tanstack/react-start'
import { desc } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { bpRecords, createDb, type BpRecord } from '~/db'

/** 全部血压记录（倒序）。区间筛选与统计交给客户端，支持任意范围切换。 */
export const getTrendsData = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const readings = (await db
    .select()
    .from(bpRecords)
    .orderBy(desc(bpRecords.measuredAt))) as BpRecord[]
  return { readings }
})
