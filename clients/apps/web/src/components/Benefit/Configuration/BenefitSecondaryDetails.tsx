'use client'

import {
  DetailColumn,
  type DetailColumnRow,
} from '@/components/Orders/OrderSection'
import { schemas } from '@polar-sh/client'
import { Grid } from '@polar-sh/orbit'

export const BenefitSecondaryDetails = ({
  benefit,
}: {
  benefit: schemas['Benefit']
}) => {
  const metadataItems: DetailColumnRow[] = Object.entries(benefit.metadata).map(
    ([key, value]) => ({
      key,
      label: key,
      value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value,
    }),
  )

  // Feature flags carry their whole configuration in metadata, so the column
  // stays visible (with its empty state) even when nothing is set yet.
  if (metadataItems.length === 0 && benefit.type !== 'feature_flag') {
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
      <DetailColumn title="Metadata" items={metadataItems} />
    </Grid>
  )
}
