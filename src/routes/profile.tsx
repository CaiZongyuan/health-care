import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { addMedication } from '~/server/meds'
import {
  deleteMedication,
  getProfileData,
  saveProfile,
  toggleMedActive,
} from '~/server/profile'
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
import { formatDateTime } from '~/lib/datetime'
import { listModels } from '~/server/llm'
import { LLM_PRESETS, getPreset } from '~/lib/llm'
import { AiSummaryView } from '~/components/ai-summary'

const MED_STAGES = ['早晨', '中午', '晚上', '睡前'] as const

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
  loader: async () => await getProfileData(),
})

function ProfilePage() {
  const router = useRouter()
  const d = Route.useLoaderData()
  const aiEnabled = d.profile.ai_auto_enabled === '1'
  const aiFreq = d.profile.ai_auto_freq === 'weekly' ? 'weekly' : 'daily'

  // AI 模型配置
  const [aiProv, setAiProv] = useState(d.profile.ai_provider || 'zhipu')
  const [aiBase, setAiBase] = useState(d.profile.ai_base_url || '')
  const [aiKey, setAiKey] = useState(d.profile.ai_api_key || '')
  const [aiModel, setAiModel] = useState(d.profile.ai_model || '')
  const [aiModels, setAiModels] = useState<{ id: string }[]>([])
  const [detecting, setDetecting] = useState(false)
  const aiEffectiveBase = aiBase || getPreset(aiProv)?.baseURL || ''
  const onDetectModels = async () => {
    setDetecting(true)
    try {
      const r = await listModels({
        data: { provider: aiProv, baseURL: aiEffectiveBase, apiKey: aiKey },
      })
      setAiModels(r.models)
      if (r.models.length && !r.models.some((x) => x.id === aiModel)) {
        setAiModel(r.models[0].id)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '检测失败')
    } finally {
      setDetecting(false)
    }
  }
  const saveAiConfig = async () => {
    await saveProfile({
      data: {
        ai_provider: aiProv,
        ai_base_url: aiBase,
        ai_api_key: aiKey,
        ai_model: aiModel,
      },
    })
    await router.invalidate()
    flash('aiConfig')
  }

  const [age, setAge] = useState(d.profile.age ?? '')
  const [height, setHeight] = useState(d.profile.height ?? '')
  const [weight, setWeight] = useState(d.profile.weight ?? '')
  const [history, setHistory] = useState(d.profile.history ?? '')
  const [savedKey, setSavedKey] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [mName, setMName] = useState('')
  const [mDosage, setMDosage] = useState('')
  const [mStages, setMStages] = useState<string[]>([])

  const flash = (k: string) => {
    setSavedKey(k)
    setTimeout(() => setSavedKey(''), 1500)
  }

  const saveBasic = async () => {
    await saveProfile({ data: { age, height, weight } })
    await router.invalidate()
    flash('basic')
  }
  const saveHistory = async () => {
    await saveProfile({ data: { history } })
    await router.invalidate()
    flash('history')
  }

  const onAddMed = async (e: React.FormEvent) => {
    e.preventDefault()
    await addMedication({
      data: {
        name: mName,
        dosage: mDosage,
        stages: mStages.map((stage) => ({ stage, time: '' })),
      },
    })
    setMName('')
    setMDosage('')
    setMStages([])
    setShowAdd(false)
    await router.invalidate()
  }

  return (
    <div className="space-y-4 p-4 pt-6">
      <h1 className="text-2xl font-bold">我的</h1>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {[
              { k: 'age', label: '年龄', val: age, set: setAge },
              { k: 'height', label: '身高 cm', val: height, set: setHeight },
              { k: 'weight', label: '体重 kg', val: weight, set: setWeight },
            ].map((f) => (
              <div key={f.k} className="flex-1">
                <Label className="mb-1 block text-xs text-muted-foreground">
                  {f.label}
                </Label>
                <Input
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  inputMode={f.k === 'age' ? 'numeric' : 'decimal'}
                />
              </div>
            ))}
          </div>
          <Button onClick={saveBasic} className="w-full">
            {savedKey === 'basic' ? '已保存 ✓' : '保存基本信息'}
          </Button>
        </CardContent>
      </Card>

      {/* 既往病史 */}
      <Card>
        <CardHeader>
          <CardTitle>既往病史</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            placeholder="如：原发性高血压（3 级）、脑出血术后康复期、2 型糖尿病……"
            className="h-24"
          />
          <Button onClick={saveHistory} variant="outline" className="w-full">
            {savedKey === 'history' ? '已保存 ✓' : '保存病史'}
          </Button>
        </CardContent>
      </Card>

      {/* AI 模型配置 */}
      <Card>
        <CardHeader>
          <CardTitle>AI 模型配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">服务商</Label>
            <select
              value={aiProv}
              onChange={(e) => {
                setAiProv(e.target.value)
                setAiBase('')
                setAiModels([])
              }}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring"
            >
              {LLM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.region === 'global' ? '（需海外网络）' : ''}
                </option>
              ))}
              <option value="custom">自定义（OpenAI 兼容）</option>
            </select>
          </div>

          {aiProv === 'custom' ? (
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                Base URL
              </Label>
              <Input
                value={aiBase}
                onChange={(e) => setAiBase(e.target.value)}
                placeholder="https://your-provider/v1"
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              端点：{getPreset(aiProv)?.baseURL}
            </p>
          )}

          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">API Key</Label>
            <Input
              type="password"
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
              placeholder="sk-..."
            />
            {getPreset(aiProv)?.keyUrl && (
              <a
                href={getPreset(aiProv)?.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                去{getPreset(aiProv)?.label}获取 Key →
              </a>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onDetectModels}
            disabled={detecting || !aiKey}
          >
            {detecting ? '检测中…' : '检测可用模型'}
          </Button>

          {aiModels.length > 0 ? (
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">模型</Label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring"
              >
                {aiModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                模型（可手动填或先检测）
              </Label>
              <Input
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="如 glm-4.6 / deepseek-chat"
              />
            </div>
          )}

          <Button type="button" className="w-full" onClick={saveAiConfig}>
            {savedKey === 'aiConfig' ? '已保存 ✓' : '保存配置'}
          </Button>
          <p className="text-xs text-muted-foreground">
            不配置则默认用智谱。⚠️ Key 存在本地数据库（个人自用），仅你可访问。
          </p>
        </CardContent>
      </Card>

      {/* AI 健康小结 */}
      <Card>
        <CardHeader>
          <CardTitle>AI 健康小结</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">已生成 {d.aiCount} 次</p>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">定时自动生成</span>
              <button
                type="button"
                onClick={async () => {
                  await saveProfile({
                    data: { ai_auto_enabled: aiEnabled ? '0' : '1' },
                  })
                  await router.invalidate()
                }}
                className={`relative h-6 w-11 rounded-full transition ${
                  aiEnabled ? 'bg-green-500' : 'bg-muted'
                }`}
                aria-label="切换定时生成"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    aiEnabled ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            {aiEnabled && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">频率</span>
                {(['daily', 'weekly'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={async () => {
                      await saveProfile({ data: { ai_auto_freq: f } })
                      await router.invalidate()
                    }}
                    className={`rounded-full px-3 py-1 text-xs ${
                      aiFreq === f
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-muted-foreground'
                    }`}
                  >
                    {f === 'daily' ? '每日' : '每周'}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              每天上海 08:00 按设置自动生成并存档；首页可随时手动生成。
            </p>
          </div>

          <div className="border-t pt-3">
            <h3 className="mb-2 text-sm font-bold">历史小结</h3>
            {d.aiHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有生成过小结。</p>
            ) : (
              <div className="space-y-2">
                {d.aiHistory.map((s) => (
                  <div key={s.id} className="rounded-lg bg-muted/40 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDateTime(s.createdAt)}</span>
                      <span>{s.trigger === 'auto' ? '定时' : '手动'}</span>
                    </div>
                    <AiSummaryView content={s.content} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 长期用药 */}
      <Card>
        <CardHeader>
          <CardTitle>长期用药</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {d.meds.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有用药。</p>
          ) : (
            <div className="space-y-2">
              {d.meds.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 rounded-xl border border-border p-3 ${
                    m.active ? '' : 'opacity-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-bold">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[
                        (m.stages ?? []).map((s) => s.stage).join('、'),
                        m.dosage,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await toggleMedActive({ data: { id: m.id } })
                      await router.invalidate()
                    }}
                  >
                    {m.active ? '停用' : '启用'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={async () => {
                      await deleteMedication({ data: { id: m.id } })
                      await router.invalidate()
                    }}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full rounded-md py-2 text-sm text-primary hover:bg-muted"
            >
              + 添加用药
            </button>
          ) : (
            <form
              onSubmit={onAddMed}
              className="space-y-3 rounded-xl border border-border p-3"
            >
              <Input
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="药品名称"
              />
              <Input
                value={mDosage}
                onChange={(e) => setMDosage(e.target.value)}
                placeholder="剂量（如 1片/30mg）"
              />
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">
                  服用时段（一天多次请多选）
                </Label>
                <div className="flex flex-wrap gap-2">
                  {MED_STAGES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setMStages((prev) =>
                          prev.includes(s)
                            ? prev.filter((x) => x !== s)
                            : [...prev, s],
                        )
                      }
                      className={
                        mStages.includes(s)
                          ? 'rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground'
                          : 'rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground'
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={!mName || mStages.length === 0}
                  className="flex-1"
                >
                  添加
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAdd(false)}
                >
                  取消
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
