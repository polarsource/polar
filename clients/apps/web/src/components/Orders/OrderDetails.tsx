'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ArrowUpRightIcon } from 'lucide-react'
import Link from 'next/link'
import { OrderStatus } from './OrderStatus'
import { DetailCell, DetailGrid } from './OrderSection'

const formatBillingReason = (reason: string) =>
  reason
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

export const OrderDetails = ({
  order,
  product,
  organization,
}: {
  order: schemas['Order']
  product?: schemas['Product']
  organization: schemas['Organization']
}) => {
  return (
    <DetailGrid>
      <DetailCell
        label="Product"
        value={
          product ? (
            <Link
              href={`/dashboard/${organization.slug}/products/${product.id}`}
            >
              <Box
                as="span"
                display="inline-flex"
                alignItems="center"
                columnGap="s"
              >
                <Text as="span" variant="body" truncate>
                  {product.name}
                </Text>
                <Box as="span" display="inline-flex">
                  <ArrowUpRightIcon size={16} />
                </Box>
              </Box>
            </Link>
          ) : undefined
        }
      />
      <DetailCell
        label="Order date"
        value={
          <Text variant="body" as="span">
            <FormattedDateTime
              dateStyle="medium"
              resolution="time"
              datetime={order.created_at}
            />
          </Text>
        }
      />
      <DetailCell
        label="Status"
        value={<OrderStatus status={order.status} />}
      />
      <DetailCell label="Invoice number" value={order.invoice_number} />
      <DetailCell
        label="Billing reason"
        value={formatBillingReason(order.billing_reason)}
      />
      <DetailCell
        label="Discount"
        value={
          order.discount ? (
            <Link
              href={`/dashboard/${organization.slug}/products/discounts?query=${order.discount.code}`}
            >
              <Box
                as="span"
                display="inline-flex"
                alignItems="center"
                columnGap="s"
              >
                <Text as="span" variant="body" truncate>
                  {order.discount.name}
                </Text>
                <Box as="span" display="inline-flex">
                  <ArrowUpRightIcon size={16} />
                </Box>
              </Box>
            </Link>
          ) : undefined
        }
      />
    </DetailGrid>
  )
}
