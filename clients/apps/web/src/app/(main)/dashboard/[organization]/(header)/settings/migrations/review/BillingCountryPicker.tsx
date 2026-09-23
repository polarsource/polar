'use client'

import { useUpdateMigrationBillingCountry } from '@/hooks/queries/merchantMigrations'
import { useOptimisticSave } from '@/hooks/useOptimisticSave'
import { enums, schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'

type Country = schemas['CountryAlpha2Input']

export function BillingCountryPicker({
  migrationId,
  row,
}: {
  migrationId: string
  row: schemas['MerchantMigrationRecordItem']
}) {
  const updateCountry = useUpdateMigrationBillingCountry(migrationId)
  const { value, update } = useOptimisticSave<Country | ''>(
    (row.customer_country as Country | null) ?? '',
    async (country) => {
      if (!row.record_id || !country) {
        return false
      }
      try {
        await updateCountry.mutateAsync({
          recordId: row.record_id,
          country,
        })
        return true
      } catch {
        return false
      }
    },
  )

  return (
    <Box flexDirection="column" rowGap="s" width="100%">
      <CountryPicker
        allowedCountries={enums.addressInputCountryValues}
        value={value || undefined}
        onChange={(country) => update(country as Country)}
        placeholder="Select billing country"
      />
      <Text variant="caption" color="muted">
        Used for Polar tax. Changing it does not block the migration.
      </Text>
      {updateCountry.isError ? (
        <Text variant="caption" color="error">
          {updateCountry.error instanceof Error && updateCountry.error.message
            ? updateCountry.error.message
            : "We couldn't save the billing country."}
        </Text>
      ) : null}
    </Box>
  )
}
