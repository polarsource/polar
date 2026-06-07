/**
 * The store seam. `main.ts` and any embedded host build their `EventStore`
 * through here instead of `new SqliteEventStore(...)`, so the durable backend is
 * a config choice rather than a hard-coded import.
 *
 * Today there are two backends:
 *   - `sqlite`  — a per-instance file. The stateful sidecar (the default).
 *   - `memory`  — ephemeral; tests and throwaway runs.
 *
 * Adding a shared/remote backend (e.g. Postgres) is what unlocks the embedded
 * handler in a multi-instance, stateless app — a single local SQLite file can't
 * be shared across replicas. Note the deliberate constraint: `EventStore` is a
 * **synchronous** interface (it mirrors the synchronous `node:sqlite` driver),
 * so a network-backed store first requires converting `EventStore` and its
 * consumers (ingest/flusher/service/reconcile/selfheal) to async. That's the
 * tracked follow-up; the switch below is where the new `case` will land.
 */
import type { StoreConfig } from './config'
import { MemoryEventStore, SqliteEventStore, type EventStore } from './store'

export const createStore = (config: StoreConfig): EventStore => {
  switch (config.kind) {
    case 'sqlite':
      return new SqliteEventStore(config.path)
    case 'memory':
      return new MemoryEventStore()
  }
}
