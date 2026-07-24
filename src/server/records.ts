import { createServerFn } from '@tanstack/react-start'
import { count, desc } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { aiSummaries, bpRecords, createDb, type BpRecord } from '~/db'
import { isMorningNow } from '~/lib/datetime'

/** 首页数据：总数 + 最近 7 条。 */
export const getHomeData = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const [[c], recent, [lastAi]] = await Promise.all([
    db.select({ value: count() }).from(bpRecords),
    db.select().from(bpRecords).orderBy(desc(bpRecords.id)).limit(7),
    db.select().from(aiSummaries).orderBy(desc(aiSummaries.createdAt)).limit(1),
  ])
  return {
    recordCount: Number(c?.value ?? 0),
    recent: recent as BpRecord[],
    lastAiSummary: lastAi?.content ?? null,
    lastAiAt: lastAi?.createdAt ?? null,
  }
})

export type SaveBpInput = {
  measuredAt: number
  sys: number
  dia: number
  hr: number | null
  spo2: number | null
  symptoms: string[]
  notes: string
}

/** 保存一条血压记录（校验高/低压必填且有效）。isMorning 由服务端按上海时区判定。 */
export const saveBpRecord = createServerFn()
  .validator((d: unknown): SaveBpInput => {
    const v = (d ?? {}) as Record<string, unknown>
    const sys = Number(v.sys)
    const dia = Number(v.dia)
    if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys <= 0 || dia <= 0) {
      throw new Error('请填写有效的高压和低压')
    }
    const toNumOrNull = (x: unknown) =>
      x == null || x === '' ? null : Number(x)
    const symptoms = Array.isArray(v.symptoms)
      ? v.symptoms.filter((s): s is string => typeof s === 'string')
      : []
    const notes = typeof v.notes === 'string' ? v.notes : ''
    const measuredAt =
      Number.isFinite(Number(v.measuredAt)) && Number(v.measuredAt) > 0
        ? Number(v.measuredAt)
        : Date.now()
    return {
      measuredAt,
      sys,
      dia,
      hr: toNumOrNull(v.hr),
      spo2: toNumOrNull(v.spo2),
      symptoms,
      notes,
    }
  })
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    await db.insert(bpRecords).values({
      measuredAt: data.measuredAt,
      isMorning: isMorningNow(new Date(data.measuredAt)),
      sys: data.sys,
      dia: data.dia,
      hr: data.hr,
      spo2: data.spo2,
      symptoms: data.symptoms,
      notes: data.notes,
    })
    return { ok: true }
  })
