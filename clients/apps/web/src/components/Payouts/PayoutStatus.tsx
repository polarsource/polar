import {
  StatusIcon,
  StatusLabel,
  StatusTooltip,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
import { schemas } from '@polar-sh/client'

type Status = schemas['PayoutStatus']

const PayoutStatusDisplayTitle: Record<Status, string> = {
  pending: 'Pending',
  held: 'Held for review',
  in_transit: 'In transit',
  succeeded: 'Paid out',
  failed: 'Failed',
  canceled: 'Canceled',
}

const PayoutStatusDescription: Record<Status, string> = {
  pending: 'Created, and waiting to be sent to your payout account.',
  held: 'On hold while your account is under review. It will be paid out automatically once the review is complete.',
  in_transit: 'Sent, and on its way to your bank account.',
  succeeded: 'The money has arrived in your bank account.',
  failed: 'The payout could not be completed.',
  canceled: 'Canceled before it was sent.',
}

const PayoutStatusIconDisplay: Record<Status, StatusIconProps> = {
  pending: { shape: 'half', tone: 'yellow' },
  held: { shape: 'paused', tone: 'yellow' },
  in_transit: { shape: 'most', tone: 'blue' },
  succeeded: { shape: 'check', tone: 'green' },
  failed: { shape: 'cross', tone: 'red' },
  canceled: { shape: 'cross' },
}

// A failed payout says why, when the processor gave a reason.
const getDescription = ({ status, attempts }: schemas['Payout']) =>
  (status === 'failed' ? attempts.at(-1)?.failed_reason : null) ??
  PayoutStatusDescription[status]

export const PayoutStatus = ({ payout }: { payout: schemas['Payout'] }) => (
  <StatusLabel
    {...PayoutStatusIconDisplay[payout.status]}
    label={PayoutStatusDisplayTitle[payout.status]}
    description={getDescription(payout)}
  />
)

// The icon alone, where there is no room for the name.
export const PayoutStatusIcon = ({ payout }: { payout: schemas['Payout'] }) => (
  <StatusTooltip
    description={`${PayoutStatusDisplayTitle[payout.status]}. ${getDescription(payout)}`}
  >
    <span role="img" aria-label={PayoutStatusDisplayTitle[payout.status]}>
      <StatusIcon {...PayoutStatusIconDisplay[payout.status]} />
    </span>
  </StatusTooltip>
)
