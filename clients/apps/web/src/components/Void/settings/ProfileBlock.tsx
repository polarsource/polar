'use client'

import { VoidField, VoidSettingRow } from '@/components/Void/VoidControls'
import { useUpdateOrganization } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { SettingsBlock } from './SettingsBlock'

export const ProfileBlock = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const updateOrganization = useUpdateOrganization()

  const save = (body: schemas['OrganizationUpdate']) =>
    updateOrganization.mutateAsync({ id: organization.id, body })

  return (
    <SettingsBlock title="Organization">
      <VoidSettingRow title="Name">
        <VoidField
          value={organization.name}
          onCommit={(name) => save({ name })}
        />
      </VoidSettingRow>
      <VoidSettingRow
        title="Support email"
        description="Shown to customers on receipts and the portal"
      >
        <VoidField
          value={organization.email ?? ''}
          placeholder="support@company.com"
          onCommit={(email) => save({ email })}
        />
      </VoidSettingRow>
      <VoidSettingRow title="Website">
        <VoidField
          value={organization.website ?? ''}
          placeholder="https://company.com"
          onCommit={(website) => save({ website })}
        />
      </VoidSettingRow>
    </SettingsBlock>
  )
}
