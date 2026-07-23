# 09 — Auth approach for 健康随访管家 MVP

**Status:** research → decision (open questions at the bottom)
**Date:** 2026-07-23
**Scope:** B2C health-tracking app, China, mobile-web first (React + TanStack Start + Cloudflare Workers). Users = ELDERLY patients + self-associated family doctors. Identity must later unify with a future WeChat mini-program (same person, same account).

---

## TL;DR recommendation

- **MVP primary auth = phone number + SMS OTP.** It is the only option that is elderly-usable, works for doctors, runs on the open web (not just inside WeChat), AND gives a stable cross-platform identity key with **no WeChat prerequisites**.
- **Identity unification strategy = phone number as the canonical user key.** The future mini-program's `getPhoneNumber` and the web's SMS OTP both produce a verified phone → same `users.phone` → same account. Optionally layer `unionid` later for WeChat-in-browser silent login (requires 服务号 + 小程序 bound to one 微信开放平台 account). See [§ Cross-platform identity unification](#cross-platform-identity-unification-the-crux).
- **Library = lean custom session in D1 + signed cookie/JWT**, because (a) better-auth has open Cloudflare-Workers compatibility bugs, (b) every China-specific flow (SMS send/verify, WeChat 网页授权, mini-program `code2session`, `getPhoneNumber`, unionid mapping) is hand-wired anyway. If the team wants a library, **better-auth** is the best candidate (official TanStack Start integration, phone-OTP plugin, native D1). See [§ Library recommendation](#library-recommendation-for-the-stack).

---

## Per-option analysis

### 1. Phone number + SMS verification code — RECOMMENDED (primary)

| Dimension | Finding |
|---|---|
| Elderly usability | Best universal option. Phone ownership is near-universal; SMS OTP is a familiar mental model in China. Main friction: app-switching to read the SMS and retyping the code. Mitigate with auto-fill (Android `OneTime` / `OTP` autocomplete attribute), large input fields, 60s resend. |
| China SMS gateway | Requires **签名 (signature) + 模板 (template) review** on 阿里云/腾讯云. Signature review ≈ **24h**, template review ≈ **2–4h**, review hours 09:00–21:00 daily. 个人实名 only allows 验证码 + 通知短信 (no marketing); 企业实名 recommended. Must hold a 企业资质 whose name matches the signature. |
| Cost | **阿里云验证码 ≈ ¥0.045/条** (¥0.055 marketing). 腾讯云 comparable, slightly cheaper per-msg in bulk packs (~¥0.036–0.04). Mini-program `getPhoneNumber` is **¥0.04/次** (see below). |
| Identity unification | **Phone is the cross-platform anchor.** Works on open web and inside WeChat; needs no 微信开放平台 binding. |
| Risk | SMS delivery can be filtered/delayed by carriers; 阿里云 offers a 验证码兜底 (fallback) solution. Rate-limit hard (per-number + per-IP). |

Sources:
- 阿里云短信 计费/审核规则 — https://help.aliyun.com/zh/sms/getting-started/get-started-with-sms
- 阿里云 国内短信收费 — https://help.aliyun.com/zh/sms/product-overview/billing-of-messages-sent-to-chinese-mainland
- 阿里云 验证码兜底方案 — https://help.aliyun.com/zh/sms/user-guide/unified-verification-code-solution
- 腾讯云 短信使用须知 — https://cloud.tencent.com/document/product/382/13444
- 腾讯云 短信价格总览 — https://cloud.tencent.com/document/product/382/36132

### 2. WeChat web OAuth (网页授权) — OPTIONAL convenience layer (inside WeChat only)

| Dimension | Finding |
|---|---|
| Elderly usability | Best-in-class **when the user is already inside WeChat's browser**: one tap, no typing. Useless outside WeChat (regular mobile browsers, desktop). The app is "mobile-web first", so OAuth alone does not cover the whole audience. |
| Prerequisites (heavy) | **Only 已认证服务号 (verified Service Account) can do 网页授权.** 订阅号 and unverified accounts cannot. 服务号认证 = **¥300/年**, requires 企业/组织资质 (营业执照). Must also configure the 网页授权域名 in 公众平台 → 设置与开发 → 功能设置. |
| Scopes | `snsapi_base` = silent, returns only openid. `snsapi_userinfo` = consent popup, returns nickname/avatar and (if bound) unionid. Since 2022 微信 snapshots/freezes pages that auto-fire `snsapi_userinfo` without a user gesture — must trigger from a tap. |
| Identity unification | Returns an **openid that is DIFFERENT from the mini-program openid** (openid is per-appid). Unifies with the mini-program only via `unionid`, and only if the 服务号 + 小程序 are bound to the **same 微信开放平台 account**. `unionid` is returned **only for `snsapi_userinfo`** (not `snsapi_base`), and only once the 服务号 is bound to 开放平台. |

Verdict: valuable *add-on* for the "patient opens link from inside WeChat" flow, but it cannot be the sole MVP auth because (a) it excludes non-WeChat browsers and (b) it carries a ¥300/年 + 企业资质 + 开放平台-binding tax before it yields a unifiable identity. Layer it **on top of** phone-OTP after the 服务号 is certified.

Sources:
- 微信网页授权 (服务号文档) — https://developers.weixin.qq.com/doc/service/guide/h5/auth.html
- UnionID 机制说明 — https://developers.weixin.qq.com/doc/service/guide/product/unionid.html
- 微信认证费用说明 — https://developers.weixin.qq.com/minigame/product/renzheng.html

### 3. Email + password — REJECT for this audience

- Poor fit for elderly Chinese patients: low email penetration, password recall/management is a known failure point for this group (industry data: only ~8% of 60+ users fluently use phone-app "elderly modes"; complex interaction/cognition is the top barrier). Doctors in China likewise live in WeChat/phone, not email.
- Minimal China regulatory burden, but it provides **no help** unifying with the WeChat mini-program.
- Keep optional for internal/admin logins only; not a patient-facing MVP path.

Sources:
- 银发网民/老年数字鸿沟 — http://www.crca.cn/index.php/13-agednews/738-1-19.html , http://www.news.cn/20251229/d24310f9c203463185e6cb31bb6c46ff/c.html

### 4. Passkeys / WebAuthn — REJECT for MVP

- Theoretically "easier" (no password), but in practice enrollment, device transfer, and recovery are deeply confusing for elderly users and there is no established mental model in this demographic. Support on the older/lower-end Android devices common among elderly users is inconsistent.
- Device-bound credentials do **not** help unify identity across web ↔ mini-program.
- Reserve as a future hardening option for the doctor cohort once the base session layer exists. Not an MVP path.

---

## Cross-platform identity unification (THE CRUST)

**The core problem:** WeChat issues `openid` per-appid. The same person gets **different** openids from (a) 服务号 网页授权 and (b) the mini-program. So openid cannot be the shared key.

**Two unifiers exist:**

| Key | Scope | Prerequisite | Notes |
|---|---|---|---|
| `unionid` | All apps bound to one 微信开放平台 account | 服务号 + 小程序 bound to **same 开放平台** (开发者资质认证 ¥300/次, 企业主体); also 服务号 must use `snsapi_userinfo` scope | WeChat-only; gives the seamless "already-logged-in inside WeChat" experience. |
| **phone number** | Everywhere (web SMS OTP + mini-program `getPhoneNumber` + any future app) | None (just an SMS gateway +, for mini-program, a 认证主体) | The only key that works on the open web AND inside WeChat with zero 开放平台 dependency. |

**Recommended model — phone-first, unionid-secondary:**

```
                       users (canonical)
                       ─────────────────────────
   id  (uuid, pk)
   phone  (unique, NOT NULL)   ← THE unifying key
   unionid  (unique, NULLABLE) ← filled when 开放平台 binding exists
   mp_openid   (unique, NULLABLE)   ← mini-program openid
   web_openid  (unique, NULLABLE)   ← 服务号 网页授权 openid
   created_at, ...
```

Flows that write to this table:
- **Web (MVP):** SMS OTP → on success, upsert by `phone`.
- **Mini-program (future):** `wx.login` → `code2session` → upsert by `unionid` (if present) else by `mp_openid`; then `<button open-type="getPhoneNumber">` → `/wxa/business/getuserphonenumber` → set/merge `phone`. Because phone is unique, a returning mini-program user is reconciled to the same record the web created. (`getPhoneNumber` is **¥0.04/次**, requires 认证主体, government/non-profit exempt per docs.)
- **WeChat-in-browser (optional, post-服务号认证):** 网页授权 `snsapi_userinfo` → upsert by `unionid` (silent SSO for users already known via the mini-program) or by `web_openid`.

**Why phone-first wins for the MVP:** it needs no 服务号, no 开放平台, no mini-program, no 企业认证 at launch — yet it is forward-compatible with all of them. `unionid` becomes a *nice-to-have* optimization (silent WeChat SSO) rather than a *prerequisite* for account continuity.

Sources:
- 小程序 getPhoneNumber (官方) — https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html
- 开放平台 绑定/UnionID 概念 — https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/getting_started/terminology_introduce
- 开放平台 账号管理 (小程序只能绑一个开放平台) — https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/product/Open_Platform_Account_Management.html

---

## Library recommendation for the stack

Stack constraints: **TanStack Start + Cloudflare Workers**, storage = D1 (+ KV). Workers runtime has no Node.js by default (needs `nodejs_compat` flag), CPU-time limits (10ms free / up to 30s paid), and isolate-reuse semantics that bite stateful singletons.

| Library | Verdict |
|---|---|
| **Lucia** | **Do not use.** Officially **deprecated** in 2025 (v3 maintained only through Mar 2025); now a "learning resource," not a maintained library. — https://github.com/lucia-auth/lucia/discussions/1707 , https://lucia-auth.com/luci-v3/migrate |
| **Auth.js v5** | Possible but **not idiomatic for TanStack Start**. v5 is tightly coupled to Next.js middleware/routing; on TanStack Start you'd use the framework-agnostic `@auth/core`, which is extra glue. Has an **official Cloudflare D1 adapter** (tables: users/sessions/accounts/verification_tokens). No China-specific WeChat/SMS providers, so you still hand-wire those. — https://authjs.dev/getting-started/adapters/d1 , https://authjs.dev/reference/d1-adapter |
| **better-auth** | **Best library if you want one.** First-class **TanStack Start integration** (official, with `tanstackStartCookies` plugin), **phone-number OTP plugin**, **2FA plugin**, **native D1 support (1.5+)**, plus community `better-auth-cloudflare` helper for D1/KV. **Risk:** multiple open issues report Cloudflare-Workers incompatibility — "Workers runtime canceled this request… code had hung" (TanStack/router #5323, Oct 2025), CPU-resource-exceeded on sign-in, `nodejs_compat` breakage (better-auth #1375). **Known mitigations:** instantiate DB/auth **inside the request handler** (not at module top-level), enable `nodejs_compat`, use `better-auth-cloudflare`. — https://better-auth.com/docs/integrations/tanstack , https://better-auth.com/docs/plugins/phone-number , https://better-auth.com/blog/1-5 , https://github.com/better-auth/better-auth/issues/1375 , https://github.com/TanStack/router/issues/5323 |
| **Custom JWT/session in D1/KV** | **Lowest runtime risk for an MVP.** A `sessions` table in D1 (sessionId → userId → expiresAt) + an HMAC-signed HttpOnly cookie (or a short-lived JWT with KV revocation). No external deps to fight on Workers. You hand-roll OTP/WeChat either way, so the marginal code is small. Full control over the phone-primary / unionid-secondary schema above. |

**Recommendation:** Given (a) the better-auth-on-Workers bugs are still being worked out, and (b) **every** option requires hand-wiring the China-specific pieces (SMS OTP send/verify, WeChat 网页授权 code→session, mini-program `code2session`, `getPhoneNumber`, unionid mapping) — start with a **thin custom session layer in D1 + signed cookie**, and write the WeChat/SMS flows directly. This minimizes Workers-runtime risk and is the smallest surface area for an elderly-focused MVP. **If the team prefers a library** and accepts the integration tax, choose **better-auth** (TanStack Start + phone-OTP + D1) with the `better-auth-cloudflare` helper and `nodejs_compat`; re-test the request-cancellation issue against the latest versions before committing.

Sources:
- TanStack Start on Cloudflare (官方) — https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Cloudflare Workers Node.js compatibility — https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Cloudflare compat flags (`nodejs_compat`) — https://developers.cloudflare.com/workers/configuration/compatibility-flags/
- better-auth-cloudflare (community) — https://github.com/zpg6/better-auth-cloudflare
- Better Auth + Cloudflare Workers guide (instantiate-per-request fix) — https://medium.com/@senioro.valentino/better-auth-cloudflare-workers-the-integration-guide-nobody-wrote-8480331d805f

---

## Decision points still needing the human (research → decision)

1. **服务号 availability.** Is a 已认证服务号 (¥300/年 + 企业/组织资质) obtainable for the MVP? If **no**, WeChat web OAuth is out of scope for v1 and the MVP is phone-OTP-only — which is fine (phone unification needs no 服务号).
2. **开放平台 binding.** Do we register a 微信开放平台 account (¥300/次 开发者资质认证) and bind 服务号 + future 小程序 for `unionid`? This only affects the WeChat-in-browser *silent-SSO* nicety; phone-first unification works without it. Recommend: **defer** until the mini-program is closer to launch.
3. **SMS gateway vendor.** 阿里云 vs 腾讯云, and **whose 企业实名资质** fronts the signature review (signature string, e.g. 【健康随访管家】). This is a procurement/legal decision, not a technical one.
4. **Library choice.** Accept better-auth's Workers-integration risk, or go with the recommended thin custom D1 session? (Tech lead decision; recommend custom for MVP, re-evaluate better-auth post-MVP.)
5. **Doctor auth.** Same phone-OTP as patients (recommended, single identity model), or a separate flow? Doctors are also WeChat/phone-native in China, so a unified phone model is simplest.
6. **Cost model for mini-program phone capture.** `getPhoneNumber` is ¥0.04/次 — confirm this is acceptable vs. SMS-only web OTP (¥0.045/条) when planning the mini-program budget. (Minor; flagged for completeness.)

---

## Key citations (primary sources)

- 微信网页授权 (服务号文档) — https://developers.weixin.qq.com/doc/service/guide/h5/auth.html
- UnionID 机制说明 — https://developers.weixin.qq.com/doc/service/guide/product/unionid.html
- 开放平台 基本概念 (绑定获取 UnionID) — https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/getting_started/terminology_introduce
- 小程序 getPhoneNumber — https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html
- 微信认证费用 — https://developers.weixin.qq.com/minigame/product/renzheng.html
- 阿里云短信 计费/审核 — https://help.aliyun.com/zh/sms/getting-started/get-started-with-sms
- 腾讯云短信 使用须知/价格 — https://cloud.tencent.com/document/product/382/13444 , https://cloud.tencent.com/document/product/382/36132
- Better Auth — TanStack Start — https://better-auth.com/docs/integrations/tanstack
- Better Auth — Phone Number plugin — https://better-auth.com/docs/plugins/phone-number
- Better Auth — 1.5 release (native D1) — https://better-auth.com/blog/1-5
- Lucia deprecation — https://github.com/lucia-auth/lucia/discussions/1707
- Auth.js D1 adapter — https://authjs.dev/getting-started/adapters/d1
- Cloudflare Workers — TanStack Start guide — https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Cloudflare Workers — Node.js compatibility — https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- better-auth ↔ Cloudflare compat issues — https://github.com/TanStack/router/issues/5323 , https://github.com/better-auth/better-auth/issues/1375
