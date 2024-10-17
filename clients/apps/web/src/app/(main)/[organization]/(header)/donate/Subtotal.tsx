import { DonationStripePaymentIntentMutationResponse } from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'

const Subtotal = ({
  paymentIntent,
}: {
  paymentIntent?: DonationStripePaymentIntentMutationResponse
}) => {
  const amount = paymentIntent?.amount || 0

  return (
    <div>
      <div className="flex w-full text-sm text-gray-950 dark:text-white">
        <div className="w-full">Donation amount</div>
        <div className="w-full text-right">
          {formatCurrencyAndAmount(amount, paymentIntent?.currency)}
        </div>
      </div>

      <div className="mb-6 flex w-full text-sm font-medium text-gray-950 dark:text-white">
        <div className="w-1/2">Total</div>
        <div className="w-1/2 text-right">
          {formatCurrencyAndAmount(amount, paymentIntent?.currency)}
        </div>
      </div>
    </div>
  )
}

export default Subtotal
