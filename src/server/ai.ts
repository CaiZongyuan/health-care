import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { count, desc, inArray } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import {
  aiSummaries,
  bpRecords,
  createDb,
  profile,
  type AiSummary,
  type DB,
} from '~/db'
import { average, controlRate } from '~/lib/bp'
import { formatDateTime } from '~/lib/datetime'

// 智谱 GLM 的 OpenAI 兼容端点（决策 07）。
const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

const SYSTEM = [
  '你是一名健康助理。根据用户近期的家庭血压自测数据，',
  '用中文写一段简洁的「近期健康小结」，',
  '包含：整体情况、达标情况、需要关注的点。语气平和、鼓励。',
  '注意：你提供的是健康提醒而非医疗诊断，不得给出用药或剂量调整建议；',
  '若数据明显异常（如收缩压≥180 或舒张压≥110），请明确提醒尽快就医。',
  '控制在 150 字以内。',
].join('')

/** 生成小结文本（无数据返回提示；API 失败抛错）。手动 + 定时复用。 */
export async function generateSummaryText(
  e: Env,
): Promise<{ content: string; hasData: boolean }> {
  const apiKey = e.ZHIPU_API_KEY
  if (!apiKey) throw new Error('尚未配置智谱 API Key（ZHIPU_API_KEY）')
  const db = createDb(e.DB)
  const recent = await db
    .select()
    .from(bpRecords)
    .orderBy(desc(bpRecords.measuredAt))
    .limit(7)
  if (recent.length === 0) {
    return { content: '还没有血压记录，先记录几天再生成小结。', hasData: false }
  }

  const ascending = recent.slice().reverse()
  const dataLine = ascending
    .map((r) => {
      const parts = [`${formatDateTime(r.measuredAt)} ${r.sys}/${r.dia}mmHg`]
      if (r.hr) parts.push(`心率${r.hr}`)
      if (r.spo2) parts.push(`血氧${r.spo2}%`)
      if (r.symptoms.length) parts.push(`症状:${r.symptoms.join('/')}`)
      if (r.isMorning) parts.push('晨起')
      return parts.join(' ')
    })
    .join('\n')
  const avg = average(recent)
  const rate = controlRate(recent)
  const promptText = [
    '家庭血压达标标准：收缩压≤135 且 舒张压≤85。',
    '',
    `近 ${recent.length} 次记录：`,
    dataLine,
    '',
    `平均血压 ${avg ? `${avg.sys}/${avg.dia}` : '-/-'}，达标率 ${rate}%。`,
  ].join('\n')

  const zhipu = createOpenAI({ baseURL: ZHIPU_BASE_URL, apiKey, name: 'zhipu' })
  const { text } = await generateText({
    model: zhipu.chat(e.ZHIPU_MODEL),
    system: SYSTEM,
    prompt: promptText,
  })
  return { content: text.trim(), hasData: true }
}

/** 生成并存档一条小结（trigger）。无数据则不存档。 */
export async function generateAndSave(
  e: Env,
  trigger: 'manual' | 'auto',
): Promise<string> {
  const { content, hasData } = await generateSummaryText(e)
  if (hasData) {
    const db = createDb(e.DB)
    await db.insert(aiSummaries).values({
      createdAt: Date.now(),
      trigger,
      content,
    })
  }
  return content
}

export type AiAutoSettings = { enabled: boolean; freq: 'daily' | 'weekly' }

/** 读取 AI 自动设置（定时任务用）。键：ai_auto_enabled(0/1)、ai_auto_freq(daily/weekly)。 */
export async function readAiAutoSettings(db: DB): Promise<AiAutoSettings> {
  const rows = await db
    .select()
    .from(profile)
    .where(inArray(profile.key, ['ai_auto_enabled', 'ai_auto_freq']))
  const m: Record<string, string> = {}
  for (const r of rows) m[r.key] = r.value
  return {
    enabled: m.ai_auto_enabled === '1',
    freq: m.ai_auto_freq === 'weekly' ? 'weekly' : 'daily',
  }
}

/** 手动生成（首页按钮）。 */
export const getAiSummary = createServerFn().handler(async () => {
  try {
    const content = await generateAndSave(env, 'manual')
    return { ok: true, summary: content }
  } catch (e) {
    return {
      ok: false,
      summary: '生成小结失败：' + (e instanceof Error ? e.message : String(e)),
    }
  }
})

/** 历史 + 总次数（我的页）。 */
export const getAiHistory = createServerFn().handler(async () => {
  const db = createDb(env.DB)
  const [list, [c]] = await Promise.all([
    db.select().from(aiSummaries).orderBy(desc(aiSummaries.createdAt)).limit(30),
    db.select({ value: count() }).from(aiSummaries),
  ])
  return { total: Number(c?.value ?? 0), list: list as AiSummary[] }
})
