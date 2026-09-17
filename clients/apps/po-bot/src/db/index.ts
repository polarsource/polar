import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

export const db = drizzle({
  client: createClient({ url: 'file:data/app.db' }),
  schema,
})
