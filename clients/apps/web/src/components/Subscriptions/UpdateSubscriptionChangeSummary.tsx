'use client'

import { ListRow } from '@/components/Widgets/ListRow'
import { useDiscount } from '@/hooks/queries'
import { useSubscriptionChangePreview } from '@/hooks/queries/subscriptions'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getDiscountDisplay } from '@/utils/discount'
import { formatTrialEnd, type TrialChangeOutcome } from '@/utils/trial-change'
import { ClientResponseError, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import type { ReactNode } from 'react'

const format = formatCurrency('accounting')

const ChangeRow = ({
  label,
  from,
  to,
}: {
  label: string
  from: ReactNode
  to: ReactNode
}) => (
  <>
    <Text color="muted">{label}</Text>
    <Text color="muted" truncate>
      {from}
    </Text>
    <Box paddingHorizontal="xs">
      <ArrowRight className="dark:text-polar-500 h-3 w-3 text-gray-400" />
    </Box>
    <Text truncate>{to}</Text>
  </>
)

const discountName = (discount: schemas['Discount'] | undefined) =>
  discount ? `${discount.name} ${getDiscountDisplay(discount)}` : 'None'

const splitLabel = (label: string) => {
  const [name, period] = label.split(' — ')
  return { name, period: period ?? null }
}

const headlineFor = (
  preview: schemas['SubscriptionChangePreview'],
  productName: string,
  nextInvoice: ReactNode,
  trialOutcome: TrialChangeOutcome,
): { amount: number; caption: ReactNode } => {
  const { total_amount: total, due_amount: due } = preview
  if (trialOutcome?.kind === 'continues') {
    return {
      amount: 0,
      caption: `until the trial ends on ${formatTrialEnd(trialOutcome.trialEnd)}`,
    }
  }
  if (trialOutcome?.kind === 'ends') {
    return { amount: due, caption: 'charged today, ending the trial' }
  }
  if (preview.proration_behavior === 'next_period') {
    return {
      amount: 0,
      caption: (
        <>
          today, {productName} starts {nextInvoice}
        </>
      ),
    }
  }
  if (preview.proration_behavior === 'prorate') {
    return {
      amount: total,
      caption: (
        <>
          {total < 0 ? 'credit' : 'added'} on the {nextInvoice} invoice
        </>
      ),
    }
  }
  if (due > 0) return { amount: due, caption: 'charged today' }
  if (total > 0) {
    return { amount: total, caption: 'paid from the customer’s balance' }
  }
  if (total < 0) {
    return { amount: total, caption: 'credit toward the next invoice' }
  }
  return { amount: 0, caption: 'charged today' }
}

export const UpdateSubscriptionChangeSummary = ({
  subscription,
  selectedProduct,
  change,
  isChangingDiscount,
  newDiscountId,
  trialOutcome,
}: {
  subscription: schemas['Subscription']
  selectedProduct: schemas['Product'] | undefined
  change: schemas['SubscriptionChangeProduct'] | null
  isChangingDiscount: boolean
  newDiscountId: string | null
  trialOutcome: TrialChangeOutcome
}) => {
  const organizationId = subscription.product.organization_id
  const { currency } = subscription
  const preview = useSubscriptionChangePreview(subscription.id, change)
  const { data: currentDiscount } = useDiscount(
    organizationId,
    subscription.discount_id,
  )
  const { data: newDiscount } = useDiscount(
    organizationId,
    isChangingDiscount ? newDiscountId : null,
  )

  const nextInvoiceDate =
    subscription.status === 'trialing'
      ? subscription.trial_end
      : subscription.current_period_end
  const nextInvoice = nextInvoiceDate ? (
    <FormattedDateTime dateStyle="medium" datetime={nextInvoiceDate} />
  ) : (
    'next'
  )
  const productName = selectedProduct?.name ?? 'The new product'

  const headline =
    change !== null && preview.data
      ? headlineFor(preview.data, productName, nextInvoice, trialOutcome)
      : null

  const lines = (preview.data?.prorations ?? []).map((proration, index) => ({
    id: `proration-${index}`,
    ...splitLabel(proration.label),
    amount: proration.amount,
  }))
  const sharedPeriod =
    lines.length > 0 && lines.every((line) => line.period === lines[0].period)
      ? lines[0].period
      : null

  return (
    <Box flexDirection="column" rowGap="xl">
      {change === null ? (
        <Text color="muted">
          {newDiscount
            ? `${newDiscount.name} applies`
            : 'The discount is removed'}{' '}
          from the {nextInvoice} invoice
        </Text>
      ) : preview.isError ? (
        <Text color="danger">
          {preview.error instanceof ClientResponseError
            ? extractApiErrorMessage({ detail: preview.error.error.detail })
            : 'Could not preview this change.'}
        </Text>
      ) : (
        <Box alignItems="baseline" columnGap="m" flexWrap="wrap">
          <Text
            variant="heading-s"
            weight="book"
            tabularNums
            color={headline ? 'default' : 'muted'}
          >
            {headline ? format(headline.amount, currency) : '–'}
          </Text>
          {headline && <Text color="muted">{headline.caption}</Text>}
        </Box>
      )}

      <Grid
        templateColumns="92px auto auto minmax(0, 1fr)"
        autoRows="minmax(26px, auto)"
        columnGap="xs"
        alignItems="center"
      >
        {change !== null && (
          <ChangeRow
            label="Product"
            from={subscription.product.name}
            to={productName}
          />
        )}
        {isChangingDiscount && (
          <ChangeRow
            label="Discount"
            from={discountName(currentDiscount)}
            to={discountName(newDiscount)}
          />
        )}
      </Grid>

      {preview.data && lines.length > 0 && (
        <Box flexDirection="column">
          {sharedPeriod && (
            <Box paddingBottom="s">
              <Text color="muted">{sharedPeriod}</Text>
            </Box>
          )}
          {lines.map((line) => (
            <ListRow key={line.id}>
              <Box flexDirection="column" minWidth={0}>
                <Text truncate>{line.name}</Text>
                {!sharedPeriod && line.period && (
                  <Text variant="caption" color="muted">
                    {line.period}
                  </Text>
                )}
              </Box>
              <Text color="muted" tabularNums>
                {format(line.amount, currency)}
              </Text>
            </ListRow>
          ))}
          <ListRow>
            <Text>Total</Text>
            <Text tabularNums>
              {format(preview.data.total_amount, currency)}
            </Text>
          </ListRow>
        </Box>
      )}
    </Box>
  )
}
