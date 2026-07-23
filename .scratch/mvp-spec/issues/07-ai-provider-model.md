# 07 — AI 提供方/模型选择（国内可访问 + Cloudflare + AI SDK）

Type: research
Status: resolved
Blocked by: none

## Question

随访草稿生成（04）需要中文医学文本摘要能力。哪个 LLM 提供方/模型适合？

- 约束：(a) 中国大陆可访问（或经 Cloudflare 中转）；(b) 兼容 Vercel AI SDK 的 provider 接口；(c) 中文医学文本摘要质量与成本合适。
- 候选：通义千问/Qwen（阿里）、豆包/Doubao（字节）、智谱 GLM、Moonshot/Kimi、DeepSeek、经代理的 OpenAI、Cloudflare Workers AI。
- 关注：国内调用链路、价格、是否有 AI SDK 社区 provider、医疗内容的输出策略/免责。

产出：`research/07-ai-provider-model.md`（一手来源 + 引用）。需给出推荐模型 + 调用方式 + 仍需人类拍板的点。

## Research findings

详见 [`research/07-ai-provider-model.md`](../research/07-ai-provider-model.md)。

**候选评估**（一手来源：ai-sdk.dev provider 索引、阿里云百炼、DeepSeek、智谱、Kimi、火山、Cloudflare、CAC/SCMP）：只有 **3 个同时有官方 AI SDK provider 且大陆可达** —— Qwen（`@ai-sdk/alibaba`）、DeepSeek（`@ai-sdk/deepseek`）、Moonshot（`@ai-sdk/moonshotai`）。GLM、豆包无官方包；**OpenAI 与 Cloudflare Workers AI 在大陆基本不可达/不可靠**。

> 注：与票据 06"Workers AI/OpenAI 是 happy path"的前提在**大陆网络下冲突**——结论是 AI SDK 在 Workers 上能跑（06 成立），但模型端点要打**国内可达的**（07）。两者不矛盾，只是把 happy-path 模型换成国内模型。

**推荐（待人类拍板）**：
- **主模型 = Qwen `qwen-plus`（Qwen3，非 thinking）**，经 `@ai-sdk/alibaba` 指向 DashScope 大陆端点（`dashscope.aliyuncs.com/compatible-mode/v1`）：≈¥0.0008/¥0.002 每 1k token（≈$0.11/$0.28 每 1M）、1M 上下文、prompt caching；百炼同端点还托管 DeepSeek/GLM/Kimi，换模型只是改一行 ID。
- **备选 = DeepSeek `deepseek-v4-flash` / `deepseek-chat`**（`@ai-sdk/deepseek`）：国内公司、医生评价高、≈$0.14/$0.28 每 1M。

**合规利好**：医生在回路（草稿供医生审核）正好规避《互联网诊疗监管细则》对"AI 替代医师"的禁令；约束：**不可自动开处方**（湖南先例）、应用大概率需 **CAC 备案**、系统提示须框定为"供临床医生审核的草稿"。

**仍需人类拍板**：①应用部署区域（影响 Cloudflare 可行性 + 延迟，与 06/08 联动）；②先 qwen-plus 还是 qwen-flash 试跑；③单厂商百炼 vs 双端点容灾；④thinking 模式默认开关；⑤备案 + 系统提示的法律签字。

## Answer（用户决策）

**AI 提供方 = 智谱 GLM，走 GLM Coding Plan。**

- 用户已有智谱 GLM Coding Plan（含 API key），故选 Zhipu 而非研究推荐的 Qwen——**用户的成本/可得性优先于"官方 provider 包"这一项**。
- **集成方式**：智谱提供 **OpenAI 兼容端点** `https://open.bigmodel.cn/api/paas/v4/`，用 Vercel AI SDK 的 `@ai-sdk/openai` + `createOpenAI({ baseURL, apiKey })` 即可，**不需要官方 `@ai-sdk/zhipu` 包**（研究中"GLM 无官方包"的问题由此绕过）。
- **模型**：取 Coding Plan 覆盖的最新可用（GLM-4.6 / GLM-4.5 / glm-4-plus），实现时确认 plan 内具体模型 ID。
- 沿用约束：医生在回路、不可自动开方、系统提示框定为"供审核的草稿"。
- 海外 CF Workers 调用国内智谱端点：公网可达，有跨境延迟但可用；首周在已部署 Worker 上验证流式（与 06 联动）。
