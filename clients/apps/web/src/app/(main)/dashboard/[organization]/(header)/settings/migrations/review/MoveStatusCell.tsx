import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Info } from 'lucide-react'
import { moveOutcome, moveStatus } from './moveStatus'
import {
  PaymentMethodIcon,
  PaymentMethodText,
  PaymentMethodTooltip,
} from './PaymentMethodLabel'
import { PaymentMethodVariant } from './paymentMethodVariant'
import { ReviewRow } from './reviewRows'

export function MoveStatusCell({
  row,
  variant,
}: {
  row: ReviewRow
  variant: PaymentMethodVariant
}) {
  const status = moveStatus(row)
  const method = status.paymentMethod

  if (variant === 'outcome') {
    const outcome = moveOutcome(status)
    const chip = (
      <Status status={outcome.label} color={outcome.color} size="small" />
    )
    if (!method?.note) return chip
    return (
      <PaymentMethodTooltip method={method}>
        <Box
          display="inline-flex"
          alignItems="center"
          columnGap="xs"
          cursor="default"
          color="text-tertiary"
          aria-label={`${outcome.label}: ${method.note.title}`}
        >
          {chip}
          <Info className="size-3" />
        </Box>
      </PaymentMethodTooltip>
    )
  }

  return (
    <Box alignItems="center" columnGap="s" minWidth={0}>
      <Status status={status.label} color={status.color} size="small" />
      {method ? (
        variant === 'icon' ? (
          <PaymentMethodIcon method={method} />
        ) : (
          <>
            <Text as="span" variant="caption" color="muted">
              ·
            </Text>
            <PaymentMethodText method={method} />
          </>
        )
      ) : null}
    </Box>
  )
}
