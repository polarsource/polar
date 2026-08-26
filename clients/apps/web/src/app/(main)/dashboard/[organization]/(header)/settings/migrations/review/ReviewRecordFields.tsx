'use client'

import {
  DetailColumn,
  type DetailColumnRow,
} from '@/components/Orders/OrderSection'
import { Text } from '@polar-sh/orbit'
import { automaticTaxLabel, intervalLabel, renewalDate } from '../recordFormat'
import { ReviewRow, rowAmount } from './reviewRows'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'

export function SubscriptionFields({ row }: { row: ReviewRow }) {
  const tax = automaticTaxLabel(row)
  const items: DetailColumnRow[] = [
    {
      key: 'import',
      label: 'Import',
      value: <ReviewStatusIndicator row={row} />,
    },
  ]

  if (row.subtitle) {
    items.push({ key: 'status', label: 'Status', value: row.subtitle })
  }
  items.push({ key: 'renewal', label: 'Renewal', value: renewalDate(row) })
  if (tax) {
    items.push({ key: 'tax', label: 'Automatic tax', value: tax })
  }
  if (row.import_status === 'failed') {
    items.push({ key: 'last_run', label: 'Last run', value: 'Failed' })
  }
  items.push({
    key: 'source_id',
    label: 'Stripe subscription ID',
    value: (
      <Text color="muted" monospace>
        {row.source_id}
      </Text>
    ),
  })

  return <DetailColumn title="Subscription" items={items} />
}

export function ProductFields({ row }: { row: ReviewRow }) {
  const amount = rowAmount(row)
  const interval = intervalLabel(row)
  const missing = row.reason_code === 'subscription_product_not_importable'
  if (!row.product_name && !missing) {
    return null
  }

  const items: DetailColumnRow[] = [
    { key: 'name', label: 'Name', value: row.product_name },
  ]
  if (amount) {
    items.push({ key: 'price', label: 'Price', value: amount.money })
  }
  if (interval) {
    items.push({
      key: 'interval',
      label: 'Renewal interval',
      value: interval,
    })
  }
  if (row.product_source_id) {
    items.push({
      key: 'product_source_id',
      label: 'Stripe product ID',
      value: (
        <Text color="muted" monospace>
          {row.product_source_id}
        </Text>
      ),
    })
  }

  return <DetailColumn title="Product" items={items} />
}

export function CustomerFields({ row }: { row: ReviewRow }) {
  if (!row.customer_email && !row.customer_name && !row.customer_source_id) {
    return null
  }

  const items: DetailColumnRow[] = []
  if (row.customer_name) {
    items.push({ key: 'name', label: 'Name', value: row.customer_name })
  }
  if (row.customer_email) {
    items.push({ key: 'email', label: 'Email', value: row.customer_email })
  }
  items.push({
    key: 'country',
    label: 'Country',
    value: row.customer_country,
  })
  if (row.customer_source_id) {
    items.push({
      key: 'customer_source_id',
      label: 'Stripe customer ID',
      value: (
        <Text color="muted" monospace>
          {row.customer_source_id}
        </Text>
      ),
    })
  }

  return <DetailColumn title="Customer" items={items} />
}
