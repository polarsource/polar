'use client'

import { schemas } from '@polar-sh/client'
import { List, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  CustomProperties,
  DownloadablesProperties,
  GitHubRepositoryProperties,
  LicenseKeysProperties,
  MeterCreditProperties,
} from './BenefitProperties'
import {
  ConfigurationBlock,
  ConfigurationEntry,
  ConfigurationRow,
} from './ConfigurationRow'
import {
  DiscordProperties,
  SlackSharedChannelProperties,
} from './IntegrationProperties'

export interface BenefitConfigurationProps {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}

const BenefitTypeProperties = ({
  benefit,
  organization,
}: BenefitConfigurationProps) => {
  switch (benefit.type) {
    case 'custom':
      return <CustomProperties benefit={benefit} />
    case 'discord':
      return <DiscordProperties benefit={benefit} />
    case 'github_repository':
      return <GitHubRepositoryProperties benefit={benefit} />
    case 'downloadables':
      return (
        <DownloadablesProperties
          benefit={benefit}
          organization={organization}
        />
      )
    case 'license_keys':
      return <LicenseKeysProperties benefit={benefit} />
    case 'meter_credit':
      return (
        <MeterCreditProperties benefit={benefit} organization={organization} />
      )
    case 'slack_shared_channel':
      return <SlackSharedChannelProperties benefit={benefit} />
    // Feature flags carry their whole configuration in metadata, rendered below.
    case 'feature_flag':
      return null
  }
}

export const BenefitConfiguration = ({
  benefit,
  organization,
}: BenefitConfigurationProps) => {
  const metadataEntries = Object.entries(benefit.metadata)
  const showMetadata =
    metadataEntries.length > 0 || benefit.type === 'feature_flag'

  return (
    <Box flexDirection="column" gap="xl">
      <Box flexDirection="column" gap="s">
        <Text variant="heading-xxs" as="h2">
          Configuration
        </Text>
        <Text color="muted">
          How this benefit is delivered when granted to a customer
        </Text>
      </Box>
      <List size="small">
        <BenefitTypeProperties benefit={benefit} organization={organization} />
        {showMetadata && (
          <ConfigurationBlock label="Metadata">
            {metadataEntries.length === 0 ? (
              <Text color="muted">No metadata configured</Text>
            ) : (
              metadataEntries.map(([key, value]) => (
                <ConfigurationEntry
                  key={key}
                  name={key}
                  detail={String(value)}
                  monospace
                />
              ))
            )}
          </ConfigurationBlock>
        )}
        <ConfigurationRow
          label="Visibility"
          value={
            benefit.visibility === 'public'
              ? 'Visible in the customer portal'
              : 'Hidden from the customer portal'
          }
        />
        <ConfigurationRow
          label="Created"
          value={<FormattedDateTime datetime={benefit.created_at} />}
        />
        <ConfigurationRow label="Benefit ID" value={benefit.id} monospace />
      </List>
    </Box>
  )
}
