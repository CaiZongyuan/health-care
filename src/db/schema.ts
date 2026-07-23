import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 单用户个人自用：不带 user_id。多用户/认证阶段再加归属维度（见 .scratch 决策 05/09）。

/** 血压记录：高压/低压必填，心率/血氧可选，症状多选，备注。 */
export const bpRecords = sqliteTable('bp_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 测量时间（unix 毫秒）。趋势/AI 按 measured_at 过滤近 N 天。
  measuredAt: integer('measured_at').notNull(),
  // 是否晨起测量（清晨高血压 flag，标准见决策 10）。
  isMorning: integer('is_morning', { mode: 'boolean' }).notNull().default(false),
  sys: integer('sys').notNull(),
  dia: integer('dia').notNull(),
  hr: integer('hr'),
  spo2: integer('spo2'),
  symptoms: text('symptoms', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  notes: text('notes').notNull().default(''),
})

/** 长期用药清单（患者手填，见决策 14）。 */
export const medications = sqliteTable('medications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  dosage: text('dosage').notNull().default(''),
  // 时段：如 "早晨" / "睡前" / "08:00"
  timeOfDay: text('time_of_day').notNull().default(''),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
})

/** 用药打卡：某药某日是否已服（见 #4）。 */
export const medLog = sqliteTable('med_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 不加外键约束，归属在应用层校验（参考 multica 惯例）。
  medId: integer('med_id').notNull(),
  // YYYY-MM-DD，便于按日去重查询
  takenDate: text('taken_date').notNull(),
  takenAt: integer('taken_at').notNull(),
})

/** 长期档案 key/value：身高/体重/既往病史/长期用药/紧急联系人等（见 #7）。 */
export const profile = sqliteTable('profile', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updatedAt: integer('updated_at').notNull(),
})

export type BpRecord = typeof bpRecords.$inferSelect
export type NewBpRecord = typeof bpRecords.$inferInsert
export type Medication = typeof medications.$inferSelect
export type NewMedication = typeof medications.$inferInsert
export type MedLog = typeof medLog.$inferSelect
export type Profile = typeof profile.$inferSelect
