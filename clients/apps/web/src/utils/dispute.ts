import { schemas } from '@polar-sh/client'

export const DisputeStatusDisplayTitle: Record<
  schemas['DisputeStatus'],
  string
> = {
  prevented: 'Prevented',
  early_warning: 'Early Warning',
  needs_response: 'Needs Response',
  under_review: 'Under Review',
  won: 'Won',
  lost: 'Lost',
}

export const DisputeStatusDisplayColor: Record<
  schemas['DisputeStatus'],
  string
> = {
  prevented: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  early_warning: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
  needs_response: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
  under_review: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
  won: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  lost: 'bg-red-100 text-red-500 dark:bg-red-950',
}
