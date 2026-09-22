'use client'

import { AnimatePresence, motion } from 'motion/react'
import { short } from './hash'
import { Lineage, type Branch, type Version } from './Lineage'
import { Replay } from './Replay'
import { dollars, gb, perGb, type Customer, type Levers } from './scenario'

export type { Branch, Version } from './Lineage'

const EASE = [0.2, 0.8, 0.2, 1] as const

export interface PlanEntry {
  readonly action: 'replace' | 'unchanged'
  readonly kind: string
  readonly key: string
}

export type View =
  | {
      readonly kind: 'levers'
      readonly base: Levers
      readonly scenario: Levers
    }
  | {
      readonly kind: 'replay'
      readonly base: Levers
      readonly scenario: Levers
      readonly customers: readonly Customer[]
    }
  | {
      readonly kind: 'identity'
      readonly base: Version
      readonly hash: string
      readonly deployment?: Version
    }
  | { readonly kind: 'plan'; readonly entries: readonly PlanEntry[] }
  | { readonly kind: 'compare' }

const CHANGED = 'text-amber-600 dark:text-amber-400'

const Heading = ({ children }: { children: string }) => (
  <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
    {children}
  </span>
)

const LeverRow = ({
  label,
  before,
  after,
}: {
  label: string
  before: string
  after: string
}) => {
  const changed = before !== after
  return (
    <li className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={changed ? 'text-muted-foreground line-through' : ''}>
        {before}
      </span>
      <span className={changed ? CHANGED : 'text-muted-foreground'}>
        {changed ? '→' : '='}
      </span>
      <span className={changed ? CHANGED : ''}>{after}</span>
    </li>
  )
}

const LeversView = ({ base, scenario }: { base: Levers; scenario: Levers }) => (
  <ul className="flex flex-col gap-1 font-mono text-[11px]">
    <LeverRow
      label="pro · price"
      before={`${dollars(base.fee)} / mo`}
      after={`${dollars(scenario.fee)} / mo`}
    />
    <LeverRow
      label="pro · allowance"
      before={gb(base.included)}
      after={gb(scenario.included)}
    />
    <LeverRow
      label="bandwidth · overage"
      before={perGb(base.unitAmount)}
      after={perGb(scenario.unitAmount)}
    />
  </ul>
)

const IdentityView = ({
  base,
  hash,
  deployment,
}: {
  base: Version
  hash: string
  deployment?: Version
}) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px]">
    <dt className="text-muted-foreground">base</dt>
    <dd>
      {base.label}{' '}
      <span className="text-muted-foreground">{short(base.hash)}</span>
    </dd>
    <dt className="text-muted-foreground">patch</dt>
    <dd className="text-muted-foreground">applied on read</dd>
    <dt className="text-muted-foreground">version</dt>
    <dd className="break-all">{hash}</dd>
    <dt className="text-muted-foreground">deployment</dt>
    <dd className={deployment ? '' : 'text-muted-foreground'}>
      {deployment
        ? `${deployment.label} · ${deployment.status}`
        : 'none has this version yet'}
    </dd>
  </dl>
)

const PlanView = ({ entries }: { entries: readonly PlanEntry[] }) => {
  const replaced = entries.filter((e) => e.action === 'replace').length
  const unchanged = entries.length - replaced
  return (
    <ul className="flex flex-col gap-0.5 font-mono text-[11px]">
      {entries.map((entry) => (
        <li
          key={`${entry.kind}:${entry.key}`}
          className="grid grid-cols-[1ch_auto_1fr] gap-x-3"
        >
          <span
            className={
              entry.action === 'replace' ? CHANGED : 'text-muted-foreground'
            }
          >
            {entry.action === 'replace' ? '~' : '='}
          </span>
          <span className="text-muted-foreground">{entry.kind}</span>
          <span
            className={
              entry.action === 'unchanged' ? 'text-muted-foreground' : ''
            }
          >
            {entry.key}
          </span>
        </li>
      ))}
      <li className="text-muted-foreground border-border mt-1 border-t pt-1">
        {[
          replaced > 0 && `${replaced} to replace`,
          unchanged > 0 && `${unchanged} unchanged`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </li>
    </ul>
  )
}

const COMPARE: readonly (readonly [string, string, string, string])[] = [
  ['lives in', 'lineage', 'beside one version', 'your process'],
  ['has a hash', 'yes', 'yes, of the resolved config', 'points at one'],
  ['edited in', 'code', 'dashboard', 'code'],
  ['serves traffic', 'pinned clients', 'never', 'this client'],
  ['moves with base', 'n/a', 'no', 'no'],
  ['becomes live by', 'activate', 'promote, then activate', 'n/a'],
]

const CompareView = () => (
  <table className="w-full font-mono text-[11px]">
    <thead>
      <tr className="text-muted-foreground text-left">
        <th className="pb-1.5 font-normal" />
        <th className="pb-1.5 font-normal">draft</th>
        <th className="pb-1.5 font-normal">scenario</th>
        <th className="pb-1.5 font-normal">versionId</th>
      </tr>
    </thead>
    <tbody className="divide-border divide-y">
      {COMPARE.map(([row, draft, scenario, pin]) => (
        <tr key={row}>
          <td className="text-muted-foreground py-1.5 pr-3">{row}</td>
          <td className="py-1.5 pr-3">{draft}</td>
          <td className="py-1.5 pr-3">{scenario}</td>
          <td className="py-1.5">{pin}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

const TITLE: Record<View['kind'], string> = {
  levers: 'levers',
  replay: 'replay · drag a lever',
  identity: 'version',
  plan: 'plan',
  compare: 'three ways to hold a change',
}

const Panel = ({ view }: { view: View }) => {
  switch (view.kind) {
    case 'levers':
      return <LeversView base={view.base} scenario={view.scenario} />
    case 'replay':
      return (
        <Replay
          base={view.base}
          scenario={view.scenario}
          customers={view.customers}
        />
      )
    case 'identity':
      return (
        <IdentityView
          base={view.base}
          hash={view.hash}
          deployment={view.deployment}
        />
      )
    case 'plan':
      return <PlanView entries={view.entries} />
    case 'compare':
      return <CompareView />
  }
}

/**
 * The Simulate view as the chapter tells it: the lineage graph on the left,
 * with the scenario on its own lane, and on the right whichever panel the
 * step is about.
 */
export const ScenarioBranch = ({
  slots,
  versions,
  branch,
  view,
  crumb,
}: {
  slots: readonly string[]
  versions: readonly Version[]
  branch?: Branch
  view: View
  crumb: string
}) => (
  <div className="flex h-full flex-col">
    <div className="border-border flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-xs">
      <span>
        <span className="text-muted-foreground">simulate › </span>
        {crumb}
      </span>
      <span className="text-muted-foreground">acme · dashboard</span>
    </div>
    <div className="divide-border grid min-h-0 flex-1 grid-cols-[minmax(0,4fr)_minmax(0,5fr)] divide-x">
      <div className="flex min-h-0 flex-col gap-2 px-4 py-3">
        <Heading>versions</Heading>
        <div className="min-h-0 flex-1">
          <Lineage slots={slots} versions={versions} branch={branch} />
        </div>
      </div>
      <div className="flex flex-col gap-2 overflow-auto px-4 py-3">
        <Heading>{TITLE[view.kind]}</Heading>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view.kind}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <Panel view={view} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  </div>
)
