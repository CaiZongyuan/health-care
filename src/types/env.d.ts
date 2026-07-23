// 智谱 API Key 通过 secret 注入（不放进 wrangler.jsonc vars，避免空值覆盖 .dev.vars），
// 这里为全局 Env 补类型。本地：.dev.vars；生产：wrangler secret put ZHIPU_API_KEY。
interface Env {
  ZHIPU_API_KEY?: string
}
