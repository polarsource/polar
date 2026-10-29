import { benefitsDisplayNames } from '@/components/Benefit/utils'
import AmountLabel from '@/components/Shared/AmountLabel'
import { useBenefit, useProduct } from '@/hooks/queries'
import { useOrder } from '@/hooks/queries/orders'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import Link from 'next/link'
import { ReactNode } from 'react'
import { BillingReasonDisplayName } from './EventCard/OrderEventCard'
import { hasDedicatedEventCard } from './utils'

export interface EventDetailField {
  label: string
  value: ReactNode
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const ResourceLink = ({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) => (
  <Link href={href} className="min-w-0 truncate text-sm hover:opacity-60">
    {children}
  </Link>
)

export const useEventDetailFields = (
  event: schemas['Event'],
  organizationSlug: string,
): { fields: EventDetailField[]; isLoading: boolean } => {
  const metadata = hasDedicatedEventCard(event)
    ? (event.metadata as Record<string, unknown>)
    : {}
  const kind = hasDedicatedEventCard(event) ? event.name : null
  const base = `/dashboard/${organizationSlug}`

  const subscriptionId = asString(metadata.subscription_id)
  const orderId = asString(metadata.order_id)
  const benefitId = asString(metadata.benefit_id)

  const { data: product, isLoading: isLoadingProduct } = useProduct(
    asString(metadata.product_id) ?? asString(metadata.new_product_id),
  )
  const { data: oldProduct, isLoading: isLoadingOldProduct } = useProduct(
    asString(metadata.old_product_id),
  )
  const { data: order, isLoading: isLoadingOrder } = useOrder(orderId)
  const { data: benefit, isLoading: isLoadingBenefit } = useBenefit(benefitId)

  const isLoading =
    isLoadingProduct ||
    isLoadingOldProduct ||
    isLoadingOrder ||
    isLoadingBenefit
  const subscriptionHref = `${base}/subscriptions?subscriptionId=${subscriptionId}`

  switch (kind) {
    case 'subscription.cycled':
    case 'subscription.revoked': {
      const amount = metadata.amount
      const currency = asString(metadata.currency)
      return {
        isLoading,
        fields: [
          {
            label: 'Product',
            value: (
              <ResourceLink href={subscriptionHref}>
                {product?.name ?? '—'}
              </ResourceLink>
            ),
          },
          ...(typeof amount === 'number' && currency
            ? [
                {
                  label: 'Amount',
                  value: (
                    <Text>
                      <AmountLabel
                        amount={amount}
                        currency={currency}
                        interval={
                          metadata.recurring_interval as
                            | schemas['RecurringInterval']
                            | undefined
                        }
                        intervalCount={
                          metadata.recurring_interval_count as
                            | number
                            | undefined
                        }
                      />
                    </Text>
                  ),
                },
              ]
            : []),
        ],
      }
    }
    case 'subscription.product_updated':
      return {
        isLoading,
        fields: [
          {
            label: 'Product',
            value: (
              <ResourceLink href={subscriptionHref}>
                {oldProduct?.name ?? '—'} → {product?.name ?? '—'}
              </ResourceLink>
            ),
          },
        ],
      }
    case 'order.paid':
    case 'order.refunded':
      if (!order) return { isLoading, fields: [] }
      return {
        isLoading,
        fields: [
          {
            label: 'Order',
            value: (
              <ResourceLink href={`${base}/sales/${order.id}`}>
                {order.product?.name ?? order.id}
              </ResourceLink>
            ),
          },
          ...(kind === 'order.paid'
            ? [
                {
                  label: 'Reason',
                  value: (
                    <Text>
                      {BillingReasonDisplayName[order.billing_reason]}
                    </Text>
                  ),
                },
                {
                  label: 'Amount',
                  value: (
                    <Text tabularNums>
                      {formatCurrency('compact')(
                        order.total_amount,
                        order.currency,
                      )}
                    </Text>
                  ),
                },
              ]
            : [
                {
                  label: 'Refunded',
                  value: (
                    <Text tabularNums>
                      {formatCurrency('compact')(
                        order.refunded_amount,
                        order.currency,
                      )}
                    </Text>
                  ),
                },
              ]),
        ],
      }
    case 'benefit.granted':
    case 'benefit.cycled':
    case 'benefit.updated':
    case 'benefit.revoked':
      if (!benefit) return { isLoading, fields: [] }
      return {
        isLoading,
        fields: [
          {
            label: 'Benefit',
            value: (
              <ResourceLink href={`${base}/products/benefits/${benefit.id}`}>
                {benefit.description ?? '—'}
              </ResourceLink>
            ),
          },
          {
            label: 'Type',
            value: <Text>{benefitsDisplayNames[benefit.type]}</Text>,
          },
        ],
      }
    default:
      return { isLoading, fields: [] }
  }
}
