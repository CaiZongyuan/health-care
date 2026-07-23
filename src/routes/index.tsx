import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getHomeData, saveBpRecord } from '~/server/records'
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

const SYMPTOMS = ['头晕', '恶心', '呕吐', '头痛', '乏力', '心悸', '胸闷']

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async () => await getHomeData(),
})

function formatTime(ms: number) {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

function HomePage() {
  const router = useRouter()
  const data = Route.useLoaderData()
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [hr, setHr] = useState('')
  const [spo2, setSpo2] = useState('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await saveBpRecord({
        data: {
          sys: Number(sys),
          dia: Number(dia),
          hr: hr ? Number(hr) : null,
          spo2: spo2 ? Number(spo2) : null,
          symptoms,
          notes,
          isMorning: new Date().getHours() < 11,
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

  return (
    <div className="space-y-4 p-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold">健康随访管家</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          个人自用 · 血压随访 · 已记录 {data.recordCount} 条
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>记录当前血压</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
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
                      {formatTime(r.measuredAt)}
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
