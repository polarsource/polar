import { isCardPayment } from '@/utils/payment'
import { schemas } from '@spaire/client'
import CreditCardBrandIcon from '../CreditCardBrandIcon'

const CardPaymentMethod = ({
  payment,
}: {
  payment: schemas['CardPayment']
}) => {
  return (
    <div className="flex flex-row items-center gap-1">
      <CreditCardBrandIcon
        height="1.5em"
        brand={payment.method_metadata.brand}
      />
      <span className="capitalize">
        {`•••• ${payment.method_metadata.last4}`}
      </span>
    </div>
  )
}

const PaymentMethod = ({ payment }: { payment: schemas['Payment'] }) => {
  if (isCardPayment(payment)) {
    return <CardPaymentMethod payment={payment} />
  }
  return <span className="capitalize">{payment.method}</span>
}

export default PaymentMethod
