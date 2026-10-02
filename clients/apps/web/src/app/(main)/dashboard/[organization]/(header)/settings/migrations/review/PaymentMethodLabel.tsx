import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Info } from 'lucide-react'
import { ReactNode } from 'react'
import { PaymentMethodNote, rowPaymentMethod } from './paymentMethod'
import { ReviewRow } from './reviewRows'

// `children` followed by an info icon that explains the note on hover.
export function PaymentMethodTooltip({
  note,
  label,
  warn = false,
  children,
}: {
  note: PaymentMethodNote
  label: string
  warn?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Box
          display="inline-flex"
          alignItems="center"
          columnGap="xs"
          cursor="default"
          color={warn ? 'text-warning' : 'text-tertiary'}
          aria-label={`${label}: ${note.title}`}
        >
          {children}
          <Info className="size-3.5" />
        </Box>
      </TooltipTrigger>
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
    <PaymentMethodTooltip note={method.note} label={method.label} warn={warn}>
      {text}
    </PaymentMethodTooltip>
  )
}
