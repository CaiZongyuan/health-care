# 08 — Data Layer for the MVP (Cloudflare)

**Ticket:** 08 · **Date:** 2026-07-23 · **Status:** research → decision (needs human sign-off)
**Scope:** Which Cloudflare data store(s) back 健康随访管家 MVP. Web-first now; a future WeChat mini-program reuses the same API-first backend.

---

## 1. Workload shape (what we must serve)

| Data | Shape | Access pattern |
|---|---|---|
| BP records (sys/dia/HR/SpO2/symptoms/notes, ts) | Relational, append-mostly, time-stamped | Insert 1–few/day per patient; read by patient over 7/30/90d windows |
| Medication todos (name/dose/time-of-day/taken) | Relational | Daily inserts/updates; small |
| Doctor↔patient messages | Relational | Append; read by conversation |
| Long-term profile (height/weight/history/meds/ER contact) | Relational, low write rate | Read-mostly |
| **Trend aggregations** | `AVG`, `COUNT`/`CASE` for 达标率, rolling stats for anomaly detection over 7/30d | Read; `GROUP BY` day/week on `(patient_id, ts)` |
| **Doctor workbench** | Cross-patient `JOIN` + aggregation over a panel | Read; heavier, lower frequency |

**This is a relational + SQL-aggregation workload.** That fact alone eliminates some options (see §3) and frames the real choice as **D1 vs Postgres-via-Hyperdrive**.

---

## 2. Comparison (primary sources)

