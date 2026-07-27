'use client'

import { DetailGrid } from '@/components/Orders/OrderSection'
import { Box } from '@polar-sh/orbit/Box'
import {
  DiscordCells,
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
    case 'feature_flag':
      return null
    default:
      benefit satisfies never
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

  if (!cells) {
    return null
  }

  return (
    <Box
      flexDirection="column"
      paddingVertical="xl"
      borderRadius="xl"
      paddingHorizontal="2xl"
      borderColor="border-secondary"
      backgroundColor="background-secondary"
    >
      <DetailGrid>{cells}</DetailGrid>
    </Box>
  )
}
