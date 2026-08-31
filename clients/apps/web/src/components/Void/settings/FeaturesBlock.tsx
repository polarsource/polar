'use client'

import { VoidSettingRow, VoidToggle } from '@/components/Void/VoidControls'
import { useUpdateOrganization } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { SettingsBlock } from './SettingsBlock'

type FeatureSettings = schemas['OrganizationFeatureSettings']

const FEATURES: { key: keyof FeatureSettings; label: string }[] = [
  { key: 'compass_enabled', label: 'Compass' },
  { key: 'unit_based_pricing_enabled', label: 'Unit based pricing' },
  { key: 'seat_based_pricing_enabled', label: 'Seat based pricing' },
  { key: 'meter_cycling_enabled', label: 'Meter cycling' },
  { key: 'wallets_enabled', label: 'Wallets' },
  { key: 'member_model_enabled', label: 'Member model' },
  { key: 'checkout_localization_enabled', label: 'Checkout localization' },
  { key: 'off_session_charges_enabled', label: 'Off-session charges' },
]

export const FeaturesBlock = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const updateOrganization = useUpdateOrganization()
  const [settings, setSettings] = useState<FeatureSettings>(
    organization.feature_settings ?? ({} as FeatureSettings),
  )

  const save = (next: FeatureSettings) => {
    setSettings(next)
    updateOrganization.mutateAsync({
      id: organization.id,
      body: { feature_settings: next },
    })
  }

  return (
    <SettingsBlock
      title="Features"
      description="Alpha and beta features for this organization"
    >
      {FEATURES.map((feature) => (
        <VoidSettingRow key={feature.key} title={feature.label}>
          <VoidToggle
            checked={Boolean(settings[feature.key])}
            onChange={(checked) =>
              save({ ...settings, [feature.key]: checked })
            }
          />
        </VoidSettingRow>
      ))}
    </SettingsBlock>
  )
}
