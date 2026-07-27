'use client'

import { DetailCell, DetailGrid } from '@/components/Orders/OrderSection'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  GitHubRepositoryCells,
  LicenseKeysCells,
  MeterCreditCells,
} from './BenefitDetailCells'
import { BenefitIdCell } from './BenefitIdCell'
import { DiscordCells, SlackSharedChannelCells } from './IntegrationDetailCells'

export interface BenefitDetailsProps {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}

const BenefitTypeCells = ({ benefit, organization }: BenefitDetailsProps) => {
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
    // These types carry prose, file lists or metadata rather than scalar
    // properties, so they render as sections of their own instead.
    case 'custom':
    case 'downloadables':
    case 'feature_flag':
      return null
  }
}

export const BenefitDetails = ({
  benefit,
  organization,
}: BenefitDetailsProps) => (
  <DetailGrid>
    <BenefitTypeCells benefit={benefit} organization={organization} />
    <DetailCell
      label="Created"
      value={
        <Text variant="body" as="span">
          <FormattedDateTime dateStyle="medium" datetime={benefit.created_at} />
        </Text>
      }
    />
    <BenefitIdCell id={benefit.id} />
  </DetailGrid>
)
