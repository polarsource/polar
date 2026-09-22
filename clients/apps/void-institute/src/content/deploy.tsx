import type { Lesson } from '@/lesson/types'
import { Deployments, type Deployment, type Entry } from '@/scenes/Deployments'
import { short } from '@/scenes/hash'
import {
  checksumOf,
  count,
  defineConfig,
  event,
  included,
  meter,
  on,
  product,
  recurring,
  signal,
  sum,
  usd,
  type Config,
} from '@void/sdk/config'
import { code } from './code'

/*
 * One config edited six ways. Every hash on screen is `checksumOf` over the
 * real definitions, so the chapter cannot claim a change matters, or does
 * not, unless the compiler agrees.
 */
export const page = event<{ bytes: number; status: string }>('crawl.page')
export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})
export const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [included(bandwidth, 1_000_000, { limit: 'hard' })],
})
export const indexed = count('indexed', on(page, { status: 'ok' }))
const indexedChanged = count('indexed', on(page, { status: 'error' }))
const indexedErrors = count('indexed-errors', on(page, { status: 'error' }))
const storm = (when: string) =>
  signal('retry-storm', {
    meter: bandwidth,
    when,
    enter: { above: 0.7 },
    exit: { below: 0.4 },
  })

export const stages: Record<
  'base' | 'export' | 'runtime' | 'signal' | 'signalEdited' | 'filter' | 'slug',
  Config
> = {
  base: defineConfig({ schema: { page, bandwidth, pro } }),
  export: defineConfig({ schema: { page, bandwidth, pro, indexed } }),
  runtime: defineConfig({
    schema: { page, bandwidth, pro, indexed },
    signalRefreshInterval: 10_000,
    eventRetention: 3 * 86_400_000,
  }),
  signal: defineConfig({
    schema: {
      page,
      bandwidth,
      pro,
      indexed,
      storm: storm('most recent crawls are retries of the same host'),
    },
  }),
  signalEdited: defineConfig({
    schema: {
      page,
      bandwidth,
      pro,
      indexed,
      storm: storm('most recent crawls hit the same host again and again'),
    },
  }),
  filter: defineConfig({
    schema: { page, bandwidth, pro, indexed: indexedChanged },
  }),
  slug: defineConfig({ schema: { page, bandwidth, pro, indexedErrors } }),
}

export const hashes = Object.fromEntries(
  Object.entries(stages).map(([name, config]) => [name, checksumOf(config)]),
) as Record<keyof typeof stages, string>

const v1: Deployment = { label: 'v1', hash: hashes.base, status: 'active' }
const v2draft: Deployment = {
  label: 'v2',
  hash: hashes.export,
  status: 'draft',
}
const v2: Deployment = { ...v2draft, status: 'active' }
const v1old: Deployment = { ...v1, status: 'archived' }
const v3: Deployment = { label: 'v3', hash: hashes.signal, status: 'draft' }
const v4: Deployment = {
  label: 'v4',
  hash: hashes.signalEdited,
  status: 'draft',
}
const v5: Deployment = { label: 'v5', hash: hashes.slug, status: 'draft' }

const unchanged = (...keys: [string, string][]): Entry[] =>
  keys.map(([kind, key]) => ({ action: 'unchanged', kind, key }))
const baseEntries = unchanged(
  ['reducer', 'bandwidth'],
  ['meter', 'bandwidth'],
  ['product', 'pro'],
)

const PLAN = `$ void plan
acme (acme)  https://api.polar.sh

version ${hashes.base}
= reducer  bandwidth
= meter    bandwidth
= product  pro

3 unchanged
`

const DEPLOY = `$ void deploy
version ${hashes.export}
status  draft

+ reducer  indexed
= reducer  bandwidth
= meter    bandwidth
= product  pro

1 to create · 3 unchanged
applied deployment dep_01j9
`

const ACTIVATE = `$ void deploy --activate
version ${hashes.export}
status  active
activated deployment dep_01j9

# or later, by id
$ void activate --id dep_01j9
`

const RUNTIME = `export const config = defineConfig({
  schema: { page, bandwidth, pro, indexed },
  signalRefreshInterval: 10_000, // runtime only
  eventRetention: 3 * 24 * 60 * 60 * 1000, // runtime only
  eventStorage: [postgresEventStorage(pool)], // runtime only
})

// event<{ bytes: number; status: string }>  →  event<{ bytes: number; status: 'ok' | 'error' }>
// types are erased; only the name is compiled
`

