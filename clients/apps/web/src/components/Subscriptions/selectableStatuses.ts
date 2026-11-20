import { schemas } from '@polar-sh/client'

export const SELECTABLE_STATUSES = [
  'active',
  'trialing',
  'paused',
  'past_due',
  'trial_ended',
  'canceled',
  'unpaid',
] as const satisfies readonly schemas['SubscriptionStatus'][]

export type SelectableSubscriptionStatus = (typeof SELECTABLE_STATUSES)[number]
