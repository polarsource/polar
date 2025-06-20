import { useDeleteCustomerPaymentMethod } from '@/hooks/queries'
import type { Client, operations, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { X } from 'lucide-react'
import CreditCardBrandIcon from '../CreditCardBrandIcon'

type PaymentMethodType =
  operations['customer_portal:customers:list_payment_methods']['responses']['200']['content']['application/json']['items'][number]

const isCardPaymentMethod = (
  paymentMethod: PaymentMethodType,
): paymentMethod is schemas['PaymentMethodCard'] =>
  paymentMethod.type === 'card'

const PaymentMethodCard = ({
  paymentMethod,
}: {
  paymentMethod: schemas['PaymentMethodCard']
}) => {
  const {
    card: { brand },
  } = paymentMethod

  return (
    <div className="flex grow flex-row items-center gap-4">
      <CreditCardBrandIcon
        width="4em"
        brand={brand}
        className="dark:border-polar-700 rounded-lg border border-gray-200 p-2"
      />
      <div className="flex flex-col">
        <span className="capitalize">
          {`${paymentMethod.card.brand} •••• ${paymentMethod.card.last4}`}
        </span>
        <span className="dark:text-polar-500 text-sm text-gray-500">
          Expires {paymentMethod.card.exp_month}/{paymentMethod.card.exp_year}
        </span>
      </div>
    </div>
  )
}

const PaymentMethod = ({
  api,
  paymentMethod,
  deletable,
}: {
  api: Client
  paymentMethod: PaymentMethodType
  deletable: boolean
}) => {
  const deletePaymentMethod = useDeleteCustomerPaymentMethod(api)

  const onDeletePaymentMethod = async () => {
    await deletePaymentMethod.mutateAsync(paymentMethod.id)
  }

  return (
    <div className="flex items-center justify-between gap-2">
      {isCardPaymentMethod(paymentMethod) ? (
        <PaymentMethodCard paymentMethod={paymentMethod} />
      ) : (
        <div>{paymentMethod.type}</div>
      )}
      <div className="flex flex-row items-center gap-x-4">
        {paymentMethod.default && (
          <Status
            status="Default Method"
            className="bg-emerald-50 text-emerald-500 dark:bg-emerald-950"
          />
        )}
        {deletable && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8"
            onClick={onDeletePaymentMethod}
            loading={deletePaymentMethod.isPending}
            disabled={deletePaymentMethod.isPending}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default PaymentMethod
