'use client'

import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import {
  DetailColumn,
  type DetailColumnRow,
} from '@/components/Orders/OrderSection'
import { formatCountry } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const SubscriptionSecondaryDetails = ({
  subscription,
  customFields,
}: {
  subscription: schemas['Subscription']
  customFields?: schemas['CustomField'][]
}) => {
  const customer = subscription.customer

  const billingItems: DetailColumnRow[] = []
  if (customer.billing_name) {
    billingItems.push({
      key: 'billing_name',
      label: 'Billing name',
      value: customer.billing_name,
    })
  }
  if (customer.tax_id) {
    billingItems.push({
      key: 'tax_id',
      label: 'Tax ID',
      value: (
        <Box as="span" display="inline-flex" alignItems="center" columnGap="m">
          <Text as="span">{customer.tax_id[0]}</Text>
          <Text as="span" color="muted" monospace>
            {customer.tax_id[1].toUpperCase().replace('_', ' ')}
          </Text>
        </Box>
      ),
    })
  }
  if (customer.billing_address) {
    const address = customer.billing_address
    billingItems.push({ key: 'line1', label: 'Address', value: address.line1 })
    if (address.line2) {
      billingItems.push({
        key: 'line2',
        label: 'Address 2',
        value: address.line2,
      })
    }
    billingItems.push({
      key: 'postal_code',
      label: 'Postal code',
      value: address.postal_code,
    })
    billingItems.push({ key: 'city', label: 'City', value: address.city })
    billingItems.push({ key: 'state', label: 'State', value: address.state })
    billingItems.push({
      key: 'country',
      label: 'Country',
      value: formatCountry(address.country),
    })
  }

  const metadataItems: DetailColumnRow[] = Object.entries(
    subscription.metadata,
  ).map(([key, value]) => ({
    key,
    label: key,
    value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value,
  }))

  const customFieldItems: DetailColumnRow[] = (customFields ?? []).map(
    (field) => ({
      key: field.id,
      label: field.name,
      value: (
        <CustomFieldValue
          field={field}
          value={
            subscription.custom_field_data
              ? subscription.custom_field_data[
                  field.slug as keyof typeof subscription.custom_field_data
                ]
              : undefined
          }
        />
      ),
    }),
  )

  if (
    billingItems.length === 0 &&
    metadataItems.length === 0 &&
    customFieldItems.length === 0
  ) {
    return null
  }

  return (
    <Grid
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingTop="4xl"
      templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }}
      columnGap="2xl"
      rowGap="2xl"
    >
      <DetailColumn title="Billing Details" items={billingItems} />
      <DetailColumn title="Metadata" items={metadataItems} />
      <DetailColumn title="Custom Fields" items={customFieldItems} />
    </Grid>
  )
}
