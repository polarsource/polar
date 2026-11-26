import {
  StatusIcon,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
import { schemas } from '@polar-sh/client'

type Status = schemas['SubscriptionStatus']

const STATUS_ICON: Record<Status, StatusIconProps> = {
  incomplete: { shape: 'dashed' },
  incomplete_expired: { shape: 'dashed' },
  // Striped like a trial on the timeline.
  trialing: { shape: 'striped', tone: 'blue' },
  active: { shape: 'check', tone: 'green' },
  past_due: { shape: 'alert', tone: 'yellow' },
  paused: { shape: 'paused' },
  trial_ended: { shape: 'minus', tone: 'yellow' },
  canceled: { shape: 'cross' },
  unpaid: { shape: 'cross', tone: 'red' },
}

// Still running, but set to end or pause when the period is over.
export const WINDING_DOWN_ICON: StatusIconProps = {
  shape: 'cross-pending',
  tone: 'yellow',
}

export const getSubscriptionStatusIcon = (
  status: Status,
  isWindingDown = false,
): StatusIconProps =>
  isWindingDown && (status === 'active' || status === 'trialing')
    ? WINDING_DOWN_ICON
    : STATUS_ICON[status]

export const SubscriptionStatusIcon = ({
  subscription,
}: {
  subscription: Pick<
    schemas['Subscription'],
    'status' | 'ends_at' | 'pause_at_period_end'
  >
}) => (
  <StatusIcon
    {...getSubscriptionStatusIcon(
      subscription.status,
      subscription.ends_at !== null || subscription.pause_at_period_end,
    )}
  />
)
