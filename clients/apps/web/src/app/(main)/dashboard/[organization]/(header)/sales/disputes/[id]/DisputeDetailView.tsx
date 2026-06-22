'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { DisputeBanner } from '@/components/Disputes/DisputeBanner'
import { DisputeCountdownBadge } from '@/components/Disputes/DisputeCountdownBadge'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrderStatus } from '@/components/Orders/OrderStatus'
import { DetailRow } from '@/components/Shared/DetailRow'
import { useOrder } from '@/hooks/queries/orders'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

const format = formatCurrency('accounting')

interface Props {
  organization: schemas['Organization']
  dispute: schemas['Dispute']
}

export const DisputeDetailView = ({ organization, dispute }: Props) => {
  const { data: order } = useOrder(dispute.order_id)

  if (order && order.customer.organization_id !== organization.id) {
    notFound()
  }

  return (
    <DashboardBody
      title={
        <Box
          alignItems="center"
          justifyContent="between"
          columnGap="m"
          flexGrow={1}
        >
          <Box flexDirection="column" rowGap="xs">
            <Box alignItems="center" columnGap="s">
              <Text variant="heading-xs" as="h2">
                {formatCurrency('standard')(dispute.amount, dispute.currency)}{' '}
                {dispute.currency.toUpperCase()}
              </Text>
              <DisputeCountdownBadge dispute={dispute} />
            </Box>
            {order && (
              <Text color="muted">
                Charged to{' '}
                <Link
                  href={buildCustomerDashboardPath(
                    organization.slug,
                    order.customer,
                  )}
                  className="underline"
                >
                  {order.customer.name || order.customer.email}
                </Link>
              </Text>
            )}
          </Box>
          {order && (
            <Link href={`/dashboard/${organization.slug}/sales/${order.id}`}>
              <Button variant="secondary">View order</Button>
            </Link>
          )}
        </Box>
      }
      contextViewTitle="Details"
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:shadow-none"
      contextView={
        order ? (
          <CustomerContextView
            organization={organization}
            customer={order.customer}
          />
        ) : undefined
      }
    >
      <Box flexDirection="column" rowGap="xl">
        <DisputeBanner dispute={dispute} />

        {order && (
          <ShadowBox className="flex flex-col gap-4">
            <h2 className="text-lg">Order</h2>
            <div className="flex flex-col">
              <DetailRow label="Product" value={order.product?.name ?? '—'} />
              <DetailRow
                label="Status"
                value={<OrderStatus status={order.status} />}
              />
              <DetailRow
                label="Subtotal"
                value={format(order.subtotal_amount, order.currency)}
              />
              <DetailRow
                label="Discount"
                value={
                  order.discount_amount
                    ? format(-order.discount_amount, order.currency)
                    : '—'
                }
              />
              <DetailRow
                label="Net amount"
                value={format(order.net_amount, order.currency)}
              />
              <DetailRow
                label="Tax"
                value={format(order.tax_amount, order.currency)}
              />
              <DetailRow
                label="Total"
                value={format(order.total_amount, order.currency)}
              />
              <DetailRow
                label="Date"
                value={<FormattedDateTime datetime={order.created_at} />}
              />
              <DetailRow label="Invoice" value={order.invoice_number ?? '—'} />
            </div>
          </ShadowBox>
        )}
      </Box>
    </DashboardBody>
  )
}
