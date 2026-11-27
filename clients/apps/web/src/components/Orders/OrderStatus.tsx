import {
  StatusIcon,
  StatusLabel,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
import { enums, schemas } from '@polar-sh/client'

type Status = schemas['Order']['status']

export const OrderStatusDisplayTitle: Record<Status, string> = {
  draft: 'Draft',
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
  void: 'Void',
}

const OrderStatusDescription: Record<Status, string> = {
  draft: 'Created but not finalized. Nothing has been charged yet.',
  pending: 'Created, and Polar is attempting to collect payment.',
  paid: 'The payment succeeded.',
  partially_refunded: 'Part of the order has been refunded.',
  refunded: 'The order has been fully refunded.',
  void: 'Will not be collected, for example after repeated payment failures.',
}

const OrderStatusIcon: Record<Status, StatusIconProps> = {
  draft: { shape: 'dashed' },
  pending: { shape: 'half', tone: 'yellow' },
  paid: { shape: 'check', tone: 'green' },
  partially_refunded: { shape: 'most', tone: 'purple' },
  refunded: { shape: 'returned', tone: 'purple' },
  void: { shape: 'cross' },
}

// In the order an order moves through them.
const ORDERED: Status[] = [
  'draft',
  'pending',
  'paid',
  'partially_refunded',
  'refunded',
  'void',
]

export const orderStatusOptions = [
  ...ORDERED,
  ...enums.orderStatusValues.filter((value) => !ORDERED.includes(value)),
].map((value) => ({
  value,
  label: OrderStatusDisplayTitle[value],
  icon: <StatusIcon {...OrderStatusIcon[value]} />,
}))

export const OrderStatus = ({ status }: { status: Status }) => (
  <StatusLabel
    {...OrderStatusIcon[status]}
    label={OrderStatusDisplayTitle[status]}
    description={OrderStatusDescription[status]}
  />
)
