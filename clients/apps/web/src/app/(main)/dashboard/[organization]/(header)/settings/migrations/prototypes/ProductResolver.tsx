'use client'

import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  getProductResolutionImpact,
  getProductResolutionLabel,
  ProductResolution,
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

const PRODUCT_OPTIONS: ProductResolution[] = [
  'map_existing_pro',
  'create_separate_product',
  'leave_on_stripe',
]

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
  presentation: ResolutionPresentation
  index?: number
}

export function ProductResolver({
  state,
  act,
  presentation,
  index = 1,
}: Props) {
  const choice = state.resolutions.product
  const compact = presentation === 'tower' || presentation === 'current'
  const copy = domainCopy('product', presentation, index)

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
        <ComparePanel title="Stripe Pro" compact={compact}>
          <FactLine label="Price" value="$19/month" />
          <FactLine label="Source product ID" value="prod_stripe_pro" />
          <FactLine label="Source price ID" value="price_stripe_pro_19" />
          <Text variant="caption" color="muted">
            No Polar benefits attached on the source catalog.
          </Text>
        </ComparePanel>
        <ComparePanel title="Existing Polar Pro" compact={compact}>
          <FactLine label="Price" value="$19/month" />
          <FactLine label="Polar product ID" value="prod_polar_pro" />
          <FactLine
            label="Polar benefits"
            value="License keys · Discord role · Priority support"
          />
        </ComparePanel>
      </Grid>

      <Box flexDirection="column" rowGap="s">
        <Text variant="label">Choose how Stripe Pro should resolve</Text>
        <ResolutionChoiceGroup
          label="Product resolution choices"
          compact={compact}
          options={PRODUCT_OPTIONS.map((option) => ({
            id: option,
            label: getProductResolutionLabel(option),
            selected: choice === option,
            recommended:
              presentation === 'assisted' && option === 'map_existing_pro',
            onSelect: () => act({ type: 'choose_product', choice: option }),
          }))}
        />
        <SelectedImpact
          compact={compact}
          label={choice ? getProductResolutionLabel(choice) : null}
          impact={choice ? getProductResolutionImpact(choice) : null}
        />
      </Box>
    </ResolverFrame>
  )
}
