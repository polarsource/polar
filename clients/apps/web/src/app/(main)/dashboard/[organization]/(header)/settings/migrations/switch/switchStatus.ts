import { StatusColor } from '@polar-sh/orbit'
import { CARD_STATUS_COPY } from './cardStatus'
import { SwitchRow } from './switchRows'

export interface SwitchStatus {
  label: string
  color?: StatusColor
}

export function switchStatus(row: SwitchRow): SwitchStatus {
  switch (row.cutover_status) {
    case 'moved':
      return { label: 'Switched' }
    case 'failed':
      return { label: 'Failed', color: 'red' }
    case 'skipped':
      return { label: 'Not switched', color: 'yellow' }
  }
  const cardCopy = row.card_status ? CARD_STATUS_COPY[row.card_status] : null
  if (cardCopy) {
    return { label: cardCopy.label, color: 'yellow' }
  }
  if (row.has_payment_method === false) {
    return { label: 'No payment method', color: 'yellow' }
  }
  return { label: 'Ready', color: 'green' }
}
