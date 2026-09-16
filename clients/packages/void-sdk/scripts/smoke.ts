import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  checksumOf,
  compile,
  createVoid,
  defineConfig,
  memoryEventStorage,
  type Wire,
} from '../src/index'
import { config } from './smoke.config'

const execute = promisify(execFile)
const packageDirectory = fileURLToPath(new URL('..', import.meta.url))
const configPath = fileURLToPath(new URL('./smoke.config.ts', import.meta.url))
function requiredEnvironment(name: string): string {
  const value = process.env[name]
  assert(value, `${name} is required`)
  return value
}
const token = requiredEnvironment('VOID_TOKEN')
const apiUrl = requiredEnvironment('VOID_API_URL')
const timeout = Number(process.env.VOID_SMOKE_TIMEOUT_MS ?? 90000)
assert(
  Number.isFinite(timeout) && timeout > 0,
  'VOID_SMOKE_TIMEOUT_MS must be positive',
)
const runId = randomUUID()
const rootId = `smoke-root-${runId}`
const childId = `smoke-child-${runId}`
const storage = memoryEventStorage()
const sum = checksumOf(config)
let requestsWithConfig = 0
const progress = (stage: string, details: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ stage, ...details }))

async function poll<A>(
  name: string,
  read: () => Promise<A>,
  ready: (value: A) => boolean,
  timeoutMs = timeout,
): Promise<A> {
  const deadline = Date.now() + timeoutMs
  do {
    const value = await read()
    if (ready(value)) return value
    await delay(500)
  } while (Date.now() < deadline)
  throw new Error(`Timed out waiting for ${name}`)
}

const client = createVoid(
  defineConfig({ schema: config.schema, eventStorage: [storage] }),
  {
    apiUrl,
    token,
    fetch: async (input, init) => {
      const request = new Request(input, init)
      assert.equal(request.headers.get('x-void-config'), sum)
      assert.equal(request.headers.get('polar-version'), '2026-04')
      requestsWithConfig++
      return globalThis.fetch(request)
    },
  },
)
const temporary = await mkdtemp(join(tmpdir(), 'polar-void-smoke-'))
const credentials = join(temporary, 'credentials.json')
const cliEnvironment = {
  ...process.env,
  VOID_API_URL: apiUrl,
  VOID_TOKEN: token,
  VOID_CREDENTIALS_FILE: credentials,
  NO_COLOR: '1',
}

async function cli(command: string, savedLogin = true): Promise<string> {
  const environment: NodeJS.ProcessEnv = { ...cliEnvironment }
  if (savedLogin) delete environment.VOID_TOKEN
  const args = [join(packageDirectory, 'bin/void.mjs'), command]
  if (command === 'plan' || command === 'deploy')
    args.push('--config', configPath)
  try {
    const { stdout } = await execute(process.execPath, args, {
      cwd: temporary,
      env: environment,
      timeout,
      maxBuffer: 1024 * 1024,
    })
    return stdout
  } catch (error) {
    throw new Error(
      `CLI ${command} failed: ${String(error).replaceAll(token, '[redacted]')}`,
    )
  }
}

async function definitions() {
  const [reducers, meters, products, entitlements] = await Promise.all([
    client.api.reducers.list(),
    client.api.meters.list(),
    client.api.products.list({}),
    client.api.entitlements.list(),
  ])
  return { reducers, meters, products, entitlements }
}

function receiptIncludes(state: Wire.CustomerState, id: string): boolean {
  return state.buckets.some((bucket) =>
    bucket.last_processed_event?.event_ids?.includes(id),
  )
}