| Dimension | **D1** (SQLite) | **Postgres via Hyperdrive** (Neon / Supabase / Tembo) | **Durable Objects** | **KV** | **R2** |
|---|---|---|---|---|---|
| Relational + aggregation SQL? | Yes — full SQLite (CTEs, window fns, `GROUP BY`, `CASE`). 达标率/anomaly trivial. | Yes — full Postgres + extensions (TimescaleDB on Tembo, materialized views). Strongest. | Per-object SQLite only; **no cross-object query** — doctor workbench would need app-level fan-out (anti-pattern) | No — key-value only, no query/aggregation | No — blob storage, no querying |
| Doctor workbench (cross-panel query) | Works at MVP scale in a single DB; single-threaded DB is the ceiling | Best — one big Postgres handles panel-wide aggregations well | Wrong shape | Wrong shape | Wrong shape |
| Write pattern & volume | Fine for low writes/patient/day; `INSERT` few ms | Fine | Per-object serial writes; great for chat rooms | 1 write/sec/key — **too weak for records** | Object puts — wrong granularity |
| Max DB size | **10 GB / database** (scale by sharding; pricing unchanged) | TB+ single DB | 50 GB/account | 1 GB free / unlimited paid | 10 GB free, then paid |
| MVP cost / quotas | Workers Paid **$5/mo** floor; rows-based billing (25B reads + 5M writes/mo included); scale-to-zero | Hyperdrive **included** on Free/Paid; you pay the Postgres vendor (Neon/Supabase). Hyperdrive Free = 100k queries/day | $5/mo floor + duration billing can spike (WebSocket examples $10–$416/mo) | Cheap; 1k writes/day free | Cheap; storage-tier priced |
| China latency / region | **Data colocated at Cloudflare edge** with Workers — reads fast for CN users; no second region to worry about | Postgres origin has **no mainland-China region** on Neon/Supabase. Hyperdrive caches reads at edge, but **writes/cold reads cross-border** | Edge-colocated | Edge-cached | Edge |
| Local dev / seed | **Excellent**: `wrangler d1 migrations apply --local`, runs local SQLite via Miniflare; `wrangler d1 export`/seed | OK: `localConnectionString` → local Postgres; Hyperdrive caching off in local mode | Awkward — DOs need a Worker front-end to test | Fine | Fine |
| Backups / PITR | **Time Travel** — restore to any minute in 30d; plus export | Neon/Supabase PITR/branching | Per-object `deleteAll()`/SQLite export | Namespace export | Bucket versioning |
| Shared by future mini-program? | **Yes — via your API layer.** DB never exposed; the API contract is what's portable. | Yes — same reasoning | Yes but harder | Yes | Yes |
| Migration path if outgrown | Swap driver behind API; or shard D1 by clinic/tenant (CF's own scale-out) | N/A (this is the "upgrade" target) | — | — | — |

**D1 GA status:** Generally Available and production-ready since **2024-04-01** (announced alongside Hyperdrive GA) — https://blog.cloudflare.com/making-full-stack-easier-d1-ga-hyperdrive-queues/ , https://developers.cloudflare.com/d1/platform/release-notes/ . Free-tier daily limits began enforcement 2025-02-10.

**Primary sources:**
- D1 GA + limits/pricing/local dev/Time Travel — https://blog.cloudflare.com/making-full-stack-easier-d1-ga-hyperdrive-queues/ , https://developers.cloudflare.com/d1/platform/limits/ , https://developers.cloudflare.com/d1/platform/pricing/ , https://developers.cloudflare.com/d1/best-practices/local-development/ , https://developers.cloudflare.com/d1/reference/time-travel/
- Hyperdrive overview/pricing/local dev — https://developers.cloudflare.com/hyperdrive/ , https://developers.cloudflare.com/hyperdrive/platform/pricing/ , https://developers.cloudflare.com/hyperdrive/configuration/local-development/
- Durable Objects pricing — https://developers.cloudflare.com/durable-objects/platform/pricing/
- KV limits — https://developers.cloudflare.com/kv/platform/limits/
- "Choosing a data or storage product" (CF's own decision matrix) — https://developers.cloudflare.com/workers/platform/storage-options/
- Neon scale-to-zero / autoscaling / no-China-region — https://neon.com/pricing , https://neon.com/blog/neon-autoscaling-is-generally-available , https://www.21cloudbox.com/support/neon-postgres-china.html

---

## 3. Quick eliminations

- **KV** — no relational query, no aggregation, 1 write/sec/key. Only useful as a **cache** for hot aggregation results, sessions, and feature flags. Not a system of record.
- **R2** — S3-style blob storage, no querying. Only useful if we later store **attachments** (prescription photos, lab-report PDFs). Not the core store.
- **Durable Objects** — per-object strong consistency; **cannot query across objects**. A doctor workbench would have to fan out across one DO per patient and merge in-app — an anti-pattern. Useful **only if** MVP adds real-time features (live WebSocket chat, presence, per-conversation notification fan-out). For async messaging, D1 is enough.

That leaves **D1** vs **Postgres via Hyperdrive**.

---

## 4. Recommendation for MVP: **D1** (with KV as cache; R2 optional for attachments)

### Why D1 over Postgres-via-Hyperdrive for the MVP

1. **The aggregation requirement is plain SQL.** 达标率 = `AVG(CASE WHEN systolic<140 AND diastolic<90 THEN 1 ELSE 0 END)`; 7/30-day trends = `GROUP BY date` with an index on `(patient_id, ts)`; anomaly detection = rolling `AVG()/stddev` via window functions. SQLite/D1 supports all of this natively. We do **not** need Postgres-only features at MVP scale.
2. **One platform, one bill, no second vendor.** Hyperdrive is an *accelerator*, not a database — you still provision and pay Neon/Supabase separately and manage another account, credentials, and region. MVP simplicity favors D1.
3. **China latency.** D1 data sits on Cloudflare's edge with the Worker compute. Neon and Supabase have **no mainland-China region**, so writes (and cold reads) cross the border; Hyperdrive only caches repeated reads. For a health app used in China, this is a real edge for D1 — *subject to the data-residency decision point below*.
4. **Local-dev & seed story is best-in-class.** `wrangler d1 migrations apply --local` against local SQLite; seed via SQL; Time Travel for "oops" recovery. Hyperdrive local mode disables its caching, so you test that later.
5. **Cost.** Workers Paid is $5/mo floor with scale-to-zero and a huge included quota. BP records are tiny (a few hundred bytes each) — 10 GB holds years of data for a clinic. Cost is effectively $5/mo for the whole MVP.
6. **API-first keeps it swappable.** The future mini-program talks to our REST API, never to D1 directly. So choosing D1 now does **not** lock the data layer behind the API contract — the DB is an implementation detail.

### Complementary stores (not either/or)
- **KV** — session/auth tokens, cached aggregation results (hot 7/30-day summaries), feature flags. Keep D1 as the source of truth.
- **R2** — *only if/when* we add photo/PDF attachments (lab reports, prescriptions). Defer unless MVP needs it.
- **Durable Objects** — *only if* MVP scope includes **real-time** doctor↔patient chat (WebSockets). If messaging is async (inbox-style), D1 suffices.

---

## 5. Migration story if we outgrow D1

**Likely trigger:** the doctor workbench's cross-patient aggregations, running concurrently with patient writes on the same D1 database, hit the single-threaded throughput ceiling → rising latency or "overloaded" errors. (D1 guidance: ~1k queries/sec at 1ms each; heavy aggregations lower this.) Secondary trigger: a single DB approaching the 10 GB cap.

**Path A — stay on D1, shard by tenant:** Cloudflare's own scale-out story is one D1 database per clinic/tenant (thousands of DBs at no extra cost). Patient writes stay in their clinic's DB; the workbench fans out across clinic DBs in code. Defers the migration cheaply if growth is multi-clinic.

**Path B — move to Postgres via Hyperdrive:**
1. The REST API contract stays identical → **no mini-program or web client change.**
2. Spin up Postgres (Neon or Supabase) and attach via Hyperdrive behind a feature flag.
3. Port schema: SQLite → Postgres is mostly trivial. Mind (a) SQLite's loose typing vs Postgres strict types, (b) any SQLite date/string functions, (c) auto-increment syntax.
4. Backfill: `wrangler d1 export` → pipe into Postgres.
5. Cut over per-table or per-tenant behind the flag.

**Make migration near-free by deciding now:**
- Use an ORM/query-builder that targets **both** D1 and Postgres — **Drizzle** is the standard pick here (first-class D1 + Postgres support; swap is a driver/config change).
- Keep SQL **ANSI-clean**; avoid SQLite-isms (`STRFTIME`, `GROUP_CONCAT` quirks, dynamic typing).
- Put the DB behind a thin repository interface in the API layer so the surface area is small.

---

## 6. Decision points still needing the human

1. **Data residency / PIPL compliance (biggest unknown).** Health data on Chinese residents is regulated under PIPL; mainland-China storage may be required. If so, **neither D1's edge placement nor Neon/Supabase may qualify** without a domestic partner — this could force a domestic provider (Tencent Cloud TDSQL, Alibaba Cloud PolarDB/OceanBase, or a China-hosted Postgres) and would override the D1 recommendation entirely. **Confirm the residency requirement before any build.**
2. **Mini-program data access model.** Confirm it will always go through the REST API and never need direct DB access (it should). If yes, the DB choice is fully decoupled from the client — reaffirms D1.
3. **Doctor-panel size & workbench freshness.** How many patients per doctor, and how fresh must panel aggregations be? At a few thousand patients per clinic with on-demand queries + indexes, D1 is comfortable. If panels are huge or queries are very heavy, lean toward precomputing summaries (Cron Trigger → summary tables in D1) or reconsider Postgres sooner.
4. **Real-time chat in MVP?** Async messaging → D1 only. Live/WebSocket chat → add Durable Objects for the realtime channel (messages still persisted to D1).
5. **ORM choice (decide now to cheapen any future migration).** Recommend **Drizzle** (D1 + Postgres). Confirm.
6. **Aggregation strategy.** On-demand D1 queries are fine for MVP. If we want snappier dashboards, add Cron Triggers that write rollup tables (per-day/per-patient) into D1, read by the dashboards. Decide whether MVP needs this or can compute on the fly.

---

## 7. TL;DR

- Eliminate KV (cache only), R2 (attachments only), Durable Objects (only if realtime chat lands).
- **Pick D1 for the system of record** — it runs the trend/aggregation SQL natively, is edge-colocated for CN latency, has the best dev/seed story, costs ~$5/mo, and stays swappable behind an API-first contract.
- **Add KV** for sessions + cached aggregations; **add R2/DO only if** attachments / realtime chat enter MVP scope.
- **Decide now: Drizzle ORM + ANSI SQL** so a future move to Postgres+Hyperdrive (the natural upgrade if the doctor workbench outgrows D1's single-DB throughput) is a driver swap, not a rewrite.
- **Blocker to confirm before building: PIPL/China data residency** — if mainland storage is mandatory, the whole recommendation may need to move to a domestic Cloud-provider DB.
