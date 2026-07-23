# Research 06 — TanStack Start + Vercel AI SDK on Cloudflare (2026)

**Date:** 2026-07-23 · **Stack:** React + TanStack Start + Vercel AI SDK + Cloudflare
**Method:** Primary sources only (tanstack.com, developers.cloudflare.com, ai-sdk.dev, GitHub repos/issues). 2025–2026 sources preferred.

---

## Summary

This stack **can run on Cloudflare in 2026 and is a supported, documented path** — TanStack Start lists Cloudflare Workers as an **Official Hosting Partner** and Cloudflare ships a first-party Vite plugin + deploy guide (updated June 2026). SSR, server functions, and bindings all work on Workers. The Vercel AI SDK also runs on the Workers runtime with `nodejs_compat`, and Cloudflare maintains an official integration page. **However, AI streaming has real, documented sharp edges on Workers:** a confirmed deadlock bug where `streamText()` + the **Anthropic** provider hangs indefinitely on Workers (issue #10725, AI SDK v6 beta, Nov 2025), and a CPU-limit trap from "smooth streaming" (issue #6492). There is also a TanStack-specific footgun where server functions that `fetch()` their own API routes work in dev but fail in production on Workers (issue #4255).

**Verdict: CONDITIONAL YES** — viable for the MVP, but you must (1) deploy to **Workers** (not Pages) via `@cloudflare/vite-plugin` with `nodejs_compat` + a recent compat date, (2) **validate the AI provider's streaming path on Workers early** (avoid/patch `@ai-sdk/anthropic` until #10725 is resolved, or use the Workers AI / OpenAI provider which is the documented happy path), (3) respect Workers' 128 MB / 30 s-default-CPU limits, and (4) never self-`fetch()` internal API routes from server functions.

---

## Findings

### Q1 — TanStack Start → Cloudflare (Workers/Pages): status & maturity

**Adapter status: Official, mature, Workers-first (not Pages).**

- TanStack Start is at **v1** (docs served under `/start/v1/`). Cloudflare is one of three **Official Hosting Partners** (Cloudflare, Netlify, Railway), listed first with a dedicated deploy guide. ([TanStack Start — Hosting](https://tanstack.com/start/v1/docs/framework/react/guide/hosting))
- Cloudflare's first-party guide ([TanStack Start · Cloudflare Workers docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/), last modified **2026-06-25**, example `compatibility_date: 2026-07-11`) describes TanStack Start as "a full-stack framework for building web applications with **server-side rendering, streaming, server functions, and bundling**" — i.e. SSR on Workers is the supported, documented path, not an edge case.
- **Recommended deployment shape: Workers** via `@cloudflare/vite-plugin` (the official setup "currently uses Vite through `@cloudflare/vite-plugin`"). The Vite plugin gained official TanStack Start support in **Oct 2025** ([Cloudflare community announcement](https://community.cloudflare.com/t/workers-build-tanstack-start-apps-with-the-cloudflare-vite-plugin/852011)). Pages is the legacy path and shows up only in community SSG/prerender complaints ([Reddit](https://www.reddit.com/r/reactjs/comments/1rbkx0i/tanstack_start_cloudflare_pages_ssg_prerender/)) — prefer Workers.
- **Required config:** `compatibility_flags: ["nodejs_compat"]` + a current `compatibility_date`; entrypoint `@tanstack/react-start/server-entry`. ([Cloudflare guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/))
- **Bindings / full-stack:** server functions access KV/R2/D1/D1/AI/Queues via `import { env } from "cloudflare:workers"`. A **custom server entrypoint** (`src/server.ts`) wraps the default `fetch` handler and lets you add Queues, Cron Triggers, Durable Objects, Workflows, and Service Bindings — first-class. ([Cloudflare guide — Custom entrypoints / Bindings](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/))
- **Static prerendering** is supported at build time; for CI builds without secrets, set `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`. ([Cloudflare guide — Static prerendering](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/))

**Known TanStack↔Cloudflare issues (GitHub):**
- [#4255](https://github.com/TanStack/router/issues/4255) — **ServerFn that `fetch()`es an internal API route works in dev, fails in production on Workers** (self-referential subrequest problem). Workaround: call the logic directly or use Service Bindings, don't HTTP-fetch your own routes.
- [#5208](https://github.com/TanStack/router/issues/5208) — `Cannot find module "cloudflare:workers"` in some RC/preset configs.
- [#5291](https://github.com/TanStack/router/issues/5291) — dev server breakage with the Cloudflare Vite plugin (Solid Start variant).

**Workers runtime constraints that apply (Cloudflare Limits, last modified 2026-07-05):** ([Limits · Workers](https://developers.cloudflare.com/workers/platform/limits/))
- **Memory: 128 MB per isolate** (shared across concurrent requests; JS heap + WASM).
- **CPU time: 30 s default → raisable to 5 min (300,000 ms)** on the Paid plan via `limits.cpu_ms`. Network wait (`fetch`, KV, DB) does **not** count as CPU time.
- **Request body: plan-dependent** (~100 MB on Free/Pro/Business; Enterprise negotiable); `413` if exceeded. **No response body size limit** (CDN cache: 512 MB Free/Pro/Business).
- **Duration: no hard wall-clock limit for HTTP** Workers while the client is connected; `ctx.waitUntil()` extends up to 30 s post-response.
- **Startup: global scope must parse/execute within 1 s** (bundle size matters → keep deps lean).
- **6 simultaneous connections waiting for headers** per invocation; subrequest budget is finite and tunable.

### Q2 — Vercel AI SDK → Cloudflare Workers runtime: compatibility

**Status: Supported with `nodejs_compat`, but streaming has provider-specific sharp edges.**

- Cloudflare maintains an official integration page: **[Vercel AI SDK · Cloudflare Workers AI docs](https://developers.cloudflare.com/workers-ai/configuration/ai-sdk/)** (last modified 2026-04-21). It documents `generateText`, `streamText`, and `generateObject` all running on Workers using the `workers-ai-provider` package bound to `env.AI`.
- The AI SDK explicitly targets multiple JS runtimes — Node.js, Edge Runtime, and "other JavaScript runtimes" including Workers — and community providers declare compatibility across them. ([ai-sdk.dev — Community Providers: Cloudflare](https://ai-sdk.dev/providers/community-providers/cloudflare-workers-ai))
- **Hard requirement: enable `nodejs_compat`** (umbrella flag; with `compatibility_date ≥ 2024-09-23` it auto-enables `nodejs_compat_v2`). Imports must use the `node:` prefix in your code *and* transitive deps. ([Node.js compatibility · Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)) Most core Node APIs are now natively supported (Buffer, Crypto, Stream, HTTP/HTTPS, Path, Zlib, AsyncLocalStorage, etc.); a few are stubs (e.g. `node:http2`, `node:vm`, `node:child_process` only import safely on recent compat dates — see stub table).

**Streaming support (SSE / ReadableStream):**
- The AI SDK's streaming primitives are web-standard (`ReadableStream`, `TransformStream`) and are designed for edge runtimes. ([ai-sdk.dev — Streaming](https://ai-sdk.dev/docs/foundations/streaming))
- On Workers, Cloudflare's own docs require **special response headers** to keep the stream chunked through the CDN: `Content-Type: text/x-unknown`, `content-encoding: identity`, `transfer-encoding: chunked`. ([Workers AI · AI SDK — Stream Text](https://developers.cloudflare.com/workers-ai/configuration/ai-sdk/))
- **CRITICAL known incompatibility — `streamText()` + `@ai-sdk/anthropic` deadlocks on Workers:** issue [#10725](https://github.com/vercel/ai/issues/10725) (filed 2025-11-30, AI SDK v6 beta / `@ai-sdk/anthropic` v3.0.0-beta.66). The provider's `doStream()` uses a `stream.tee()` + async IIFE first-chunk check that deadlocks under Workers' pull-based stream model — `reader.read()` never resolves, so `doStream()` never returns and the request **hangs indefinitely**. Documented workaround: `patch-package` to remove the `tee()` pattern. (Open as of research date.)
- **CPU-limit trap — "smooth streaming":** issue [#6492](https://github.com/vercel/ai/issues/6492) (2025-05, `ai` 4.3.13, Mastra on Workers). Enabling smooth streaming triggered excessive `RegExp` executions and hit the Workers CPU limit. Workaround: change the chunking strategy (e.g. slice buffer every ~5 chars) or raise `limits.cpu_ms`.

### Q3 — Coexistence: TanStack Start server functions/routes + AI SDK streaming on one deployment

**Status: Coexist cleanly on a single Worker; share `nodejs_compat`. Avoid self-fetch.**

- Both layers live in the **same Worker** and both depend on `nodejs_compat` — there is **no conflict**; one flag covers SSR, server functions, and the AI SDK. ([Cloudflare guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/))
- **Integration pattern:** AI calls belong inside TanStack **server functions** (`createServerFn`) or **API file routes** (`createAPIFileRoute`), which share the Worker and can read `env.AI` (or any binding) via `cloudflare:workers`. Cloudflare's docs show `createServerFn().handler(...)` accessing `env` bindings directly. ([Cloudflare guide — Bindings / Use R2 in a server function](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/))
- **Streaming responses from a server function / API route** return a standard `Response`/`ReadableStream` — the Worker's single `fetch` handler (TanStack's `@tanstack/react-start/server-entry`) routes both SSR and API routes, so an AI stream is just another streamed response. Apply the Cloudflare streaming headers above.
- **Do NOT `fetch()` your own API route from a server function.** Per [#4255](https://github.com/TanStack/router/issues/4255) this works locally but fails in production on Workers. Instead, extract shared logic into a function both call directly, or use **Service Bindings** (`env.AUTH_SERVICE...`) which Cloudflare explicitly recommends over global `fetch()` to another Worker on the same zone. ([Limits · Workers — Worker-to-Worker subrequests](https://developers.cloudflare.com/workers/platform/limits/))
- **⚠ Prefer API file routes (`createAPIFileRoute`) over streaming server functions for AI responses.** Issue [#6045](https://github.com/TanStack/router/issues/6045) reports that **streaming server-function responses return an empty body on Cloudflare Workers** (discussion covers adding Workers-specific handling in TanStack's dev-server middleware). A streaming `createAPIFileRoute` that returns the AI SDK's `Response`/`ReadableStream` directly is the safer path until #6045 is confirmed fixed. ([TanStack Start — Server entry point](https://tanstack.com/start/v0/docs/framework/react/guide/server-entry-point), [Server Functions](https://tanstack.com/start/v0/docs/framework/react/guide/server-functions))
- **Custom entrypoint escape hatch:** if you need the AI work in a separate Worker (e.g. to isolate CPU/memory or run a long agent), create `src/server.ts`, re-export the TanStack handler, and add a second Worker reachable via Service Binding — TanStack documents this exact pattern. ([Cloudflare guide — Custom entrypoints / Service Bindings](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/))

---

## Recommendation

**Proceed with the stack, on these conditions:**

1. **Deploy target = Cloudflare Workers** (not Pages) via `@cloudflare/vite-plugin`, with `compatibility_flags: ["nodejs_compat"]` and `compatibility_date` set to a current date. This is the TanStack Official Partner path and the only one Cloudflare actively documents.
2. **Pick the AI provider deliberately and test streaming on Workers in week 1.** The documented happy path is **Workers AI** (`workers-ai-provider`, bound to `env.AI`) or the **OpenAI** provider. **Treat `@ai-sdk/anthropic` streaming as blocked until #10725 is resolved** (or budget for a `patch-package`/fork). If the product needs Anthropic specifically, validate a minimal `streamText` deploy before committing.
3. **Run on the Workers Paid plan** so you can raise `limits.cpu_ms` to 300,000 ms for AI workloads and avoid the 100k daily-request Free cap during testing.
4. **Architecture rule for the team:** server functions call shared logic or Service Bindings directly — never HTTP-`fetch()` internal `/api` routes ([#4255](https://github.com/TanStack/router/issues/4255)).
5. **Keep the Worker bundle lean** (1 s startup budget) and stream bodies (don't buffer) to stay within 128 MB.

---

## Gotchas / Workarounds

| Issue | Symptom | Workaround |
|---|---|---|
| [#10725](https://github.com/vercel/ai/issues/10725) `@ai-sdk/anthropic` `streamText` hangs on Workers | Request hangs indefinitely, never responds | `patch-package` to remove `tee()`+IIFE in `doStream()`; or switch to Workers AI / OpenAI provider; track the issue for an upstream fix |
| [#6492](https://github.com/vercel/ai/issues/6492) smooth streaming CPU limit | `Worker exceeded resource limits` (Error 1102) | Change chunking strategy (slice every ~5 chars); or raise `limits.cpu_ms` on Paid plan |
| [#4255](https://github.com/TanStack/router/issues/4255) server fn → own API route | Works in dev, fails in prod on Workers | Call shared logic directly or use Service Bindings; don't self-`fetch` |
| [#6045](https://github.com/TanStack/router/issues/6045) streaming server fn empty body on Workers | AI stream via `createServerFn` returns empty body | Serve AI streams from a `createAPIFileRoute` returning the SDK's `Response`/`ReadableStream` directly; verify #6045 status before relying on streaming server fns |
| Streaming response mangled/cached by CDN | Stream not chunking client-side | Set `Content-Type: text/x-unknown`, `content-encoding: identity`, `transfer-encoding: chunked` ([Workers AI docs](https://developers.cloudflare.com/workers-ai/configuration/ai-sdk/)) |
| `node:`-prefix / transitive deps | `[unenv] ... is not implemented yet!` at runtime | Enable `nodejs_compat`; ensure deps use `node:` imports; check the stub-module table for non-functional modules ([Node.js compat](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)) |
| 128 MB memory / bundle bloat | `Exceeded Memory` (Error 1102) | Stream bodies via `TransformStream`; keep deps lean; offload heavy objects to KV/R2/D1 ([Limits](https://developers.cloudflare.com/workers/platform/limits/)) |
| 30 s default CPU ceiling | LLM/agent work truncated | Set `limits.cpu_ms: 300000` on Paid plan ([Limits — CPU time](https://developers.cloudflare.com/workers/platform/limits/)) |

---

## Open Risks

- **Anthropic streaming on Workers is the single biggest risk.** Issue [#10725](https://github.com/vercel/ai/issues/10725) is unresolved as of research; if the MVP needs Claude specifically, a fork/patch or a proxy Worker (Service Binding to a non-Anthropic-provider path) may be required. Re-check the issue status before locking the provider.
- **AI streaming has TWO independent failure modes on Workers.** Beyond the Anthropic deadlock ([#10725](https://github.com/vercel/ai/issues/10725)), TanStack's own streaming server functions return empty bodies on Workers ([#6045](https://github.com/TanStack/router/issues/6045)). Net: route AI streams through `createAPIFileRoute`, not `createServerFn`, and validate the chosen provider end-to-end on a deployed Worker early.
- **TanStack Start Cloudflare adapter is "official" but young-ish at v1.** Issues [#4255](https://github.com/TanStack/router/issues/4255), [#5208](https://github.com/TanStack/router/issues/5208), [#5291](https://github.com/TanStack/router/issues/5291), [#6045](https://github.com/TanStack/router/issues/6045) show real production/dev divergences; expect to pin versions and follow the `tanstack/router` repo.
- **Workers CPU ceiling (max 5 min) caps long agent loops.** Multi-step tool-calling agents that exceed wall CPU need offloading to Durable Objects/Workflows or a separate Node backend — relevant if the "随访" (follow-up) AI assistant grows beyond single-shot Q&A.
- **`nodejs_compat` surface keeps shifting** (new stub modules gated behind compat dates through 2026-03-17+). A dependency upgrade can silently start hitting an unimplemented stub; pin the compat date and test on dep bumps. ([Node.js compat — stub table](https://developers.cloudflare.com/workers/runtime-apis/nodejs/))
- **128 MB isolate** is fine for an MVP but tight if you buffer large model outputs or hold big prompt contexts — enforce streaming end-to-end.
