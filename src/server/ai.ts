import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { desc } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { bpRecords, createDb } from '~/db'
import { average, controlRate } from '~/lib/bp'
import { formatDateTime } from '~/lib/datetime'

// 智谱 GLM 的 OpenAI 兼容端点（决策 07）。
const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

/** 用智谱 GLM 基于近 7 次记录生成"健康小结"（非医疗建议，人在回路由用户查看）。 */
export const getAiSummary = createServerFn().handler(async () => {
  const apiKey = env.ZHIPU_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      summary:
        '尚未配置智谱 API Key。本地：创建 .dev.vars 写入 ZHIPU_API_KEY=xxx；生产：wrangler secret put ZHIPU_API_KEY。',
    }
  }

  const db = createDb(env.DB)
  const recent = await db
    .select()
    .from(bpRecords)
    .orderBy(desc(bpRecords.measuredAt))
    .limit(7)
  if (recent.length === 0) {
    return { ok: false, summary: '还没有血压记录，先记录几天再生成小结。' }
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

  // 自定义 baseURL 必须 .chat()（Chat Completions），不能用默认的 responses API。
  const zhipu = createOpenAI({ baseURL: ZHIPU_BASE_URL, apiKey, name: 'zhipu' })
  const model = zhipu.chat(env.ZHIPU_MODEL)

  try {
    const avgText = avg ? `${avg.sys}/${avg.dia}` : '-/-'
    const system = [
      '你是一名健康助理。根据用户近期的家庭血压自测数据，',
      '用中文写一段简洁的「近期健康小结」，',
      '包含：整体情况、达标情况、需要关注的点。语气平和、鼓励。',
      '注意：你提供的是健康提醒而非医疗诊断，不得给出用药或剂量调整建议；',
      '若数据明显异常（如收缩压≥180 或舒张压≥110），请明确提醒尽快就医。',
      '控制在 150 字以内。',
    ].join('')
    const prompt = [
      '家庭血压达标标准：收缩压≤135 且 舒张压≤85。',
      '',
      `近 ${recent.length} 次记录：`,
      dataLine,
      '',
      `平均血压 ${avgText}，达标率 ${rate}%。`,
    ].join('\n')
    const { text } = await generateText({ model, system, prompt })
    return { ok: true, summary: text.trim() }
  } catch (e) {
    return {
      ok: false,
      summary: '生成小结失败：' + (e instanceof Error ? e.message : String(e)),
    }
  }
})
