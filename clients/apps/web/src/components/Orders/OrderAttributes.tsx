'use client'

import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { schemas } from '@polar-sh/client'
import { DetailItem, OrderSection } from './OrderSection'

export const OrderAttributes = ({
  order,
  customFields,
}: {
  order: schemas['Order']
  customFields?: schemas['CustomField'][]
}) => {
  const hasCustomFields = (customFields?.length ?? 0) > 0
  const metadataEntries = Object.entries(order.metadata)

  return (
    <>
      {hasCustomFields && (
        <OrderSection title="Custom fields">
          {customFields?.map((field) => (
            <DetailItem
              key={field.id}
              label={field.name}
              value={
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
              }
            />
          ))}
        </OrderSection>
      )}

      {metadataEntries.length > 0 && (
        <OrderSection title="Metadata">
          {metadataEntries.map(([key, value]) => (
            <DetailItem
              key={key}
              label={key}
              value={
                typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value
              }
            />
          ))}
        </OrderSection>
      )}
    </>
  )
}
