import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { createDb, medications, medLog, type Medication } from '~/db'
import { todayStr } from '~/lib/datetime'

export type MedStage = { stage: string; time: string }

/** 今日用药：活跃药品（含多时段）+ 今日已打卡的 (medId,stage)。 */
export const getTodayMeds = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const today = todayStr()
  const [meds, logs] = await Promise.all([
    db.select().from(medications).where(eq(medications.active, true)).orderBy(medications.id),
    db.select().from(medLog).where(eq(medLog.takenDate, today)),
  ])
  const taken = logs
    .filter((l) => l.stage != null)
    .map((l) => ({ medId: l.medId, stage: l.stage as string }))
  return { today, meds: meds as Medication[], taken }
})

/** 切换某药某时段的今日打卡。 */
export const toggleMedTaken = createServerFn()
  .validator((d: unknown): { medId: number; stage: string } => {
    const v = (d ?? {}) as { medId?: unknown; stage?: unknown }
    const medId = Number(v.medId)
    const stage = typeof v.stage === 'string' ? v.stage : ''
    if (!Number.isFinite(medId) || medId <= 0 || !stage) {
      throw new Error('无效参数')
    }
    return { medId, stage }
  })
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const today = todayStr()
    const existing = await db
      .select()
      .from(medLog)
      .where(
        and(
          eq(medLog.medId, data.medId),
          eq(medLog.stage, data.stage),
          eq(medLog.takenDate, today),
        ),
      )
      .limit(1)
    if (existing.length > 0) {
      await db
        .delete(medLog)
        .where(
          and(
            eq(medLog.medId, data.medId),
            eq(medLog.stage, data.stage),
            eq(medLog.takenDate, today),
          ),
        )
      return { taken: false }
    }
    await db.insert(medLog).values({
      medId: data.medId,
      stage: data.stage,
      takenDate: today,
      takenAt: Date.now(),
    })
    return { taken: true }
  })

export type AddMedInput = {
  name: string
  dosage: string
  stages: MedStage[]
}

/** 添加一条长期用药（含多时段 stages）。 */
export const addMedication = createServerFn()
  .validator((d: unknown): AddMedInput => {
    const v = (d ?? {}) as Record<string, unknown>
    const name = typeof v.name === 'string' ? v.name.trim() : ''
    if (!name) throw new Error('请填写药品名称')
    const dosage = typeof v.dosage === 'string' ? v.dosage.trim() : ''
    const rawStages = Array.isArray(v.stages) ? v.stages : []
    const stages: MedStage[] = rawStages
      .map((s) => (s && typeof s === 'object' ? (s as { stage?: unknown; time?: unknown }) : null))
      .filter(
        (s): s is { stage: string; time: string } =>
          !!s && typeof s.stage === 'string' && s.stage.trim() !== '' && typeof s.time === 'string',
      )
      .map((s) => ({ stage: (s as { stage: string }).stage, time: (s as { time: string }).time }))
    return { name, dosage, stages }
  })
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    await db.insert(medications).values({
      name: data.name,
      dosage: data.dosage,
      stages: data.stages,
      active: true,
      createdAt: Date.now(),
    })
    return { ok: true }
  })
