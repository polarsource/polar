'use client'

import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CountryResolver } from './CountryResolver'
import { IdentityResolver } from './IdentityResolver'
import {
  getResolutionCompletionCount,
  isResolutionComplete,
  PrototypeAction,
  PrototypeState,
  RESOLUTION_DOMAINS,
  ResolutionDomain,
} from './model'
import { ProductResolver } from './ProductResolver'
import {
  AssistedProposalNav,
  CurrentAttentionRows,
  GuidedDomainNav,
  TowerDecisionQueue,
} from './resolutionChrome'
import { ResolutionPresentation } from './resolutionControls'
import { useResolutionDomainFocus } from './resolutionDomainFocus'

export type { ResolutionPresentation } from './resolutionControls'

export interface ResolutionResolversProps {
  state: PrototypeState
  act: (action: PrototypeAction) => void
  presentation: ResolutionPresentation
}

function DomainResolver({
  domain,
  ...props
}: ResolutionResolversProps & { domain: ResolutionDomain }) {
  if (domain === 'product') {
    return <ProductResolver {...props} index={1} />
  }
  if (domain === 'country') {
    return <CountryResolver {...props} index={2} />
  }
  return <IdentityResolver {...props} index={3} />
}

function PresentationChrome({
  presentation,
  resolutions,
  activeDomain,
  onSelect,
}: {
  presentation: ResolutionPresentation
  resolutions: PrototypeState['resolutions']
  activeDomain: ResolutionDomain
  onSelect: (domain: ResolutionDomain) => void
}) {
  if (presentation === 'guided') {
    return (
      <GuidedDomainNav
        resolutions={resolutions}
        activeDomain={activeDomain}
        onSelect={onSelect}
      />
    )
  }
  if (presentation === 'assisted') {
    return (
      <AssistedProposalNav
        resolutions={resolutions}
        activeDomain={activeDomain}
        onSelect={onSelect}
      />
    )
  }
  if (presentation === 'tower') {
    return (
      <TowerDecisionQueue
        resolutions={resolutions}
        activeDomain={activeDomain}
        onSelect={onSelect}
      />
    )
  }
  return (
    <CurrentAttentionRows
      resolutions={resolutions}
      activeDomain={activeDomain}
      onSelect={onSelect}
    />
  )
}

function ShellHeader({
  presentation,
  resolvedCount,
  total,
  complete,
}: {
  presentation: ResolutionPresentation
  resolvedCount: number
  total: number
  complete: boolean
}) {
  if (presentation === 'current') {
    return null
  }
  const title =
    presentation === 'guided'
      ? 'Resolve blocking decisions in order'
      : presentation === 'assisted'
        ? "Review Polar's proposed resolutions"
        : 'Decision inbox'
  const detail =
    presentation === 'guided'
      ? 'One decision at a time. Completed decisions stay editable.'
      : presentation === 'assisted'
        ? 'Polar labels its recommendation, but nothing is approved yet. Choose it or an alternative for each decision.'
        : 'Pick a queue row, then resolve it in the detail pane.'

  return (
    <Box
      alignItems={{ base: 'start', md: 'center' }}
      justifyContent="between"
      gap="m"
      flexWrap="wrap"
    >
      <Box flexDirection="column" rowGap="xs" minWidth={0}>
        <Text
          variant={presentation === 'tower' ? 'heading-xs' : 'heading-l'}
          as="h2"
        >
          {title}
        </Text>
        <Text variant="caption" color="muted" wrap="pretty">
          {detail}
        </Text>
      </Box>
      <Status
        status={`${resolvedCount} of ${total} resolved`}
        color={complete ? 'green' : 'yellow'}
        size={presentation === 'tower' ? 'small' : 'medium'}
      />
    </Box>
  )
}

export function ResolutionResolvers({
  state,
  act,
  presentation,
}: ResolutionResolversProps) {
  const resolvedCount = getResolutionCompletionCount(state.resolutions)
  const total = RESOLUTION_DOMAINS.length
  const complete = isResolutionComplete(state.resolutions)
  const autoAdvance = presentation === 'guided' || presentation === 'assisted'
  const { activeDomain, selectDomain, wrapAct } = useResolutionDomainFocus(
    state.resolutions,
    autoAdvance,
  )
  const focusedAct = wrapAct(act)
  const compact = presentation === 'tower' || presentation === 'current'
  const towerLayout = presentation === 'tower'

  return (
    <Box
      as="section"
      flexDirection="column"
      rowGap={compact ? 'm' : 'l'}
      aria-label="Migration resolution decisions"
    >
      <ShellHeader
        presentation={presentation}
        resolvedCount={resolvedCount}
        total={total}
        complete={complete}
      />

      <Box
        flexDirection={towerLayout ? { base: 'column', lg: 'row' } : 'column'}
        gap={compact ? 'm' : 'l'}
        alignItems={towerLayout ? { base: 'stretch', lg: 'start' } : undefined}
      >
        <PresentationChrome
          presentation={presentation}
          resolutions={state.resolutions}
          activeDomain={activeDomain}
          onSelect={selectDomain}
        />
        <Box flex={towerLayout ? 1 : undefined} minWidth={0}>
          <DomainResolver
            domain={activeDomain}
            state={state}
            act={focusedAct}
            presentation={presentation}
          />
        </Box>
      </Box>
    </Box>
  )
}
