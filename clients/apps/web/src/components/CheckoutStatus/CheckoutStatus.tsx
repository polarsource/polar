import {
  CheckoutStatusDisplayColor,
  CheckoutStatusDisplayTitle,
} from '@/utils/checkout'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { twMerge } from 'tailwind-merge'

const CheckoutStatus = ({
  checkout: { status },
}: {
  checkout: schemas['Checkout']
}) => {
  return (
    <Status
      className={twMerge(CheckoutStatusDisplayColor[status], 'w-fit')}
      status={CheckoutStatusDisplayTitle[status]}
    />
  )
}

export default CheckoutStatus
