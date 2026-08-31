'use client'

import { VoidField, VoidSettingRow } from '@/components/Void/VoidControls'
import { useUpdateOrganization } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { SettingsBlock } from './SettingsBlock'

export const EmbedBlock = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const updateOrganization = useUpdateOrganization()
  const [hosts, setHosts] = useState<string[]>(organization.embed_hosts ?? [])

  const save = (embed_hosts: string[]) => {
    setHosts(embed_hosts)
    updateOrganization.mutateAsync({
      id: organization.id,
      body: { embed_hosts },
    })
  }

  return (
    <SettingsBlock
      title="Embedding"
      description="Hosts allowed to embed your checkout"
    >
      {hosts.map((host) => (
        <Box
          key={host}
          justifyContent="between"
          alignItems="baseline"
          columnGap="l"
        >
          <Text variant="heading-xxs" monospace>
            {host}
          </Text>
          <button
            type="button"
            aria-label={`Remove ${host}`}
            onClick={() => save(hosts.filter((h) => h !== host))}
            className="cursor-pointer border-0 bg-transparent p-0"
          >
            <Text variant="heading-xxs" color="muted">
              Remove
            </Text>
          </button>
        </Box>
      ))}
      <VoidSettingRow title="Add host">
        <VoidField
          value=""
          placeholder="checkout.company.com"
          onCommit={(host) => {
            const trimmed = host.trim()
            if (trimmed && !hosts.includes(trimmed)) {
              save([...hosts, trimmed])
            }
          }}
        />
      </VoidSettingRow>
    </SettingsBlock>
  )
}
