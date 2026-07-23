# 02 — MVP 前端载体：Web 优先 + API-first 为小程序留路

Type: grilling
Status: resolved
Blocked by: none

## Question

MVP 的前端载体选哪个？决定整个技术框架和能否复用已选的 web 栈（TanStack Start + Cloudflare + shadcn）。

## Answer

**Web/PWA 优先，后端 API-first，为微信小程序留路。**

- MVP 用 web/PWA 验证产品闭环，直接复用 React / TanStack Start / Cloudflare / shadcn。
- 强制约束：核心业务逻辑与数据通过后端 API 暴露，**不与 web 前端耦合**；未来微信小程序对接同一套后端 API，无需重写领域层。
- **已知验证风险**（写入 map）：国内老年患者走 web 门槛偏高。MVP 验证阶段先从"会用手机的患者 + 家属代记意向"场景切入；接受小程序是真正的分发形态，并据此规划迁移（见 Out of scope）。
- 解锁：技术运行时研究（06）、数据层（08）、认证（09）都基于"web on Cloudflare + API-first"展开。
