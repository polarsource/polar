'use client'

import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { formatCountry } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'
import { DetailItem } from './OrderSection'

interface DetailRow {
  key: string
  label: ReactNode
  value: ReactNode
}

const DetailColumn = ({
  title,
  items,
}: {
  title: ReactNode
  items: DetailRow[]
}) => (
  <Box flexDirection="column" rowGap="l" minWidth={0}>
    <Text variant="body" as="h3">
      {title}
    </Text>
    <Box flexDirection="column" minWidth={0} flex={1}>
      {items.length === 0 ? (
        <Box
          borderColor="border-primary"
          borderWidth={1}
          width="100%"
          height="100%"
          flexGrow={1}
          flex={1}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          padding="5xl"
        >
          <Text color="muted">No Data</Text>
        </Box>
      ) : (
        items.map((item, index) => (
          <Box
            key={item.key}
            flexDirection="column"
            minWidth={0}
            borderTopWidth={index === 0 ? 0 : 1}
            borderStyle="solid"
            borderColor="border-primary"
            paddingTop={index === 0 ? 'none' : 's'}
            paddingBottom={index === items.length - 1 ? 'none' : 's'}
          >
            <DetailItem label={item.label} value={item.value} />
          </Box>
        ))
      )}
    </Box>
  </Box>
)

export const OrderSecondaryDetails = ({
  order,
  customFields,
}: {
  order: schemas['Order']
  customFields?: schemas['CustomField'][]
}) => {
  const billingItems: DetailRow[] = []
  if (order.billing_name) {
    billingItems.push({
      key: 'billing_name',
      label: 'Billing name',
      value: order.billing_name,
    })
  }
  if (order.customer.tax_id) {
    billingItems.push({
      key: 'tax_id',
      label: 'Tax ID',
      value: (
        <Box as="span" display="inline-flex" alignItems="center" columnGap="m">
          <Text as="span">{order.customer.tax_id[0]}</Text>
          <Text as="span" color="muted" monospace>
            {order.customer.tax_id[1].toUpperCase().replace('_', ' ')}
          </Text>
        </Box>
      ),
    })
  }
  if (order.billing_address) {
    const address = order.billing_address
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

  const metadataItems: DetailRow[] = Object.entries(order.metadata).map(
    ([key, value]) => ({
      key,
      label: key,
      value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value,
    }),
  )

  const customFieldItems: DetailRow[] = (customFields ?? []).map((field) => ({
    key: field.id,
    label: field.name,
    value: (
      <CustomFieldValue
        field={field}
        value={
          order.custom_field_data
            ? order.custom_field_data[
                field.slug as keyof typeof order.custom_field_data
              ]
            : undefined
        }
      />
    ),
  }))

  if (
    billingItems.length === 0 &&
    metadataItems.length === 0 &&
    customFieldItems.length === 0
  ) {
    return null
  }

  return (
    <Grid
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
