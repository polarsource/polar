import { schemas } from '@polar-sh/client'
import type { StatusColor } from '@polar-sh/orbit'

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
  StatusColor
> = {
  prevented: 'green',
  early_warning: 'yellow',
  needs_response: 'yellow',
  under_review: 'yellow',
  won: 'green',
  lost: 'red',
}
