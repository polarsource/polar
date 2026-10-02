import {
  Alert,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CreditCard, Info } from 'lucide-react'
import { PAYMENT_METHOD_STAYS_COPY, rowPaymentMethod } from './paymentMethod'
import { ReviewRow } from './reviewRows'

export function PaymentMethodSummary({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <Alert
      variant="info"
      title={PAYMENT_METHOD_STAYS_COPY.summary(count)}
      description={PAYMENT_METHOD_STAYS_COPY.summaryDetail}
    />
  )
}

// `exceptionsOnly` keeps cards silent, so only the rows that need a follow-up
// carry a marker.
export function PaymentMethodLabel({
  row,
  exceptionsOnly = false,
}: {
  row: ReviewRow
  exceptionsOnly?: boolean
}) {
  const method = rowPaymentMethod(row)
  if (!method) {
    return exceptionsOnly ? null : <Text color="muted">—</Text>
  }
  if (method.moves) {
    if (exceptionsOnly) return null
    return (
      <Box as="span" display="inline-flex" alignItems="center" columnGap="xs">
        <Box as="span" display="inline-flex" color="text-tertiary">
          <CreditCard className="size-3.5" />
        </Box>
        <Text as="span" color="muted">
          {method.label}
        </Text>
      </Box>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Box
          as="span"
          display="inline-flex"
          alignItems="center"
          columnGap="xs"
          flexShrink={0}
          cursor="default"
          color="text-warning"
          aria-label={`${method.label}: ${PAYMENT_METHOD_STAYS_COPY.title}`}
        >
          <Text
            as="span"
            color="warning"
            variant={exceptionsOnly ? 'caption' : 'default'}
          >
            {exceptionsOnly ? `${method.label} · won't move` : method.label}
          </Text>
          <Info className="size-3.5" />
        </Box>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <Box flexDirection="column" rowGap="xs" paddingVertical="xs">
          <Text variant="label">{PAYMENT_METHOD_STAYS_COPY.title}</Text>
          <Text variant="caption" color="muted">
            {method.explanation}
          </Text>
        </Box>
      </TooltipContent>
    </Tooltip>
  )
}
