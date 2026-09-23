'use client'

import { useUpdateMigrationRecord } from '@/hooks/queries/merchantMigrations'
import { enums, schemas } from '@polar-sh/client'
import { Grid, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
import { useState } from 'react'

type AddressForm = {
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

const isComplete = (address: AddressForm) =>
  !!address.country &&
  (address.country !== 'US' ||
    (!!address.line1 && !!address.city && !!address.postal_code)) &&
  (!['US', 'CA'].includes(address.country) || !!address.state)

export function BillingAddressEditor({
  migrationId,
  row,
}: {
  migrationId: string
  row: schemas['MerchantMigrationRecordItem']
}) {
  const updateRecord = useUpdateMigrationRecord(migrationId)
  const [address, setAddress] = useState<AddressForm>(() => ({
    line1: row.customer_billing_address?.line1 ?? '',
    line2: row.customer_billing_address?.line2 ?? '',
    city: row.customer_billing_address?.city ?? '',
    state: row.customer_billing_address?.state ?? '',
    postal_code: row.customer_billing_address?.postal_code ?? '',
    country:
      row.customer_billing_address?.country ?? row.customer_country ?? '',
  }))
  const needsState = address.country === 'US' || address.country === 'CA'
  const needsFullAddress = address.country === 'US'

  const save = (next: AddressForm) => {
    setAddress(next)
    if (!row.record_id || !isComplete(next)) {
      return
    }
    updateRecord.mutate({
      recordId: row.record_id,
      update: {
        billing_address: {
          ...next,
          line2: next.line2 || null,
          state: next.state || null,
        } as schemas['AddressInput'],
      },
    })
  }

  const setField = (field: keyof AddressForm, value: string) => {
    setAddress((current) => ({ ...current, [field]: value }))
  }

  return (
    <Box flexDirection="column" rowGap="s" width="100%">
      <CountryPicker
        allowedCountries={enums.addressInputCountryValues}
        value={address.country || undefined}
        onChange={(country) =>
          save({
            ...address,
            country,
            state: '',
            ...(country === 'US'
              ? {}
              : { line1: '', line2: '', city: '', postal_code: '' }),
          })
        }
        placeholder="Select billing country"
      />
      {needsFullAddress ? (
        <>
          <Input
            aria-label="Address line 1"
            autoComplete="billing address-line1"
            placeholder="Address line 1"
            value={address.line1}
            onChange={(event) => setField('line1', event.target.value)}
            onBlur={(event) => save({ ...address, line1: event.target.value })}
          />
          <Input
            aria-label="Address line 2"
            autoComplete="billing address-line2"
            placeholder="Address line 2 (optional)"
            value={address.line2}
            onChange={(event) => setField('line2', event.target.value)}
            onBlur={(event) => save({ ...address, line2: event.target.value })}
          />
          <Grid templateColumns="1fr 1fr" gap="s">
            <Input
              aria-label="Postal code"
              autoComplete="billing postal-code"
              placeholder="Postal code"
              value={address.postal_code}
              onChange={(event) => setField('postal_code', event.target.value)}
              onBlur={(event) =>
                save({ ...address, postal_code: event.target.value })
              }
            />
            <Input
              aria-label="City"
              autoComplete="billing address-level2"
              placeholder="City"
              value={address.city}
              onChange={(event) => setField('city', event.target.value)}
              onBlur={(event) => save({ ...address, city: event.target.value })}
            />
          </Grid>
        </>
      ) : null}
      {needsState ? (
        <CountryStatePicker
          autoComplete="billing address-level1"
          country={address.country as 'US' | 'CA'}
          value={address.state || undefined}
          onChange={(state) => save({ ...address, state })}
          placeholder={address.country === 'US' ? 'State' : 'Province'}
        />
      ) : null}
      <Text variant="caption" color="muted">
        Used for Polar tax. Changes save automatically and do not block the
        migration.
      </Text>
      {updateRecord.isError ? (
        <Text variant="caption" color="error">
          {updateRecord.error instanceof Error && updateRecord.error.message
            ? updateRecord.error.message
            : "We couldn't save the billing address."}
        </Text>
      ) : null}
    </Box>
  )
}
