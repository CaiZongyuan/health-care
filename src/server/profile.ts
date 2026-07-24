import { createServerFn } from '@tanstack/react-start'
import { count, desc, eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import {
  aiSummaries,
  createDb,
  medications,
  profile,
  type AiSummary,
  type Medication,
} from '~/db'

/** 我的页数据：长期档案（key/value）+ 全部用药（含停用）。 */
export const getProfileData = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const [rows, meds, aiList, [aiC]] = await Promise.all([
    db.select().from(profile),
    db.select().from(medications).orderBy(medications.id),
    db.select().from(aiSummaries).orderBy(desc(aiSummaries.createdAt)).limit(20),
    db.select({ value: count() }).from(aiSummaries),
  ])
  const p: Record<string, string> = {}
  for (const r of rows) p[r.key] = r.value
  // review #14: 不把 API Key 明文返回给客户端
  const hasAiKey = !!p.ai_api_key
  delete p.ai_api_key
  return {
    profile: p,
    hasAiKey,
    meds: meds as Medication[],
    aiCount: Number(aiC?.value ?? 0),
    aiHistory: aiList as AiSummary[],
  }
})

export type ProfilePatch = Record<string, string>

/** 批量 upsert 档案字段。 */
export const saveProfile = createServerFn()
  .validator((d: unknown): ProfilePatch => {
    const v = (d ?? {}) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'string') out[k] = val
    }
    return out
  })
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const now = Date.now()
    for (const [key, value] of Object.entries(data)) {
      const existing = await db
        .select()
        .from(profile)
        .where(eq(profile.key, key))
        .limit(1)
      if (existing.length > 0) {
        await db
          .update(profile)
          .set({ value, updatedAt: now })
          .where(eq(profile.key, key))
      } else {
        await db.insert(profile).values({ key, value, updatedAt: now })
      }
    }
    return { ok: true }
  })

/** 删除用药。 */
export const deleteMedication = createServerFn()
  .validator((d: unknown): number => {
    const id = Number((d as { id?: unknown })?.id)
    if (!Number.isFinite(id) || id <= 0) throw new Error('无效 id')
    return id
  })
  .handler(async ({ data: id }) => {
    const db = createDb(env.DB)
    await db.delete(medications).where(eq(medications.id, id))
    return { ok: true }
  })

/** 启用/停用用药。 */
export const toggleMedActive = createServerFn()
  .validator((d: unknown): number => {
    const id = Number((d as { id?: unknown })?.id)
    if (!Number.isFinite(id) || id <= 0) throw new Error('无效 id')
    return id
  })
  .handler(async ({ data: id }) => {
    const db = createDb(env.DB)
    const [row] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, id))
      .limit(1)
    if (row) {
      await db
        .update(medications)
        .set({ active: !row.active })
        .where(eq(medications.id, id))
    }
    return { ok: true }
  })
