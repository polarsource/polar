import {
  StatusLabel,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
import { schemas } from '@polar-sh/client'

type Status = schemas['RefundStatus']

const RefundStatusDisplayTitle: Record<Status, string> = {
  pending: 'Pending',
  succeeded: 'Refunded',
  failed: 'Failed',
  canceled: 'Canceled',
}

const RefundStatusDescription: Record<Status, string> = {
  pending: 'Submitted, and on its way back to the customer.',
  succeeded: 'The money has been returned to the customer.',
  failed: 'The refund could not be completed. Nothing was returned.',
  canceled: 'Canceled before it completed. Nothing was returned.',
}

const RefundStatusIcon: Record<Status, StatusIconProps> = {
  pending: { shape: 'half', tone: 'yellow' },
  succeeded: { shape: 'returned', tone: 'purple' },
  failed: { shape: 'cross', tone: 'red' },
  canceled: { shape: 'cross' },
}

export const RefundStatus = ({ status }: { status: Status }) => (
  <StatusLabel
    {...RefundStatusIcon[status]}
    label={RefundStatusDisplayTitle[status]}
    description={RefundStatusDescription[status]}
  />
)
