/**
 * `bun run src/main.ts` — start the local sidecar.
 *
 * Wires env config → durable store → Polar sink → HTTP handler, serves it on a
 * port, and forks the background flusher that forwards the outbox to Polar. The
 * local store is the commit point, so ingestion keeps working (and billing
 * previews stay instant) even while Polar is unreachable.
 *
 * Required env: POLAR_ACCESS_TOKEN. Optional: POLAR_SERVER (production|sandbox),
 * POLAR_ORG_ID, LOCAL_PORT (8787), LOCAL_DB_PATH (local.db), LOCAL_FLUSH_INTERVAL_MS.
 */
import { Effect, Fiber } from "effect";
import { history } from "./billing";
import { configFromEnv } from "./config";
import { runFlusher } from "./flusher";
import { polarClient } from "./polar-client";
import { polarSink } from "./sink";
import { makeHandler } from "./service";
import { SqliteEventStore } from "./store";

const config = configFromEnv();
const store = new SqliteEventStore(config.dbPath);
const client = polarClient({ token: config.polar.token, server: config.polar.server });
const sink = polarSink({
  client,
  ...(config.polar.organizationId ? { organizationId: config.polar.organizationId } : {}),
});

const handler = makeHandler({ store, history, polarClient: client });

// Background: forward the outbox to Polar forever.
const flusher = Effect.runFork(runFlusher(store, sink, config.flushIntervalMillis));

const server = Bun.serve({ port: config.port, fetch: handler });
console.log(`local listening on http://localhost:${server.port} (db: ${config.dbPath}, polar: ${config.polar.server})`);

const shutdown = () => {
  console.log("\nshutting down…");
  void server.stop();
  Effect.runFork(Fiber.interrupt(flusher));
  store.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
