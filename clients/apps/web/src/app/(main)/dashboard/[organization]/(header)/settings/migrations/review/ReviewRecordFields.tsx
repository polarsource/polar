'use client'

import { Field, FieldSection, FieldValue } from '../recordFields'
import { intervalLabel, renewalDate, taxLabel } from '../recordFormat'
import { ReviewRow, rowAmount } from './reviewRows'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'

export function SubscriptionFields({ row }: { row: ReviewRow }) {
  const renewal = renewalDate(row)
  const tax = taxLabel(row)

  return (
    <FieldSection title="Subscription">
      <Field label="Import">
        <ReviewStatusIndicator row={row} />
      </Field>
      {row.subtitle && (
        <Field label="Status">
          <FieldValue>{row.subtitle}</FieldValue>
        </Field>
      )}
      <Field label="Renewal">
        <FieldValue muted={!renewal}>{renewal ?? 'Unknown'}</FieldValue>
      </Field>
      {tax && (
        <Field label="Tax">
          <FieldValue>{tax}</FieldValue>
        </Field>
      )}
      {row.import_status === 'failed' && (
        <Field label="Last run">
          <FieldValue>Failed</FieldValue>
        </Field>
      )}
      <Field label="Stripe subscription ID">
        <FieldValue monospace muted>
          {row.source_id}
        </FieldValue>
      </Field>
    </FieldSection>
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
    <FieldSection title="Product">
      <Field label="Name">
        <FieldValue muted={!row.product_name}>
          {row.product_name ?? '—'}
        </FieldValue>
      </Field>
      {amount && (
        <Field label="Price">
          <FieldValue>{amount.money}</FieldValue>
        </Field>
      )}
      {interval && (
        <Field label="Renewal interval">
          <FieldValue>{interval}</FieldValue>
        </Field>
      )}
      {row.product_source_id && (
        <Field label="Stripe product ID">
          <FieldValue monospace muted>
            {row.product_source_id}
          </FieldValue>
        </Field>
      )}
    </FieldSection>
  )
}

export function CustomerFields({ row }: { row: ReviewRow }) {
  if (!row.customer_email && !row.customer_name && !row.customer_source_id) {
    return null
  }

  return (
    <FieldSection title="Customer">
      {row.customer_name && (
        <Field label="Name">
          <FieldValue>{row.customer_name}</FieldValue>
        </Field>
      )}
      {row.customer_email && (
        <Field label="Email">
          <FieldValue>{row.customer_email}</FieldValue>
        </Field>
      )}
      <Field label="Country">
        <FieldValue muted={!row.customer_country}>
          {row.customer_country ?? '—'}
        </FieldValue>
      </Field>
      {row.customer_source_id && (
        <Field label="Stripe customer ID">
          <FieldValue monospace muted>
            {row.customer_source_id}
          </FieldValue>
        </Field>
      )}
    </FieldSection>
  )
}
