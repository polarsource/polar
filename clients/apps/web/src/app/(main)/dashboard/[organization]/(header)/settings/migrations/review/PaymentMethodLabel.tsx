import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CircleAlert, CreditCard, Info, Landmark } from 'lucide-react'
import { ReactNode } from 'react'
import { RowPaymentMethod, rowPaymentMethod } from './paymentMethod'
import { ReviewRow } from './reviewRows'

export function PaymentMethodTooltip({
  method,
  children,
}: {
  method: RowPaymentMethod
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <Box flexDirection="column" rowGap="xs" paddingVertical="xs">
          <Text variant="label">{method.note?.title ?? method.label}</Text>
          {method.note ? (
            <Text variant="caption" color="muted">
              {method.note.body}
            </Text>
          ) : null}
        </Box>
      </TooltipContent>
    </Tooltip>
  )
}

export function PaymentMethodIcon({ method }: { method: RowPaymentMethod }) {
  const Icon =
    method.kind === 'no_card'
      ? CircleAlert
      : method.kind === 'bank_debit'
        ? Landmark
        : CreditCard
  return (
    <PaymentMethodTooltip method={method}>
      <Box
        as="span"
        display="inline-flex"
        cursor="default"
        color={method.kind === 'no_card' ? 'text-warning' : 'text-tertiary'}
        aria-label={
          method.note ? `${method.label}: ${method.note.title}` : method.label
        }
      >
        <Icon className="size-3.5" />
      </Box>
    </PaymentMethodTooltip>
  )
}

// The method as text, with an info icon and tooltip when there's a caveat.
export function PaymentMethodText({ method }: { method: RowPaymentMethod }) {
  const warn = method.kind === 'no_card'
  const text = (
    <Text as="span" variant="caption" color={warn ? 'warning' : 'muted'}>
      {method.label}
    </Text>
  )
  if (!method.note) return text
  return (
    <PaymentMethodTooltip method={method}>
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        columnGap="xs"
        cursor="default"
        color={warn ? 'text-warning' : 'text-tertiary'}
        aria-label={`${method.label}: ${method.note.title}`}
      >
        {text}
        <Info className="size-3" />
      </Box>
    </PaymentMethodTooltip>
  )
}

export function PaymentMethodLabel({ row }: { row: ReviewRow }) {
  const method = rowPaymentMethod(row)
  if (!method) return null
  return <PaymentMethodText method={method} />
}
