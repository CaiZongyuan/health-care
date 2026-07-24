// AI 小结渲染：结构化 JSON（整体评估/关键发现/关注建议）三段，旧文本兜底纯文本。

export type AiSummaryData = {
  整体评估: string
  关键发现: string[]
  关注建议: string[]
}

export function parseAiSummary(content: string): AiSummaryData | null {
  try {
    const o = JSON.parse(content)
    if (o && typeof o.整体评估 === 'string') {
      return {
        整体评估: o.整体评估,
        关键发现: Array.isArray(o.关键发现) ? o.关键发现 : [],
        关注建议: Array.isArray(o.关注建议) ? o.关注建议 : [],
      }
    }
  } catch {
    /* not JSON */
  }
  return null
}

export function AiSummaryView({ content }: { content: string }) {
  const data = parseAiSummary(content)
  if (!data) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {content}
      </p>
    )
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <p className="font-medium text-foreground">{data.整体评估}</p>
      {data.关键发现.length > 0 && (
        <ul className="space-y-1">
          {data.关键发现.map((f, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="shrink-0 text-blue-500">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
      {data.关注建议.length > 0 && (
        <ul className="space-y-1">
          {data.关注建议.map((f, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="shrink-0">💡</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
