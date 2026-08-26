'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { automaticTaxLabel, intervalLabel, renewalDate } from '../recordFormat'
import { ReviewRow, rowAmount } from './reviewRows'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box flexDirection="column" rowGap="l" minWidth={0}>
      <Text variant="body" as="h3">
        {title}
      </Text>
      <Box flexDirection="column" rowGap="m" minWidth={0}>
        {children}
      </Box>
    </Box>
  )
}

export function SubscriptionFields({ row }: { row: ReviewRow }) {
  const tax = automaticTaxLabel(row)

  return (
    <Section title="Subscription">
      <DetailCell label="Import" value={<ReviewStatusIndicator row={row} />} />
      {row.subtitle ? <DetailCell label="Status" value={row.subtitle} /> : null}
      <DetailCell label="Renewal" value={renewalDate(row)} />
      {tax ? <DetailCell label="Automatic tax" value={tax} /> : null}
      {row.import_status === 'failed' ? (
        <DetailCell label="Last run" value="Failed" />
      ) : null}
      <DetailCell
        label="Stripe subscription ID"
        value={row.source_id}
        monospace
      />
    </Section>
  )
}

export function ProductFields({ row }: { row: ReviewRow }) {
  const amount = rowAmount(row)
  const interval = intervalLabel(row)
  const missing = row.reason_code === 'subscription_product_not_importable'
  if (!row.product_name && !missing) {
    return null
  }

  return (
    <Section title="Product">
      <DetailCell label="Name" value={row.product_name} />
      {amount ? <DetailCell label="Price" value={amount.money} /> : null}
      {interval ? (
        <DetailCell label="Renewal interval" value={interval} />
      ) : null}
      {row.product_source_id ? (
        <DetailCell
          label="Stripe product ID"
          value={row.product_source_id}
          monospace
        />
      ) : null}
    </Section>
  )
}

export function CustomerFields({ row }: { row: ReviewRow }) {
  if (!row.customer_email && !row.customer_name && !row.customer_source_id) {
    return null
  }

  return (
    <Section title="Customer">
      {row.customer_name ? (
        <DetailCell label="Name" value={row.customer_name} />
      ) : null}
      {row.customer_email ? (
        <DetailCell label="Email" value={row.customer_email} />
      ) : null}
      <DetailCell label="Country" value={row.customer_country} />
      {row.customer_source_id ? (
        <DetailCell
          label="Stripe customer ID"
          value={row.customer_source_id}
          monospace
        />
      ) : null}
    </Section>
  )
}
