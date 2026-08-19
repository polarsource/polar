import { StatusColor } from '@polar-sh/orbit'
import { SwitchRow } from './switchRows'

export interface SwitchStatus {
  label: string
  // Undefined renders a neutral chip. Colour marks the outcomes that need the
  // merchant's eye — switched, or left behind — so a table mid-run reads at a
  // glance.
  color?: StatusColor
}

// One question per row: what has the switch done with this subscription, and if
// nothing yet, is it ready to go. The engine re-reads Stripe and is the real
// authority, so the pre-switch hints ("No payment method") are just that.
export function switchStatus(row: SwitchRow): SwitchStatus {
  switch (row.cutover_status) {
    case 'moved':
      return { label: 'Switched', color: 'green' }
    case 'failed':
      return { label: 'Failed', color: 'red' }
    case 'skipped':
      return { label: 'Left on Stripe', color: 'yellow' }
  }
  if (row.has_payment_method === false) {
    return { label: 'No payment method', color: 'yellow' }
  }
  return { label: 'Ready' }
}
