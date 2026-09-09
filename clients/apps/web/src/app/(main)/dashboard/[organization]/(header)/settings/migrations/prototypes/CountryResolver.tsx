'use client'

import { Alert, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  confirmSuggestedBillingCountry,
  CountryResolution,
  getCountryResolutionImpact,
  getCountryResolutionLabel,
  PrototypeAction,
  PrototypeState,
  SUGGESTED_BILLING_COUNTRY,
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

const ALTERNATE_COUNTRY = 'Germany'

function isCountryChoice(
  choice: CountryResolution | null,
  next: CountryResolution,
): boolean {
  if (!choice) {
    return false
  }
  if (choice.disposition === 'leave_on_stripe') {
    return next.disposition === 'leave_on_stripe'
  }
  return (
    next.disposition === 'set_country' &&
    choice.disposition === 'set_country' &&
    choice.country === next.country
  )
}

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
  presentation: ResolutionPresentation
  index?: number
}

export function CountryResolver({
  state,
  act,
  presentation,
  index = 2,
}: Props) {
  const choice = state.resolutions.country
  const compact = presentation === 'tower' || presentation === 'current'
  const copy = domainCopy('country', presentation, index)
  const suggested = confirmSuggestedBillingCountry()
  const alternate: CountryResolution = {
    disposition: 'set_country',
    country: ALTERNATE_COUNTRY,
  }
  const leave: CountryResolution = { disposition: 'leave_on_stripe' }

  return (
    <ResolverFrame
      presentation={presentation}
      resolved={choice !== null}
      eyebrow={copy.eyebrow}
      headline={copy.headline}
      context={copy.context}
    >
      <Box
        gap="m"
        flexDirection={{ base: 'column', md: compact ? 'column' : 'row' }}
      >
        <ComparePanel title="Affected customer" compact={compact}>
          <FactLine label="Customer" value="Uma NoCountry" />
          <FactLine label="Email" value="uma.nocountry@example.com" />
          <FactLine label="Current billing country" value="None on file" />
          <FactLine label="Subscription" value="Pro · $19/mo" />
        </ComparePanel>
        <ComparePanel title="Evidence" compact={compact}>
          <FactLine
            label="Suggested country"
            value={SUGGESTED_BILLING_COUNTRY}
          />
          <FactLine label="Evidence strength" value="Weak · card issuer only" />
          <Text variant="caption" color="muted">
            Issuer country is a hint, not a verified address.
          </Text>
        </ComparePanel>
      </Box>

      <Alert
        variant="warning"
        title="Tax consequence"
        description="Without a billing country, Polar cannot calculate VAT/sales tax on the next renewal. Confirming a country applies that jurisdiction; leaving on Stripe keeps tax on the source."
      />

      <Box flexDirection="column" rowGap="s">
        <Text variant="label">Choose a billing-country disposition</Text>
        <ResolutionChoiceGroup
          label="Country resolution choices"
          compact={compact}
          options={[
            {
              id: 'confirm-uk',
              label: getCountryResolutionLabel(suggested),
              selected: isCountryChoice(choice, suggested),
              recommended: presentation === 'assisted',
              onSelect: () =>
                act({ type: 'choose_country', choice: suggested }),
            },
            {
              id: 'germany',
              label: getCountryResolutionLabel(alternate),
              selected: isCountryChoice(choice, alternate),
              onSelect: () =>
                act({ type: 'choose_country', choice: alternate }),
            },
            {
              id: 'leave-country',
              label: getCountryResolutionLabel(leave),
              selected: isCountryChoice(choice, leave),
              onSelect: () => act({ type: 'choose_country', choice: leave }),
            },
          ]}
        />
        <SelectedImpact
          compact={compact}
          label={choice ? getCountryResolutionLabel(choice) : null}
          impact={choice ? getCountryResolutionImpact(choice) : null}
        />
      </Box>
    </ResolverFrame>
  )
}
