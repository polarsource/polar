import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

// The SDK writes every event here first, then ships it to the server. Separate
// from the app's own database on purpose: this file belongs to Void.
mkdirSync('data', { recursive: true })

const shared = globalThis as typeof globalThis & { voidEvents?: DatabaseSync }
export const events = shared.voidEvents ?? new DatabaseSync('data/void.db')
if (process.env.NODE_ENV !== 'production') shared.voidEvents = events
