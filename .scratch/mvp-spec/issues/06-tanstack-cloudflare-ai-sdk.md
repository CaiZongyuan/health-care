# 06 — TanStack Start + Cloudflare + Vercel AI SDK 运行时可行性

Type: research
Status: resolved
Blocked by: none

## Question

到 2026 年，这套技术栈在 Cloudflare 上能否跑通、有哪些坑？

1. TanStack Start 能否部署到 Cloudflare（Workers / Pages）？适配器（cloudflare adapter）的成熟度、SSR 在 Workers 上的支持、已知限制？
2. Vercel AI SDK 能否在 Cloudflare Workers 运行时（edge）正常跑？有无 Node API / 流式响应（streaming）兼容问题？
3. TanStack Start 的 server functions 与 AI SDK 的流式调用如何在 Cloudflare 上共存？

产出：`research/06-tanstack-cloudflare-ai-sdk.md`（一手来源 + 引用）。需给出"这套栈是否可用于 MVP"的推荐与关键 gotcha。

## Research findings

详见 [`research/06-tanstack-cloudflare-ai-sdk.md`](../research/06-tanstack-cloudflare-ai-sdk.md)。

**裁定：条件可行（CONDITIONAL YES）** —— 所选栈可在 Cloudflare 上跑通。

- **TanStack Start → Cloudflare 官方支持、成熟**：Cloudflare 是官方托管伙伴；`@cloudflare/vite-plugin` + Workers 部署指南（2026-06 更新，v1 文档）覆盖 SSR / server functions / bindings / prerender / Queues·Cron·DO·Workflows。目标 = **Workers（不是 Pages）**，需 `nodejs_compat` + 较新 compat date。
- **Vercel AI SDK 在 Workers 上可用**（`nodejs_compat`）：`generateText`/`streamText`/`generateObject` 均可（官方 happy path = Workers AI / OpenAI provider）。流式需特殊响应头（`text/x-unknown`、`content-encoding: identity`、`transfer-encoding: chunked`）。
- **两个真实坑**：(1) `@ai-sdk/anthropic` 的 `streamText()` 在 Workers 上**死锁/无限挂起**（issue #10725，AI SDK v6 beta，未解决，需 patch-package）；(2) "smooth streaming" 因 RegExp 爆 CPU（#6492）。
- **共存 OK**：SSR + server fn + AI 共用 `nodejs_compat` 不冲突；bindings 经 `cloudflare:workers` 进 server fn。**别在内部 API route 自 fetch**（#4255）；**AI 流式走 `createAPIFileRoute`，不要用流式 server fn**（#6045：流式 server fn 在 Workers 上返回空 body）。
- **Workers 限制需规避**：128MB/isolate 内存、默认 30s CPU（Paid 可提到 5 min）、~100MB 请求体、1s 启动预算、6 个并发 header-waiting 连接。

**落地约束（实现期遵循）**：用官方插件部署到 **Workers**；跑 **Paid 计划**；第 1 周在已部署 Worker 上验证所选 AI provider 的流式；在 #10725 关闭前 **AI provider 避开 Anthropic**；AI 流式经 **API file route** 提供（与票据 07 联动）。
