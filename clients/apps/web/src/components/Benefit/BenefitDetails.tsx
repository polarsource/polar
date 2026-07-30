'use client'

import { DetailGrid } from '@/components/Orders/OrderSection'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DiscordCells,
  FeatureFlagCells,
  GitHubRepositoryCells,
  LicenseKeysCells,
  MeterCreditCells,
  SlackSharedChannelCells,
} from './BenefitDetailCells'
import { schemas } from '@polar-sh/client'

const getBenefitTypeCells = ({
  benefit,
  organization,
}: {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}) => {
  switch (benefit.type) {
    case 'discord':
      return <DiscordCells benefit={benefit} />
    case 'feature_flag':
      return <FeatureFlagCells benefit={benefit} />
    case 'github_repository':
      return <GitHubRepositoryCells benefit={benefit} />
    case 'license_keys':
      return <LicenseKeysCells benefit={benefit} />
    case 'meter_credit':
      return <MeterCreditCells benefit={benefit} organization={organization} />
    case 'slack_shared_channel':
      return <SlackSharedChannelCells benefit={benefit} />
    case 'custom':
    case 'downloadables':
      return null
    default:
      benefit satisfies never
      return null
  }
}

const getBenefitProse = (benefit: schemas['Benefit']) => {
  switch (benefit.type) {
    case 'custom':
      return {
        label: 'Private note',
        text: benefit.properties.note,
        fallback: 'No note configured',
      }
    case 'slack_shared_channel':
      return {
        label: 'Welcome message',
        text: benefit.properties.welcome_message,
        fallback: 'No welcome message configured',
      }
    default:
      return null
  }
}

export const BenefitDetails = ({
  benefit,
  organization,
}: {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}) => {
  const cells = getBenefitTypeCells({ benefit, organization })
  const prose = getBenefitProse(benefit)

  if (!cells && !prose) {
    return null
  }

  return (
    <Box
      flexDirection="column"
      borderRadius="xl"
      paddingHorizontal="2xl"
      paddingVertical="xl"
      rowGap="xl"
      backgroundColor="background-card"
    >
      {cells ? <DetailGrid>{cells}</DetailGrid> : null}
      {prose ? (
        <Box
          flexDirection="column"
          rowGap="xs"
          minWidth={0}
          borderTopWidth={cells ? 1 : 0}
          borderStyle="solid"
          borderColor="border-primary"
          paddingTop={cells ? 'xl' : 'none'}
        >
          <Text color="muted">{prose.label}</Text>
          {prose.text ? (
            // Notes and welcome messages are multi-line text, so the
            // line breaks are preserved.
            <div className="max-w-[65ch] whitespace-pre-wrap">
              <Text>{prose.text}</Text>
            </div>
          ) : (
            <Text color="muted">{prose.fallback}</Text>
          )}
        </Box>
      ) : null}
    </Box>
  )
}
