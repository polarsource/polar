import {
  StatusLabel,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
import {
  getPaymentDisplayStatus,
  PaymentStatusDisplayTitle,
} from '@/utils/payment'
import { schemas } from '@polar-sh/client'

const PaymentStatusIcon: Record<
  ReturnType<typeof getPaymentDisplayStatus>,
  StatusIconProps
> = {
  pending: { shape: 'half', tone: 'yellow' },
  succeeded: { shape: 'check', tone: 'green' },
  failed: { shape: 'cross', tone: 'red' },
  blocked: { shape: 'alert', tone: 'red' },
}

const PaymentStatus = ({ payment }: { payment: schemas['Payment'] }) => {
  const status = getPaymentDisplayStatus(payment)
  return (
    <StatusLabel
      {...PaymentStatusIcon[status]}
      label={PaymentStatusDisplayTitle[status]}
    />
  )
}

export default PaymentStatus
