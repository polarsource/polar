import {
  PaymentStatusDisplayColor,
  PaymentStatusDisplayTitle,
} from '@/utils/payment'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/orbit'

const PaymentStatus = ({
  payment: { status },
}: {
  payment: schemas['Payment']
}) => {
  return (
    <Status
      color={PaymentStatusDisplayColor[status]}
      status={PaymentStatusDisplayTitle[status]}
    />
  )
}

export default PaymentStatus