const SIGNAL = `export const storm = signal('retry-storm', {
  meter: bandwidth,
  when: 'most recent crawls hit the same host again and again',
  enter: { above: 0.7 },
  exit: { below: 0.4 },
})
`

const FILTER = `// indexed was deployed as count(on(page, { status: 'ok' }))
export const indexed = count('indexed', on(page, { status: 'error' }))

$ void deploy
DeploymentConflict: reducer 'indexed' exists with a different filter, map or aggregation
`

const SLUG = `export const indexedErrors = count('indexed-errors', on(page, { status: 'error' }))

$ void deploy
version ${hashes.slug}
status  draft

+ reducer  indexed-errors
? reducer  indexed          not in this config; kept with its history
= reducer  bandwidth
= meter    bandwidth
= product  pro

1 to create · 3 unchanged · 1 orphaned
`

const PIN = `export const config = defineConfig({
  schema: { page, bandwidth, pro, indexedErrors },
  versionId: '${hashes.slug}',
})

// Every lookup this client makes resolves slugs against that draft,
// not the active deployment. Publishing is unaffected.
`

const PULL = `$ void pull
wrote void.json (version 4, ${short(hashes.export)}, active)

$ void plan --config void.json
version ${hashes.export}
3 unchanged

$ void pull --version v5 --ts   # best-effort TypeScript over the define API
`

