// 个人自用、面向国内用户：日期/时间统一按 Asia/Shanghai，
// 也让 SSR 与客户端渲染一致（避免 hydration 时间不一致）。
const TZ = 'Asia/Shanghai'

type Parts = Record<string, string>

function parts(ms: number): Parts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const o: Parts = {}
  for (const p of fmt.formatToParts(new Date(ms))) o[p.type] = p.value
  return o
}

/** YYYY-MM-DD（Shanghai），用于"今日"判定。 */
export function todayStr(now: Date = new Date()): string {
  const o = parts(now.getTime())
  return `${o.year}-${o.month}-${o.day}`
}

/** 显示用：MM-DD HH:mm（Shanghai）。 */
export function formatDateTime(ms: number): string {
  const o = parts(ms)
  return `${o.month}-${o.day} ${o.hour}:${o.minute}`
}

/** 当前是否晨起（Shanghai 时区 < 11 点）——清晨高血压判定用。 */
export function isMorningNow(now: Date = new Date()): boolean {
  const o = parts(now.getTime())
  return Number(o.hour) < 11
}
