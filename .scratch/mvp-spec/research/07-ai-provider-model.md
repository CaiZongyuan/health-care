# 07 — LLM Provider / Model Selection (DOCTOR-ASSIST follow-up draft summarization)

**Task:** Chinese-language summarization of a patient's recent BP trends + symptoms + medication adherence into a follow-up "draft" the doctor reviews/edits before sending (human-in-the-loop). Web-first MVP. Stack: React + TanStack Start + Vercel AI SDK + Cloudflare. Must be callable from mainland China.
**Date gathered:** 2026-07. All pricing verified against primary sources where possible; see citations.

---

## TL;DR Recommendation

- **PRIMARY: Qwen `qwen-plus` (Qwen3, non-thinking mode) via the official `@ai-sdk/alibaba` provider**, with `baseURL` pointed at the DashScope **mainland** endpoint (`https://dashscope.aliyuncs.com/compatible-mode/v1`).
  - Officially supported by the AI SDK, directly callable from mainland China, best-in-class Chinese, ~**¥0.0008/1k input · ¥0.002/1k output** (≈ $0.11 / $0.28 per 1M tokens), 1M-token context, native prompt caching, JSON/structured output + tool calls.
  - Strategic bonus: Alibaba Bailian (DashScope) hosts **Qwen + DeepSeek + GLM + Kimi under one OpenAI-compatible endpoint in the mainland (北京) region**, so swapping the underlying model later is a one-line model-ID change with no provider rewrite.
- **FALLBACK: DeepSeek `deepseek-v4-flash` (non-thinking) / `deepseek-chat` via the official `@ai-sdk/deepseek` provider** (endpoint `https://api.deepseek.com`).
  - DeepSeek is a Hangzhou-registered Chinese company; `api.deepseek.com` is fully reachable from the mainland. Top-rated by senior physicians in Beijing Friendship Hospital's 2026 AI diagnostic eval. Official AI SDK provider. ~**$0.14 / 1M input (cache-miss) · $0.28 / 1M output**, cache-hit input drops to **$0.0028 / 1M**.

Both choices satisfy all three hard constraints (China-reachable, AI-SDK-native, strong Chinese-medical quality at low cost). The other five candidates fall short on at least one axis (see table).

---

## Per-provider comparison

| Provider (model) | Mainland-China access | AI SDK provider | Price (per 1M tokens, input / output) | Chinese-medical quality notes | Fit |
|---|---|---|---|---|---|
| **Qwen / 通义千问** (`qwen-plus`, Qwen3) | **Yes** — DashScope mainland endpoint `dashscope.aliyuncs.com/compatible-mode/v1` (北京 region) | **Official `@ai-sdk/alibaba`** | ¥0.8 / ¥2 (≈ $0.11 / $0.28); cache + Batch halves available | Excellent general Chinese; preferred by junior physicians in Beijing Friendship Hospital eval; strong instruction-following + JSON output | **PRIMARY** |
| **DeepSeek** (`deepseek-v4-flash` / `deepseek-chat`) | **Yes** — China company (杭州深度求索); `api.deepseek.com` reachable; +86 phone needed to register | **Official `@ai-sdk/deepseek`** | $0.14 / $0.28 (cache-miss); cache-hit input $0.0028 | Preferred by senior physicians in Friendship Hospital eval; strong causal reasoning on symptoms | **FALLBACK** |
| **智谱 GLM** (`glm-4.6`) | Yes — `bigmodel.cn` (mainland) or Z.AI overseas; also hosted on Bailian | **Community only** (`Xiang-CH/zhipu-ai-provider`) or OpenAI-compatible; on Vercel AI Gateway | Mainland: ¥3 / ¥14 (≈ $0.42 / $1.94); Z.AI overseas ~$1.4/1M in | Strong Chinese + agent/tool use; built-in 安全审核 safety audit | OK but no official SDK pkg; prices rose 67–100% Feb 2026 |
| **Moonshot / Kimi** (`kimi-k2.5`) | Yes — `platform.kimi.ai`; also on Bailian | **Official `@ai-sdk/moonshotai`** (per docs page; some community trackers still open) | $0.60 / $3.00 (K2.5); cache-hit $0.10 | Excellent Chinese; tuned for agentic/tool/coding more than plain summarization | Good but pricier; overkill for summarization |
| **豆包 Doubao** (ByteDance Volcengine Ark) | Yes — Volcengine Ark `/v1` OpenAI-compatible endpoint | **No official/community pkg** — use `@ai-sdk/openai-compatible` | Seed-2.0 Pro ~¥3.2 / ¥16 (≈ $0.47 / $2.37); Lite ~¥0.6 / ¥3.6 | Decent Chinese; medical-content posture less documented; 2026 API pricing not published | Usable but weakest SDK ergonomics; pricing opaque |
| **OpenAI** (GPT-5.x via proxy/Azure) | **No** — direct API blocked in mainland + HK; Azure OpenAI individual signup closed (enterprise-only with qualification) | Official `@ai-sdk/openai` | $1–5+ / 1M depending on tier | Strong but adds compliance + ToS risk via proxies | **Rejected for mainland MVP** |
| **Cloudflare Workers AI** (hosted Qwen/DeepSeek) | **Poor** — `workers.dev` blocked in mainland; no mainland PoPs; routes to HK (unreliable latency) | Official `workersai` binding / `@ai-sdk/cloudflare` | $0.011 / 1k Neurons (model-dependent) | Inherits hosted model quality | Good infra fit but China reach is the blocker; consider only if egress is overseas |

