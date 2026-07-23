import type { BpRecord } from '~/db'

/** 把血压记录转成 CSV 字符串（含 BOM，Excel 中文不乱码）。 */
export function bpRecordsToCsv(readings: BpRecord[]): string {
  const rows: string[][] = [
    ['日期', '时间', '收缩压', '舒张压', '心率', '血氧', '晨起', '症状', '备注'],
  ]
  for (const r of [...readings].reverse()) {
    const d = new Date(r.measuredAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    rows.push([
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      String(r.sys),
      String(r.dia),
      r.hr ? String(r.hr) : '',
      r.spo2 ? String(r.spo2) : '',
      r.isMorning ? '是' : '',
      r.symptoms.join('/'),
      r.notes,
    ])
  }
  return (
    '﻿' +
    rows
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
  )
}

/** 浏览器端下载 CSV。 */
export function downloadBpCsv(readings: BpRecord[]) {
  const csv = bpRecordsToCsv(readings)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `血压记录_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