export const deployLesson: Lesson = {
  slug: 'deploy',
  title: 'Deploy and versions',
  summary: 'What is hashed, what is not, and what goes live.',
  lang: 'bash',
  file: 'terminal',
  steps: [
    {
      id: 'plan',
      prose: (
        <>
          <p>
            {code('void plan')} compiles the module to its IR, hashes it, and
            asks the server to diff that against the organization&apos;s active
            deployment. It writes nothing.
          </p>
          <p>
            Every chapter so far said &ldquo;this is a new version&rdquo; or
            &ldquo;this changes nothing&rdquo;. This is where that is decided.
            The hash is SHA-256 over the IR with its keys sorted, and the
            runtime sends it on every request.
          </p>
        </>
      ),
      code: PLAN,
      focus: [4, 5, 6, 7],
      scene: (
        <Deployments
          command="void plan"
          deployments={[v1]}
          entries={baseEntries}
          pointer={v1.hash}
        />
      ),
    },
    {
      id: 'deploy',
      prose: (
        <>
          <p>
            Add an export and {code('void deploy')} applies the whole config
            atomically as a draft. A draft serves nobody yet. Pushing the same
            config again returns the same deployment, because the hash is the
            identity.
          </p>
          <p>
            One row per distinct hash. The plan says what each definition needs:
            create, replace, unchanged, orphan.
          </p>
        </>
      ),
      code: DEPLOY,
      focus: [2, 3, 5],
      scene: (
        <Deployments
          command="void deploy"
          deployments={[v2draft, v1]}
          entries={[
            { action: 'create', kind: 'reducer', key: 'indexed' },
            ...baseEntries,
          ]}
          pointer={v1.hash}
        />
      ),
    },
    {
      id: 'activate',
      prose: (
        <>
          <p>
            Activation is what puts a version in front of customers. One
            deployment is active per organization; activating the next one
            archives the previous. It needs an organization that has passed
            Polar&apos;s review.
          </p>
          <p>
            Runtime lookups follow the active version, and the client caches its
            slug-to-id table for a minute. A long-lived process that deploys
            through {code('client.api.deploys')} should call{' '}
            {code('client.refresh()')}.
          </p>
        </>
      ),
      code: ACTIVATE,
      focus: [1, 2, 3, 4],
      scene: (
        <Deployments
          command="void deploy --activate"
          deployments={[v2, v1old]}
          entries={[
            { action: 'create', kind: 'reducer', key: 'indexed' },
            ...baseEntries,
          ]}
          pointer={v2.hash}
        />
      ),
    },
    {
      id: 'runtime',
      prose: (
        <>
          <p>
            Not everything in {code('defineConfig')} is deployed. The refresh
            interval, the retention, the event storage and your handlers are
            runtime concerns. Event metadata types are erased. None of it
            reaches the IR, so none of it moves the hash.
          </p>
          <p>
            A plan after these edits reports every definition unchanged and the
            same version as before.
          </p>
        </>
      ),
      code: RUNTIME,
      lang: 'typescript',
      file: 'void.ts',
      focus: [3, 4, 5, 8, 9],
      scene: (
        <Deployments
          command="void plan"
          deployments={[v2, v1old]}
          entries={[
            { action: 'unchanged', kind: 'reducer', key: 'indexed' },
            ...baseEntries,
          ]}
          pointer={v2.hash}
        />
      ),
    },
    {
      id: 'signal',
      prose: (
        <>
          <p>
            A signal&apos;s thresholds and question are deployed, so editing the
            question is a new version, the same as editing a price. That is
            deliberate: a semantic criterion decides what a customer&apos;s code
            does and belongs under the same gate.
          </p>
          <p>
            The signal itself does not appear in the plan, since it lives in the
            deployment&apos;s configuration alone, but the hash moves.
          </p>
        </>
      ),
      code: SIGNAL,
      lang: 'typescript',
      file: 'void.ts',
      focus: [3],
      scene: (
        <Deployments
          command="void deploy"
          deployments={[v4, v3, v2, v1old]}
          entries={[
            { action: 'unchanged', kind: 'reducer', key: 'indexed' },
            ...baseEntries,
          ]}
          pointer={v2.hash}
        />
      ),
    },
    {
      id: 'filter',
      prose: (
        <>
          <p>
            A reducer&apos;s slug names its history. Change its filter, map or
            aggregation under the same slug and the server refuses: the buckets
            already computed for {code('indexed')} would mean something else.
          </p>
          <p>
            Meters are looser: a new price under the same slug is a{' '}
            {code('replace')}, because the reducer beneath it is unchanged.
          </p>
        </>
      ),
      code: FILTER,
      focus: [2, 5],
      scene: (
        <Deployments
          command="void deploy"
          deployments={[v4, v3, v2, v1old]}
          refused="reducer 'indexed' exists with a different filter, map or aggregation"
          pointer={v2.hash}
        />
      ),
    },
    {
      id: 'slug',
      prose: (
        <>
          <p>
            So give it a new slug. The old reducer is not in this config, so the
            plan marks it orphaned, and it is kept with everything it counted.
            Its slug stays reserved; a later config cannot reuse it for
            something else.
          </p>
          <p>
            Reading the old numbers is still possible through the API by id. The
            new slug starts empty and the server backfills what it can.
          </p>
        </>
      ),
      code: SLUG,
      focus: [1, 7, 8],
      scene: (
        <Deployments
          command="void deploy"
          deployments={[v5, v4, v3, v2, v1old]}
          entries={[
            { action: 'create', kind: 'reducer', key: 'indexed-errors' },
            {
              action: 'orphan',
              kind: 'reducer',
              key: 'indexed',
              note: 'kept with its history',
            },
            ...baseEntries,
          ]}
          pointer={v2.hash}
        />
      ),
    },
    {
      id: 'pin',
      prose: (
        <>
          <p>
            To test a draft before activating it, pin the client to it.{' '}
            {code('versionId')} makes every lookup resolve against that hash
            instead of the active deployment. It is a runtime setting, so it
            does not change what you publish.
          </p>
          <p>
            Without a pin, every client of every version of your code talks to
            the one active deployment.
          </p>
        </>
      ),
      code: PIN,
      lang: 'typescript',
      file: 'void.ts',
      focus: [3],
      scene: (
        <Deployments
          command="node app.js"
          deployments={[v5, v4, v3, v2, v1old]}
          pointer={v5.hash}
          pinned
        />
      ),
    },
    {
      id: 'pull',
      prose: (
        <>
          <p>
            {code('void pull')} writes the active deployment&apos;s IR to{' '}
            {code('void.json')}. The CLI deploys that file as it is, so a pulled
            config always plans as unchanged: the IR is the contract, the
            TypeScript is how you write it.
          </p>
          <p>
            {code('--ts')} recovers best-effort TypeScript over the define API
            and warns when it compiles to a different version. Plugins and
            runtime options are not part of a deployment and are not recovered.
          </p>
        </>
      ),
      code: PULL,
      focus: [1, 2, 4, 5, 6],
      scene: (
        <Deployments
          command="void pull"
          deployments={[v5, v4, v3, v2, v1old]}
          entries={[
            { action: 'unchanged', kind: 'reducer', key: 'indexed' },
            ...baseEntries,
          ]}
          pointer={v2.hash}
        />
      ),
    },
  ],
}
