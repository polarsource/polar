import { PledgeStripePaymentIntentMutationResponse } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'

const Subtotal = ({
  paymentIntent,
}: {
  paymentIntent?: PledgeStripePaymentIntentMutationResponse
}) => {
  const amount = paymentIntent?.amount || 0
  const fee = paymentIntent?.fee || 0
  const amountIncludingFee = paymentIntent?.amount_including_fee || 0

  return (
    <>
      <div className="flex w-full text-sm text-gray-500 dark:text-gray-400">
        <div className="w-full">Funding amount</div>
        <div className="w-full text-right">
          ${getCentsInDollarString(amount, true)}
        </div>
      </div>

      <div className="mb-1 flex w-full text-sm text-gray-500 dark:text-gray-400">
        <div className="w-1/2 text-sm">Service fee</div>
        <div className="w-1/2 text-right">
          ${getCentsInDollarString(fee, true)}
        </div>
      </div>
      {fee === 0 && (
        <p className="mb-1 flex w-full text-xs text-gray-500 dark:text-gray-400">
          Service fee (4.5%) covered by Polar.
        </p>
      )}
      {fee > 0 && (
        <p className="mb-1 flex w-full text-xs text-gray-500 dark:text-gray-400">
          <span className="underline">Note</span>: Service fee is
          non-refundable.
        </p>
      )}

      <div className="mb-6 mt-4 flex w-full text-sm font-medium">
        <div className="w-1/2">Total</div>
        <div className="w-1/2 text-right">
          ${getCentsInDollarString(amountIncludingFee, true)}
        </div>
      </div>
    </>
  )
}

export default Subtotal
