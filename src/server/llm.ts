import { createServerFn } from '@tanstack/react-start'
import { getPreset } from '~/lib/llm'

export type LlmModel = { id: string }

/** cc-switch 风格：baseURL → 候选 /models URL（处理 /v1 vs /models vs /paas/v4 的分歧）。 */
export function buildModelsUrlCandidates(rawBase: string): string[] {
  const base = rawBase.trim().replace(/\/+$/, '')
  if (!base) return []
  const out: string[] = []
  if (/\/v\d+$/.test(base)) {
    out.push(`${base}/models`)
    if (!base.endsWith('/v1')) out.push(`${base}/v1/models`)
  } else {
    out.push(`${base}/v1/models`)
  }
  return [...new Set(out)]
}

/** 探测 provider 可用模型（OpenAI 兼容 GET /models）。 */
export const listModels = createServerFn()
  .validator((d: unknown): { provider: string; baseURL: string; apiKey: string } => {
    const v = (d ?? {}) as Record<string, unknown>
    const provider = typeof v.provider === 'string' ? v.provider : 'custom'
    const baseURL = typeof v.baseURL === 'string' ? v.baseURL.trim() : ''
    const apiKey = typeof v.apiKey === 'string' ? v.apiKey.trim() : ''
    if (!baseURL) throw new Error('缺少 baseURL')
    if (!apiKey) throw new Error('需要先填写 API Key')
    return { provider, baseURL, apiKey }
  })
  .handler(async ({ data }) => {
    const preset = getPreset(data.provider)
    const urls = preset?.modelsUrl
      ? [preset.modelsUrl]
      : buildModelsUrlCandidates(data.baseURL)
    let lastErr: unknown = null
    for (const url of urls) {
      // review #16: SSRF 防护——拒绝内网/本地地址
      try {
        const parsed = new URL(url)
        const h = parsed.hostname.toLowerCase()
        if (
          /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(h) ||
          h === '::1' ||
          h.startsWith('fc') ||
          h.startsWith('fe80')
        ) {
          throw new Error(`不允许访问内网地址: ${h}`)
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('不允许')) throw e
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${data.apiKey}` },
      })
      if (res.ok) {
        const json = (await res.json()) as { data?: { id: string }[] }
        const models = (json.data ?? []).map((x) => ({ id: x.id })).sort((a, b) =>
          a.id.localeCompare(b.id),
        )
        return { models }
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`API Key 无效或无权限（HTTP ${res.status}）`)
      }
      if (res.status === 404 || res.status === 405) {
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      throw new Error(`获取模型列表失败：HTTP ${res.status}`)
    }
    throw new Error(
      `无法获取模型列表：${lastErr instanceof Error ? lastErr.message : '未知'}`,
    )
  })
