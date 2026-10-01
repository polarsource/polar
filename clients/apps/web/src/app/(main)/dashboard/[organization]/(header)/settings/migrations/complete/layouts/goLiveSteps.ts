import { schemas } from '@polar-sh/client'

export type GoLiveStatus = 'done' | 'todo' | 'attention' | 'waiting'

export type GoLiveKey =
  | 'switch'
  | 'backfill'
  | 'polar-webhooks'
  | 'stripe-off'
  | 'checkout'

export interface GoLiveSignals {
  report: schemas['MerchantMigrationCutoverReport']
  webhookEndpoints: number | null
  checkoutLinks: number | null
  markedDone: Set<GoLiveKey>
}

export interface GoLiveStep {
  key: GoLiveKey
  title: string
  status: GoLiveStatus
  summary: string
  manual: boolean
}

const numberFormat = new Intl.NumberFormat('en-US')

const counted = (value: number | null, one: string, many: string) =>
  value === null
    ? 'Checking…'
    : `${numberFormat.format(value)} ${value === 1 ? one : many}`

export function goLiveSteps({
  report,
  webhookEndpoints,
  checkoutLinks,
  markedDone,
}: GoLiveSignals): GoLiveStep[] {
  const left = report.skipped + report.failed
  const manual = (key: GoLiveKey): GoLiveStatus =>
    markedDone.has(key) ? 'done' : 'todo'
  return [
    {
      key: 'switch',
      title: 'Switch subscriptions to Polar',
      status: report.pending > 0 ? 'waiting' : left > 0 ? 'attention' : 'done',
      summary: [
        `${numberFormat.format(report.moved)} on Polar`,
        report.pending > 0 && `${numberFormat.format(report.pending)} ready`,
        left > 0 && `${numberFormat.format(left)} left on Stripe`,
      ]
        .filter(Boolean)
        .join(' · '),
      manual: false,
    },
    {
      key: 'backfill',
      title: 'Swap Stripe IDs for Polar IDs in your database',
      status: manual('backfill'),
      summary: 'Download the map, or look IDs up one at a time.',
      manual: true,
    },
    {
      key: 'polar-webhooks',
      title: 'Listen to Polar webhooks',
      status: webhookEndpoints ? 'done' : 'todo',
      summary: counted(webhookEndpoints, 'endpoint', 'endpoints'),
      manual: false,
    },
    {
      key: 'stripe-off',
      title: 'Turn off Stripe billing webhooks and emails',
      status: manual('stripe-off'),
      summary:
        'Stop Stripe from revoking access or emailing customers about the subscriptions it cancelled.',
      manual: true,
    },
    {
      key: 'checkout',
      title: 'Sell new subscriptions with Polar Checkout',
      status: checkoutLinks ? 'done' : 'todo',
      summary: counted(checkoutLinks, 'checkout link', 'checkout links'),
      manual: false,
    },
  ]
}

const storageKey = (migrationId: string) =>
  `merchant-migration:${migrationId}:go-live`

export function readMarkedDone(migrationId: string): Set<GoLiveKey> {
  try {
    const stored = localStorage.getItem(storageKey(migrationId))
    return new Set(stored ? (JSON.parse(stored) as GoLiveKey[]) : [])
  } catch {
    return new Set()
  }
}

export function writeMarkedDone(migrationId: string, done: Set<GoLiveKey>) {
  try {
    localStorage.setItem(storageKey(migrationId), JSON.stringify([...done]))
  } catch {
    // Private mode or a full quota: the tick just won't survive a reload.
  }
}
