/**
 * Runtime surface — `import { ... } from "@polar-sh/local/server"`.
 *
 * This is the *advanced* entry point, for hosts that want to mount the service
 * inside their own process instead of running the sidecar (`main.ts`). The whole
 * service is a web-standard `(Request) => Promise<Response>` handler, so you can
 * graft it onto any fetch-style server (Hono, Bun, Deno, a Next.js route):
 *
 *   import { configFromEnv, createStore, makeHandler, polarClient, polarSink, runFlusher } from "@polar-sh/local/server";
 *   import { Effect } from "effect";
 *   import { history } from "./billing";
 *
 *   const config = configFromEnv();
 *   const store = createStore(config.store);
 *   const client = polarClient(config.polar);
 *   const handler = makeHandler({ store, history, polarClient: client });
 *   Effect.runFork(runFlusher(store, polarSink({ client }), config.flushIntervalMillis));
 *   // mount `handler` under /v1 on your existing app
 *
 * Caveat — read `create-store.ts`: the only shipped durable backend is a
 * per-instance SQLite file, which is single-writer. Mounting into a
 * multi-instance / serverless app is only safe once a shared backend exists.
 * The DSL for authoring billing-as-code stays in the package root
 * (`@polar-sh/local`); this module is purely the runtime.
 */

// HTTP handler + its dependency shape.
export { makeHandler } from './service'
export type { ServiceDeps } from './service'

// Config + the store seam.
export { configFromEnv, describeStore } from './config'
export type { ServiceConfig, StoreConfig } from './config'
export { createStore } from './create-store'

// Durable stores.
export { SqliteEventStore, MemoryEventStore } from './store'
export type { EventStore, DraftEvent, DeadLetter } from './store'

// Polar API client + the ingestion sink the flusher forwards through.
export { polarClient } from './polar-client'
export type { PolarClient, PolarClientOptions } from './polar-client'
export { polarSink } from './sink'
export type { IngestionSink } from './sink'

// Background forwarding.
export { runFlusher, flushOnce, deliver, trySend } from './flusher'
export type { FlushOptions, FlushReport } from './flusher'

// Ingestion (when feeding the store directly, bypassing HTTP).
export { ingest } from './ingest'
export type { RawEvent } from './ingest'

// Load an integrator's billing module by path (what the sidecar does at boot).
export { loadBilling } from './load-billing'
