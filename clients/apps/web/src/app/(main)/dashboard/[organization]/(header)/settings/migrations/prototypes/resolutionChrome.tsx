'use client'

import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  RESOLUTION_DOMAINS,
  ResolutionChoices,
  ResolutionDomain,
} from './model'
import {
  domainAttentionLabel,
  domainNavLabel,
  domainRiskLine,
} from './resolutionCopy'

function isResolved(
  resolutions: ResolutionChoices,
  domain: ResolutionDomain,
): boolean {
  return resolutions[domain] !== null
}

function onActivateKey(
  event: { key: string; preventDefault: () => void },
  activate: () => void,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activate()
  }
}

export function GuidedDomainNav({
  resolutions,
  activeDomain,
  onSelect,
}: {
  resolutions: ResolutionChoices
  activeDomain: ResolutionDomain
  onSelect: (domain: ResolutionDomain) => void
}) {
  return (
    <Box role="group" aria-label="Decision progress" gap="s" flexWrap="wrap">
      {RESOLUTION_DOMAINS.map((domain, index) => {
        const resolved = isResolved(resolutions, domain)
        const active = domain === activeDomain
        return (
          <Button
            key={domain}
            type="button"
            size="sm"
            variant={active ? 'default' : 'secondary'}
            aria-pressed={active}
            onClick={() => onSelect(domain)}
          >
            {index + 1}. {domainNavLabel(domain, 'guided')}
            {resolved ? ' · Done' : ''}
          </Button>
        )
      })}
    </Box>
  )
}

export function AssistedProposalNav({
  resolutions,
  activeDomain,
  onSelect,
}: {
  resolutions: ResolutionChoices
  activeDomain: ResolutionDomain
  onSelect: (domain: ResolutionDomain) => void
}) {
  return (
    <Box role="group" aria-label="Proposal decisions" gap="s" flexWrap="wrap">
      {RESOLUTION_DOMAINS.map((domain) => {
        const resolved = isResolved(resolutions, domain)
        const active = domain === activeDomain
        return (
          <Button
            key={domain}
            type="button"
            size="sm"
            variant={active ? 'default' : 'secondary'}
            aria-pressed={active}
            onClick={() => onSelect(domain)}
          >
            {resolved ? 'Approved · ' : 'Polar recommends · '}
            {domainNavLabel(domain, 'assisted')}
          </Button>
        )
      })}
    </Box>
  )
}

export function CurrentAttentionRows({
  resolutions,
  activeDomain,
  onSelect,
}: {
  resolutions: ResolutionChoices
  activeDomain: ResolutionDomain
  onSelect: (domain: ResolutionDomain) => void
}) {
  return (
    <Box
      role="group"
      aria-label="Attention required"
      flexDirection="column"
      rowGap="s"
    >
      {RESOLUTION_DOMAINS.map((domain) => {
        const resolved = isResolved(resolutions, domain)
        const active = domain === activeDomain
        return (
          <Box
            key={domain}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            onClick={() => onSelect(domain)}
            onKeyDown={(event) => onActivateKey(event, () => onSelect(domain))}
            alignItems="center"
            justifyContent="between"
            gap="s"
            padding="m"
            borderRadius="m"
            borderWidth={1}
            borderStyle="solid"
            borderColor={active ? 'border-primary' : 'border-secondary'}
            backgroundColor={
              active ? 'background-card' : 'background-secondary'
            }
            cursor="pointer"
          >
            <Text variant="body">{domainAttentionLabel(domain)}</Text>
            <Status
              status={resolved ? 'Resolved' : 'Needs decision'}
              color={resolved ? 'green' : 'yellow'}
              size="small"
            />
          </Box>
        )
      })}
    </Box>
  )
}

export function TowerDecisionQueue({
  resolutions,
  activeDomain,
  onSelect,
}: {
  resolutions: ResolutionChoices
  activeDomain: ResolutionDomain
  onSelect: (domain: ResolutionDomain) => void
}) {
  return (
    <Box
      as="ul"
      aria-label="Decision queue"
      flexDirection="column"
      rowGap="s"
      minWidth={0}
      width={{ base: '100%', lg: '16rem' }}
      flexShrink={0}
    >
      {RESOLUTION_DOMAINS.map((domain) => {
        const resolved = isResolved(resolutions, domain)
        const active = domain === activeDomain
        return (
          <Box as="li" key={domain} minWidth={0}>
            <Box
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => onSelect(domain)}
              onKeyDown={(event) =>
                onActivateKey(event, () => onSelect(domain))
              }
              flexDirection="column"
              rowGap="xs"
              padding="m"
              borderRadius="m"
              borderWidth={1}
              borderStyle="solid"
              borderColor={active ? 'border-primary' : 'border-secondary'}
              backgroundColor={
                active ? 'background-card' : 'background-secondary'
              }
              cursor="pointer"
              minWidth={0}
            >
              <Box
                alignItems="center"
                justifyContent="between"
                gap="s"
                width="100%"
              >
                <Text variant="label">{domainNavLabel(domain, 'tower')}</Text>
                <Status
                  status={resolved ? 'Resolved' : 'Unresolved'}
                  color={resolved ? 'green' : 'yellow'}
                  size="small"
                />
              </Box>
              <Text variant="caption" color="muted" wrap="pretty">
                {domainRiskLine(domain)}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
