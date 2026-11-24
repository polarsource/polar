import { schemas } from '@polar-sh/client'
import { joinList, plural } from '../review/importSummary'
import { SwitchRow } from './switchRows'

export type CardStatus = schemas['MerchantMigrationCardStatus']
export type CardStatusCount = schemas['MerchantMigrationCardStatusCount']

interface CardStatusCopy {
  label: string
  detail: string
  count: (count: number) => string
}

// `ready` has no entry: there is nothing to tell the merchant about it.
export const CARD_STATUS_COPY: Partial<Record<CardStatus, CardStatusCopy>> = {
  india_card: {
    label: 'India card',
    detail:
      "India-issued card. Its mandate for recurring charges didn't move, so renewals on Polar will be declined.",
    count: (count) => `${count} with an India-issued card`,
  },
  expired_card: {
    label: 'Card expired',
    detail: 'The copied card has expired.',
    count: (count) => `${count} with an expired card`,
  },
  non_card_only: {
    label: 'No card copied',
    detail:
      "Only a payment method Polar can't charge was copied, such as Link.",
    count: (count) => `${count} with only a method Polar can't charge`,
  },
  nothing_copied: {
    label: 'No card copied',
    detail: 'No payment method was copied for this customer.',
    count: (count) => `${count} with nothing copied`,
  },
  ambiguous: {
    label: 'Card unclear',
    detail:
      "Several copied cards look like the one this subscription was charging, so Polar can't tell which to use.",
    count: (count) => `${count} where the card to charge is unclear`,
  },
}

export function paymentMethodDetail(
  row: Pick<SwitchRow, 'card_status' | 'has_payment_method'>,
): string | null {
  const copy = row.card_status ? CARD_STATUS_COPY[row.card_status] : null
  if (copy) return copy.detail
  if (row.has_payment_method === false) return 'No payment method'
  return row.has_payment_method ? 'Ready to charge' : null
}

export function cardStatusSummaryText(
  counts: CardStatusCount[],
): string | null {
  const flagged = counts.flatMap(({ status, count }) => {
    const copy = CARD_STATUS_COPY[status]
    return copy ? [{ count, text: copy.count(count) }] : []
  })
  if (flagged.length === 0) return null
  const affected = flagged.reduce((sum, entry) => sum + entry.count, 0)
  return `${plural(affected, 'subscription')} not switched yet can't be charged with what the card copy left on Polar: ${joinList(flagged.map((entry) => entry.text))}. You can still switch them, but their first renewal fails and goes to dunning until the customer adds a payment method. Leave them unselected to keep them at your current provider for now.`
}
