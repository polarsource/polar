'use client'

import { Button, Grid, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
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
import { ResolutionPresentation } from './resolutionControls'

export type { ResolutionPresentation } from './resolutionControls'

export interface ResolutionResolversProps {
  state: PrototypeState
  act: (action: PrototypeAction) => void
  presentation: ResolutionPresentation
}

const DOMAIN_LABELS: Record<ResolutionDomain, string> = {
  product: 'Product',
  country: 'Country',
  identity: 'Identity',
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

function shellCopy(presentation: ResolutionPresentation): {
  title: string
  detail: string
} {
  if (presentation === 'guided') {
    return {
      title: 'Resolve blocking decisions in order',
      detail:
        'Work each numbered decision. Continue stays with the parent variant once all three are resolved.',
    }
  }
  if (presentation === 'assisted') {
    return {
      title: "Review Polar's proposed resolutions",
      detail:
        'Approve or change each Polar proposal. The parent variant owns the final Approve control.',
    }
  }
  if (presentation === 'tower') {
    return {
      title: 'Decision inbox',
      detail: 'Resolve product, country, and identity in parallel.',
    }
  }
  return {
    title: 'Required resolutions',
    detail: 'Clear these before the transfer step.',
  }
}

export function ResolutionResolvers({
  state,
  act,
  presentation,
}: ResolutionResolversProps) {
  const resolved = getResolutionCompletionCount(state.resolutions)
  const total = RESOLUTION_DOMAINS.length
  const complete = isResolutionComplete(state.resolutions)
  const copy = shellCopy(presentation)
  const compact = presentation === 'tower' || presentation === 'current'
  const parallel = presentation === 'tower'
  const [assistedDomain, setAssistedDomain] = useState<ResolutionDomain | null>(
    null,
  )
  const firstUnresolved = RESOLUTION_DOMAINS.find(
    (domain) => state.resolutions[domain] === null,
  )
  const activeAssistedDomain =
    assistedDomain ?? firstUnresolved ?? RESOLUTION_DOMAINS[0]

  return (
    <Box
      as="section"
      flexDirection="column"
      rowGap={compact ? 'm' : 'l'}
      aria-label="Migration resolution decisions"
    >
      <Box
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        gap="m"
        flexWrap="wrap"
      >
        <Box flexDirection="column" rowGap="xs" minWidth={0}>
          <Text variant={compact ? 'heading-xs' : 'heading-l'} as="h2">
            {copy.title}
          </Text>
          <Text variant="caption" color="muted" wrap="pretty">
            {copy.detail}
          </Text>
        </Box>
        <Status
          status={`${resolved} of ${total} resolved`}
          color={complete ? 'green' : 'yellow'}
          size={compact ? 'small' : 'medium'}
        />
      </Box>

      {presentation === 'assisted' ? (
        <Box flexDirection="column" rowGap="l">
          <Box
            role="group"
            aria-label="Proposal decisions"
            gap="s"
            flexWrap="wrap"
          >
            {RESOLUTION_DOMAINS.map((domain) => {
              const resolved = state.resolutions[domain] !== null
              return (
                <Button
                  key={domain}
                  size="sm"
                  variant={
                    domain === activeAssistedDomain ? 'default' : 'secondary'
                  }
                  aria-pressed={domain === activeAssistedDomain}
                  onClick={() => setAssistedDomain(domain)}
                >
                  {resolved ? '✓ ' : ''}
                  {DOMAIN_LABELS[domain]}
                </Button>
              )
            })}
          </Box>
          <DomainResolver
            domain={activeAssistedDomain}
            state={state}
            act={act}
            presentation={presentation}
          />
        </Box>
      ) : parallel ? (
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }}
          gap="m"
        >
          <ProductResolver
            state={state}
            act={act}
            presentation={presentation}
            index={1}
          />
          <CountryResolver
            state={state}
            act={act}
            presentation={presentation}
            index={2}
          />
          <IdentityResolver
            state={state}
            act={act}
            presentation={presentation}
            index={3}
          />
        </Grid>
      ) : (
        <Box flexDirection="column" rowGap={compact ? 'm' : 'l'}>
          <ProductResolver
            state={state}
            act={act}
            presentation={presentation}
            index={1}
          />
          <CountryResolver
            state={state}
            act={act}
            presentation={presentation}
            index={2}
          />
          <IdentityResolver
            state={state}
            act={act}
            presentation={presentation}
            index={3}
          />
        </Box>
      )}
    </Box>
  )
}
