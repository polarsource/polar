import type { Lesson } from '@/lesson/types'
import { MeterGauge } from '@/scenes/MeterGauge'
import {
  compile,
  defineConfig,
  type Config,
  event,
  included,
  meter,
  product,
  recurring,
  sum,
  usd,
} from '@void/sdk/config'
import { credits } from '@void/sdk/plugins'
import { code } from './code'

export const page = event<{ bytes: number; status: string }>('crawl.page')
export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})
const pricing = recurring({ interval: 'month', amount: usd(49) })
export const payPerUse = product('pro', {
  name: 'Pro',
  price: pricing,
  meters: [bandwidth],
})
export const hard = product('pro', {
  name: 'Pro',
  price: pricing,
  meters: [included(bandwidth, 1_000_000, { limit: 'hard' })],
})
export const soft = product('pro', {
  name: 'Pro',
  price: pricing,
  meters: [included(bandwidth, 1_000_000, { limit: 'soft' })],
})
const wallet = credits({ key: 'wallet', price: usd(0) })

export const stages: Record<
  'meter' | 'payPerUse' | 'hard' | 'soft' | 'wallet',
  Config
> = {
  meter: defineConfig({ schema: { page, bandwidth } }),
  payPerUse: defineConfig({ schema: { page, bandwidth, pro: payPerUse } }),
  hard: defineConfig({ schema: { page, bandwidth, pro: hard } }),
  soft: defineConfig({ schema: { page, bandwidth, pro: soft } }),
  wallet: defineConfig({ schema: { page, bandwidth, pro: soft, wallet } }),
}

const term = (stage: 'payPerUse' | 'hard' | 'soft') =>
  compile(stages[stage]).products[0]!.meters[0]!
const bandwidthIr = compile(stages.meter).meters[0]!
const walletIr = compile(stages.wallet).meters.find((m) => m.slug === 'wallet')!

/** What acme has spent this period, from the reducers chapter's stream. */
const USAGE = 522_131

const METER = `import { event, meter, sum, usd } from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')

export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})
`

const PRODUCT = `import { event, meter, product, recurring, sum, usd } from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')

export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})

export const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [bandwidth],
})
`

const productWith = (terms: string) => `import {
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

export const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [${terms}],
})
`

const HARD = productWith("included(bandwidth, 1_000_000, { limit: 'hard' })")
const SOFT = productWith("included(bandwidth, 1_000_000, { limit: 'soft' })")

const CHECK = `const actor = client.as('acme')

const result = await actor.meters.bandwidth.check({ estimate: 600_000 })
if (!result.allowed) {
  // result.reason is 'cap', result.limitedBy is 'acme'
  throw new Error(\`bandwidth cap reached, \${result.remaining} left\`)
}

await crawl(url)
await actor.events.page.record({ bytes, status: 'ok' })
`

const WALLET = `${SOFT.replace(/\n$/, '')}

const wallet = credits({ key: 'wallet', price: usd(0) })
`.replace(
  "} from '@void/sdk'\n",
  "} from '@void/sdk'\nimport { credits } from '@void/sdk/plugins'\n",
)

const GRANT = `const actor = client.as('acme')

await actor.wallet.grant(1_000, { reason: 'starter pack' })

await actor.wallet.charge(120, async () => generate(prompt))

const balance = await actor.wallet.credits.balance()
// balance.credits is 1000, balance.usage is what charge settled
`

const CUSTOMER = `await client.api.customers.create({
  external_id: 'acme',
  email: billingEmail,
  name: 'Acme',
})

// Polar now bills acme: a Pro subscription makes acme the holder
// of bandwidth's allowance, and every identity under acme spends it.
const standing = await client.as('acme').meters.bandwidth.balance()
`

const JSON_IR = JSON.stringify(
  {
    meters: compile(stages.wallet).meters,
    products: compile(stages.wallet).products,
  },
  null,
  2,
)

