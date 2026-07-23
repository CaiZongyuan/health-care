import handler from '@tanstack/react-start/server-entry'
import { desc, eq } from 'drizzle-orm'
import { aiSummaries, createDb } from './db'
import { generateAndSave, readAiAutoSettings } from './server/ai'
import { todayStr } from './lib/datetime'

// 自定义入口：保留 TanStack 的 fetch，并加 Cron Trigger（AI 小结定时自动生成）。
export default {
  fetch: handler.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    try {
      const db = createDb(env.DB)
      const { enabled, freq } = await readAiAutoSettings(db)
      if (!enabled) return
      // 每周模式：cron 每日触发，但只在周一实际生成
      if (freq === 'weekly' && new Date().getUTCDay() !== 1) return
      // 当天已自动生成过则跳过
      const [last] = await db
        .select()
        .from(aiSummaries)
        .where(eq(aiSummaries.trigger, 'auto'))
        .orderBy(desc(aiSummaries.createdAt))
        .limit(1)
      if (last && todayStr(new Date(last.createdAt)) === todayStr()) return
      await generateAndSave(env, 'auto')
    } catch (e) {
      console.error('[scheduled] AI 自动小结失败', e)
    }
  },
}
