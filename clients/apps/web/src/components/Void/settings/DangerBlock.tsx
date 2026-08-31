'use client'

import { VoidSettingRow } from '@/components/Void/VoidControls'
import { Text } from '@polar-sh/orbit'
import { SettingsBlock } from './SettingsBlock'

export const DangerBlock = () => (
  <SettingsBlock
    title="Danger zone"
    description="Irreversible actions for this organization"
  >
    <VoidSettingRow
      title="Delete organization"
      description="Removes the organization, its products and all customer data"
    >
      <Text variant="heading-xxs" color="muted">
        Contact support to delete
      </Text>
    </VoidSettingRow>
  </SettingsBlock>
)
