/** Where the feature a page describes stands today. Pages about ideas rather than features carry none. */
export type Status = 'development' | 'early-access' | 'production'

export const STATUS: Record<string, Status> = {
  'm-code': 'development',
  'm-cli': 'development',
  'm-check': 'development',
  'm-event': 'production',
  'm-ledger': 'production',
  'm-ingest': 'production',
  'm-gateways': 'development',
  'm-meter': 'production',
  'm-fold': 'development',
  'm-tiers': 'production',
  'm-igloo': 'development',
  'm-latency': 'development',
  'm-reconcile': 'development',
  'm-nesting': 'development',
  'm-rollup': 'development',
  'm-economics': 'production',
  'm-delegate': 'development',
  'm-signals': 'development',
  'm-margin': 'development',
  'm-branch': 'development',
  'm-compare': 'development',
  'm-credits': 'production',
  'm-grants': 'production',
  'm-zero': 'development',
  'm-gates': 'production',
  'm-entitlements': 'production',
  'm-psp': 'development',
  'm-mor': 'production',
}

const LABEL: Record<Status, string> = {
  development: 'Currently in development',
  'early-access': 'Available in early access',
  production: 'Available in production',
}

const DOT: Record<Status, string> = {
  development: 'bg-[#7b7b7b]',
  'early-access': 'bg-amber-400',
  production: 'bg-emerald-400',
}

/** A page's status as a small mono label: a dot in its colour, then its name. */
export function StatusLabel({ status }: { status: Status }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[13px] text-[#7b7b7b] uppercase">
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </span>
  )
}
