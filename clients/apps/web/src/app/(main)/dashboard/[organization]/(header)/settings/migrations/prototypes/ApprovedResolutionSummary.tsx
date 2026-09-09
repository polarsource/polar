'use client'

import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  getResolutionChoiceImpact,
  getResolutionChoiceLabel,
  PrototypeAction,
  PrototypeReturnStage,
  PrototypeState,
  RESOLUTION_DOMAINS,
  ResolutionDomain,
} from './model'

const DOMAIN_TITLES: Record<ResolutionDomain, string> = {
  product: 'Product',
  country: 'Billing country',
  identity: 'Customer identity',
}

const STAGE_RETURN_LABEL: Record<PrototypeReturnStage, string> = {
  cards: 'card movement',
  transfer: 'transfer review',
  receipt: 'receipt',
}

export interface ApprovedResolutionSummaryProps {
  state: PrototypeState
  act: (action: PrototypeAction) => void
  compact?: boolean
  context?: PrototypeReturnStage
}

function returnStageLabel(
  context: PrototypeReturnStage | undefined,
  stage: PrototypeState['stage'],
): string {
  if (context) {
    return STAGE_RETURN_LABEL[context]
  }
  if (stage === 'cards' || stage === 'transfer' || stage === 'receipt') {
    return STAGE_RETURN_LABEL[stage]
  }
  return STAGE_RETURN_LABEL.cards
}

export function ApprovedResolutionSummary({
  state,
  act,
  compact = false,
  context,
}: ApprovedResolutionSummaryProps) {
  const returnLabel = returnStageLabel(context, state.stage)

  return (
    <Box
      as="section"
      aria-label="Approved resolution choices"
      flexDirection="column"
      rowGap={compact ? 's' : 'm'}
      padding={compact ? 'm' : 'l'}
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      backgroundColor="background-secondary"
    >
      <Box
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        gap="s"
        flexWrap="wrap"
      >
        <Box flexDirection="column" rowGap="xs" minWidth={0}>
          <Text variant={compact ? 'label' : 'heading-xs'} as="h3">
            Approved choices
          </Text>
          <Text variant="caption" color="muted" wrap="pretty">
            Change choices to reopen decisions. After you reconfirm, you return
            here to {returnLabel}. Receipt and unrelated choices stay as they
            are.
          </Text>
        </Box>
        <Button
          type="button"
          variant="secondary"
          size={compact ? 'sm' : 'default'}
          onClick={() => act('edit_resolutions')}
        >
          Change choices
        </Button>
      </Box>

      <Box
        as="ul"
        flexDirection="column"
        rowGap={compact ? 'xs' : 's'}
        margin="none"
        aria-label="Resolution choices"
      >
        {RESOLUTION_DOMAINS.map((domain) => {
          const label = getResolutionChoiceLabel(domain, state.resolutions)
          const impact = getResolutionChoiceImpact(domain, state.resolutions)
          if (!label) {
            return null
          }
          return (
            <Box
              as="li"
              key={domain}
              alignItems={{ base: 'start', md: 'baseline' }}
              justifyContent="between"
              gap="s"
              flexWrap="wrap"
            >
              <Text variant="caption" color="muted">
                {DOMAIN_TITLES[domain]}
              </Text>
              <Box
                flex={1}
                minWidth={0}
                flexDirection="column"
                rowGap="none"
                textAlign={{ base: 'left', md: 'right' }}
              >
                <Text variant="body">{label}</Text>
                {impact && !compact ? (
                  <Text variant="caption" color="muted" wrap="pretty">
                    {impact}
                  </Text>
                ) : null}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
