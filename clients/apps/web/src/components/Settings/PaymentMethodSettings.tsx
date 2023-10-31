import {
  ArrowTopRightOnSquareIcon,
  CreditCardIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { PaymentMethod } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import { Button } from 'polarkit/components/ui/atoms'
import {
  useDetachPaymentMethodMutation,
  useListPaymentMethods,
} from 'polarkit/hooks'
import { useState } from 'react'
import { prettyCardName } from '../Pledge/payment'
import Spinner from '../Shared/Spinner'

const PaymentMethodSettings = () => {
  const paymentMethods = useListPaymentMethods()

  const [stripePortalLoading, setStripePortalLoading] = useState(false)

  const onGotoStripeCustomerPortal = async () => {
    setStripePortalLoading(true)

    const portal = await api.users.createStripeCustomerPortal()
    if (portal) {
      window.location.href = portal.url
    }

    setStripePortalLoading(false)
  }

  return (
    <div className="dark:text-polar-200 dark:border-polar-700 dark:bg-polar-900 flex w-full flex-col divide-y rounded-xl border text-gray-900">
      {paymentMethods.data?.items?.length === 0 && (
        <div className="dark:text-polar:300 dark:text-polar-400 p-4 text-sm text-gray-500">
          You don&apos;t have any saved payment methods yet. You can add one
          when making your next payment.
        </div>
      )}

      {paymentMethods.data?.items?.map((pm) => (
        <PaymentMethodItem key={pm.stripe_payment_method_id} pm={pm} />
      ))}

      <div className="dark:text-polar:300 space-y-2 p-4 text-sm text-gray-500">
        <Button
          fullWidth={false}
          loading={stripePortalLoading}
          onClick={onGotoStripeCustomerPortal}
        >
          <ArrowTopRightOnSquareIcon className="mr-2 h-4 w-4" />
          <span>Invoice settings and receipts</span>
        </Button>
      </div>
    </div>
  )
}

export default PaymentMethodSettings

const PaymentMethodItem = ({ pm }: { pm: PaymentMethod }) => {
  const detachPaymentMethod = useDetachPaymentMethodMutation()

  const [isDetaching, setIsDetaching] = useState(false)

  const onDetach = async () => {
    setIsDetaching(true)
    await detachPaymentMethod.mutateAsync({
      id: pm.stripe_payment_method_id,
    })
    setIsDetaching(false)
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2">
      <CreditCardIcon className="h-5 w-5" />
      <div className="flex-1">
        {prettyCardName(pm.brand)} (****{pm.last4})
      </div>
      <div className="dark:text-polar-400 text-sm text-gray-600">
        Expires {pm.exp_month.toString().padStart(2, '0')}/{pm.exp_year}
      </div>
      <div className="dark:text-polar-400 text-sm text-gray-600">
        Connected June 22, 2023
      </div>

      {isDetaching && (
        <div>
          <Spinner />
        </div>
      )}

      {!isDetaching && (
        <div>
          <XMarkIcon
            className="dark:text-polar-400 dark:hover:text-polar-300 h-4 w-4 cursor-pointer text-gray-600 hover:text-gray-700"
            onClick={onDetach}
          />
        </div>
      )}
    </div>
  )
}
