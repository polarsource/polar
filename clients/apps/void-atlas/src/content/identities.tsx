import type { Lesson } from '@/lesson/types'
import { IdentityTree } from '@/scenes/IdentityTree'
import type { Tree, TreeNode } from '@/scenes/tree'
import {
  compile,
  defineConfig,
  entitlement,
  event,
  included,
  meter,
  product,
  recurring,
  sum,
  usd,
  type Config,
} from '@void/sdk/config'
import { code } from './code'

export const page = event<{ bytes: number; status: string }>('crawl.page')
export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})
export const priority = entitlement('priority', { name: 'Priority crawling' })
export const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [included(bandwidth, 1_000_000, { limit: 'hard' })],
  entitlements: [priority],
})
export const config: Config = defineConfig({
  schema: { page, bandwidth, priority, pro },
})

const ir = compile(config)
const holder = {
  id: 'acme',
  term: ir.products[0]!.meters[0]!,
  features: ir.products[0]!.entitlements,
}

const RECORDED = 48_211
const acme: TreeNode = { id: 'acme', parent: null, usage: 0 }
const alice: TreeNode = { id: 'alice', parent: 'acme', usage: 0 }
const bob: TreeNode = { id: 'bob', parent: 'acme', usage: 380_000 }
const nightly: TreeNode = { id: 'nightly', parent: 'alice', usage: 60_000 }
const nightlyAfter: TreeNode = { ...nightly, usage: nightly.usage + RECORDED }
const aliceCapped: TreeNode = { ...alice, cap: 150_000 }
const bobDenied: TreeNode = { ...bob, features: [] }
const batch: TreeNode = {
  id: 'batch',
  parent: 'bob',
  usage: 0,
  cap: 20_000,
  features: [],
}

export const trees: Record<string, Tree> = {
  root: { nodes: [acme], holder },
  spawned: { nodes: [acme, alice, bob, nightly], holder },
  recorded: { nodes: [acme, alice, bob, nightlyAfter], holder },
  capped: { nodes: [acme, aliceCapped, bob, nightlyAfter], holder },
  denied: { nodes: [acme, aliceCapped, bobDenied, nightlyAfter], holder },
  batch: { nodes: [acme, aliceCapped, bobDenied, nightlyAfter, batch], holder },
}

const VOID_TS = `import {
  entitlement,
  event,
  included,
  meter,
  product,
  recurring,
  sum,
  usd,
} from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')

export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})

export const priority = entitlement('priority', { name: 'Priority crawling' })

export const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [included(bandwidth, 1_000_000, { limit: 'hard' })],
  entitlements: [priority],
})
`

const HEAD = `import { createVoid } from '@void/sdk'
import { bandwidth, config, priority } from './void'

const client = createVoid(config, { apiUrl, token })
`

const ROOT = `${HEAD}
const acme = await client.root('acme')
`

const SPAWN = `${HEAD}
const acme = await client.root('acme')
const alice = await acme.spawn('alice')
const bob = await acme.spawn('bob')
const nightly = await alice.spawn('nightly')

await nightly.chain() // ['nightly', 'alice', 'acme']
`

const RECORD = `${HEAD}
const acme = await client.root('acme')
const alice = await acme.spawn('alice')
const bob = await acme.spawn('bob')
const nightly = await alice.spawn('nightly')

const actor = client.as('nightly')
await actor.events.page.record({ bytes: 48_211, status: 'ok' })
`

const CHECK = `${RECORD}
const result = await actor.meters.bandwidth.check({ estimate: 50_000 })
// result.allowed, result.limitedBy is 'acme'
`

const CAP = `${RECORD}
await alice.cap(bandwidth, 150_000)

const result = await actor.meters.bandwidth.check({ estimate: 50_000 })
// !result.allowed, result.limitedBy is 'alice', result.reason is 'cap'
`

const DENY = `${RECORD}
await alice.cap(bandwidth, 150_000)
await bob.deny(priority)
`

const BATCH = `${RECORD}
await alice.cap(bandwidth, 150_000)
await bob.deny(priority)

const batch = await bob.spawn('batch', {
  entitlements: { features: [], meters: [{ meter: bandwidth, cap: 20_000 }] },
})
`

const NAVIGATE = `${HEAD}
const nightly = client.as('nightly')

await nightly.parent() // alice
await nightly.root() // acme
await nightly.chain() // ['nightly', 'alice', 'acme']
await nightly.customer() // the Polar customer bound to acme
await nightly.snapshot() // identity, customer and every meter balance at one instant
`

