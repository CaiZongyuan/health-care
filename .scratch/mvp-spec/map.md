<!-- wayfinder:map -->
# Map — 健康随访管家 MVP 规格 + 架构

## Destination

一套**已决策、可落地的 MVP/原型产品规格 + 技术架构文档（multica 风格，置于 `docs/`）**：每个阻塞"开工构建 MVP"的产品与框架决策都已解决，文档足以直接交给实现阶段开工。最终的文档综合（synthesis）在所有决策票据关闭后进行——届时把决策落成 `docs/` 下的产品描述、功能规格、架构与约定文档。

## Notes

- **领域**：面向高血压、脑出血康复期及长期随访患者的移动端健康跟踪。核心闭环 = 记录 → 趋势分析 → 家庭医生随访。移动 web 优先，面向老年患者（低门槛、"打开就会用"）。
- **每个 session 应 consult 的 skills**：`grilling`、`domain-modeling`（建 `CONTEXT.md` 术语表 / `docs/adr` 决策）、`research`（外部事实）、`prototype`（UI/逻辑低保真）。
- **本 effort 的 standing preferences**：
  - **MVP/原型 bar**：医疗合规/资质（二类医疗器械、PIPL/数据安全法）作为已知风险标记，不在这轮深入解决（见 Out of scope）。
  - **技术栈已选**：React、TanStack Start、Vercel AI SDK、Cloudflare 部署、shadcn/ui。Web 优先，后端 API-first，为微信小程序留路。
  - **中文产品语态**；最终 docs 遵循一份 `docs/conventions` 风格规范（参考 multica 的 conventions 做法），命名/术语/中文文案全局统一。
  - **医疗安全**：AI 输出必须有人（医生）在回路把关；患者侧不直接给"医疗建议"，只展示数据与医生反馈。
  - **执行指令（用户，2026-07-23）**：本 effort **进入执行模式**——剩余问题授权 Claude 自行决定；项目开发用 **GitHub Issues** 管理（本仓 `CaiZongyuan/health-care`）；接入 **AI SDK 前查官网最新用法**（sdk.vercel.ai）；MVP 范围 = 个人自用单用户（见 11）。
- **票据约定（local-markdown tracker）**：票据在 `.scratch/mvp-spec/issues/NN-<slug>.md`；含 `Type:` / `Status:` / `Blocked by:` 行；解析时在 `## Answer` 写答案、置 `Status: resolved`、并在本文件「Decisions so far」追加一行指针。

## Decisions so far

- [01 商业模式：B2C](issues/01-business-model.md) — 直接面向患者/家属，患者自主注册并关联自己的家庭医生；多租户/社区机构入驻留到规模化。
- [02 MVP 前端载体：Web 优先 + API-first](issues/02-frontend-platform.md) — MVP 用 web/PWA（TanStack Start + Cloudflare + shadcn），后端与前端解耦，为微信小程序留路；老年触达是已知验证风险。
- [03 医生端：轻量 Web 工作台](issues/03-doctor-surface.md) — 医生在 web 看关联患者的趋势/异常/达标率、写随访反馈（置顶患者首页）；两端共用后端 API。〔**MVP 个人自用阶段不建，延后到多用户**；决策保留为该阶段方案〕
- [04 AI 角色：医生辅助生成随访草稿](issues/04-ai-role.md) — AI 把患者近期趋势+症状+用药汇总成随访草稿，医生审核修改后发出；人在回路，患者侧不直接给医疗建议。〔**MVP 改为给用户自己生成"健康小结"（智谱 GLM）；医生辅助草稿随医生侧延后**〕
- [05 家属角色：MVP 仅患者本人](issues/05-family-proxy.md) — MVP 只做患者本人账号；家属代记/代看与授权模型作为后续阶段。
- [06 技术栈运行时可行性：条件可行](issues/06-tanstack-cloudflare-ai-sdk.md) — TanStack Start + Cloudflare(Workers) + AI SDK 官方支持、成熟、可跑；约束：`nodejs_compat` + Paid 计划、AI 流式走 API file route（非流式 server fn）、Workers AI/OpenAI provider 可用但 **Anthropic `streamText` 在 Workers 会挂**（#10725，暂避）。
- [07 AI 提供方：智谱 GLM（Coding Plan）](issues/07-ai-provider-model.md) — 用智谱 GLM（用户已有 Coding Plan），经 **OpenAI 兼容端点** + `@ai-sdk/openai` 接入（无需官方 zhipu 包）；模型取 plan 内最新；医生在回路、不可自动开方。
- [09 认证：MVP 不做，个人自用直接进入](issues/09-auth.md) — 单用户、无登录、打开即用；手机号 + `phone` 统一身份方案保留给未来多用户阶段。
- **部署**：海外 Cloudflare + 自有域名，个人自用无需 ICP 备案（非票据，记为既定约束；D1 海外确认为主存储，见 08）。
- [10 血压判定标准：采用家庭血压 135/85](issues/10-bp-standards.md) — 家庭高血压 ≥135/85（非诊室 140/90）；达标 = SBP≤135 **且** DBP≤85；清晨高血压单独 flag；偏低<90/60；危象≥180/110 触发就医 UI；HR/SpO2 仅信息提示。上线前临床签字（个人自用降级）。
- [11 MVP 功能范围：单用户自用](issues/11-mvp-feature-scope.md) — 首页(记血压+用药待办+AI健康小结) / 趋势(7·30天折线+达标率+清晨高血压+历史明细) / 我的(长期档案) / AI健康小结；**不做**登录/医生端/家属/推送/导出。
- [14 用药待办来源：患者手填](issues/14-meds-data-source.md) — 患者在"我的"维护用药清单(名称/剂量/时段)，系统每日生成待办勾选；医生结构化开方留待 B2B。

## Not yet specified

- **通知/提醒机制**（用药提醒 push）：web push vs 未来小程序订阅消息；依赖载体与数据层决策后再具体化。
- **数据导出 / 一键分享给医生**（含趋势图的报告）：MVP 是否纳入、形态如何，依赖功能范围（11）与医生工作台（03）细化。
- **记录细节**：一天多次记录、记录编辑/删除、历史回填——在功能范围裁剪（11）中统一决定。
- **清晨高血压/夜间血压等高级分析**：MVP 是否触及，依赖趋势标准（10）与范围（11）。
- **国际化/多语言**：MVP 仅简体中文；多语言留待规模化。
- **小程序迁移的触发条件与时机**：API-first 已规避主要风险；何时启动作为单独 effort。

## Out of scope

- **医疗器械资质**（如二类医疗器械备案/注册）与 **PIPL/数据安全法深度合规建设**：已知风险，本轮不深入解决；正式面向真实患者上线前必须单独立项处理（含数据脱敏、存储区域、用户授权、免责声明）。
- **B2B / 社区卫生机构多租户**、机构入驻与签约工作流：规模化阶段。
- **家属/代理账号体系**与细粒度授权：后续阶段（见 05）。
- **微信小程序的实际构建**：未来 effort（当前以 API-first 为其留路）。
- **认证系统**：个人自用 MVP 不做登录；多用户阶段再做（见 09）。**ICP 备案**：个人自用 + 海外部署，N/A。
- **医生侧（工作台 03 / 患者关联 12 / 医患对话 13）**：无认证 + 单用户下**整体延后到多用户阶段（已确认）**。
- **Apple Watch / 蓝牙血压计等硬件集成、HIS/医院系统对接**。
