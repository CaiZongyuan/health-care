# OpenAI-Compatible LLM Providers — Research (end-user-configurable AI)

Goal: let the end user pick a provider + paste an API key in Settings, then the app
**auto-detects available models** from the key (like `cc-switch` does) and feeds them into
`@ai-sdk/openai`'s `createOpenAI({ baseURL }).chat(model)`.

All four providers below speak the OpenAI Chat Completions wire format and expose an
OpenAI-shaped `GET /models` listing endpoint → one unified detection routine works.

---

## 1. Provider matrix

| Provider | Chat `baseURL` (for `createOpenAI`) | `/models` works? | Auth header | China-accessible? | From CF Worker? | API-key URL |
|---|---|---|---|---|---|---|
| **DeepSeek** | `https://api.deepseek.com` (or `…/v1`) | ✅ `GET https://api.deepseek.com/models` (NOTE: **`/models`, not `/v1/models`**) | `Authorization: Bearer <key>` | ✅ (Chinese co.) | ✅ | https://platform.deepseek.com/api_keys |
| **ModelScope / 魔搭** (Alibaba) | `https://api-inference.modelscope.cn/v1` | ✅ `GET https://api-inference.modelscope.cn/v1/models` | `Authorization: Bearer <access_token>` | ✅ (Alibaba) | ✅ | https://modelscope.cn/my/myaccesstoken |
| **Zhipu / 智谱** (already integrated) | `https://open.bigmodel.cn/api/paas/v4` | ✅ `GET https://open.bigmodel.cn/api/paas/v4/models` (undocumented but stable; used by TruffleHog for key verification) | `Authorization: Bearer <api_key>` — **plain API key, NOT JWT** (JWT is an optional alternative) | ✅ | ✅ | https://open.bigmodel.cn/usercenter/apikeys |
| **OpenRouter** | `https://openrouter.ai/api/v1` | ✅ `GET https://openrouter.ai/api/v1/models` — **public, no auth required** (Bearer accepted too) | `Authorization: Bearer <key>` for chat; optional `HTTP-Referer`, `X-Title` headers | ❌ **unreliable/blocked from mainland China** (openrouter.ai) | ✅ (Workers run overseas) | https://openrouter.ai/keys |

### Per-provider notes & quirks

**DeepSeek** — `@ai-sdk/openai` works with `baseURL: 'https://api.deepseek.com'`; chat posts to
`{baseURL}/chat/completions`. Listing endpoint is **`/models`** (no `/v1` prefix) — confirmed by
the official "Lists Models" page (response `{object:"list", data:[{id, object, owned_by}]}`).
Current model IDs (2026-07): `deepseek-chat`, `deepseek-reasoner`, `deepseek-v4-flash`,
`deepseek-v4-pro` (`deepseek-chat`/`deepseek-reasoner` flagged deprecated 2026-07-24 in latest docs).

