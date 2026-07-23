# 08 — 数据层选型（Cloudflare）

Type: research
Status: resolved
Blocked by: none

## Question

健康记录（血压/心率/血氧/症状/备注）、用药、医患消息、长期档案、趋势聚合——在 Cloudflare 上用哪个数据层？

- 候选：D1（SQLite）、经 Hyperdrive 的 Postgres（Neon/Supabase）、Durable Objects、KV/R2。
- 对比维度：关系查询与趋势聚合能力、写入模式、配额与限制、能否被未来微信小程序共用同一后端、迁移成本、本地开发体验。
- 注意 MVP bar：够用即可，但要支撑"达标率/异常波动/趋势图"这类聚合查询。

产出：`research/08-data-layer.md`（一手来源 + 引用）。需给出推荐 + 仍需人类拍板的决策点（研究→决策）。

## Research findings

详见 [`research/08-data-layer.md`](../research/08-data-layer.md)。

**结论**：负载是关系型 + SQL 聚合（记录/待办/消息/档案 + 7/30 天达标率与异常 + 医生 panel 跨患者查询），直接排除 KV（无查询）、R2（对象存储）、Durable Objects（无跨对象查询）。真正的选择是 **D1 vs 经 Hyperdrive 的 Postgres**。

**推荐（待人类拍板）**：
- **D1 作主存储**（2024-04 起 GA；原生跑趋势 SQL/CTE/窗口函数；与 Workers 同边缘低延迟；本地 dev/seed 最好；约 $5/月 + scale-to-zero）。
- **KV 存会话 + 聚合缓存**；**R2** 仅当上照片/PDF 附件；**Durable Objects** 仅当 MVP 要做实时 WebSocket 问诊（否则异步消息留在 D1）。
- **现在就采用 Drizzle ORM + ANSI SQL**——未来若要换 Postgres 只是驱动/配置改动，不是重写。

**仍需人类拍板（研究→决策）**：
1. **PIPL / 国内数据驻留**（最大未知——可能强制改用腾讯/阿里等国内厂商，推翻以上结论；与 Out of scope 的合规立项强相关）。
2. 小程序一律走 REST API（确认——保持 DB 可替换）。
3. 医生 panel 规模 + 工作台新鲜度（决定 D1 单库吞吐够不够，或需 Cron Triggers 预算 rollup）。
4. MVP 是否要实时问诊？（要→加 Durable Objects，与票据 13 联动。）
5. 是否现在采用 Drizzle ORM（推荐：是）。

## 决策更新（用户）

- **部署区域 = 海外 Cloudflare**（绑自有域名，国内可访问，个人自用**无需 ICP 备案**）→ 决策点 #1（PIPL/数据驻留）在**个人自用阶段降级**，不强制换国内云；**D1（海外）确认为主存储**。
- PIPL/数据驻留仍记为风险：一旦转向真实多患者上线，须重评（见 map 的 Out of scope 合规立项）。
- #3（医生 panel 规模）随医生侧延后而暂缓；#4（实时问诊/DO）随 13 联动；#2（小程序走 REST）确认；#5（Drizzle）推荐采用。
