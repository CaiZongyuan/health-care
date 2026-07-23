// 血压判定与达标率（家庭血压标准，决策 10）。
// 偏高 ≥135/85；危象 ≥180/110；偏低 <90/60；正常高值 120-134/80-84。
// 上线前须临床医生签字确认（个人自用阶段为提醒，非医疗建议）。

export type BpLevel = 'low' | 'normal' | 'elevated' | 'high' | 'crisis'

export type BpStatus = {
  level: BpLevel
  label: string
  /** badge 的 tailwind 类（bg + text + border） */
  className: string
}

export function getBpStatus(sys: number, dia: number): BpStatus {
  if (sys >= 180 || dia >= 110) {
    return {
      level: 'crisis',
      label: '危象·建议就医',
      className: 'border-red-300 bg-red-100 text-red-700',
    }
  }
  if (sys < 90 || dia < 60) {
    return {
      level: 'low',
      label: '偏低',
      className: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    }
  }
  if (sys >= 135 || dia >= 85) {
    return {
      level: 'high',
      label: '偏高',
      className: 'border-red-200 bg-red-50 text-red-600',
    }
  }
  if (sys >= 120 || dia >= 80) {
    return {
      level: 'elevated',
      label: '正常高值',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }
  return {
    level: 'normal',
    label: '正常',
    className: 'border-green-200 bg-green-50 text-green-600',
  }
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
