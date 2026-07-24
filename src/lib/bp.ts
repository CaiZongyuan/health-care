// 血压分级（面向已确诊高血压患者）。
// 危象 ≥170/110；偏高 ≥140/90；尚可 120-139/80-89；健康 <120/80；偏低 <90/60。
// 达标线（家庭血压）≤135/85 是更严格的控制目标（达标率用）。

export type BpLevel = 'low' | 'healthy' | 'acceptable' | 'high' | 'crisis'

export type BpStatus = {
  level: BpLevel
  label: string
  className: string
}

export function getBpStatus(sys: number, dia: number): BpStatus {
  if (sys >= 170 || dia >= 110) {
    return { level: 'crisis', label: '危象·建议就医', className: 'border-red-300 bg-red-100 text-red-700' }
  }
  if (sys < 90 || dia < 60) {
    return { level: 'low', label: '偏低', className: 'border-yellow-200 bg-yellow-50 text-yellow-700' }
  }
  if (sys >= 140 || dia >= 90) {
    return { level: 'high', label: '偏高', className: 'border-orange-200 bg-orange-50 text-orange-600' }
  }
  if (sys < 120 && dia < 80) {
    return { level: 'healthy', label: '健康', className: 'border-green-300 bg-green-100 text-green-700' }
  }
  return { level: 'acceptable', label: '尚可', className: 'border-blue-200 bg-blue-50 text-blue-600' }
}

/** 达标（家庭血压）：sys≤135 且 dia≤85。 */
export function isControlled(sys: number, dia: number): boolean {
  return sys <= 135 && dia <= 85
}

/** 清晨高血压：晨起测量且 sys≥135 或 dia≥85。 */
export function isMorningHypertension(r: {
  sys: number
  dia: number
  isMorning: boolean
}): boolean {
  return r.isMorning && (r.sys >= 135 || r.dia >= 85)
}

/** 达标率（百分比）。 */
export function controlRate(records: { sys: number; dia: number }[]): number {
  if (records.length === 0) return 0
  const ok = records.filter((r) => isControlled(r.sys, r.dia)).length
  return Math.round((ok / records.length) * 100)
}

/** 平均血压。 */
export function average(
  records: { sys: number; dia: number }[],
): { sys: number; dia: number } | null {
  if (records.length === 0) return null
  const sum = records.reduce(
    (a, r) => ({ sys: a.sys + r.sys, dia: a.dia + r.dia }),
    { sys: 0, dia: 0 },
  )
  return {
    sys: Math.round(sum.sys / records.length),
    dia: Math.round(sum.dia / records.length),
  }
}

/** 样本标准差。 */
export function std(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const v =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(v)
}

/** 收缩压日间变异：CV% + 范围（用于"波动"维度）。 */
export function sbpVariability(records: { sys: number }[]): {
  cv: number
  min: number
  max: number
} {
  if (records.length === 0) return { cv: 0, min: 0, max: 0 }
  const sys = records.map((r) => r.sys)
  const mean = sys.reduce((a, b) => a + b, 0) / sys.length
  return {
    cv: mean > 0 ? Math.round((std(sys) / mean) * 100) : 0,
    min: Math.min(...sys),
    max: Math.max(...sys),
  }
}

/** 趋势：近 7 天 vs 前 7 天均值差。 */
export function trendDelta(
  recent7: { sys: number; dia: number }[],
  prev7: { sys: number; dia: number }[],
): { dSys: number; dDia: number } | null {
  const a = average(recent7)
  const b = average(prev7)
  if (!a || !b) return null
  return { dSys: a.sys - b.sys, dDia: a.dia - b.dia }
}

/** 末尾连续 ≥135/85 的天数（清晨高血压连击）。 */
export function trailingHighStreak(records: { sys: number; dia: number }[]): number {
  let n = 0
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].sys >= 135 || records[i].dia >= 85) n++
    else break
  }
  return n
}

