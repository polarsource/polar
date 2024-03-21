import { DonationStripePaymentIntentMutationResponse } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'

const Subtotal = ({
  paymentIntent,
}: {
  paymentIntent?: DonationStripePaymentIntentMutationResponse
}) => {
  const amount = paymentIntent?.amount.amount || 0

  return (
    <div>
      <div className="dark:text-polar-400 flex w-full text-sm text-gray-500">
        <div className="w-full">Donation amount</div>
        <div className="w-full text-right">
          ${getCentsInDollarString(amount, true)}
        </div>
      </div>

      <div className="mb-6 flex w-full text-sm font-medium">
        <div className="w-1/2">Total</div>
        <div className="w-1/2 text-right">
          ${getCentsInDollarString(amount, true)}
        </div>
      </div>
    </div>
  )
}

export default Subtotal