---

## Provider deep-dives (with primary sources)

### 1. Qwen / 通义千问 (Alibaba DashScope / Bailian) — RECOMMENDED PRIMARY
- **Access from China:** Bailian (百炼) is Alibaba's domestic model platform; mainland region is **中国大陆（北京）**. OpenAI-compatible endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1`. The official AI SDK provider defaults to the international endpoint (`dashscope-intl.aliyuncs.com`) but explicitly supports a `baseURL` override for regional endpoints — point it at the mainland host. ([ai-sdk.dev/providers/ai-sdk-providers/alibaba](https://ai-sdk.dev/providers/ai-sdk-providers/alibaba))
- **AI SDK:** Official `@ai-sdk/alibaba`. Supports `qwen-plus`, `qwen3-max`, `enableThinking` / `thinkingBudget`, prompt caching (implicit + explicit `cacheControl`), structured output, tool calls. ([AI SDK providers list](https://ai-sdk.dev/providers/ai-sdk-providers))
- **Pricing (mainland, per 1k tokens, source aliyun.com):**
  - `qwen-plus` (Qwen3, non-thinking, ≤128K input): **¥0.0008 in / ¥0.002 out** (≈ $0.11 / $0.28 per 1M)
  - `qwen-flash` (Qwen3, ≤128K): **¥0.00015 in / ¥0.0015 out** (≈ $0.021 / $0.21 per 1M) — even cheaper, good for high-volume simple summaries
  - `qwen3-max` (≤32K): ¥0.0032 in / ¥0.0128 out (≈ $0.44 / $1.78 per 1M) — reserve for hard cases
  - `qwen-long` (10M context): ¥0.0005 in / ¥0.002 out — if you ever sum up very long histories
  - New accounts get ~1M free tokens per model (90-day window). ([Bailian models & pricing](https://help.aliyun.com/zh/model-studio/getting-started/models), [pricing](https://help.aliyun.com/zh/model-studio/model-pricing))
- **One-endpoint multiplier:** Bailian's mainland region also serves third-party **DeepSeek** (`deepseek-v3.2-exp` ¥0.002/¥0.003; `deepseek-r1` ¥0.004/¥0.016), **GLM** (`glm-4.6` ¥0.003/¥0.014 ≤32K), and **Kimi** (`kimi-k2-thinking` ¥0.004/¥0.016). So you can A/B models behind one `@ai-sdk/alibaba` config.
- **Chinese-medical quality:** Among Chinese LLMs, Qwen-Max was the model junior physicians most preferred in Beijing Friendship Hospital's first large-scale AI medical-diagnosis evaluation (2026). ([Sina Finance coverage](https://finance.sina.cn/stock/jdts/2026-07-18/detail-iniiftix8272948.d.html))

### 2. DeepSeek — RECOMMENDED FALLBACK
- **Access from China:** DeepSeek is operated by **杭州深度求索人工智能基础技术研究有限公司** (Hangzhou, founded 2023, backed by 幻方量化). `api.deepseek.com` is a China-hosted endpoint, fully reachable from the mainland. Note: new platform registration now requires a **+86 mobile number** (email-only signup disabled). ([deepseek.com](https://www.deepseek.com/))
- **AI SDK:** Official `@ai-sdk/deepseek`. Model IDs: `deepseek-chat` (non-thinking) / `deepseek-reasoner` (thinking) — these aliases are being deprecated **2026-07-24** in favor of `deepseek-v4-flash` (non-thinking default) / `deepseek-v4-pro`. ([ai-sdk.dev/providers/ai-sdk-providers/deepseek](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek), [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/))
- **Pricing (USD, source api-docs.deepseek.com):**
  - `deepseek-v4-flash`: **$0.14 / 1M input (cache-miss) · $0.0028 / 1M (cache-hit) · $0.28 / 1M output**. 1M context, 384K max output.
  - `deepseek-v4-pro`: $0.435 / 1M in (miss) · $0.87 / 1M out.
  - New accounts get a free token grant (~5M tokens reported).
- **Chinese-medical quality:** Senior physicians preferred **DeepSeek-R1** (and GPT-4o) in the Beijing Friendship Hospital diagnostic eval — strong reasoning over symptoms/labs. ([Beijing Daily coverage](https://xinwen.bjd.com.cn/content/s6a571ab4e4b0e45f3fd4a8fc.html))
- **Catch:** DeepSeek occasionally experiences capacity strain during viral spikes; the Bailian-hosted mirror is a good redundant route.

### 3. 智谱 GLM (Zhipu / Z.AI)
- **Access:** Mainland via `bigmodel.cn`; overseas via Z.AI (`docs.z.ai`). Also hosted on Alibaba Bailian (mainland) and on Vercel AI Gateway.
- **AI SDK:** **No official package.** Options: community `Xiang-CH/zhipu-ai-provider` (supports AI SDK 6 / `LanguageModelV3`), or the OpenAI-compatible provider with Zhipu's base URL, or Vercel AI Gateway. ([AI SDK providers list](https://ai-sdk.dev/providers/ai-sdk-providers) — GLM absent)
- **Pricing:** Mainland `glm-4.6` (≤32K) ¥0.003 in / ¥0.014 out per 1k (≈ $0.42 / $1.94 per 1M). Z.AI overseas ~$1.4/1M input. Zhipu raised API prices 67–100% and subscriptions 30–60% around the Feb 2026 GLM-5 overseas launch. ([bigmodel.cn/pricing](https://bigmodel.cn/pricing))
- **Policy:** Explicit built-in 安全审核机制 (safety audit) layer on outputs. ([docs.bigmodel.cn content safety](https://docs.bigmodel.cn/cn/guide/platform/securityaudit))
- **Verdict:** Strong model, but no official AI SDK provider and recent price hikes make it a secondary fallback only.

### 4. Moonshot / Kimi
- **Access:** `platform.kimi.ai` (mainland-reachable); also on Bailian.
- **AI SDK:** Official provider page exists at `ai-sdk.dev/providers/ai-sdk-providers/moonshotai`; model IDs `kimi-k2.5`, `kimi-k2-thinking`. A GitHub tracking issue (#12224) suggests the dedicated npm package is still being formalized — the OpenAI-compatible provider is the common fallback. ([Moonshot AI provider docs](https://ai-sdk.dev/providers/ai-sdk-providers/moonshotai))
- **Pricing:** `kimi-k2.5` **$0.60 / 1M in · $3.00 / 1M out** (cache-hit $0.10). Legacy `moonshot-v1-8k` $0.20/1M. ([platform.kimi.ai/docs/pricing](https://platform.kimi.ai/docs/pricing/chat-v1))
- **Verdict:** Excellent Chinese, but ~5–10× the cost of Qwen-Plus/DeepSeek for a plain summarization task, and more agentic/tool-oriented than this use case needs.

### 5. 豆包 Doubao (ByteDance Volcengine Ark)
- **Access:** Volcengine Ark (火山方舟) exposes an OpenAI-compatible `/v1/chat/completions` endpoint; reachable from mainland. Third-party proxies (302.ai etc.) also proxy it.
- **AI SDK:** **No official/community package.** Must use `@ai-sdk/openai-compatible` with a custom `baseURL` + Ark API key. ([AI SDK OpenAI-compatible providers](https://ai-sdk.dev/providers/openai-compatible-providers))
- **Pricing:** Doubao-Seed-2.0 Pro ~¥3.2 / ¥16 per 1M (≈ $0.47 / $2.37); Lite ~¥0.6 / ¥3.6; Mini ~¥0.2 / ¥2. **2026-specific API token pricing not officially published** — Seed-2.0 structure still authoritative. ([volcengine.com/docs/82379/1544106](https://www.volcengine.com/docs/82379/1544106), [Doubao product page](https://www.volcengine.com/product/doubao))
- **Verdict:** Cheap-ish but weakest SDK ergonomics (no native provider) and opaque/2025-era pricing. Skip for MVP.

### 6. OpenAI (via proxy / Azure OpenAI)
- **Access from China:** Direct `api.openai.com` is **blocked in mainland China and Hong Kong**. Microsoft closed Azure OpenAI for **individual** mainland users; only **enterprise** Azure OpenAI with qualification is allowed. Hong Kong Azure still works. Unofficial proxies violate OpenAI ToS. ([SCMP](https://www.scmp.com/tech/big-tech/article/3283259/microsoft-closes-azure-subscription-individuals-access-openai-mainland-china), [Mashable](https://mashable.com/article/openai-plans-block-api-access-china-chinese-ai-companies-moving-in-to-replace))
- **Verdict:** **Rejected for a mainland MVP.** Only reconsider if the deployment moves overseas or enterprise Azure qualification is in hand.

### 7. Cloudflare Workers AI
- **Access from China:** `workers.dev` domain is **DNS-blocked in mainland China**; Cloudflare has **no mainland PoPs** for Workers AI (requests route to Hong Kong / nearby Asia), giving unpredictable latency. Custom domains help but IP-level blocks still occur. ([Cloudflare community threads](https://community.cloudflare.com/t/cloudflare-worker-blocked-by-openai/804750))
- **Models:** Hosts DeepSeek-R1, Qwen, etc. Priced at **$0.011 / 1,000 Neurons** (model-dependent). ([Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [models](https://developers.cloudflare.com/workers-ai/models/))
- **Verdict:** Architecturally tempting (same Cloudflare stack as the app), but mainland reach is the dealbreaker for user-facing calls. Acceptable only for non-China egress or internal batch jobs.

---

## How to call from the Vercel AI SDK

### Primary — Qwen `qwen-plus` via `@ai-sdk/alibaba` (mainland endpoint)

```bash
pnpm add ai @ai-sdk/alibaba
```

```ts
// lib/doctor-assist.ts
import { createAlibaba } from '@ai-sdk/alibaba';
import { generateText } from 'ai';

// Point at the MAINLAND DashScope endpoint (default is the intl/SG host).
const alibaba = createAlibaba({
  apiKey: process.env.DASHSCOPE_API_KEY!, // Bailian API key
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

export async function draftFollowUp(patientContext: string) {
  const { text } = await generateText({
    // qwen-plus = Qwen3, non-thinking mode: cheap, fast, great Chinese.
    // Bump to 'qwen3-max' for hard cases; 'qwen-flash' for high volume.
    model: alibaba('qwen-plus'),
    system: FOLLOW_UP_SYSTEM_PROMPT, // see compliance notes below
    prompt: patientContext,          // BP trends + symptoms + adherence
  });
  return text;
}
```

### Fallback — DeepSeek via `@ai-sdk/deepseek`

```bash
pnpm add ai @ai-sdk/deepseek
```

```ts
import { deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';

export async function draftFollowUpDeepSeek(patientContext: string) {
  const { text } = await generateText({
    // deepseek-chat (→ deepseek-v4-flash non-thinking) after 2026-07-24.
    // Use 'deepseek-reasoner' for thinking mode on hard cases.
    model: deepseek('deepseek-chat'),
    system: FOLLOW_UP_SYSTEM_PROMPT,
    prompt: patientContext,
  });
  return text;
}
```

**Switching strategy:** Because Bailian also hosts DeepSeek/GLM/Kimi behind the same DashScope endpoint, you can keep a single `@ai-sdk/alibaba` provider and just rotate the model ID (`'qwen-plus'` → `'deepseek-v3.2-exp'` → `'glm-4.6'`) as a runtime config — no second provider dependency needed for the in-China path. Use the dedicated `@ai-sdk/deepseek` only if you want DeepSeek's own endpoint/billing as an independent fallback.

---

## Medical-content compliance notes (China)

- **The use case is well-positioned.** The model only **summarizes** structured patient data into a draft that a licensed physician reviews, edits, and signs. The 《互联网诊疗监管细则（试行）》(2022) prohibits AI from **replacing** a physician in diagnosis/prescription — a human-in-the-loop draft avoids that prohibition. ([Lexology analysis](https://www.lexology.com/library/detail.aspx?g=1b38c0f1-59ce-4d4d-838b-00c763251930))
- **Hard line to respect:** Hunan province (Feb 2025) explicitly banned internet hospitals from using AI (e.g. DeepSeek) to **auto-generate prescriptions**. Do not let the model emit prescriptions or dosages directly; keep medication output to "adherence summary" only. ([Chinanews](https://www.chinanews.com.cn/sh/2025/02-25/10373772.shtml))
- **Provider behavior:** Chinese LLMs (DeepSeek, Qwen, GLM) routinely append 免责声明 ("仅供参考，不能替代专业医师诊断") and may refuse direct diagnosis/dosage requests. Frame the system prompt as **summarization for a clinician**, not patient-facing advice, to avoid refusals. (Zhipu's platform-level 安全审核 is the most explicit: [docs.bigmodel.cn](https://docs.bigmodel.cn/cn/guide/platform/securityaudit))
- **Filing (备案):** Public-facing generative-AI services in China require CAC filing under the 《生成式人工智能服务管理暂行办法》 (effective 2023-08-15). Using a provider's already-filed API (Qwen, DeepSeek, GLM all have CAC-filed services) generally covers the model layer, but the **application itself** as an internet-health tool will need its own compliance review — flag for legal. ([CAC measures](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm))
- **Prompt guardrails (recommended system-prompt shape):**
  1. "You are drafting a follow-up summary FOR A LICENSED PHYSICIAN'S REVIEW. Do not diagnose or prescribe."
  2. "Only summarize the provided BP/symptom/adherence data; flag missing or contradictory values; never fabricate numbers or medication names."
  3. "Output in structured Chinese: 趋势概述 / 异常提示 / 依从性 / 建议随访要点."

---

## Decision points still needing the human

1. **Deployment region for the app itself.** If the web app is served from outside mainland China (e.g. Vercel global / Cloudflare), then API egress to DashScope/DeepSeek is fine, but you trade off user-facing latency vs. compliance posture. Confirm where the backend runs. → Affects whether Cloudflare Workers AI becomes viable and whether you need a domestic ICP-filed domain.
2. **qwen-plus vs qwen-flash default.** `qwen-flash` is ~5× cheaper on input and fine for straightforward summaries; `qwen-plus` is higher quality for ambiguous symptom text. Pilot both on 50–100 real (de-identified) cases and compare doctor edit-distance.
3. **Single-vendor (Bailian) vs dual-vendor resilience.** Routing everything through `@ai-sdk/alibaba` + Bailian is simplest and lets you swap models trivially, but creates one billing/quota dependency. Adding `@ai-sdk/deepseek` as a true second endpoint is cheap insurance — decide if MVP needs it.
4. **Thinking mode on/off.** Non-thinking (`qwen-plus`, `deepseek-v4-flash` non-thinking) is right for fast cheap drafts. Thinking mode (`enableThinking`, `deepseek-reasoner`) costs ~10× on output but may catch subtle contraindications. Default off; offer as a "deep review" toggle for the doctor?
5. **Compliance/legal sign-off.** Confirm whether the app needs its own CAC filing and internet-hospital qualification, and have counsel bless the system-prompt framing and the "doctor must edit + sign" control before launch.

---

## Key sources
- AI SDK providers (official): https://ai-sdk.dev/providers/ai-sdk-providers
- Alibaba provider docs: https://ai-sdk.dev/providers/ai-sdk-providers/alibaba
- DeepSeek provider docs: https://ai-sdk.dev/providers/ai-sdk-providers/deepseek
- DeepSeek pricing: https://api-docs.deepseek.com/quick_start/pricing/
- Bailian models & pricing: https://help.aliyun.com/zh/model-studio/getting-started/models , https://help.aliyun.com/zh/model-studio/model-pricing
- Zhipu pricing: https://bigmodel.cn/pricing ; Zhipu content safety: https://docs.bigmodel.cn/cn/guide/platform/securityaudit
- Moonshot pricing: https://platform.kimi.ai/docs/pricing/chat-v1
- Doubao/Volcengine pricing: https://www.volcengine.com/docs/82379/1544106
- Workers AI pricing/models: https://developers.cloudflare.com/workers-ai/platform/pricing/ , https://developers.cloudflare.com/workers-ai/models/
- OpenAI/Azure China blocks: https://www.scmp.com/tech/big-tech/article/3283259/microsoft-closes-azure-subscription-individuals-access-openai-mainland-china
- 生成式AI服务管理暂行办法 (CAC): https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm
- 互联网诊疗监管细则 analysis: https://www.lexology.com/library/detail.aspx?g=1b38c0f1-59ce-4d4d-838b-00c763251930
- Hunan AI-prescription ban: https://www.chinanews.com.cn/sh/2025/02-25/10373772.shtml
- Beijing Friendship Hospital AI eval: https://finance.sina.cn/stock/jdts/2026-07-18/detail-iniiftix8272948.d.html
