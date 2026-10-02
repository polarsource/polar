import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Info } from 'lucide-react'
import { ReactNode } from 'react'
import { PaymentMethodNote, rowPaymentMethod } from './paymentMethod'
import { ReviewRow } from './reviewRows'

export function PaymentMethodTooltip({
  note,
  children,
}: {
  note: PaymentMethodNote
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <Box flexDirection="column" rowGap="xs" paddingVertical="xs">
          <Text variant="label">{note.title}</Text>
          <Text variant="caption" color="muted">
            {note.body}
          </Text>
        </Box>
      </TooltipContent>
    </Tooltip>
  )
}

export function PaymentMethodLabel({ row }: { row: ReviewRow }) {
  const method = rowPaymentMethod(row)
  if (!method) return null
  const warn = method.kind === 'no_card'
  const text = (
    <Text as="span" color={warn ? 'warning' : 'default'}>
      {method.label}
    </Text>
  )
  if (!method.note) return text
  return (
    <PaymentMethodTooltip note={method.note}>
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
        <Info className="size-3.5" />
      </Box>
    </PaymentMethodTooltip>
  )
}
