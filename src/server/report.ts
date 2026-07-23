import { createServerFn } from '@tanstack/react-start'
import { desc, eq, gte } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import {
  aiSummaries,
  bpRecords,
  createDb,
  medications,
  profile,
  type BpRecord,
  type Medication,
} from '~/db'
import { average, controlRate, getBpStatus } from '~/lib/bp'

/** 医生报告数据：近 30 天读数 + 档案 + 用药 + 统计 + 最近一次 AI 小结。 */
export const getReportData = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000
  const [readings, rows, meds, aiRows] = await Promise.all([
    db
      .select()
      .from(bpRecords)
      .where(gte(bpRecords.measuredAt, cutoff))
      .orderBy(desc(bpRecords.measuredAt)),
    db.select().from(profile),
    db.select().from(medications).where(eq(medications.active, true)),
    db.select().from(aiSummaries).orderBy(desc(aiSummaries.createdAt)).limit(1),
  ])
  const p: Record<string, string> = {}
  for (const r of rows) p[r.key] = r.value
  const last30 = readings as BpRecord[]
  const avg = average(last30)
  const rate = controlRate(last30)
  const highs = last30.filter((r) => {
    const lv = getBpStatus(r.sys, r.dia).level
    return lv === 'high' || lv === 'crisis'
  })
  return {
    profile: p,
    readings: last30,
    meds: meds as Medication[],
    avg,
    rate,
    count: last30.length,
    highs,
    lastAi: aiRows[0]?.content ?? '',
  }
})