try {
  const organization = await client.api.organizations.current()
  assert.match(await cli('login', false), /Logged in/)
  assert.equal((await stat(credentials)).mode & 0o777, 0o600)
  const beforePlan = await definitions()
  await cli('plan')
  assert.deepEqual(await definitions(), beforePlan)
  await cli('deploy')
  const deployed = await definitions()
  const meter = deployed.meters.find(
    (item) => item.slug === config.schema.units.key,
  )
  assert(meter?.version_id, 'Deployment must produce a meter version')
  const draft = await client.api.deploys.latest({
    version_id: meter.version_id,
  })
  assert.equal(draft.status, 'draft')
  assert.equal(
    (await client.api.organizations.current()).active_version_id,
    null,
  )
  await cli(`activate --id ${draft.id}`)
  await client.refresh()
  const firstDeploy = await client.api.deploys.latest()
  assert.equal(firstDeploy.id, draft.id)
  assert.equal(firstDeploy.status, 'active')
  await cli('deploy --activate')
  const secondDeploy = await client.api.deploys.latest()
  // An identical configuration is the same deployment, not a new one.
  assert.equal(firstDeploy.id, secondDeploy.id)
  assert.equal(firstDeploy.version_id, secondDeploy.version_id)
  assert.equal(secondDeploy.checksum, sum)
  assert.deepEqual(await definitions(), deployed)
  progress('deployment_verified', {
    organization_id: organization.id,
    version_id: meter.version_id,
  })

  const root = await client.root(rootId)
  const child = await root.spawn(childId)
  assert.deepEqual(await child.chain(), [childId, rootId])
  const customer = await client.api.customers.create({
    external_id: rootId,
    email: `void-smoke+${runId}@polar.sh`,
    name: 'Void smoke customer',
  })
  assert.equal((await child.customer())?.id, customer.id)
  const native = await globalThis.fetch(
    new URL(`/v1/customers/${customer.id}`, apiUrl),
    {
      headers: { Authorization: `Bearer ${token}`, 'Polar-Version': '2026-04' },
    },
  )
  assert.equal(
    native.status,
    200,
    'Void binding must point to a native Polar customer',
  )
  const nativeCustomer: unknown = await native.json()
  assert(
    nativeCustomer &&
      typeof nativeCustomer === 'object' &&
      'id' in nativeCustomer &&
      'external_id' in nativeCustomer,
  )
  assert.equal(nativeCustomer.id, customer.id)
  assert.equal(nativeCustomer.external_id, rootId)

  const now = new Date()
  const thisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
  const previousMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  )
  const historicalAt = new Date(previousMonth.getTime() + 86400000)
  const historicalId = `smoke-history-${runId}`
  await child.events.usage.record(
    { units: 125 },
    { id: historicalId, timestamp: historicalAt },
  )
  await poll(
    'historical usage receipt',
    () =>
      client.api.customers.state(rootId, {
        since: previousMonth.toISOString(),
      }),
    (state) => receiptIncludes(state, historicalId),
  )
  const subscription = await root.products.pro.subscribe({
    startsAt: previousMonth,
  })
  await poll(
    'inherited product entitlement',
    () => child.entitlements.support.has(),
    Boolean,
  )
  await poll(
    'recurring meter',
    () => child.meters.units.balance({ reconcile: false }),
    (balance) => balance.remaining === 100,
  )
  progress('cycle_ready', { subscription_id: subscription.id })
  const cycles = await poll(
    'meter cycle settlement',
    () => root.subscriptions.cycles(subscription.id),
    (items) =>
      items.some(
        (cycle) => Date.parse(cycle.period_end) === thisMonth.getTime(),
      ),
    Math.max(timeout, 360000),
  )
  const cycle = cycles.find(
    (item) => Date.parse(item.period_end) === thisMonth.getTime(),
  )
  assert(cycle)
  assert.equal(Number(cycle.total), 49.05)
  assert.equal(cycle.meters[0]?.usage, 25)
  progress('cycle_verified')

  const offlineEvent: Required<Wire.EventCreate> = {
    name: config.schema.usage.name,
    external_id: `smoke-offline-${runId}`,
    external_identity_id: childId,
    timestamp: new Date().toISOString(),
    metadata: { units: 7 },
  }
  await storage.persist(organization.id, [offlineEvent])
  const local = await child.meters.units.balance()
  assert.equal(local.remaining, 93)
  assert.equal(local.reconciliation?.localAdjustment, -7)
  assert.equal(
    (await child.meters.units.balance({ reconcile: false })).remaining,
    100,
  )
  const accepted = await client.api.events.ingest([offlineEvent])
  assert.equal(accepted.saved, 1)
  const duplicate = await client.api.events.ingest([offlineEvent])
  assert.equal(duplicate.ignored, 1)
  await poll(
    'current usage receipt',
    () =>
      client.api.customers.state(rootId, { since: thisMonth.toISOString() }),
    (state) => receiptIncludes(state, offlineEvent.external_id),
  )
  assert.equal((await child.meters.units.balance()).remaining, 93)
  assert.equal(
    (await child.meters.units.balance({ reconcile: false })).remaining,
    93,
  )
  assert.equal(
    (await child.meters.units.check({ estimate: 94 })).allowed,
    false,
  )
  assert.equal((await child.meters.units.check({ estimate: 93 })).allowed, true)
  const events = await client.api.events.list({
    external_identity_id: childId,
    name: config.schema.usage.name,
    limit: 100,
  })
  assert.equal(
    events.items.filter(
      (event) => event.external_id === offlineEvent.external_id,
    ).length,
    1,
  )

  await child.setEntitlements(
    {
      features: [config.schema.support],
      meters: [{ meter: config.schema.units, cap: 10 }],
    },
    { id: `smoke-cap-${runId}` },
  )
  await poll(
    'child usage cap',
    () => child.meters.units.balance({ reconcile: false }),
    (balance) => balance.remaining === 3,
  )
  assert.equal((await child.meters.units.balance()).remaining, 3)
  assert.equal((await child.meters.units.check({ estimate: 4 })).allowed, false)
  assert.equal((await child.snapshot()).meters.units.remaining, 3)
  progress('reconciliation_verified', { remaining: 3 })

  const prepaid = await client.root(`smoke-prepaid-${runId}`)
  await prepaid.events.grant.record(
    { units: 40 },
    { id: `smoke-grant-${runId}` },
  )
  await poll(
    'prepaid credits',
    () =>
      client.api.meters.balance(meter.id, { external_identity_id: prepaid.id }),
    (balance) => balance.remaining === 40 && balance.subscription === null,
  )
  const previewBefore = await definitions()
  const ir = compile(config)
  const preview = await client.api.deploys.create({
    checksum: sum,
    dry_run: true,
    reducers: ir.reducers,
    meters: ir.meters.map((item) => ({ ...item, unit_amount: '0.004' })),
    entitlements: ir.entitlements,
    products: ir.products,
    preview: {
      start: previousMonth.toISOString().slice(0, 10),
      end: thisMonth.toISOString().slice(0, 10),
    },
  })
  assert(
    preview.entries.some(
      (entry) =>
        entry.price_preview &&
        Number(entry.price_preview.proposed_amount) >
          Number(entry.price_preview.current_amount),
    ),
  )
  assert.deepEqual(await definitions(), previewBefore)
  assert.equal((await client.api.deploys.latest()).id, secondDeploy.id)

  const canceled = await root.subscriptions.cancel(subscription.id, {
    atPeriodEnd: true,
  })
  assert.equal(canceled.status, 'canceled')
  assert.equal(await child.entitlements.support.has(), true)
  const revoked = await root.subscriptions.revoke(subscription.id)
  assert.equal(revoked.status, 'revoked')
  await poll(
    'revoked feature access',
    () => child.entitlements.support.has(),
    (held) => !held,
  )
  await poll(
    'revoked credit access',
    () => child.meters.units.balance({ reconcile: false }),
    (balance) => balance.remaining === 0,
  )
  assert(requestsWithConfig > 0)
  progress('complete', {
    root_id: rootId,
    customer_id: customer.id,
    requests_with_config: requestsWithConfig,
  })
} finally {
  await client.dispose()
  await rm(temporary, { recursive: true, force: true })
}
