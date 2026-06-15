import {
  CheckoutStatusDisplayColor,
  CheckoutStatusDisplayTitle,
} from '@/utils/checkout'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/orbit'

const CheckoutStatus = ({
  checkout: { status },
}: {
  checkout: schemas['Checkout']
}) => {
  return (
    <Status
      color={CheckoutStatusDisplayColor[status]}
      status={CheckoutStatusDisplayTitle[status]}
    />
  )
}

export default CheckoutStatus
