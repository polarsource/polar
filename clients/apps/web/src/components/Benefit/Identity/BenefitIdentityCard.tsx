'use client'

import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { CompactCardContext } from './BenefitCardBody'
import { BenefitFacts } from './BenefitFacts'
import { BenefitGraphic, type GraphicRenderer } from './BenefitGraphic'
import {
  customGraphic,
  downloadablesGraphic,
  featureFlagGraphic,
  licenseKeysGraphic,
  meterCreditGraphic,
} from './graphics'
import { discordGraphic, githubGraphic, slackGraphic } from './logoGraphics'

const GRAPHIC_RENDERERS: Record<schemas['BenefitType'], GraphicRenderer> = {
  custom: customGraphic,
  discord: discordGraphic,
  github_repository: githubGraphic,
  downloadables: downloadablesGraphic,
  license_keys: licenseKeysGraphic,
  meter_credit: meterCreditGraphic,
  feature_flag: featureFlagGraphic,
  slack_shared_channel: slackGraphic,
}

export const BenefitIdentityCard = ({
  benefit,
  organization,
  variant = 'default',
}: {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
  variant?: 'default' | 'compact'
}) => {
  const compact = variant === 'compact'
  return (
    <CompactCardContext.Provider value={compact}>
      <Box
        flexDirection={{ base: 'column', md: 'row' }}
        borderRadius="l"
        backgroundColor="background-primary"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        overflow="hidden"
      >
        <Box
          alignItems="center"
          justifyContent="center"
          padding="xl"
          width={{ base: '100%', md: '30%' }}
          flexShrink={0}
        >
          <Box width={compact ? 140 : 160} height={compact ? 140 : 160}>
            <BenefitGraphic render={GRAPHIC_RENDERERS[benefit.type]} />
          </Box>
        </Box>
        <BenefitFacts benefit={benefit} organization={organization} />
      </Box>
    </CompactCardContext.Provider>
  )
}
