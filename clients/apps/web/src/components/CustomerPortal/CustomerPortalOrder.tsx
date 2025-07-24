'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import { useCustomerBenefitGrants } from '@/hooks/queries'
import { useRetryPayment } from '@/hooks/useRetryPayment'
import { Client, schemas } from '@polar-sh/client'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import { DetailRow } from '../Shared/DetailRow'
import { RetryPaymentButton } from './RetryPaymentButton'

const statusColors = {
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  refunded:
    'bg-purple-100 text-purple-500 dark:bg-purple-950 dark:text-purple-500',
  partially_refunded:
    'bg-purple-100 text-purple-500 dark:bg-purple-950 dark:text-purple-500',
}

const CustomerPortalOrder = ({
  api,
  order,
  customerSessionToken,
  themingPreset,
}: {
  api: Client
  order: schemas['CustomerOrder']
  customerSessionToken: string
  themingPreset: ThemingPresetProps
}) => {
  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    order_id: order.id,
    limit: 100,
    sorting: ['type'],
  })

  const { retryPayment, isRetrying, isLoading } =
    useRetryPayment(customerSessionToken)

  const isPartiallyOrFullyRefunded = useMemo(() => {
    return order.status === 'partially_refunded' || order.status === 'refunded'
  }, [order])

  return (
    <div className="flex h-full flex-col gap-12">
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-row flex-wrap gap-x-4">
          <h3 className="text-2xl">{order.product.name}</h3>
          <Status
            status={order.status.split('_').join(' ')}
            className={twMerge(statusColors[order.status], 'capitalize')}
          />
          <RetryPaymentButton
            order={order}
            onRetry={retryPayment}
            isRetrying={isRetrying(order.id)}
            isLoading={isLoading(order.id)}
            themingPreset={themingPreset}
          />
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col">
            <DetailRow label="Order ID" value={<span>{order.id}</span>} />
            <DetailRow
              label="Product"
              value={<span>{order.product.name}</span>}
            />
            <DetailRow
              label="Order Date"
              value={
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              }
            />
            <DetailRow
              label="Status"
              value={
                <span className="capitalize">
                  {order.status.split('_').join(' ')}
                </span>
              }
            />
          </div>

          {order.items.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg">Order Items</h3>
              <div className="flex flex-col gap-4">
                {order.items.map((item) => (
                  <DetailRow
                    key={item.id}
                    label={item.label}
                    value={<span>{formatCurrencyAndAmount(item.amount)}</span>}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col">
            <DetailRow
              label="Subtotal"
              value={
                <span>{formatCurrencyAndAmount(order.subtotal_amount)}</span>
              }
            />
            <DetailRow
              label="Discount"
              value={
                <span>
                  {order.discount_amount
                    ? formatCurrencyAndAmount(-order.discount_amount)
                    : '—'}
                </span>
              }
            />
            <DetailRow
              label="Net amount"
              value={<span>{formatCurrencyAndAmount(order.net_amount)}</span>}
            />
            <DetailRow
              label="Tax"
              value={<span>{formatCurrencyAndAmount(order.tax_amount)}</span>}
            />
            <DetailRow
              label="Total"
              value={<span>{formatCurrencyAndAmount(order.total_amount)}</span>}
            />

            {isPartiallyOrFullyRefunded && (
              <DetailRow
                label="Refunded amount"
                value={
                  <span>{formatCurrencyAndAmount(order.refunded_amount)}</span>
                }
              />
            )}
          </div>
          {order.paid && (
            <div className="flex flex-col gap-2">
              <DownloadInvoicePortal
                customerSessionToken={customerSessionToken}
                order={order}
                onInvoiceGenerated={() => {}}
              />
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-4">
          <h3 className="text-lg">Benefit Grants</h3>
          {(benefitGrants?.items.length ?? 0) > 0 ? (
            <div className="flex flex-col gap-4">
              <List className={themingPreset.polar.list}>
                {benefitGrants?.items.map((benefitGrant) => (
                  <ListItem
                    key={benefitGrant.id}
                    className="py-6 hover:bg-transparent dark:hover:bg-transparent"
                  >
                    <BenefitGrant api={api} benefitGrant={benefitGrant} />
                  </ListItem>
                ))}
              </List>
            </div>
          ) : (
            <div className="dark:border-polar-700 flex flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 p-6">
              <span className="dark:text-polar-500 text-gray-500">
                This product has no benefit grants
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomerPortalOrder
