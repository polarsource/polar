import { Alert } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { RowPaymentMethod } from './paymentMethod'

export function PaymentMethodNotice({ method }: { method: RowPaymentMethod }) {
  if (!method.note) return null
  return (
    // Alert grows to fill a column parent, so keep it in its own row.
    <Box>
      <Alert
        variant={method.kind === 'no_card' ? 'warning' : 'info'}
        title={method.note.title}
        description={method.note.body}
      />
    </Box>
  )
}
