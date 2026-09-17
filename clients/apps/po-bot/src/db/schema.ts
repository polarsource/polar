import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Rows get UUIDs so a row's id can be its Void identity id as is.
const uuid = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

/** A person in the organization. `cap` is the most credits they may spend per period. */
export const members = sqliteTable('members', {
  id: uuid(),
  name: text().notNull(),
  cap: integer().notNull(),
})

/** A reusable bot owned by one member, pinned to one model. */
export const agents = sqliteTable('agents', {
  id: uuid(),
  memberId: text('member_id')
    .notNull()
    .references(() => members.id),
  name: text().notNull(),
  model: text().notNull(),
  systemPrompt: text('system_prompt').notNull(),
})

/** One thread per agent. */
export const messages = sqliteTable('messages', {
  id: integer().primaryKey({ autoIncrement: true }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id),
  role: text({ enum: ['user', 'assistant'] }).notNull(),
  content: text().notNull(),
})

export type Member = typeof members.$inferSelect
export type Agent = typeof agents.$inferSelect
export type Message = typeof messages.$inferSelect
