import {
  getPaymentDisplayStatus,
  PaymentStatusDisplayColor,
  PaymentStatusDisplayTitle,
} from '@/utils/payment'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/orbit'

const PaymentStatus = ({ payment }: { payment: schemas['Payment'] }) => {
  const status = getPaymentDisplayStatus(payment)
  return (
    <Status
      color={PaymentStatusDisplayColor[status]}
      status={PaymentStatusDisplayTitle[status]}
    />
  )
}

export default PaymentStatus
