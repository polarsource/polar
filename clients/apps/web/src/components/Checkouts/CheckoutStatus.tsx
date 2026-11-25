import {
  StatusIcon,
  StatusLabel,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
import { CheckoutStatusDisplayTitle } from '@/utils/checkout'
import { schemas } from '@polar-sh/client'

type Status = schemas['CheckoutStatus']

const CheckoutStatusIcon: Record<Status, StatusIconProps> = {
  open: { shape: 'empty' },
  confirmed: { shape: 'half', tone: 'yellow' },
  succeeded: { shape: 'check', tone: 'green' },
  expired: { shape: 'minus' },
  failed: { shape: 'cross', tone: 'red' },
}

const CheckoutStatusDescription: Record<Status, string> = {
  open: 'The checkout session was opened.',
  confirmed: 'The customer clicked Pay. The payment has not succeeded yet.',
  succeeded: 'The payment was performed successfully.',
  expired: 'The session expired and is no longer accessible.',
  failed: 'Failed for technical reasons and cannot be retried.',
}

// In the order a checkout moves through them.
const ORDERED: Status[] = [
  'open',
  'confirmed',
  'succeeded',
  'expired',
  'failed',
]

export const checkoutStatusOptions = ORDERED.map((value) => ({
  value,
  label: CheckoutStatusDisplayTitle[value],
  icon: <StatusIcon {...CheckoutStatusIcon[value]} />,
}))

export const CheckoutStatus = ({ status }: { status: Status }) => (
  <StatusLabel
    {...CheckoutStatusIcon[status]}
    label={CheckoutStatusDisplayTitle[status]}
    description={CheckoutStatusDescription[status]}
  />
)
