import { desc, gte } from 'drizzle-orm'
import {
  aiSummaries,
  bpRecords,
  createDb,
  medications,
  medLog,
  profile,
  type BpRecord,
  type DB,
  type Medication,
} from '~/db'
import {
  average,
  controlRate,
  sbpVariability,
  trailingHighStreak,
  trendDelta,
} from '~/lib/bp'
import { formatDateTime, todayStr } from '~/lib/datetime'

const DAY = 24 * 3600 * 1000

function bmi(h?: string, w?: string): string | null {
  const H = Number(h),
    W = Number(w)
  if (H > 0 && W > 0) return (W / ((H / 100) ** 2)).toFixed(1)
  return null
}

function comorbidities(history: string): string[] {
  const out: string[] = []
  if (/糖尿病|diabetes/i.test(history)) out.push('糖尿病')
  if (/肾病|CKD|chronic\s*kidney/i.test(history)) out.push('慢性肾病')
  if (/卒中|中风|脑出血|脑梗|stroke|TIA/i.test(history)) out.push('脑血管病史')
  if (/冠心病|心梗|房颤|心衰|cardiac/i.test(history)) out.push('心血管病史')
  return out
}

/** 装配 AI 小结的完整上下文（研究 daily-analysis.md §3.4 模板）。 */
export async function buildAiContext(
  db: DB,
): Promise<{ contextText: string; hasData: boolean }> {
  const now = Date.now()
  const since30 = now - 30 * DAY
  const since14 = now - 14 * DAY
  const since7 = now - 7 * DAY
  const since14m = now - 14 * DAY

  const [readings, allMeds, logs, profRows, lastAi] = await Promise.all([
    db
      .select()
      .from(bpRecords)
      .where(gte(bpRecords.measuredAt, since30))
      .orderBy(desc(bpRecords.measuredAt)),
    db.select().from(medications),
    db.select().from(medLog).where(gte(medLog.takenAt, since14)),
    db.select().from(profile),
    db.select().from(aiSummaries).orderBy(desc(aiSummaries.createdAt)).limit(1),
  ])

  const recs = readings as BpRecord[]
  if (recs.length === 0) return { contextText: '', hasData: false }

  const p: Record<string, string> = {}
  for (const r of profRows) p[r.key] = r.value
  const activeMeds = (allMeds as Medication[]).filter((m) => m.active)

  // BP 特征
  const avg = average(recs)
  const rate = controlRate(recs)
  const okCount = recs.filter((r) => r.sys <= 135 && r.dia <= 85).length
  const morning = recs.filter((r) => r.isMorning)
  const evening = recs.filter((r) => !r.isMorning)
  const mAvg = average(morning)
  const mRate = controlRate(morning)
  const mStreak = trailingHighStreak([...morning].reverse())
  const eAvg = average(evening)
  const eRate = controlRate(evening)
  const recent7 = recs.filter((r) => r.measuredAt >= since7)
  const prev7 = recs.filter((r) => r.measuredAt >= since14 && r.measuredAt < since7)
  const trend = trendDelta(recent7, prev7)
  const mVar = sbpVariability(morning.filter((r) => r.measuredAt >= since14m))
  const crisis = recs.filter((r) => r.sys >= 180 || r.dia >= 110).length

  // 症状
  const symFreq: Record<string, number> = {}
  let totalSym = 0
  for (const r of recs) for (const s of r.symptoms) (symFreq[s] = (symFreq[s] ?? 0) + 1), totalSym++
  const anyHigh = recs.some((r) => r.sys >= 135 || r.dia >= 85)
  const silent = anyHigh && totalSym === 0

  // 依从性（近 14 天，按时段）
  const expectedPerDay = activeMeds.reduce(
    (n, m) => n + (m.stages?.length ?? 0),
    0,
  )
  let pdc: number | null = null
  let missedDates: string[] = []
  if (expectedPerDay > 0) {
    const takenByDate: Record<string, number> = {}
    for (const l of logs)
      if (l.takenDate) takenByDate[l.takenDate] = (takenByDate[l.takenDate] ?? 0) + 1
    let takenTotal = 0
    let expectedTotal = 0
    for (let i = 0; i < 14; i++) {
      const d = new Date(now - i * DAY)
      const ds = todayStr(d)
      const tk = takenByDate[ds] ?? 0
      takenTotal += Math.min(tk, expectedPerDay)
      expectedTotal += expectedPerDay
      if (tk < expectedPerDay) missedDates.push(`${Number(ds.slice(5, 7))}-${Number(ds.slice(8, 10))}`)
    }
    pdc = expectedTotal > 0 ? Math.round((100 * takenTotal) / expectedTotal) : null
    missedDates = missedDates.slice(0, 6)
  }

  const medsSummary = activeMeds
    .map((m) => `${m.name}${m.dosage ? ' ' + m.dosage : ''}${m.stages?.length ? '(' + m.stages.map((s) => s.stage).join('/') + ')' : ''}`)
    .join('；')
  const cmb = comorbidities(p.history ?? '')
  const lastShort = lastAi[0]?.content
    ? String(lastAi[0].content).slice(0, 80).replace(/\s+/g, ' ')
    : '（无）'

  // 原始读数快照（升序，近 20 条）
  const snapshot = [...recs]
    .slice(0, 20)
    .reverse()
    .map((r) =>
      [
        formatDateTime(r.measuredAt).slice(0, 11),
        r.isMorning ? '晨' : '晚',
        `${r.sys}/${r.dia}`,
        r.hr ? `HR${r.hr}` : '',
        r.spo2 ? `SpO2-${r.spo2}` : '',
        r.symptoms.length ? `[${r.symptoms.join('/')}]` : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join('\n')

  const symLine =
    totalSym > 0
      ? Object.entries(symFreq).map(([k, v]) => `${k}×${v}`).join(' ')
      : '无症状记录'

  const lines = [
    '# 角色与边界',
    '你是高血压家庭随访的健康助理。仅根据下方【数据】生成中文小结，不得编造未给出的数字或日期。',
    '输出是「健康提醒」，非诊断；禁止任何用药/剂量增减建议；异常(≥180/110)务必提示就医。',
    '家庭血压达标 = 收缩≤135 且 舒张≤85。清晨高血压 = 晨起读数≥135/85；家庭数据只能提示"清晨血压偏高"，不能宣称"晨峰"。',
    '',
    '# 【档案】',
    `年龄: ${p.age || '未知'} | 身高/体重: ${p.height || '-'}/${p.weight || '-'}${bmi(p.height, p.weight) ? `(BMI ${bmi(p.height, p.weight)})` : ''} | 既往: ${p.history || '无'}`,
    `长期用药: ${medsSummary || '无'}`,
    cmb.length ? `合并高危因素: ${cmb.join('、')}` : '合并高危因素: 无',
    `补充说明(用户自填): ${p.ai_extra_context || '无'}`,
    '',
    '# 【周期与依从】(近 30 天血压 / 近 14 天依从)',
    `测量: ${recs.length} 次(${morning.length} 晨 / ${evening.length} 晚)`,
    expectedPerDay > 0
      ? `用药打卡(按时段): PDC=${pdc}%  漏服日期(近14天): ${missedDates.length ? missedDates.join('、') : '无'}  参考线≥80%良好`
      : '用药打卡: 未设置用药时段',
    '',
    '# 【血压特征】(已预计算)',
    `近30天均值: ${avg ? `${avg.sys}/${avg.dia}` : '-'}  达标率: ${rate}%(${okCount}/${recs.length})`,
    `清晨: 均值${mAvg ? `${mAvg.sys}/${mAvg.dia}` : '-'} 达标率${mRate}% 高血压${morning.filter((r) => r.sys >= 135 || r.dia >= 85).length}次 末尾连续≥135/85 ${mStreak}天`,
    `晚间: 均值${eAvg ? `${eAvg.sys}/${eAvg.dia}` : '-'} 达标率${eRate}%`,
    `趋势: 近7天均值${average(recent7) ? `${average(recent7)!.sys}/${average(recent7)!.dia}` : '-'} vs 前7天${average(prev7) ? `${average(prev7)!.sys}/${average(prev7)!.dia}` : '-'}${trend ? `(Δ${trend.dSys > 0 ? '+' : ''}${trend.dSys}/${trend.dDia > 0 ? '+' : ''}${trend.dDia})` : ''}`,
    `波动: 晨起SBP变异系数 ${mVar.cv}%(范围 ${mVar.min}-${mVar.max})`,
    `危象读数(≥180/110): ${crisis} 次`,
    '',
    '# 【症状】',
    `周期内症状: ${symLine}`,
    `症状-血压标记: ${silent ? 'silent(血压有偏高但完全无症状——沉默型，最需警惕)' : anyHigh ? '有症状伴血压偏高(可观察是否同时段反复)' : '血压基本达标'}`,
    '',
    '# 【原始读数】(升序，供举例)',
    snapshot,
    '',
    '# 【上次小结要点】',
    lastShort,
  ]

  return { contextText: lines.join('\n'), hasData: true }
}

// 便捷：同时返回 db（避免 ai.ts 重复建）
export function getDb(env: Env) {
  return createDb(env.DB)
}
