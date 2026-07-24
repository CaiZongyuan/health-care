// 可配置 LLM Provider 预设（设置页下拉用，服务端 + 客户端共享）。
// 研究来源：.scratch/mvp-spec/research/providers.md（DeepSeek/ModelScope/Zhipu/OpenRouter 均为 OpenAI 兼容 + 暴露 GET /models）。

export type LlmPreset = {
  id: string
  label: string
  baseURL: string
  modelsUrl: string | null // null = 用 cc-switch 候选算法探测
  keyUrl: string
  region: 'cn' | 'global' // global = 国内直连不稳，但 Worker(海外)可达
  defaultModel: string
}

export const LLM_PRESETS: LlmPreset[] = [
  {
    id: 'zhipu',
    label: '智谱 GLM (Zhipu)',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    modelsUrl: 'https://open.bigmodel.cn/api/paas/v4/models',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    region: 'cn',
    defaultModel: 'glm-4.6',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    modelsUrl: 'https://api.deepseek.com/models', // ⚠️ /models，非 /v1/models
    keyUrl: 'https://platform.deepseek.com/api_keys',
    region: 'cn',
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'modelscope',
    label: '魔搭 ModelScope (Qwen 等)',
    baseURL: 'https://api-inference.modelscope.cn/v1',
    modelsUrl: 'https://api-inference.modelscope.cn/v1/models',
    keyUrl: 'https://modelscope.cn/my/myaccesstoken',
    region: 'cn',
    defaultModel: 'Qwen/Qwen3-8B',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (聚合，需海外网络)',
    baseURL: 'https://openrouter.ai/api/v1',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    keyUrl: 'https://openrouter.ai/keys',
    region: 'global',
    defaultModel: 'deepseek/deepseek-chat:free',
  },
]

export function getPreset(id: string): LlmPreset | undefined {
  return LLM_PRESETS.find((p) => p.id === id)
}
