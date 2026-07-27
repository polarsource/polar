import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const formatReleaseDate = (datetime: string) =>
  new Date(datetime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

const HeldBalanceNote = ({
  label,
  amount,
  currency,
  caption,
}: {
  label: string
  amount: number
  currency: string
  caption?: string
}) => (
  <Box flexDirection="column" rowGap="xs">
    <Text color="muted">
      {label}: {formatCurrency('accounting')(amount, currency)}
    </Text>
    {caption ? (
      <Text variant="caption" color="muted">
        {caption}
      </Text>
    ) : null}
  </Box>
)

export const HeldBalanceSummary = ({
  heldBalance,
}: {
  heldBalance: schemas['TransactionsHeldBalance'] | undefined
}) => {
  if (!heldBalance || heldBalance.amount === 0) {
    return null
  }

  if (heldBalance.amount < 0) {
    return (
      <HeldBalanceNote
        label="Pending refunds"
        amount={-heldBalance.amount}
        currency={heldBalance.currency}
        caption={
          heldBalance.fully_available_at
            ? `Settles by ${formatReleaseDate(heldBalance.fully_available_at)}, reducing your available balance`
            : 'Reduces your available balance as refunds settle'
        }
      />
    )
  }

  const nextRelease =
    heldBalance.next_release_at && heldBalance.next_release_amount > 0
      ? `${formatCurrency('accounting')(
          heldBalance.next_release_amount,
          heldBalance.currency,
        )} releases ${formatReleaseDate(heldBalance.next_release_at)}`
      : null
  const fullyAvailable =
    heldBalance.fully_available_at &&
    heldBalance.fully_available_at !== heldBalance.next_release_at
      ? `Fully available by ${formatReleaseDate(heldBalance.fully_available_at)}`
      : null
  const caption = [nextRelease, fullyAvailable].filter(Boolean).join('. ')

  return (
    <HeldBalanceNote
      label="Pending"
      amount={heldBalance.amount}
      currency={heldBalance.currency}
      caption={caption || undefined}
    />
  )
}
