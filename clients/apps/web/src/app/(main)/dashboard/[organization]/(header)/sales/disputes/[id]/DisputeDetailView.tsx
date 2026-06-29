'use client'

import { DisputeBanner } from '@/components/Disputes/DisputeBanner'
import { DisputeContextView } from '@/components/Disputes/DisputeContextView'
import { DisputeCountdownBadge } from '@/components/Disputes/DisputeCountdownBadge'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useOrder } from '@/hooks/queries/orders'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

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
          <DisputeContextView organization={organization} order={order} />
        ) : undefined
      }
    >
      <DisputeBanner dispute={dispute} organization={organization} />
    </DashboardBody>
  )
}
