import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

/** 从 D1 binding 构造 Drizzle 实例（server fn 内用 `createDb(env.DB)`）。 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type DB = ReturnType<typeof createDb>

export { schema }
export {
  bpRecords,
  medications,
  medLog,
  profile,
  aiSummaries,
} from './schema'
export type {
  BpRecord,
  NewBpRecord,
  Medication,
  NewMedication,
  MedLog,
  Profile,
  AiSummary,
} from './schema'
