# 13 — 医生-患者对话：实时 vs 异步（MVP）

Type: grilling
Status: resolved
Blocked by: none

## Question

原型"医生"Tab 是一个对话界面。MVP 里医患沟通做成**实时（WebSocket / Cloudflare Durable Objects）**还是**异步消息（请求-响应 + 轮询/SSE 刷新）**？

- 倾向推荐：MVP 用**异步**——医生在工作台回复，患者端拉取/刷新或 SSE。理由：实现简单、贴合"医生非实时随访"的真实节奏、避免 DO 复杂度。
- 实时只在"医生在线咨询"成为核心场景时才值得。

决策后解锁：消息数据模型、是否引入 Durable Objects、前端轮询/SSE 策略。依赖 06（运行时）与 08（数据层）的研究结论交叉确认。

## Answer

**延后到多用户阶段。** 个人自用 MVP 无医患双端，对话形态无从谈起。Out of scope for 本 effort（见 map）。届时再定实时(DO) vs 异步。
