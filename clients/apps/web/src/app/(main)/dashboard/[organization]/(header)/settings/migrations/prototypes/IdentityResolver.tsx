'use client'

import { Alert, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  getIdentityResolutionImpact,
  getIdentityResolutionLabel,
  IdentityResolution,
  PrototypeAction,
  PrototypeState,
} from './model'
import {
  ComparePanel,
  FactLine,
  ResolutionChoiceGroup,
  ResolutionPresentation,
  ResolverFrame,
  SelectedImpact,
} from './resolutionControls'
import { domainCopy } from './resolutionCopy'

const IDENTITY_OPTIONS: IdentityResolution[] = [
  'link_existing_customer',
  'create_separate_customer',
  'leave_on_stripe',
]

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
  presentation: ResolutionPresentation
  index?: number
}

export function IdentityResolver({
  state,
  act,
  presentation,
  index = 3,
}: Props) {
  const choice = state.resolutions.identity
  const compact = presentation === 'tower' || presentation === 'current'
  const copy = domainCopy('identity', presentation, index)

  return (
    <ResolverFrame
      presentation={presentation}
      resolved={choice !== null}
      eyebrow={copy.eyebrow}
      headline={copy.headline}
      context={copy.context}
    >
      <Grid
        templateColumns={{ base: '1fr', md: compact ? '1fr' : '1fr 1fr' }}
        gap="m"
      >
        <ComparePanel title="Stripe customer" compact={compact}>
          <FactLine label="Name" value="Wendy Conflict" />
          <FactLine label="Email" value="wendy.shared@example.com" />
          <FactLine label="Source customer ID" value="cus_stripe_wendy" />
          <FactLine label="Subscription" value="Starter · $9/mo" />
        </ComparePanel>
        <ComparePanel title="Existing Polar customer" compact={compact}>
          <FactLine label="Name" value="Wendy Shared" />
          <FactLine label="Email" value="wendy.shared@example.com" />
          <FactLine label="Polar customer ID" value="cus_polar_wendy" />
          <FactLine
            label="External / Stripe ID on file"
            value="cus_stripe_other"
          />
        </ComparePanel>
      </Grid>

      <Alert
        variant="warning"
        title="Merge / duplicate risk"
        description="Linking merges the Stripe identity onto the Polar customer and can attach the wrong payment history if they are different people. Creating a separate customer keeps two records for one email. Leaving on Stripe avoids Polar-side merge until you reconcile."
      />

      <Box flexDirection="column" rowGap="s">
        <Text variant="label">Choose how this identity should resolve</Text>
        <ResolutionChoiceGroup
          label="Identity resolution choices"
          compact={compact}
          options={IDENTITY_OPTIONS.map((option) => ({
            id: option,
            label: getIdentityResolutionLabel(option),
            selected: choice === option,
            onSelect: () => act({ type: 'choose_identity', choice: option }),
          }))}
        />
        <SelectedImpact
          compact={compact}
          label={choice ? getIdentityResolutionLabel(choice) : null}
          impact={choice ? getIdentityResolutionImpact(choice) : null}
        />
      </Box>
    </ResolverFrame>
  )
}
