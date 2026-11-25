import { type StatusIconProps } from '@/components/Shared/StatusIcon'
import { schemas } from '@polar-sh/client'

export const DISPUTE_STATUS_ICONS: Record<
  schemas['DisputeStatus'],
  StatusIconProps
> = {
  prevented: { shape: 'check', tone: 'green' },
  early_warning: { shape: 'alert', tone: 'yellow' },
  needs_response: { shape: 'alert', tone: 'yellow' },
  under_review: { shape: 'half', tone: 'yellow' },
  won: { shape: 'check', tone: 'green' },
  lost: { shape: 'cross', tone: 'red' },
}
