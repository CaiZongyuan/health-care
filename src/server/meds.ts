import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { createDb, medications, medLog, type Medication } from '~/db'
import { todayStr } from '~/lib/datetime'

/** 今日用药：活跃药品 + 今日已打卡的 medId 集合。 */
export const getTodayMeds = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const today = todayStr()
  const [meds, logs] = await Promise.all([
    db
      .select()
      .from(medications)
      .where(eq(medications.active, true))
      .orderBy(medications.id),
    db.select().from(medLog).where(eq(medLog.takenDate, today)),
  ])
  const takenIds = Array.from(new Set(logs.map((l) => l.medId)))
  return { today, meds: meds as Medication[], takenIds }
})

/** 切换某药今日打卡状态。 */
export const toggleMedTaken = createServerFn()
  .validator((d: unknown): number => {
    const medId = Number((d as { medId?: unknown })?.medId)
    if (!Number.isFinite(medId) || medId <= 0) {
      throw new Error('无效的用药 id')
    }
    return medId
  })
  .handler(async ({ data: medId }) => {
    const db = createDb(env.DB)
    const today = todayStr()
    const existing = await db
      .select()
      .from(medLog)
      .where(and(eq(medLog.medId, medId), eq(medLog.takenDate, today)))
      .limit(1)
    if (existing.length > 0) {
      await db
        .delete(medLog)
        .where(and(eq(medLog.medId, medId), eq(medLog.takenDate, today)))
      return { taken: false }
    }
    await db.insert(medLog).values({
      medId,
      takenDate: today,
      takenAt: Date.now(),
    })
    return { taken: true }
  })

export type AddMedInput = {
  name: string
  dosage: string
  timeOfDay: string
}

/** 添加一条长期用药（默认 active）。 */
export const addMedication = createServerFn()
  .validator((d: unknown): AddMedInput => {
    const v = (d ?? {}) as Record<string, unknown>
    const name = typeof v.name === 'string' ? v.name.trim() : ''
    if (!name) throw new Error('请填写药品名称')
    return {
      name,
      dosage: typeof v.dosage === 'string' ? v.dosage.trim() : '',
      timeOfDay: typeof v.timeOfDay === 'string' ? v.timeOfDay.trim() : '',
    }
  })
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    await db.insert(medications).values({
      ...data,
      active: true,
      createdAt: Date.now(),
    })
    return { ok: true }
  })
