import type { Wire } from '@void/sdk'
import type { LogEvent } from './channels'

/** The label vocabulary Polar asks Jev to pick from. */
export const TAXONOMY = 'polar.agent/v1'

export const LABELS = [
  'plan',
  'retrieve',
  'implement',
  'act',
  'review',
  'retry',
  'other',
] as const

const labeled = new Set<string>(LABELS)

export interface Share {
  readonly slug: string
  readonly cost: number
  readonly share: number
  readonly spans: number
}

export interface Mix {
  readonly shares: readonly Share[]
  readonly pendingCost: number
  readonly unlabeledCost: number
}

const costOf = (span: Wire.ActivitySpan) => span.cost ?? 0

/** Completions recorded as one of these identities — the agent that ran them. */
export const ofIdentities = (
  events: readonly LogEvent[],
  ids: ReadonlySet<string>,
) => events.filter((entry) => ids.has(entry.event.external_identity_id ?? ''))

/** This chat's mix, from the spans already on its completions. */
export const mixFrom = (events: readonly LogEvent[]): Mix => {
  const spans = events.flatMap((entry) => (entry.span ? [entry.span] : []))
  const known = spans.filter((span) => labeled.has(span.activity))
  const labeledCost = known.reduce((sum, span) => sum + costOf(span), 0)
  const grouped = new Map<string, Wire.ActivitySpan[]>()
  for (const span of known) {
    const bucket = grouped.get(span.activity) ?? []
    bucket.push(span)
    grouped.set(span.activity, bucket)
  }
  return {
    shares: LABELS.flatMap((slug) => {
      const bucket = grouped.get(slug) ?? []
      if (bucket.length === 0) return []
      const cost = bucket.reduce((sum, span) => sum + costOf(span), 0)
      return [
        {
          slug,
          cost,
          share: labeledCost ? cost / labeledCost : 0,
          spans: bucket.length,
        },
      ]
    }),
    pendingCost: spans
      .filter((span) => span.activity === 'pending')
      .reduce((sum, span) => sum + costOf(span), 0),
    unlabeledCost: spans
      .filter((span) => span.activity === 'unlabeled')
      .reduce((sum, span) => sum + costOf(span), 0),
  }
}