export const identitiesLesson: Lesson = {
  slug: 'identities',
  title: 'Identities',
  summary: 'A tree where usage climbs up and entitlements narrow down.',
  file: 'identities.ts',
  steps: [
    {
      id: 'config',
      prose: (
        <>
          <p>
            One more thing in the config before we start: an{' '}
            {code('entitlement')} is a feature flag a product grants. Pro
            includes a million bytes and priority crawling.
          </p>
          <p>
            Products, meters and entitlements are all we deploy. Who holds them,
            and who spends against them, is decided at runtime by identities.
          </p>
        </>
      ),
      code: VOID_TS,
      file: 'void.ts',
      focus: [18, 20, 21, 22, 23, 24, 25],
      layout: 'code',
    },
    {
      id: 'root',
      prose: (
        <>
          <p>
            An identity is who usage is recorded against. A root is a tree with
            no parent. It is what a Polar customer binds to and what a
            subscription attaches to, so the root is the holder.
          </p>
          <p>
            {code('root')} creates it; {code('as')} is a lookup that creates
            nothing; {code('ensure')} is the idempotent form that takes a
            parent.
          </p>
        </>
      ),
      code: ROOT,
      focus: [6],
      scene: <IdentityTree tree={trees.root!} />,
    },
    {
      id: 'spawn',
      prose: (
        <>
          <p>
            {code('spawn')} makes a child. Members under the organization,
            agents under a member, as deep as you like. A child inherits
            everything its parent has and can be given less, never more.
          </p>
          <p>
            {code('chain')} lists the way up. A parent is set on first touch and
            never changes.
          </p>
        </>
      ),
      code: SPAWN,
      focus: [7, 8, 9, 11],
      scene: <IdentityTree tree={trees.spawned!} />,
    },
    {
      id: 'record',
      prose: (
        <>
          <p>
            Record usage on the identity that caused it. The event is
            nightly&apos;s, and it counts for alice and for acme too: usage
            folds into every ancestor on its way up.
          </p>
          <p>
            That is why the holder&apos;s credits cover its whole subtree.
            Acme&apos;s number is the whole organization&apos;s spend.
          </p>
        </>
      ),
      code: RECORD,
      focus: [11, 12],
      scene: (
        <IdentityTree
          tree={trees.recorded!}
          pulse={{ id: 'record-1', from: 'nightly', amount: RECORDED }}
        />
      ),
    },
    {
      id: 'check',
      prose: (
        <>
          <p>
            A check on a leaf walks the chain. Nightly holds nothing, alice
            holds nothing, acme holds the plan, so acme answers. The tightest
            holder on the way up always does.
          </p>
          <p>
            Fifty thousand bytes fit in what acme has left. {code('limitedBy')}{' '}
            says who decided, which matters once the chain has more than one
            voice.
          </p>
        </>
      ),
      code: CHECK,
      focus: [14, 15],
      scene: (
        <IdentityTree
          tree={trees.recorded!}
          check={{ id: 'nightly', estimate: 50_000 }}
        />
      ),
    },
    {
      id: 'cap',
      prose: (
        <>
          <p>
            {code('cap')} narrows an inherited meter for a subtree. Alice and
            everything under her may spend 150,000 bytes of acme&apos;s million.
            It reserves nothing and follows the root&apos;s period.
          </p>
          <p>
            The same check now fails, and it fails at alice, not at acme.
            Passing {code('null')} lifts the cap again.
          </p>
        </>
      ),
      code: CAP,
      focus: [14, 16, 17],
      scene: (
        <IdentityTree
          tree={trees.capped!}
          check={{ id: 'nightly', estimate: 50_000 }}
        />
      ),
    },
    {
      id: 'deny',
      prose: (
        <>
          <p>
            Features narrow the same way. {code('deny')} takes one away from bob
            and everything under him; {code('allow')} gives it back. Alice and
            nightly still inherit it from acme.
          </p>
          <p>
            Both verbs edit one term and keep the rest. An identity that still
            inherits everything is first given the full list, so editing one
            term denies none of the others.
          </p>
        </>
      ),
      code: DENY,
      focus: [15],
      scene: <IdentityTree tree={trees.denied!} />,
    },
    {
      id: 'batch',
      prose: (
        <>
          <p>
            A child can start with its terms. {code('setEntitlements')} replaces
            every term at once: an omitted list inherits, an empty list denies.
            Batch gets no features and 20,000 bytes.
          </p>
          <p>
            Terms are recorded as events through a last-value reducer, so they
            take effect once processed. Give one edit a moment before the next.
          </p>
        </>
      ),
      code: BATCH,
      focus: [17, 18, 19],
      scene: <IdentityTree tree={trees.batch!} />,
    },
    {
      id: 'navigate',
      prose: (
        <>
          <p>
            Scopes are handles. Any identity can walk to its parent, its root
            and its chain, and {code('customer')} reads the Polar customer bound
            to the root, wherever in the tree you ask from.
          </p>
          <p>
            Everything about money lives at the root. Children are how you
            account for it, and how you say no to a part of the tree without
            touching the plan.
          </p>
        </>
      ),
      code: NAVIGATE,
      focus: [8, 9, 10, 11],
      scene: <IdentityTree tree={trees.batch!} />,
    },
  ],
}
