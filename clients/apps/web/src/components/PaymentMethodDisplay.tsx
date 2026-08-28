import type { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Wallet } from 'lucide-react'
import CreditCardBrandIcon from './CreditCardBrandIcon'

export interface PaymentMethodCardInfo {
  brand: string | null
  last4: string | null
  exp_month?: number
  exp_year?: number
}

type CardLikeMetadata = Partial<
  schemas['PaymentMethodCardMetadata'] & schemas['PaymentMethodKrCardMetadata']
>

export const getPaymentMethodCardInfo = (paymentMethod: {
  type: string
  method_metadata?: unknown
}): PaymentMethodCardInfo | null => {
  if (paymentMethod.type !== 'card' && paymentMethod.type !== 'kr_card') {
    return null
  }
  const metadata = (paymentMethod.method_metadata ?? {}) as CardLikeMetadata
  const brand = metadata.brand ?? null
  const last4 = metadata.last4 ?? null
  if (!brand && !last4) {
    return null
  }
  return {
    brand,
    last4,
    exp_month: metadata.exp_month,
    exp_year: metadata.exp_year,
  }
}

interface PaymentMethodDisplayProps {
  type: string
  card?: PaymentMethodCardInfo | null
}

const PAYMENT_METHOD_TYPE_LABELS: Record<string, string> = {
  link: 'Link',
  amazon_pay: 'Amazon Pay',
  kr_card: 'Korean card',
  kakao_pay: 'Kakao Pay',
  naver_pay: 'Naver Pay',
  samsung_pay: 'Samsung Pay',
  payco: 'PAYCO',
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
    const label = card.brand
      ? capitalize(card.brand)
      : getPaymentMethodTypeLabel(type)
    return (
      <Box alignItems="center" columnGap="m" flexGrow={1}>
        <CreditCardBrandIcon
          width="3.5em"
          brand={card.brand ?? 'unknown'}
          className="dark:border-polar-700 rounded-lg border border-gray-200"
        />
        <Box flexDirection="column">
          <Text>{`${label}${card.last4 ? ` •••• ${card.last4}` : ''}`}</Text>
          {card.exp_month !== undefined && card.exp_year !== undefined && (
            <Text color="muted" variant="caption">
              Expires {card.exp_month}/{card.exp_year}
            </Text>
          )}
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
