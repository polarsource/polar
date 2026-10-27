'use client'

import { useCatalog } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronDown } from '@polar-sh/orbit/icons'
import { summarize, versionLabel } from './diff'
import { VersionDiff } from './VersionDiff'
import {
  CurrentBadge,
  HashChip,
  PublishedAt,
  Rail,
  SummaryPills,
} from './VersionMeta'

export const VersionRow = ({
  catalog,
  number,
  organization,
  expanded,
  onToggle,
  isFirst,
  isLast,
}: {
  catalog: schemas['Catalog']
  number: number
  organization: schemas['Organization']
  expanded: boolean
  onToggle: () => void
  isFirst: boolean
  isLast: boolean
}) => {
  // ponytail: one detail request per row for the summary; move the counts
  // into the list endpoint if pages of 20 feel slow.
  const detail = useCatalog(catalog.id)
  const summary = detail.data ? summarize(detail.data.products) : undefined
  const current = catalog.status === 'live'

  return (
    <Grid templateColumns="28px minmax(0, 1fr)" columnGap="l">
      <Rail current={current} isFirst={isFirst} isLast={isLast} />
      <Box
        flexDirection="column"
        borderRadius="l"
        backgroundColor="background-card"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        boxShadow={{ base: 'none', hover: 's' }}
        transitionProperty="shadow"
        transitionDuration="fast"
        overflow="hidden"
      >
        <Box
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onToggle()
            }
          }}
          cursor="pointer"
          alignItems="center"
          columnGap="l"
          padding="l"
          backgroundColor={{
            base: 'background-card',
            hover: 'background-secondary',
            focusVisible: 'background-secondary',
          }}
          transitionProperty="colors"
          transitionDuration="fast"
        >
          <Box flexDirection="column" rowGap="xs" flexGrow={1} minWidth={0}>
            <Box alignItems="center" columnGap="m">
              <Text variant="label" truncate>
                {versionLabel(catalog.name, number)}
              </Text>
              {current ? <CurrentBadge /> : null}
            </Box>
            <Box alignItems="center" columnGap="s">
              {catalog.version_hash ? (
                <HashChip hash={catalog.version_hash} />
              ) : null}
              <Text as="span" variant="caption" color="muted">
                <PublishedAt catalog={catalog} />
              </Text>
            </Box>
          </Box>
          <SummaryPills
            summary={summary}
            initial={detail.data?.previous_version_hash === null}
          />
          <Box
            as="span"
            display="flex"
            color="text-tertiary"
            transitionProperty="transform"
            transitionDuration="fast"
            transform={expanded ? 'rotate(180deg)' : 'none'}
          >
            <ChevronDown size={16} />
          </Box>
        </Box>
        {expanded ? (
          <Box
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            backgroundColor="background-secondary"
            padding="l"
          >
            <VersionDiff detail={detail} organizationSlug={organization.slug} />
          </Box>
        ) : null}
      </Box>
    </Grid>
  )
}
