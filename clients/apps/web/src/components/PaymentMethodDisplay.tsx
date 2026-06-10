import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Wallet } from 'lucide-react'
import CreditCardBrandIcon from './CreditCardBrandIcon'

interface PaymentMethodCardInfo {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

interface PaymentMethodDisplayProps {
  type: string
  card?: PaymentMethodCardInfo | null
}

const PAYMENT_METHOD_TYPE_LABELS: Record<string, string> = {
  link: 'Link',
  amazon_pay: 'Amazon Pay',
}

const capitalize = (value: string): string =>
  value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`

export const getPaymentMethodTypeLabel = (type: string): string =>
  PAYMENT_METHOD_TYPE_LABELS[type] ?? capitalize(type.split('_').join(' '))

export const PaymentMethodDisplay = ({
  type,
  card,
}: PaymentMethodDisplayProps) => {
  if (card) {
    return (
      <Box alignItems="center" columnGap="m" flexGrow={1}>
        <CreditCardBrandIcon
          width="3.5em"
          brand={card.brand}
          className="dark:border-polar-700 rounded-lg border border-gray-200"
        />
        <Box flexDirection="column">
          <Text>{`${capitalize(card.brand)} •••• ${card.last4}`}</Text>
          <Text color="muted" variant="caption">
            Expires {card.exp_month}/{card.exp_year}
          </Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box alignItems="center" columnGap="m" flexGrow={1}>
      <Box
        alignItems="center"
        justifyContent="center"
        width="3.5em"
        aspectRatio="3 / 2"
        borderRadius="m"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Wallet className="h-5 w-5" />
      </Box>
      <Text>{getPaymentMethodTypeLabel(type)}</Text>
    </Box>
  )
}
