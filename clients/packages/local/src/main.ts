/**
 * `pnpm start` (or `tsx src/main.ts`) — start the local sidecar.
 *
 * Wires env config → durable store → Polar sink → HTTP handler, serves it on a
 * port, and forks the background flusher that forwards the outbox to Polar. The
 * local store is the commit point, so ingestion keeps working (and billing
 * previews stay instant) even while Polar is unreachable.
 *
 * Required env: POLAR_ACCESS_TOKEN. Optional: POLAR_SERVER (production|sandbox),
 * POLAR_ORG_ID, LOCAL_PORT (8787), LOCAL_STORE (sqlite|memory),
 * LOCAL_DB_PATH (local.db), LOCAL_FLUSH_INTERVAL_MS.
 */
import { createServer, type IncomingMessage } from 'node:http'
import { Effect, Fiber } from 'effect'
import { history as exampleHistory } from './billing'
import { configFromEnv, describeStore } from './config'
import { createStore } from './create-store'
import { runFlusher } from './flusher'
import { loadBilling } from './load-billing'
import { polarClient } from './polar-client'
import { polarSink } from './sink'
import { makeHandler } from './service'

const config = configFromEnv()

// Billing-as-code: load the integrator's definition, or fall back to the bundled example.
const history = config.billingPath
  ? await loadBilling(config.billingPath)
  : exampleHistory
if (!config.billingPath) {
  console.warn(
    'LOCAL_BILLING not set — using the bundled example billing (src/billing.ts)',
  )
}

const store = createStore(config.store)
const client = polarClient({
  token: config.polar.token,
  server: config.polar.server,
})
const sink = polarSink({
  client,
  ...(config.polar.organizationId
    ? { organizationId: config.polar.organizationId }
    : {}),
})

const handler = makeHandler({ store, history, polarClient: client })

// Background: forward the outbox to Polar forever.
const flusher = Effect.runFork(
  runFlusher(store, sink, config.flushIntervalMillis),
)

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

// Adapt node:http's IncomingMessage/ServerResponse to the web-standard
// (Request) => Response handler in service.ts.
const server = createServer(async (req, res) => {
  try {
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const request = new Request(
      `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`,
      {
        method: req.method ?? 'GET',
        headers: req.headers as Record<string, string>,
        ...(hasBody ? { body: await readBody(req) } : {}),
      },
    )
    const response = await handler(request)
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (cause) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: String(cause) }))
  }
})

server.listen(config.port, () => {
  console.log(
    `local listening on http://localhost:${config.port} (store: ${describeStore(config.store)}, polar: ${config.polar.server})`,
  )
})

const shutdown = () => {
  console.log('\nshutting down…')
  server.close()
  Effect.runFork(Fiber.interrupt(flusher))
  store.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