export const metersLesson: Lesson = {
  slug: 'meters',
  title: 'Meters and products',
  summary: 'Price a reducer, include an allowance, check before you spend.',
  steps: [
    {
      id: 'meter',
      prose: (
        <>
          <p>
            A meter is a reducer with a price. Every unit the reducer counts
            costs this much, and the meter is what a product, a check and a
            balance talk about.
          </p>
          <p>
            A price alone bills nobody. Acme has spent half a million bytes, but
            nothing up its chain holds a plan, so a check would say{' '}
            {code('no_plan')}.
          </p>
        </>
      ),
      code: METER,
      focus: [5, 6, 7, 8],
      scene: (
        <MeterGauge
          meter={bandwidthIr}
          holder={{ kind: 'none' }}
          usage={USAGE}
          unit="bytes"
        />
      ),
    },
    {
      id: 'product',
      prose: (
        <>
          <p>
            A product is what a customer subscribes to: a recurring price and
            the meters it covers. Acme on Pro becomes the holder, and every
            identity under acme spends against it.
          </p>
          <p>
            A bare meter on a product is pay per use. Nothing is included and
            nothing is ever denied; usage is billed at the meter&apos;s price at
            the end of each period.
          </p>
        </>
      ),
      code: PRODUCT,
      focus: [10, 11, 12, 13, 14],
      scene: (
        <MeterGauge
          meter={bandwidthIr}
          holder={{ kind: 'subscription', id: 'acme', term: term('payPerUse') }}
          usage={USAGE}
          unit="bytes"
        />
      ),
    },
    {
      id: 'included',
      prose: (
        <>
          <p>
            {code('included')} grants credits at the start of every period. A
            million bytes a month, and {code("limit: 'hard'")} means the meter
            denies once they are spent.
          </p>
          <p>
            The gauge fills against the allowance now. {code('remaining')} is
            what the holder has left, and {code('limitedBy')} names the holder.
          </p>
        </>
      ),
      code: HARD,
      focus: [21],
      scene: (
        <MeterGauge
          meter={bandwidthIr}
          holder={{ kind: 'subscription', id: 'acme', term: term('hard') }}
          usage={USAGE}
          unit="bytes"
        />
      ),
    },
    {
      id: 'check',
      prose: (
        <>
          <p>
            Before doing the work, ask. {code('check')} compares an estimate
            against every holder from this identity up to the root and returns
            the tightest one&apos;s answer.
          </p>
          <p>
            Six hundred thousand bytes will not fit in what is left, so the hard
            limit denies with {code("reason: 'cap'")}. A check spends nothing
            and reserves nothing; record the usage after the work.
          </p>
        </>
      ),
      code: CHECK,
      file: 'crawl.ts',
      focus: [3, 4, 5, 6, 7],
      scene: (
        <MeterGauge
          meter={bandwidthIr}
          holder={{ kind: 'subscription', id: 'acme', term: term('hard') }}
          usage={USAGE}
          unit="bytes"
          estimate={600_000}
        />
      ),
    },
    {
      id: 'soft',
      prose: (
        <>
          <p>
            Change one word and the same check passes. A {code('soft')} limit
            never denies; whatever runs past the included credits is overage,
            billed at the meter&apos;s price when the period closes.
          </p>
          <p>
            The estimate now lands partly outside the allowance, and the check
            says what that part would cost. {code('unlimited')} is the third
            option: no credits, no cap, everything billed.
          </p>
        </>
      ),
      code: SOFT,
      focus: [21],
      scene: (
        <MeterGauge
          meter={bandwidthIr}
          holder={{ kind: 'subscription', id: 'acme', term: term('soft') }}
          usage={USAGE}
          unit="bytes"
          estimate={600_000}
        />
      ),
    },
    {
      id: 'wallet',
      prose: (
        <>
          <p>
            Credits do not need a subscription. The {code('credits')} plugin is
            a meter over two sum reducers: one for what was spent, one for what
            was granted, linked as the meter&apos;s {code('creditReducer')}.
          </p>
          <p>
            A price of zero makes it a prepaid pool: nothing bills past the
            grants, the meter simply runs dry. A plan can top it up with{' '}
            {code('included(wallet.credits, n)')} too.
          </p>
        </>
      ),
      code: WALLET,
      focus: [10, 25],
      scene: (
        <MeterGauge
          meter={walletIr}
          holder={{ kind: 'credits', id: 'acme', granted: 1_000 }}
          usage={640}
          unit="credits"
        />
      ),
    },
    {
      id: 'grant',
      prose: (
        <>
          <p>
            The plugin gives the identity two verbs. {code('grant')} records a
            granted event; {code('charge')} checks the estimate, runs the work,
            then spends what it settled.
          </p>
          <p>
            Acme holds a thousand credits and has spent 640. A charge of 500 is
            denied: prepaid credits behave like a hard limit, because there is
            no price to bill the difference at.
          </p>
        </>
      ),
      code: GRANT,
      file: 'generate.ts',
      focus: [3, 5],
      scene: (
        <MeterGauge
          meter={walletIr}
          holder={{ kind: 'credits', id: 'acme', granted: 1_000 }}
          usage={640}
          unit="credits"
          estimate={500}
        />
      ),
    },
    {
      id: 'customer',
      prose: (
        <>
          <p>
            Products are billed by Polar, so the root of the tree has to be a
            Polar customer. One call binds them by {code('external_id')}; an
            existing customer with that id is reused.
          </p>
          <p>
            That binding is what turns a subscription into a holder. Without it,
            and without prepaid credits, every check on every identity in the
            tree answers {code('no_plan')}.
          </p>
        </>
      ),
      code: CUSTOMER,
      file: 'setup.ts',
      focus: [1, 2, 3, 4, 5],
      scene: (
        <MeterGauge
          meter={bandwidthIr}
          holder={{ kind: 'subscription', id: 'acme', term: term('soft') }}
          usage={USAGE}
          unit="bytes"
        />
      ),
    },
    {
      id: 'compiled',
      prose: (
        <>
          <p>
            Compiled, a meter is a slug, its reducer, an optional credit reducer
            and a unit price. A product carries its price and one term per
            meter: {code('included')}, {code('limit')} and how much unused
            credit rolls over.
          </p>
          <p>
            The wallet shows the plugin did nothing magic: a meter over{' '}
            {code('wallet')} spent, with {code('wallet-granted')} as its credit
            side.
          </p>
        </>
      ),
      code: JSON_IR,
      lang: 'json',
      file: 'void.json',
      layout: 'code',
    },
  ],
}
