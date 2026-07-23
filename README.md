# 健康随访管家

面向高血压、脑出血康复期及长期随访患者的个人自用移动端健康跟踪工具（MVP）。

记录血压 / 心率 / 血氧 / 症状 → 趋势与达标率（家庭血压 135/85 标准）→ AI 健康小结（智谱 GLM）。

## 技术栈
- TanStack Start (SSR) + React 19
- Cloudflare Workers（`@cloudflare/vite-plugin`，`nodejs_compat`）
- Cloudflare D1 + Drizzle ORM
- Tailwind CSS v4 + shadcn/ui
- Vercel AI SDK + 智谱 GLM（人在回路）

## 开发
```bash
pnpm install
pnpm dev      # 本地开发（local D1，无需登录）
pnpm build
```

规划与决策记录见 `.scratch/mvp-spec/`；开发任务见 GitHub Issues。
