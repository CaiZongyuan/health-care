# 09 — 认证方案（B2C 老年友好 + 未来小程序统一）

Type: research
Status: resolved
Blocked by: none

## Question

B2C 移动 web 健康应用，面向老年患者，且未来要和微信小程序**统一身份**，MVP 用哪种认证？

- 候选：手机号 + 短信验证码、微信网页授权（web OAuth）、邮箱密码、passkey。
- 关注：老年用户易用性、国内短信网关要求与成本、web 与未来小程序如何统一身份（unionid/openid 怎么映射）。
- 库：在 TanStack Start + Cloudflare 上可用的方案（better-auth / Auth.js / 自研）。

产出：`research/09-auth.md`（一手来源 + 引用）。需给出推荐 + 仍需人类拍板的决策点（研究→决策）。

## Research findings

详见 [`research/09-auth.md`](../research/09-auth.md)。

**排除**：邮箱、passkey —— 对国内老年用户不友好、且对微信身份统一无用。微信网页授权在微信内对老年友好，但需**已认证服务号**（¥300/年 + 企业资质）且只覆盖微信浏览器用户。Lucia 已弃用（2025）；Auth.js v5 在 TanStack Start 上不地道；better-auth 插件齐全但有多个 Cloudflare Workers 兼容 bug（请求取消、CPU 限制、nodejs_compat）。

**推荐（待人类拍板）**：
- **主认证 = 手机号 + 短信验证码**（≈¥0.045/条，签名 + 模板审核 ~24h / 2–4h；老年优化：验证码自动填充 + 大号输入）。
- **库 = D1 里自研薄 session + 签名 HttpOnly cookie**（Workers 风险最低；中国特有流程本就要手写）。若团队想要库，则选 better-auth。
- **身份统一（关键）= 以 `phone` 为唯一主键**。web OAuth 与小程序的 openid 不同，unionid 只在共用"微信开放平台"绑定下才统一两者——所以 unionid 对"微信浏览器内静默 SSO"是加分项，**不是上线前提**。未来小程序 `getPhoneNumber`（¥0.04/次）与 web 的短信 OTP 都产出经验证手机号 → 同一 `users.phone` → 同一账号，上线无需任何微信前置。`unionid` / `mp_openid` / `web_openid` 作为副索引，随各端上线逐步填充。

**仍需人类拍板**：①服务号是否可得；②开放平台/unionid 现在绑还是以后；③短信厂商选谁 + 用谁的**企业实名资质**背书签名；④库选型（自研 vs better-auth）；⑤医生是否同样走手机 OTP；⑥小程序 `getPhoneNumber` ¥0.04/次 成本是否接受。

## Answer（用户决策）

**MVP 不做认证，直接进入（个人自用 / 单用户模式）。**

- 因"自己使用"，MVP 单用户、无登录、打开即用。手机号 + 短信 OTP 与 `phone` 统一身份的方案**完整保留**在 `research/09-auth.md`，作为**未来多用户阶段**的实现方案，本轮不实现。
- 解锁：账号/会话暂不需要；数据归属当前单一用户。
- **连带影响**：无认证 + 单用户下，医生工作台（03）、患者-医生关联（12）、医患对话（13）失去原有多用户立足点——见 map 调整与下文，倾向整体延后到多用户阶段。
