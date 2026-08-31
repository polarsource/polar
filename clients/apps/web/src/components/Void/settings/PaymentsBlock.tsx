'use client'

import { VoidSelect, VoidSettingRow } from '@/components/Void/VoidControls'
import { useUpdateOrganization } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { SettingsBlock } from './SettingsBlock'

const CURRENCIES = [
  'usd',
  'eur',
  'gbp',
  'sek',
  'dkk',
  'nok',
  'chf',
  'cad',
  'aud',
  'jpy',
] as const

export const PaymentsBlock = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const updateOrganization = useUpdateOrganization()
  const [currency, setCurrency] = useState<string>(
    organization.default_presentment_currency,
  )
  const [taxBehavior, setTaxBehavior] = useState<string>(
    organization.default_tax_behavior,
  )

  const currencyOptions = [
    ...new Set<string>([
      organization.default_presentment_currency,
      ...CURRENCIES,
    ]),
  ].map((value) => ({ value, label: value.toUpperCase() }))

  return (
    <SettingsBlock title="Payments">
      <VoidSettingRow
        title="Presentment currency"
        description="Default currency shown to customers at checkout"
      >
        <VoidSelect
          value={currency}
          options={currencyOptions}
          onChange={(value) => {
            setCurrency(value)
            updateOrganization.mutateAsync({
              id: organization.id,
              body: {
                default_presentment_currency:
                  value as schemas['PresentmentCurrency'],
              },
            })
          }}
        />
      </VoidSettingRow>
      <VoidSettingRow
        title="Tax behavior"
        description="Whether listed prices include tax"
      >
        <VoidSelect
          value={taxBehavior}
          options={[
            { value: 'exclusive', label: 'Tax exclusive' },
            { value: 'inclusive', label: 'Tax inclusive' },
          ]}
          onChange={(value) => {
            setTaxBehavior(value)
            updateOrganization.mutateAsync({
              id: organization.id,
              body: { default_tax_behavior: value as schemas['TaxBehavior'] },
            })
          }}
        />
      </VoidSettingRow>
    </SettingsBlock>
  )
}
