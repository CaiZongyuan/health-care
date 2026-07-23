import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getHomeData, saveBpRecord } from '~/server/records'
import { addMedication, getTodayMeds, toggleMedTaken } from '~/server/meds'
import { getAiSummary } from '~/server/ai'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { getBpStatus } from '~/lib/bp'
import { formatDateTime } from '~/lib/datetime'

const SYMPTOMS = ['头晕', '恶心', '呕吐', '头痛', '乏力', '心悸', '胸闷']

/** 当前本地时间，datetime-local 控件格式（YYYY-MM-DDTHH:mm）。 */
function nowLocalInput() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async () => {
    const [home, meds] = await Promise.all([getHomeData(), getTodayMeds()])
    return { ...home, meds }
  },
})

function HomePage() {
  const router = useRouter()
  const data = Route.useLoaderData()

  // 血压记录表单
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [hr, setHr] = useState('')
  const [spo2, setSpo2] = useState('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [measuredAt, setMeasuredAt] = useState(() => nowLocalInput())

  // 用药
  const [showAddMed, setShowAddMed] = useState(false)
  const [medName, setMedName] = useState('')
  const [medDosage, setMedDosage] = useState('')
  const [medTime, setMedTime] = useState('')
  const [addingMed, setAddingMed] = useState(false)

  // AI 小结
  const [summary, setSummary] = useState<{ ok: boolean; summary: string } | null>(
    null,
  )
  const [summarizing, setSummarizing] = useState(false)

  const takenSet = new Set(data.meds.takenIds)

  const toggleSymptom = (s: string) =>
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )

  const reset = () => {
    setSys('')
    setDia('')
    setHr('')
    setSpo2('')
    setSymptoms([])
    setNotes('')
    setShowMore(false)
    setMeasuredAt(nowLocalInput())
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await saveBpRecord({
        data: {
          measuredAt: measuredAt ? new Date(measuredAt).getTime() : Date.now(),
          sys: Number(sys),
          dia: Number(dia),
          hr: hr ? Number(hr) : null,
          spo2: spo2 ? Number(spo2) : null,
          symptoms,
          notes,
        },
      })
      reset()
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const onToggleMed = async (medId: number) => {
    try {
      await toggleMedTaken({ data: { medId } })
      await router.invalidate()
    } catch {
      /* ignore */
    }
  }

  const onAddMed = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingMed(true)
    try {
      await addMedication({
        data: { name: medName, dosage: medDosage, time: medTime, timeOfDay: '' },
      })
      setMedName('')
      setMedDosage('')
      setMedTime('')
      setShowAddMed(false)
      await router.invalidate()
    } finally {
      setAddingMed(false)
    }
  }

  const onSummarize = async () => {
    setSummarizing(true)
    try {
      setSummary(await getAiSummary())
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <div className="space-y-4 p-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">健康随访管家</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          个人自用 · 血压随访 · 已记录 {data.recordCount} 条
        </p>
      </header>

      {/* AI 健康小结 */}
      <Card>
        <CardHeader>
          <CardTitle>AI 健康小结</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary ? (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {summary.summary}
              </p>
              <p className="text-xs text-muted-foreground">
                ⚠️ AI 生成的健康提醒，非医疗诊断；如有不适请咨询医生。
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={onSummarize}
                disabled={summarizing}
              >
                {summarizing ? '生成中…' : '重新生成'}
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={onSummarize}
              disabled={summarizing}
            >
              {summarizing ? '生成中…' : '生成近期健康小结（智谱 GLM）'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 记录血压 */}
      <Card>
        <CardHeader>
          <CardTitle>记录当前血压</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm text-muted-foreground">
                测量时间（可补记）
              </Label>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={measuredAt}
                  onChange={(e) => setMeasuredAt(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMeasuredAt(nowLocalInput())}
                >
                  现在
                </Button>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="mb-2 block text-sm text-muted-foreground">
                  高压 mmHg
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={sys}
                  onChange={(e) => setSys(e.target.value)}
                  placeholder="--"
                  className="bg-muted/40 px-2 py-3 text-center text-4xl font-bold"
                />
              </div>
              <span className="pb-3 text-3xl text-muted-foreground/50">/</span>
              <div className="flex-1">
                <Label className="mb-2 block text-sm text-muted-foreground">
                  低压 mmHg
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  placeholder="--"
                  className="bg-muted/40 px-2 py-3 text-center text-4xl font-bold"
                />
              </div>
            </div>

            {!showMore ? (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="w-full rounded-md py-2 text-sm text-primary hover:bg-muted"
              >
                展开心率、血氧及症状
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="mb-2 block text-sm text-muted-foreground">
                      心率
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={hr}
                      onChange={(e) => setHr(e.target.value)}
                      placeholder="次/分"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="mb-2 block text-sm text-muted-foreground">
                      血氧 %
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      placeholder="%"
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block text-sm text-muted-foreground">
                    症状（可多选）
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {SYMPTOMS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSymptom(s)}
                        className={
                          symptoms.includes(s)
                            ? 'rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow'
                            : 'rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground'
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block text-sm text-muted-foreground">
                    备注
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="例如：刚吃完饭、感觉累……"
                    className="h-20"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={saving || !sys || !dia}
              className="w-full py-5 text-base"
            >
              {saving ? '保存中…' : '保存记录'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 今日用药 */}
      <Card>
        <CardHeader>
          <CardTitle>今日用药</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.meds.meds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              还没有用药，添加一条吧。
            </p>
          ) : (
            <div className="space-y-2">
              {data.meds.meds.map((m) => {
                const taken = takenSet.has(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onToggleMed(m.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                      taken
                        ? 'border-green-200 bg-green-50'
                        : 'border-border bg-background'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs text-white ${
                        taken
                          ? 'border-green-500 bg-green-500'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      {taken ? '✓' : ''}
                    </span>
                    <span className="flex-1">
                      <span
                        className={`block font-bold ${
                          taken ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {m.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[m.time, m.dosage].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {!showAddMed ? (
            <button
              type="button"
              onClick={() => setShowAddMed(true)}
              className="w-full rounded-md py-2 text-sm text-primary hover:bg-muted"
            >
              + 添加用药
            </button>
          ) : (
            <form
              onSubmit={onAddMed}
              className="space-y-3 rounded-xl border border-border p-3"
            >
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">
                  药品名称
                </Label>
                <Input
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="如 硝苯地平控释片"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="mb-1 block text-xs text-muted-foreground">
                    剂量
                  </Label>
                  <Input
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    placeholder="如 1片(30mg)"
                  />
                </div>
                <div className="flex-1">
                  <Label className="mb-1 block text-xs text-muted-foreground">
                    时间
                  </Label>
                  <Input
                    type="time"
                    value={medTime}
                    onChange={(e) => setMedTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={addingMed || !medName}
                  className="flex-1"
                >
                  {addingMed ? '添加中…' : '添加'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddMed(false)}
                >
                  取消
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 最近记录 */}
      <section>
        <h2 className="mb-2 px-1 text-lg font-bold">最近记录</h2>
        {data.recent.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            还没有记录，先记一条吧。
          </p>
        ) : (
          <div className="space-y-2">
            {data.recent.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(r.measuredAt)}
                      {r.isMorning ? ' · 晨' : ''}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {r.sys}/{r.dia}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs ${getBpStatus(
                          r.sys,
                          r.dia,
                        ).className}`}
                      >
                        {getBpStatus(r.sys, r.dia).label}
                      </span>
                    </div>
                    {(r.symptoms.length > 0 || r.notes) && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {r.symptoms.length > 0 && (
                          <span className="mr-2 text-destructive">
                            {r.symptoms.join('、')}
                          </span>
                        )}
                        {r.notes}
                      </div>
                    )}
                  </div>
                  {(r.hr || r.spo2) && (
                    <div className="space-y-1 text-right text-sm text-muted-foreground">
                      {r.hr && <div>心率 {r.hr}</div>}
                      {r.spo2 && <div>血氧 {r.spo2}%</div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