**ModelScope** — OpenAI-compatible adapter; model IDs are full ModelScope model slugs, e.g.
`Qwen/Qwen3-8B`, `Qwen/Qwen2.5-72B-Instruct`. Token = your魔搭 Access Token from the account page.
There is a known community report of `…/v1` 404-ing for non-chat paths under some configs (issue
modelscope/modelscope#1615); the `/v1/chat/completions` and `/v1/models` paths are the supported
ones. Free tier has daily call quotas (~2000/day).

**Zhipu** — Confirms existing integration (`src/server/ai.ts`). The API key is a single string of
form `{id}.{secret}` but is passed verbatim as `Authorization: Bearer <key>` — no client-side JWT
signing needed (the old zhipuai SDK did HMAC-signed JWTs; the OpenAI-compatible `paas/v4` endpoint
does not require it). Two bases exist: general `…/api/paas/v4` vs Coding-Plan `…/api/coding/paas/v4`
— don't mix them. Model IDs include `glm-4.5`, `glm-4.6`, `glm-4-plus`, `glm-4-air`, `glm-4-flash`,
and (latest) `glm-5.2`, `glm-5v-turbo`.

**OpenRouter** — `id` format is `vendor/model`, e.g. `openai/gpt-4o`, `meta-llama/llama-3.3-70b-instruct`.
Free models carry a `:free` suffix and/or `pricing.prompt === "0" && pricing.completion === "0"`.
`/models` is **public** — works with no key, so the UI can pre-populate the model list even before
the user pastes a key (then key is required only to actually chat). Best UX of the four for
auto-detect. Requires overseas egress — fine for the Worker, not for a user sitting behind the GFW.

---

## 2. How `cc-switch` does it (the pattern to copy)

Repo: [`farion1231/cc-switch`](https://github.com/farion1231/cc-switch). Core impl:
`src-tauri/src/services/model_fetch.rs`. Quoted behavior:

- Uses the **OpenAI-compatible `GET /v1/models`** endpoint, universally. Comment from the file:
  *"通过 OpenAI 兼容的 GET /v1/models 端点获取供应商可用模型列表。主要面向第三方聚合站…以及把
  Anthropic 协议挂在兼容子路径上的官方供应商（DeepSeek、Kimi、智谱 GLM 等）。"*
- Request: `GET <url>` with header **`Authorization: Bearer {api_key}`** (15s timeout).
- Response parsed as `{ data: [{ id, owned_by? }] }` (`ModelsResponse` struct). Results sorted by `id`.
- **Candidate-URL builder** (`build_models_url_candidates`) — the key trick, because providers
  disagree on whether the path is `/v1/models` vs `/models`:
  1. If an explicit `models_url` override is given → use it verbatim (this is how per-provider
     quirks are handled — a preset carries its exact models URL).
  2. If `baseURL` ends in an OpenAI-style version segment `/v{N}` (e.g. `/v1`, Zhipu `…/paas/v4`)
     → candidate is `{baseURL}/models` (don't double-prefix `/v1`).
  3. Else → candidate is `{baseURL}/v1/models`.
  4. If the version segment is not `/v1` (e.g. `/v4`), also append `{baseURL}/v1/models` as a fallback.
  5. If `baseURL` ends in a known compat suffix (`/anthropic`, `/coding`, `/api/coding`, `/claude`,
     `/step_plan`, …), strip it and append `/v1/models` then `/models`.
- Walks candidates in order: **200 → parse & return**; **404/405 → try next**; **401/403 → fail
  fast** (bad key); other errors → fail with the body.
- Unit tests confirm: `https://api.siliconflow.cn` → `/v1/models`; `https://api.example.com/v1` →
  `/v1/models`; Zhipu-style `…/paas/v4` → `…/paas/v4/models`.

This is the exact algorithm the health app should replicate.

---

## 3. Unified `listModels(baseURL, apiKey)` — implementation approach

```ts
// src/server/llm.ts
export interface LlmModel { id: string; ownedBy?: string | null }

/** Works across DeepSeek / ModelScope / Zhipu / OpenRouter (and any OpenAI-compat provider). */
export async function listModels(baseURL: string, apiKey: string): Promise<LlmModel[]> {
  if (!apiKey) throw new Error('需要先填写 API Key')

  // 1. Build candidate model-list URLs (cc-switch algorithm).
  const candidates = buildModelsUrlCandidates(baseURL)

  let lastErr: unknown = null
  for (const url of candidates) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      // cf. cc-switch: 15s timeout
      signal: AbortSignal.timeout(15_000),
    })

    // 2. 200 → parse OpenAI shape {data:[{id, owned_by}]}
    if (res.ok) {
      const json = (await res.json()) as { data?: { id: string; owned_by?: string }[] }
      const models = (json.data ?? []).map(m => ({ id: m.id, ownedBy: m.owned_by ?? null }))
      return models.sort((a, b) => a.id.localeCompare(b.id))
    }

    // 3. 401/403 → key bad, fail fast (no point trying other candidates).
    if (res.status === 401 || res.status === 403) {
      throw new Error(`API Key 无效或无权限（HTTP ${res.status}）`)
    }

    // 4. 404/405 → wrong path, try next candidate.
    if (res.status === 404 || res.status === 405) {
      lastErr = new Error(`HTTP ${res.status}`)
      continue
    }

    // 5. Other (5xx, rate-limit, …) → surface immediately.
    throw new Error(`获取模型列表失败：HTTP ${res.status}`)
  }
  throw new Error(`无法获取模型列表（所有候选端点均失败）。原因：${lastErr ?? '未知'}`)
}

function buildModelsUrlCandidates(rawBase: string): string[] {
  const base = rawBase.trim().replace(/\/+$/, '')
  if (!base) throw new Error('Base URL 为空')
  const out: string[] = []

  // baseURL already ends in /v{N} (e.g. /v1, Zhipu …/paas/v4, ModelScope …/v1) → {base}/models
  if (/\/v\d+$/.test(base)) {
    out.push(`${base}/models`)
    if (!base.endsWith('/v1')) out.push(`${base}/v1/models`) // fallback if /v{N}/models 404s
  } else {
    out.push(`${base}/v1/models`)
  }
  return [...new Set(out)] // dedupe, preserve order
}
```

### Per-provider overrides (hardcode in the preset, skip the guessing)

Because this app ships **presets**, each preset should carry an explicit `modelsUrl` so detection
is a single GET (no candidate walk). Only the "custom provider" escape hatch needs the
candidate-builder:

| Preset | `modelsUrl` |
|---|---|
| DeepSeek | `https://api.deepseek.com/models` ⚠️ no `/v1` |
| ModelScope | `https://api-inference.modelscope.cn/v1/models` |
| Zhipu | `https://open.bigmodel.cn/api/paas/v4/models` |
| OpenRouter | `https://openrouter.ai/api/v1/models` (key optional) |
| Custom | `null` → run `buildModelsUrlCandidates(baseURL)` |

Then `listModels` becomes: if preset has `modelsUrl`, GET that one; else run the candidate walk.

### `@ai-sdk/openai` call (unchanged for all 4)

```ts
import { createOpenAI } from '@ai-sdk/openai'
const provider = createOpenAI({ baseURL: preset.baseURL, apiKey, name: preset.id })
generateText({ model: provider.chat(selectedModelId), … })
```
All four `baseURL`s in the table above are the exact value to pass as `baseURL` — the SDK appends
`/chat/completions`.

---

## 4. Recommended provider presets (Settings dropdown)

Hardcode these 4 (matches the product spec's "provider + key" UX). Each entry: `{id, label,
baseURL, modelsUrl, keyUrl, region}`.

```ts
export const LLM_PRESETS = [
  {
    id: 'zhipu',
    label: '智谱 GLM (Zhipu)',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    modelsUrl: 'https://open.bigmodel.cn/api/paas/v4/models',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    region: 'cn',                                   // accessible from mainland China
    defaultModel: 'glm-4.6',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    modelsUrl: 'https://api.deepseek.com/models',   // ⚠️ /models, NOT /v1/models
    keyUrl: 'https://platform.deepseek.com/api_keys',
    region: 'cn',
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'modelscope',
    label: '魔搭 ModelScope (Qwen 等)',
    baseURL: 'https://api-inference.modelscope.cn/v1',
    modelsUrl: 'https://api-inference.modelscope.cn/v1/models',
    keyUrl: 'https://modelscope.cn/my/myaccesstoken',
    region: 'cn',
    defaultModel: 'Qwen/Qwen3-8B',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (聚合, 需海外网络)',
    baseURL: 'https://openrouter.ai/api/v1',
    modelsUrl: 'https://openrouter.ai/api/v1/models', // public, works w/o key
    keyUrl: 'https://openrouter.ai/keys',
    region: 'global',                                 // ⚠️ blocked from mainland China
    defaultModel: 'google/gemini-2.0-flash-exp:free',
  },
] as const
```

Rationale:
- **Zhipu** stays the default (already integrated; best domestic GLM quality; `glm-4.6`/`glm-5.2`).
- **DeepSeek** — cheapest strong reasoning, China-friendly. Note the `/models` (no `/v1`) quirk.
- **ModelScope** — gives Qwen-family open models via Alibaba, free daily quota, China-friendly.
- **OpenRouter** — power-user escape hatch (hundreds of models incl. `:free` tier); only preset
  that needs overseas network from the *user's* browser, but the Worker call always works.
- A **"Custom"** entry lets the user type any OpenAI-compatible `baseURL` + key → runs the
  cc-switch candidate-builder for `/models`.

---

## 5. Primary sources (cited)

- DeepSeek — base URL + Bearer auth + get key: https://api-docs.deepseek.com/
- DeepSeek — `GET /models` endpoint + response shape `{object:"list", data:[{id, object, owned_by}]}`:
  https://api-docs.deepseek.com/api/list-models
- DeepSeek — OpenAI-compatible API guide: https://api-docs.deepseek.com/guides/compatible_api
- ModelScope — API-Inference intro (Access Token from https://modelscope.cn/my/myaccesstoken):
  https://modelscope.cn/docs/model-service/API-Inference/intro (EN: https://modelscope.ai/docs/model-service/API-Inference/intro)
- ModelScope — usage limits (free quota): https://modelscope.ai/docs/model-service/API-Inference/limits
- ModelScope — OpenAI-compatible base `https://api-inference.modelscope.cn/v1` (cross-ref):
  https://models.dev/providers/modelscope · https://voltagent.dev/models-docs/providers/modelscope/
- Zhipu — HTTP API intro (endpoint `https://open.bigmodel.cn/api/paas/v4`, Bearer **or** JWT):
  https://docs.bigmodel.cn/cn/guide/develop/http/introduction
- Zhipu — OpenAI-SDK compatibility page: https://docs.bigmodel.cn/cn/guide/develop/openai/introduction
- Zhipu — `GET …/paas/v4/models` used for key verification (works, Bearer auth): https://github.com/trufflesecurity/trufflehog/issues/4662
- Zhipu — manage API keys: https://open.bigmodel.cn/usercenter/apikeys
- OpenRouter — quick start (base `https://openrouter.ai/api/v1`, Bearer, optional `HTTP-Referer`/`X-Title`):
  https://openrouter.ai/docs/quick-start
- OpenRouter — list-all-models API (response shape `{data:[{id, name, pricing, context_length,…}]}`, public):
  https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties
- OpenRouter — free-model filtering (`:free` suffix / `pricing.prompt==="0"`):
  https://openrouter.ai/openrouter/free · https://gist.github.com/tluyben/1963331b906568cda67c4814b8ed8311
- cc-switch — repo (auto-fetch via OpenAI `/v1/models`): https://github.com/farion1231/cc-switch
- cc-switch — v3.13.0 release notes ("Provider Model Auto-Fetch"): https://newreleases.io/project/github/farion1231/cc-switch/release/v3.13.0
- cc-switch — candidate-URL builder + Bearer `/v1/models` implementation (quoted in §2):
  `src-tauri/src/services/model_fetch.rs`, `src/lib/api/model-fetch.ts`
- OpenAI — canonical `GET /models` shape all four mirror: https://platform.openai.com/docs/api-reference/models/list
