import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { count, desc, inArray } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import {
  aiSummaries,
  createDb,
  profile,
  type AiSummary,
  type DB,
} from '~/db'
import { buildAiContext } from '~/server/ai-context'
import { getPreset } from '~/lib/llm'

export type AiConfig = {
  provider: string
  baseURL: string
  apiKey: string
  model: string
}

const ZHIPU_BASE = 'https://open.bigmodel.cn/api/paas/v4'

/** 读取用户配置的 LLM；未配置则回退 env(ZHIPU_*)。无可用 key 返回 null。 */
export async function getAiConfig(db: DB): Promise<AiConfig | null> {
  const rows = await db
    .select()
    .from(profile)
    .where(
      inArray(profile.key, ['ai_provider', 'ai_base_url', 'ai_api_key', 'ai_model']),
    )
  const m: Record<string, string> = {}
  for (const r of rows) m[r.key] = r.value
  const apiKey = m.ai_api_key || env.ZHIPU_API_KEY || ''
  if (!apiKey) return null
  const provider = m.ai_provider || 'zhipu'
  const preset = getPreset(provider)
  const baseURL = m.ai_base_url || preset?.baseURL || ZHIPU_BASE
  const model = m.ai_model || preset?.defaultModel || env.ZHIPU_MODEL || 'glm-4.6'
  return { provider, baseURL, apiKey, model }
}

// 系统 prompt：研究 daily-analysis.md §4.1（硬约束 + 分析维度）。
const SYSTEM = `你是面向高血压患者的家庭随访「健康助理」。基于用户的家庭血压自测数据、用药打卡与长期档案，生成「近期健康小结」。

硬约束：
1. 只能用【数据】中已给出的数字、日期、症状；禁止编造未出现的数值或记录。
2. 这是健康提醒，不是诊断。禁止任何用药/剂量增减建议（如"加量/换药/停药"）；可建议"带数据复诊、与医生讨论"。
3. 任一读数 ≥180/110（危象），必须在【关注建议】明确写"尽快就医，不要自行加药"。
4. 不得宣称测到了"晨峰/晨峰幅度"——家庭读数只能提示"清晨血压偏高"，真晨峰需 24 小时动态血压。
5. 数据不足（<3 天、无清晨读数等）时如实说明"数据不足以得出某结论"，不要硬编。
6. 语气平和、具体、像有心的高血压专科医生做随访；不要"注意饮食/规律作息/保持心情"这类空泛套话。

分析要求（基于数据落地，命中适用的那些）：
- 达标率：本期达标率(%、n/N)，并与上一期对比(↑/↓)。
- 清晨维度：聚合晨起读数(均值/连续≥135/85 天数)，与晚间对照；命中清晨高血压要点出。
- 依从性↔血压：依从率，并把漏服日期与当天/次日血压做时间关联(若数据支持)。
- 症状↔血压：指出三者之一(沉默型=血压高无症状 / 症状与血压无关 / 同时段反复相关)。
- 趋势与波动：近7天 vs 前7天方向；波动大时点出 CV 或范围并提示独立风险。
- 可执行下一步：1 条具体的、非用药的建议(测量时机/记录习惯/带数据复诊/与医生聊依从性障碍)。

发现要"到点子上"：宁可少而具体，不要多而空泛。所有文案简体中文。

输出格式：严格只输出一个 JSON 对象，不要 markdown 代码块、不要任何多余文字。结构固定为：
{"整体评估": "1–2句总体+趋势+达标率", "关键发现": ["带数字/日期的具体发现", ...], "关注建议": ["可执行的非用药建议", ...]}`

type SummaryObj = {
  整体评估: string
  关键发现: string[]
  关注建议: string[]
}

/** 健壮解析模型输出：去 markdown、取首个 {...}、按结构兜底（兼容多 provider）。 */
function parseSummary(text: string): SummaryObj {
  const clean = text.replace(/```json\s*|```/g, '').trim()
  const m = clean.match(/\{[\s\S]*\}/)
  if (m) {
    try {
      const o = JSON.parse(m[0]) as Record<string, unknown>
      if (typeof o.整体评估 === 'string') {
        return {
          整体评估: o.整体评估,
          关键发现: Array.isArray(o.关键发现) ? (o.关键发现 as string[]) : [],
          关注建议: Array.isArray(o.关注建议) ? (o.关注建议 as string[]) : [],
        }
      }
    } catch {
      /* fall through to text fallback */
    }
  }
  return { 整体评估: text, 关键发现: [], 关注建议: [] }
}

/** 生成小结（让模型输出 JSON 文本，健壮解析后存为 JSON 字符串）。手动 + 定时复用。 */
export async function generateSummaryText(
  db: DB,
  cfg: AiConfig,
): Promise<{ content: string; hasData: boolean }> {
  const { contextText, hasData } = await buildAiContext(db)
  if (!hasData) {
    return { content: '还没有血压记录，先记录几天再生成小结。', hasData: false }
  }
  const provider = createOpenAI({
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey,
    name: cfg.provider,
  })
  const { text } = await generateText({
    model: provider.chat(cfg.model),
    system: SYSTEM,
    prompt: contextText,
    temperature: 0.2,
  })
  return { content: JSON.stringify(parseSummary(text)), hasData: true }
}

/** 生成并存档一条小结（trigger）。无数据则不存档。 */
export async function generateAndSave(
  e: Env,
  trigger: 'manual' | 'auto',
): Promise<string> {
  const db = createDb(e.DB)
  const cfg = await getAiConfig(db)
  if (!cfg) {
    throw new Error('未配置 AI（去 我的 → AI 模型配置 设置 provider/key/model）')
  }
  const { content, hasData } = await generateSummaryText(db, cfg)
  if (hasData) {
    await db.insert(aiSummaries).values({
      createdAt: Date.now(),
      trigger,
      content,
    })
  }
  return content
}

export type AiAutoSettings = { enabled: boolean; freq: 'daily' | 'weekly' }

/** 读取 AI 自动设置（定时任务用）。 */
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
