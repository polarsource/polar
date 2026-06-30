'use client'

import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { ArrowUpRightIcon } from 'lucide-react'
import Link from 'next/link'
import { formatCountry } from '@/utils/formatters'
import { OrderStatus } from './OrderStatus'
import { DetailItem, OrderSection } from './OrderSection'

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
  const hasBillingDetails =
    !!order.billing_address || !!order.billing_name || !!order.customer.tax_id

  return (
    <>
      <OrderSection title="Order details">
        <DetailItem
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
                  columnGap="xs"
                >
                  <Text as="span">{product.name}</Text>
                  <Box as="span" display="inline-flex" opacity={0.5}>
                    <ArrowUpRightIcon size={14} />
                  </Box>
                </Box>
              </Link>
            ) : undefined
          }
        />
        <DetailItem label="Invoice number" value={order.invoice_number} />
        <DetailItem label="Order ID" value={order.id} monospace />
        <DetailItem
          label="Order date"
          value={
            <FormattedDateTime
              dateStyle="medium"
              resolution="time"
              datetime={order.created_at}
            />
          }
        />
        <DetailItem
          label="Status"
          value={<OrderStatus status={order.status} />}
        />
        <DetailItem
          label="Discount code"
          value={
            order.discount ? (
              <Box as="span" display="inline-flex" alignItems="center" columnGap="s">
                {order.discount.code && (
                  <Text as="span" monospace>
                    {order.discount.code}
                  </Text>
                )}
                <Text
                  as="span"
                  color={order.discount.code ? 'muted' : 'default'}
                >
                  {order.discount.name}
                </Text>
              </Box>
            ) : undefined
          }
          action={
            order.discount ? (
              <Link
                href={`/dashboard/${organization.slug}/products/discounts?query=${order.discount.code}`}
              >
                <Button variant="ghost" size="icon">
                  <ArrowOutwardOutlined fontSize="small" />
                </Button>
              </Link>
            ) : undefined
          }
        />
        <DetailItem
          label="Billing reason"
          value={formatBillingReason(order.billing_reason)}
        />
      </OrderSection>

      {hasBillingDetails && (
        <OrderSection title="Billing details">
          {order.billing_name && (
            <DetailItem label="Billing name" value={order.billing_name} />
          )}
          {order.customer.tax_id && (
            <DetailItem
              label="Tax ID"
              value={
                <Box
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  columnGap="xs"
                >
                  <Text as="span">{order.customer.tax_id[0]}</Text>
                  <Text as="span" color="muted" monospace>
                    {order.customer.tax_id[1].toUpperCase().replace('_', ' ')}
                  </Text>
                </Box>
              }
            />
          )}
          {order.billing_address && (
            <>
              <DetailItem label="Address" value={order.billing_address.line1} />
              <DetailItem
                label="Address 2"
                value={order.billing_address.line2}
              />
              <DetailItem
                label="Postal code"
                value={order.billing_address.postal_code}
              />
              <DetailItem label="City" value={order.billing_address.city} />
              <DetailItem label="State" value={order.billing_address.state} />
              <DetailItem
                label="Country"
                value={formatCountry(order.billing_address.country)}
              />
            </>
          )}
        </OrderSection>
      )}
    </>
  )
}
