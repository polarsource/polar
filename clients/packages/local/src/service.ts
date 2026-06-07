/**
 * The deployable sidecar. Integrators run this on their own infra: their app
 * POSTs usage to local, local persists it durably, serves instant local invoice
 * previews from the versioned ruleset, and forwards to Polar in the background.
 *
 * The HTTP routing is a plain `(Request) => Promise<Response>` so it's testable
 * without binding a port (see test/service.test.ts). `main.ts` adapts it to a
 * `node:http` server and forks the background flusher.
 *
 * Endpoints:
 *   POST /v1/ingest        { events: RawEvent[] }     → { ingested }
 *   GET  /v1/preview       ?customer&from&to&version  → Invoice (local, instant)
 *   POST /v1/reconcile     { customer, from, to }     → ReconcileReport
 *   GET  /v1/deadletters                              → dead-letter queue
 *   GET  /health                                      → liveness + delivery lag
 */
import { Effect } from 'effect'
import type { CustomerRef } from './events'
import { ingest, type RawEvent } from './ingest'
import { currentRuleset, invoiceFor, type RulesetHistory } from './ruleset'
import { reconcile } from './reconcile'
import type { PolarClient } from './polar-client'
import { canonicalJson } from './serialize'
import type { EventStore } from './store'

export interface ServiceDeps {
  readonly store: EventStore
  readonly history: RulesetHistory
  /** Enables POST /v1/reconcile. Without it that route returns 501. */
  readonly polarClient?: PolarClient
}

const json = (body: unknown, status = 200): Response =>
  new Response(canonicalJson(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Parse a customer from query params: ?customer=<external id> or ?polar_customer=<uuid>. */
const customerFromQuery = (params: URLSearchParams): CustomerRef | null => {
  const external = params.get('customer')
  if (external) return { external_customer_id: external }
  const polar = params.get('polar_customer')
  if (polar) return { customer_id: polar }
  return null
}

const periodFromQuery = (
  params: URLSearchParams,
): { from: number; to: number } | null => {
  const from = Date.parse(params.get('from') ?? '')
  const to = Date.parse(params.get('to') ?? '')
  return Number.isNaN(from) || Number.isNaN(to) ? null : { from, to }
}

export const makeHandler =
  (deps: ServiceDeps) =>
  async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const { pathname } = url

    try {
      if (request.method === 'POST' && pathname === '/v1/ingest') {
        const body = (await request.json()) as { events?: RawEvent[] }
        if (!Array.isArray(body.events))
          return json({ error: 'expected { events: [...] }' }, 400)
        const result = await Effect.runPromise(
          Effect.either(ingest(deps.store, body.events)),
        )
        if (result._tag === 'Left')
          return json({ error: result.left.reason, at: result.left.index }, 400)
        return json({ ingested: result.right.length })
      }

      if (request.method === 'GET' && pathname === '/v1/preview') {
        const customer = customerFromQuery(url.searchParams)
        const period = periodFromQuery(url.searchParams)
        if (!customer)
          return json({ error: 'missing ?customer (or ?polar_customer)' }, 400)
        if (!period)
          return json(
            { error: 'missing/invalid ?from and ?to (ISO timestamps)' },
            400,
          )
        const version = url.searchParams.get('version') ?? undefined
        const invoice = invoiceFor(deps.history, deps.store.all(), {
          customer,
          period,
          ...(version ? { version } : {}),
        })
        return json(invoice)
      }

      if (request.method === 'POST' && pathname === '/v1/reconcile') {
        if (!deps.polarClient)
          return json(
            { error: 'reconcile not configured (no Polar token)' },
            501,
          )
        const ruleset = currentRuleset(deps.history)
        if (!ruleset) return json({ error: 'no ruleset defined' }, 400)
        const body = (await request.json()) as {
          customer?: string
          polar_customer?: string
          from?: string
          to?: string
        }
        const customer: CustomerRef | null = body.customer
          ? { external_customer_id: body.customer }
          : body.polar_customer
            ? { customer_id: body.polar_customer }
            : null
        const from = Date.parse(body.from ?? '')
        const to = Date.parse(body.to ?? '')
        if (!customer || Number.isNaN(from) || Number.isNaN(to))
          return json({ error: 'need customer, from, to' }, 400)
        const report = await Effect.runPromise(
          reconcile(deps.polarClient, deps.store, ruleset.plan, {
            customer,
            period: { from, to },
          }),
        )
        return json(report)
      }

      if (request.method === 'GET' && pathname === '/v1/deadletters') {
        return json({ deadLetters: deps.store.deadLetters() })
      }

      if (request.method === 'GET' && pathname === '/health') {
        const all = deps.store.all()
        const cursor = deps.store.getCursor('polar')
        const undelivered = all.filter((e) => e.seq > cursor).length
        return json({
          ok: true,
          events: all.length,
          deliveredUpToSeq: cursor,
          undelivered, // delivery lag — events buffered, not yet confirmed at Polar
          deadLetters: deps.store.deadLetters().length,
          rulesetVersions: deps.history.rulesets.map((r) => r.version),
        })
      }

      return json({ error: 'not found' }, 404)
    } catch (cause) {
      return json({ error: String(cause) }, 500)
    }
  }
