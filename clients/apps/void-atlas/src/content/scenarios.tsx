import type { Lesson } from '@/lesson/types'
import { short } from '@/scenes/hash'
import { leversOf, type Customer } from '@/scenes/scenario'
import {
  ScenarioBranch,
  type Branch,
  type PlanEntry,
  type Version,
} from '@/scenes/ScenarioBranch'
import {
  checksumOf,
  compile,
  defineConfig,
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

/*
 * Two configs: the deployed one and the one a scenario resolves to. The
 * scenario's version id on screen is `checksumOf` over the second, so the
 * chapter can only claim "promote lands on this hash" if the compiler agrees.
 */
const GB = 1_000_000_000

export const served = event<{ bytes: number }>('cdn.served')
const bandwidthAt = (perByte: number) =>
  meter('bandwidth', { reducer: sum(served, 'bytes'), price: usd(perByte) })
const proAt = (
  fee: number,
  allowance: number,
  bandwidth: ReturnType<typeof bandwidthAt>,
) =>
  product('pro', {
    name: 'Pro',
    price: recurring({ interval: 'month', amount: usd(fee) }),
    meters: [included(bandwidth, allowance, { limit: 'soft' })],
  })

export const bandwidth = bandwidthAt(0.00000000008)
export const pro = proAt(49, 50 * GB, bandwidth)
export const bandwidthUsageFirst = bandwidthAt(0.00000000012)
export const proUsageFirst = proAt(29, 20 * GB, bandwidthUsageFirst)

export const stages: Record<'base' | 'scenario', Config> = {
  base: defineConfig({ schema: { served, bandwidth, pro } }),
  scenario: defineConfig({
    schema: {
      served,
      bandwidth: bandwidthUsageFirst,
      pro: proUsageFirst,
    },
  }),
}

export const hashes = {
  v1: checksumOf(defineConfig({ schema: { served, bandwidth } })),
  base: checksumOf(stages.base),
  scenario: checksumOf(stages.scenario),
}

export const levers = {
  base: leversOf(compile(stages.base), 'pro', 'bandwidth'),
  scenario: leversOf(compile(stages.scenario), 'pro', 'bandwidth'),
}

export const customers: readonly Customer[] = [
  { name: 'Northwind', usage: 12 * GB },
  { name: 'Lumen Labs', usage: 38 * GB },
  { name: 'Kestrel', usage: 140 * GB },
  { name: 'Orbital Freight', usage: 900 * GB },
  { name: 'Halcyon', usage: 2400 * GB },
]

const v1: Version = { label: 'v1', hash: hashes.v1, status: 'archived' }
const v2: Version = { label: 'v2', hash: hashes.base, status: 'active' }
const v2old: Version = { ...v2, status: 'archived' }
const v3draft: Version = { label: 'v3', hash: hashes.scenario, status: 'draft' }
const v3: Version = { ...v3draft, status: 'active' }

const fresh: Branch = {
  name: 'usage-first',
  base: hashes.base,
  hash: hashes.base,
  changes: 0,
}
const edited: Branch = { ...fresh, hash: hashes.scenario, changes: 3 }
const promoted: Branch = { ...edited, promotedAs: 'v3' }

const plan: readonly PlanEntry[] = [
  { action: 'replace', kind: 'product', key: 'pro' },
  { action: 'replace', kind: 'meter', key: 'bandwidth' },
  { action: 'unchanged', kind: 'reducer', key: 'bandwidth' },
]

const PATCH = `{
  "name": "usage-first",
  "base_version_id": "${hashes.base}",
  "patch": {
    "products": {
      "pro": {
        "price": { "type": "recurring", "interval": "month", "amount": "29" },
        "meters": { "bandwidth": { "included": ${20 * GB}, "limit": "soft" } }
      }
    },
    "meters": {
      "bandwidth": { "unit_amount": "0.00000000012" }
    }
  }
}
`

const PULL = `$ void pull --scenario usage-first
source  scenario usage-first on v2 ${hashes.base}
version ${hashes.scenario}
wrote void.usage-first.json

$ void plan --config void.usage-first.json
version ${hashes.scenario}
~ product  pro
~ meter    bandwidth
= reducer  bandwidth

2 to replace · 1 unchanged
`

const SLOTS = ['v3', 'v2', 'v1'] as const

export const scenariosLesson: Lesson = {
  slug: 'scenarios',
  title: 'Scenarios',
  summary: 'Branch a pricing sandbox off a version, replay it, promote it.',
  lang: 'json',
  file: 'scenario.json',
  steps: [
    {
      id: 'branch',
      prose: (
        <>
          <p>
            A version is what the code deploys. A scenario is what you get when
            you want to try a different price without touching the code: in the
            dashboard&apos;s Simulate view, pick a version and give the branch a
            name.
          </p>
          <p>
            It hangs off that version on its own lane. It is not a deployment:
            no product or meter rows, no place in the lineage, and no customer
            ever resolves against it.
          </p>
        </>
      ),
      layout: 'scene',
      scene: (
        <ScenarioBranch
          crumb="new scenario"
          slots={SLOTS}
          versions={[v2, v1]}
          branch={fresh}
          view={{ kind: 'levers', base: levers.base, scenario: levers.base }}
        />
      ),
    },
    {
      id: 'levers',
      prose: (
        <>
          <p>
            The dashboard shows the version as levers: each plan&apos;s fee and
            allowance, each meter&apos;s overage price. Move three of them and
            the scenario is a usage-first Pro: cheaper to start, more per
            gigabyte.
          </p>
          <p>
            What is stored is not a copy of the config but a patch keyed by
            slug, applied to the base on every read. It can only change what the
            base already has. A new product or meter is a code change, not a
            scenario.
          </p>
        </>
      ),
      code: PATCH,
      focus: [5, 6, 7, 8, 9, 10, 11, 12, 13],
      scene: (
        <ScenarioBranch
          crumb="usage-first"
          slots={SLOTS}
          versions={[v2, v1]}
          branch={edited}
          view={{
            kind: 'levers',
            base: levers.base,
            scenario: levers.scenario,
          }}
        />
      ),
    },
    {
      id: 'replay',
      prose: (
        <>
          <p>
            The point of a scenario is the replay. Take the usage customers
            produced over the last month and bill it twice: once under the
            active version, dashed, once under the patch. Nothing is charged;
            the lines are what the invoices would have added up to.
          </p>
          <p>
            Drag a lever. Small accounts pay less, heavy accounts pay more, and
            the month ends on a number you can argue about.
          </p>
        </>
      ),
      layout: 'scene',
      scene: (
        <ScenarioBranch
          crumb="usage-first"
          slots={SLOTS}
          versions={[v2, v1]}
          branch={edited}
          view={{
            kind: 'replay',
            base: levers.base,
            scenario: levers.scenario,
            customers,
          }}
        />
      ),
    },
    {
      id: 'promote',
      prose: (
        <>
          <p>
            Promote deploys the resolved configuration as an ordinary draft, and
            the branch rejoins the trunk. It goes through the same plan as a
            push: the product and the meter are replaced, the reducer is
            untouched, and a conflicting change would be refused the same way.
          </p>
          <p>
            The scenario survives and remembers what it became. Activation is
            still a separate step on the draft, with the same review gate.
          </p>
        </>
      ),
      layout: 'scene',
      scene: (
        <ScenarioBranch
          crumb="usage-first"
          slots={SLOTS}
          versions={[v3draft, v2, v1]}
          branch={promoted}
          view={{ kind: 'plan', entries: plan }}
        />
      ),
    },
    {
      id: 'hash',
      prose: (
        <>
          <p>
            v3 has the hash the scenario had all along. The base with the patch
            applied is a full configuration, hashed the same way{' '}
            {code('void deploy')} hashes yours. That is what lets the two worlds
            meet.
          </p>
          <p>
            {code('void pull --scenario')} writes that configuration next to
            your code, and a plan against it prints the same version. Port the
            three edits into {code('void.ts')} and deploy, and you land on v3
            again, not on a v4. The dashboard and the repository cannot disagree
            about what usage-first pricing is.
          </p>
        </>
      ),
      code: PULL,
      lang: 'bash',
      file: 'terminal',
      focus: [3, 7],
      scene: (
        <ScenarioBranch
          crumb="usage-first"
          slots={SLOTS}
          versions={[v3draft, v2, v1]}
          branch={promoted}
          view={{
            kind: 'identity',
            base: v2,
            hash: hashes.scenario,
            deployment: v3draft,
          }}
        />
      ),
    },
    {
      id: 'pinned',
      prose: (
        <>
          <p>
            Activate v3 and the trunk moves on. The scenario does not: it is
            pinned to v2 and never rebases, so its replay keeps meaning what it
            meant when you read it. A scenario on an archived version is still a
            scenario.
          </p>
          <p>
            To try the next idea against what is live now, start a new one from
            v3, or duplicate this one onto it. Scenarios can be deleted;
            versions cannot.
          </p>
        </>
      ),
      layout: 'scene',
      scene: (
        <ScenarioBranch
          crumb="usage-first"
          slots={SLOTS}
          versions={[v3, v2old, v1]}
          branch={promoted}
          view={{
            kind: 'levers',
            base: levers.base,
            scenario: levers.scenario,
          }}
        />
      ),
    },
    {
      id: 'compare',
      prose: (
        <>
          <p>
            Three things now hold a configuration that is not live. A draft is
            deployed and in the lineage. A scenario is a patch beside one
            version, edited in the dashboard, only ever replayed. A{' '}
            {code('versionId')} pin is a runtime pointer in one client.
          </p>
          <p>
            Use a scenario to decide, a draft to stage, a pin to test. The hash
            is what lets them meet: promote a scenario and it is a draft; deploy
            the same code and it is the same draft.
          </p>
        </>
      ),
      layout: 'scene',
      scene: (
        <ScenarioBranch
          crumb={`usage-first · ${short(hashes.scenario)}`}
          slots={SLOTS}
          versions={[v3, v2old, v1]}
          branch={promoted}
          view={{ kind: 'compare' }}
        />
      ),
    },
  ],
}
