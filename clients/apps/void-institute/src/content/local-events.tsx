import type { Lesson } from '@/lesson/types'
import type { Row } from '@/scenes/ledger'
import { TwoLedgers } from '@/scenes/TwoLedgers'
import { defineConfig } from '@void/sdk/config'
import { code } from './code'

/** Acme's prepaid wallet from the meters chapter: 1,000 granted, 640 spent on the server. */
const CREDITS = 1_000
const SERVER_USAGE = 640
/** The SDK's default, read off an empty config rather than typed here. */
export const DEFAULT_RETENTION = defineConfig({ schema: {} }).eventRetention
const RETENTION_DAYS = DEFAULT_RETENTION / 86_400_000

const first: Row = {
  id: 'evt_01',
  amount: 30,
  state: 'local',
  note: 'POST /events → 202',
}
const firstCounted: Row = {
  ...first,
  state: 'confirmed',
  note: 'receipt in bucket',
}
const failed: Row = {
  id: 'evt_02',
  amount: 45,
  state: 'pending',
  note: '503 from the API',
}
const refused: Row = {
  id: 'evt_03',
  amount: 20,
  state: 'rejected',
  note: '422 unknown event name',
}
const stale: Row = {
  id: 'evt_00',
  amount: 12,
  state: 'pending',
  note: `recorded ${RETENTION_DAYS + 1} days ago, never confirmed`,
}
const swept: Row = { ...stale, state: 'pruned' }
const fourth: Row = {
  id: 'evt_04',
  amount: 10,
  state: 'local',
  note: 'POST /events → 202',
}

export const frames: Record<string, readonly Row[]> = {
  empty: [],
  recorded: [first],
  confirmed: [firstCounted],
  failed: [firstCounted, failed],
  refused: [firstCounted, failed, refused],
  stale: [stale, firstCounted, failed, refused],
  swept: [swept, firstCounted, failed, refused, fourth],
}

const scene = (
  frame: keyof typeof frames,
  extra: Partial<Parameters<typeof TwoLedgers>[0]> = {},
) => (
  <TwoLedgers
    rows={frames[frame]!}
    credits={CREDITS}
    serverUsage={SERVER_USAGE}
    {...extra}
  />
)

const VOID_SQLITE = `import { DatabaseSync } from 'node:sqlite'
import { defineConfig } from '@void/sdk/config'
import * as schema from './schema'

const events = new DatabaseSync('data/void.db')

export const config = defineConfig({
  schema,
  eventStorage: [{ type: 'sqlite', connection: events }],
})
`

const RECORD = `const actor = client.as('acme')

await actor.events.used.record({ amount: 30, kind: 'completion' }, { id: 'evt_01' })
// 1. written to data/void.db
// 2. POST /v1/void/events → 202, durably accepted
// 3. the worker recomputes the reducer; the balance catches up later
`

const CHECK = `const result = await actor.meters.credits.check({ estimate: 50 })

result.remaining // 330: the server's 360 with evt_01 merged in
result.reconciliation
// {
//   applied: true,          unprocessed local events contributed
//   eventCount: 1,
//   remoteRemaining: 360,   what the server alone would say
//   localAdjustment: -30,
// }
`

const CONFIRMED = `const result = await actor.meters.credits.check({ estimate: 50 })

result.remaining // 330, now from the server alone
result.reconciliation // { applied: false, eventCount: 0, remoteRemaining: 330, localAdjustment: 0 }

// The receipt named evt_01, so the check deleted it from data/void.db
// in the background. flush() waits for that.
await client.flush()
`

const FAILED = `try {
  await actor.events.used.record({ amount: 45, kind: 'completion' }, { id: 'evt_02' })
} catch (error) {
  // VoidHttpError 503: stored locally, not accepted. Nothing retries for you.
}

// Later, the same id again: the stored copy wins, the upload is retried.
await actor.events.used.record({ amount: 45, kind: 'completion' }, { id: 'evt_02' })
`

const REFUSED = `try {
  await actor.events.used.record({ amount: 20, kind: 'completion' }, { id: 'evt_03' })
} catch (error) {
  // VoidHttpError 422: the API refused it. Marked in polar_void_rejected_events.
}

await actor.meters.credits.balance() // evt_03 is excluded until evt_03 is recorded again
await actor.meters.credits.balance({ reconcile: false }) // the server's view only
`

const SERVERLESS = `import { after } from 'next/server'

export const POST = async (request: Request) => {
  const actor = client.from(request.headers)
  await actor.events.used.record({ amount: 30, kind: 'completion' }, { id })

  // The receipt delete runs after the response; a frozen instance would lose it.
  after(() => client.flush())
  return Response.json({ ok: true })
}
`

const RETENTION = `export const config = defineConfig({
  schema,
  eventStorage: [{ type: 'sqlite', connection: events }],
  eventRetention: ${RETENTION_DAYS} * 24 * 60 * 60 * 1000, // the default
})

// Every record() deletes this organization's events recorded more than
// eventRetention ago, in the same write. Reconciliation reads only inside it.
`

const POSTGRES = `import { Pool } from 'pg'
import { postgresEventStorage } from '@void/sdk'
import { defineConfig } from '@void/sdk/config'
import * as schema from './schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const config = defineConfig({
  schema,
  eventStorage: [postgresEventStorage(pool)],
})

// or, on Upstash:
// eventStorage: [redisEventStorage(Redis.fromEnv())]
`

