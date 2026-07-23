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

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
  loader: async () => await getProfileData(),
})

function ProfilePage() {
  const router = useRouter()
  const d = Route.useLoaderData()

  const [age, setAge] = useState(d.profile.age ?? '')
  const [height, setHeight] = useState(d.profile.height ?? '')
  const [weight, setWeight] = useState(d.profile.weight ?? '')
  const [history, setHistory] = useState(d.profile.history ?? '')
  const [emName, setEmName] = useState(d.profile.emergency_name ?? '')
  const [emPhone, setEmPhone] = useState(d.profile.emergency_phone ?? '')
  const [savedKey, setSavedKey] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [mName, setMName] = useState('')
  const [mDosage, setMDosage] = useState('')
  const [mTime, setMTime] = useState('')

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
  const saveEmergency = async () => {
    await saveProfile({ data: { emergency_name: emName, emergency_phone: emPhone } })
    await router.invalidate()
    flash('emergency')
  }

  const onAddMed = async (e: React.FormEvent) => {
    e.preventDefault()
    await addMedication({
      data: { name: mName, dosage: mDosage, timeOfDay: mTime },
    })
    setMName('')
    setMDosage('')
    setMTime('')
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

      {/* 紧急联系人 */}
      <Card>
        <CardHeader>
          <CardTitle>紧急联系人（家属）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground">
                姓名
              </Label>
              <Input
                value={emName}
                onChange={(e) => setEmName(e.target.value)}
                placeholder="如 儿子"
              />
            </div>
            <div className="flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground">
                电话
              </Label>
              <Input
                value={emPhone}
                onChange={(e) => setEmPhone(e.target.value)}
                inputMode="tel"
                placeholder="如 138xxxxxxxx"
              />
            </div>
          </div>
          <Button onClick={saveEmergency} variant="outline" className="w-full">
            {savedKey === 'emergency' ? '已保存 ✓' : '保存联系人'}
          </Button>
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
                      {[m.timeOfDay, m.dosage].filter(Boolean).join(' · ')}
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
              <div className="flex gap-2">
                <Input
                  value={mDosage}
                  onChange={(e) => setMDosage(e.target.value)}
                  placeholder="剂量"
                  className="flex-1"
                />
                <Input
                  value={mTime}
                  onChange={(e) => setMTime(e.target.value)}
                  placeholder="时段"
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={!mName} className="flex-1">
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
