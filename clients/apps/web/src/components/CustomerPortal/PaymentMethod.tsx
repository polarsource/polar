import { useDeleteCustomerPaymentMethod } from '@/hooks/queries'
import type { Client, operations, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { X } from 'lucide-react'
import CreditCardBrandIcon from '../CreditCardBrandIcon'

type PaymentMethodType =
  operations['customer_portal:customers:get_payment_methods']['responses']['200']['content']['application/json']['items'][number]

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
    <div className="flex grow flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-2">
        <CreditCardBrandIcon brand={brand} />
        <div>•••• {paymentMethod.card.last4}</div>
      </div>
      <div>
        Expires {paymentMethod.card.exp_month}/{paymentMethod.card.exp_year}
      </div>
    </div>
  )
}

const PaymentMethod = ({
  api,
  paymentMethod,
}: {
  api: Client
  paymentMethod: PaymentMethodType
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
      {paymentMethod.default && (
        <div className="bg-muted rounded-lg px-2 py-1 text-xs">Default</div>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onDeletePaymentMethod}
        loading={deletePaymentMethod.isPending}
        disabled={deletePaymentMethod.isPending}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

export default PaymentMethod