export const localEventsLesson: Lesson = {
  slug: 'local-events',
  title: 'Local events',
  summary: 'Read your own writes before the server has counted them.',
  file: 'record.ts',
  steps: [
    {
      id: 'storage',
      prose: (
        <>
          <p>
            Ingestion is asynchronous: the API accepts an event, a worker folds
            it into the reducers later. Between the two, a check that only asks
            the server would not see what you just recorded.
          </p>
          <p>
            {code('eventStorage')} closes that gap. Give the config a local
            ledger, here a SQLite file, and the SDK keeps every event there
            until the server proves it counted it.
          </p>
        </>
      ),
      code: VOID_SQLITE,
      file: 'void.ts',
      focus: [5, 9],
      scene: scene('empty'),
    },
    {
      id: 'record',
      prose: (
        <>
          <p>
            {code('record')} writes to every configured storage first, in one
            atomic batch, then posts the event. The API answers 202 once it is
            durably accepted; counting happens later.
          </p>
          <p>
            The row sits on the left, waiting for a receipt. Pass your own{' '}
            {code('id')}: it is the idempotency key for everything that follows.
          </p>
        </>
      ),
      code: RECORD,
      focus: [3, 4, 5, 6],
      scene: scene('recorded'),
    },
    {
      id: 'check',
      prose: (
        <>
          <p>
            A check loads the customer&apos;s state from the server and merges
            the local events inside the window before evaluating the estimate.
            Acme reads 330, not 360, and the answer says how it got there.
          </p>
          <p>
            Each server bucket carries the exact ids it included, so an event
            the server has already counted is never counted twice, even at the
            same timestamp.
          </p>
        </>
      ),
      code: CHECK,
      focus: [3, 4, 5, 6, 7, 8, 9, 10],
      scene: scene('recorded', { showReconciliation: true }),
    },
    {
      id: 'confirmed',
      prose: (
        <>
          <p>
            The worker catches up and the next check sees a receipt for evt_01.
            The balance is the same 330, but it is the server&apos;s now, and
            the local copy is deleted in the background.
          </p>
          <p>
            The buffer is not an archive. The server is the source of truth, and
            a local event only matters until the server has counted it.
          </p>
        </>
      ),
      code: CONFIRMED,
      focus: [3, 4, 8],
      scene: scene('confirmed', { showReconciliation: true }),
    },
    {
      id: 'failed',
      prose: (
        <>
          <p>
            An upload that fails with a network error or a 5xx stays local and
            keeps counting: the SDK assumes the event is real and the server is
            behind. Nothing is retried for you.
          </p>
          <p>
            Retry with the same id. Persisting is idempotent, the first stored
            copy wins, and the upload goes again. A retry with different data
            for an existing id is a bug the SDK surfaces, not one it hides.
          </p>
        </>
      ),
      code: FAILED,
      focus: [1, 2, 3, 4, 5, 8],
      scene: scene('failed'),
    },
    {
      id: 'refused',
      prose: (
        <>
          <p>
            A 4xx is different: the API looked and said no. The event is marked
            rejected and leaves reconciliation, so a typo in an event name
            cannot haunt the balance. Recording the same id again clears the
            mark.
          </p>
          <p>
            {code('balance()')} reconciles too, by default;{' '}
            {code('balance({ reconcile: false })')} is the server&apos;s view
            alone.
          </p>
        </>
      ),
      code: REFUSED,
      focus: [1, 2, 3, 4, 5, 7, 8],
      scene: scene('refused'),
    },
    {
      id: 'serverless',
      prose: (
        <>
          <p>
            The receipt delete is background work. On a serverless platform an
            instance can be frozen right after the response, so hand{' '}
            {code('client.flush()')} to the platform&apos;s after-response hook.{' '}
            {code('dispose()')} flushes first, then shuts the runtime down.
          </p>
          <p>
            Without it nothing is lost, only kept: the retention backstop bounds
            the buffer.
          </p>
        </>
      ),
      code: SERVERLESS,
      file: 'route.ts',
      focus: [8],
      scene: scene('refused'),
    },
    {
      id: 'retention',
      prose: (
        <>
          <p>
            Every {code('record')} deletes the organization&apos;s events
            recorded more than {code('eventRetention')} ago, in the same write.
            The default is {RETENTION_DAYS} days.
          </p>
          <p>
            Only events the server never accepted are affected, and for those
            the server&apos;s view is the correct one. The bound is recording
            time, so a backdated event recorded now stays visible.
          </p>
        </>
      ),
      code: RETENTION,
      file: 'void.ts',
      focus: [4, 7, 8],
      scene: scene('swept'),
    },
    {
      id: 'postgres',
      prose: (
        <>
          <p>
            A SQLite file belongs to one process, so on serverless one instance
            cannot see what another recorded. Use Postgres: every instance
            shares one ledger. Each operation is a single statement with no
            transaction, so PgBouncer and one-shot HTTP drivers work.
          </p>
          <p>
            Redis is the same ledger over Lua scripts, with keys that expire at
            the retention. Any adapter implementing {code('EventStorage')} fits;{' '}
            {code('memoryEventStorage()')} is the reference for tests.
          </p>
        </>
      ),
      code: POSTGRES,
      file: 'void.ts',
      focus: [2, 6, 10, 14],
      scene: scene('swept', { storage: 'postgres · shared' }),
    },
  ],
}
