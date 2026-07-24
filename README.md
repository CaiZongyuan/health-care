# 健康随访管家

面向高血压患者的个人自用移动端健康跟踪工具。记血压 → 看趋势 → AI 智慧家庭医师观察建议。

## 功能

- **记录血压**：高压/低压（必填）+ 心率/血氧/症状/备注，支持时间选择（补记）
- **今日用药**：按时段分组（早晨/中午/晚上/睡前），乐观更新打卡；药物可填作用说明
- **趋势分析**：5 种图表（每日均值折线·散点+拟合·柱状·达标率环形+分布·日历热力），可点看数值；范围切换；历史分页+筛选
- **智慧家庭医师观察建议**：AI 基于完整上下文（血压+依从+趋势+波动+症状+档案+补充说明）生成结构化观察（整体评估/关键发现/关注建议）；定时自动生成
- **医生报告**：A4 可打印 PDF + CSV 导出
- **多 Provider AI 配置**：智谱/DeepSeek/魔搭/OpenRouter/自定义 + 自动检测可用模型
- **认证**：单用户登录，不开放注册

## 技术栈

- React 19 + TanStack Start (SSR)
- Cloudflare Workers（`@cloudflare/vite-plugin`，`nodejs_compat`）
- Cloudflare D1 + Drizzle ORM
- Tailwind CSS v4 + shadcn/ui (Base UI)
- Vercel AI SDK（`generateText`）+ 可配置 LLM Provider

## 开发

```bash
pnpm install
cp .dev.vars.example .dev.vars   # 填入 LLM API Key
pnpm db:migrate:local            # 本地 D1 建表
pnpm dev                         # http://localhost:3000
```

## 部署

详见 [DEPLOY.md](./DEPLOY.md)。简言之：`wrangler login` → 建 D1 → 迁移 → 设 secret → `pnpm run deploy`。

## 文档

- [产品全景](./docs/product-overview.md) — 3 分钟读懂整个产品
- [部署指南](./DEPLOY.md) — Cloudflare Workers 部署步骤
- [产品规格](./docs/product-spec.md) — MVP 范围与决策
- [AI 研究](./.scratch/mvp-spec/research/) — Provider/分析/架构研究
