import { isCardPayment, isKrCardPayment } from '@/utils/payment'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CreditCardBrandIcon from '../CreditCardBrandIcon'
import { getPaymentMethodTypeLabel } from '../PaymentMethodDisplay'

const PaymentMethod = ({ payment }: { payment: schemas['Payment'] }) => {
  const metadata =
    isCardPayment(payment) || isKrCardPayment(payment)
      ? payment.method_metadata
      : null

  if (metadata?.last4) {
    return (
      <Box alignItems="center" columnGap="xs">
        <CreditCardBrandIcon
          height="1.5em"
          brand={metadata.brand ?? 'unknown'}
        />
        <Text>{`•••• ${metadata.last4}`}</Text>
      </Box>
    )
  }
  return <Text>{getPaymentMethodTypeLabel(payment.method)}</Text>
}

export default PaymentMethod
