import { createServerFn } from '@tanstack/react-start'
import { eq, lt } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { createDb, sessions, users, type DB } from '~/db'

const SESSION_COOKIE = 'hc_session'
const SESSION_TTL = 30 * 24 * 3600 * 1000

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256(`${salt}:${password}`)
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? m[1] : null
}

export async function createSession(db: DB, username: string) {
  const token = crypto.randomUUID()
  const expiresAt = Date.now() + SESSION_TTL
  await db.insert(sessions).values({ token, username, expiresAt })
  return { token, expiresAt }
}

export async function getSessionUser(db: DB, token: string | null): Promise<string | null> {
  if (!token) return null
  const [row] = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1)
  if (!row || row.expiresAt < Date.now()) return null
  return row.username
}

/** 认证检查（beforeLoad 调用，读 cookie → 返回 username 或 null）。 */
export const checkAuth = createServerFn().handler(async (ctx: any) => {
  const req = ctx.request as Request | undefined
  const token = parseCookie(req?.headers.get('cookie') ?? null, SESSION_COOKIE)
  const db = createDb(env.DB)
  return getSessionUser(db, token)
})

/** 登录（验证凭据 → 返回 cookie 字符串，客户端设置）。 */
export const login = createServerFn({ method: 'POST' })
  .validator((d: unknown): { username: string; password: string } => {
    const v = (d ?? {}) as Record<string, unknown>
    return {
      username: typeof v.username === 'string' ? v.username.trim() : '',
      password: typeof v.password === 'string' ? v.password : '',
    }
  })
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const [user] = await db.select().from(users).where(eq(users.username, data.username)).limit(1)
    if (!user) return { ok: false as const, error: '用户不存在' }
    const hash = await hashPassword(data.password, user.salt)
    if (hash !== user.passwordHash) return { ok: false as const, error: '密码错误' }
    const { token, expiresAt } = await createSession(db, user.username)
    const maxAge = Math.floor((expiresAt - Date.now()) / 1000)
    await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()))
    return { ok: true as const, cookie: `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax` }
  })

/** 登出（清除会话 → 返回清除 cookie 字符串）。 */
export const logout = createServerFn({ method: 'POST' }).handler(async (ctx: any) => {
  const req = ctx.request as Request | undefined
  const token = parseCookie(req?.headers.get('cookie') ?? null, SESSION_COOKIE)
  if (token) {
    const db = createDb(env.DB)
    await db.delete(sessions).where(eq(sessions.token, token))
  }
  return { ok: true as const, cookie: `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` }
})
