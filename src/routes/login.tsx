import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { login } from '~/server/auth'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await login({ data: { username, password } })
      if (r.ok) {
        document.cookie = r.cookie
        await navigate({ to: '/' })
      } else {
        setError(r.error || '登录失败')
      }
    } catch {
      setError('登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">健康随访管家</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label className="mb-1 block text-sm text-muted-foreground">
                用户名
              </Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <Label className="mb-1 block text-sm text-muted-foreground">
                密码
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full"
            >
              {loading ? '登录中…' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
