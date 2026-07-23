# 部署到 Cloudflare（海外，个人自用，免备案）

技术栈：TanStack Start(SSR) → Cloudflare Workers（`@cloudflare/vite-plugin`，`nodejs_compat`），数据 Cloudflare D1，AI 智谱 GLM（OpenAI 兼容端点）。

Cloudflare Workers 在全球边缘运行（默认不含大陆节点，国内经最近的海外节点如香港访问），无需指定"区域"，也无需 ICP 备案（个人自用 + 自有域名绑 Cloudflare）。

## 一次性准备

```bash
# 1) 登录 Cloudflare（浏览器 OAuth，只需一次）
pnpm exec wrangler login

# 2) 创建远程 D1 数据库，记下输出的 database_id
pnpm exec wrangler d1 create health-care
```

把上一步的 `database_id` 填进 `wrangler.jsonc` 的 `d1_databases[0].database_id`（替换 `local-dev-placeholder`）。

## 部署

```bash
# 3) 远程 D1 建表（执行 migrations/ 下的迁移）
pnpm db:migrate:remote

# 4) 设置智谱 API Key（secret，交互式粘贴）
pnpm exec wrangler secret put ZHIPU_API_KEY
#   粘贴：你的智谱 GLM Coding Plan Key

# 5) 构建并部署 Worker
pnpm deploy          # = pnpm build && wrangler deploy
```

部署成功后得到一个 `https://health-care.<你的子域>.workers.dev` 地址，国内可直接访问。

## 绑定自有域名（可选，推荐）

Cloudflare 控制台 → Workers & Pages → `health-care` → Settings → Domains & Routes → Add → Custom domain → 填入你在 Cloudflare 托管的域名（如 `bp.你的域名.com`）。Cloudflare 自动签发证书；个人自用 + 海外部署无需备案。

## 环境变量

| 变量 | 来源 | 说明 |
|---|---|---|
| `DB` | wrangler.jsonc `d1_databases` 绑定 | D1 数据库（无需手动设） |
| `ZHIPU_MODEL` | wrangler.jsonc `vars` | 默认 `glm-4.7`，可改 |
| `ZHIPU_API_KEY` | `wrangler secret put` | 智谱 Key（生产）；本地用 `.dev.vars` |

## 本地开发（无需认证）

```bash
pnpm install
cp .dev.vars.example .dev.vars   # 填入 ZHIPU_API_KEY
pnpm db:migrate:local            # 本地 D1 建表（离线）
pnpm dev                         # http://localhost:3000
```

## 备注

- 改了 `wrangler.jsonc`（加绑定/vars）后，`pnpm build` 会自动重跑 `wrangler types` 刷新 `Env` 类型。
- D1 在国内经海外节点访问，跨域延迟存在但可用；AI 调用（智谱国内端点）从 Worker 出口正常。
