'use client'

import { schemas } from '@polar-sh/client'
import { Grid, List, ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { PublishedAt } from './PublishedAt'

const columns = 'minmax(0, 1fr) 128px repeat(3, 32px) 16px'

export const kinds = [
  { change: 'added', glyph: '+', color: 'text-success' },
  { change: 'changed', glyph: '~', color: 'text-secondary' },
  { change: 'removed', glyph: '-', color: 'text-danger' },
] as const

const Counts = ({ catalog }: { catalog: schemas['Catalog'] }) =>
  kinds.map(({ change, glyph, color }) => {
    const count = catalog.changes?.[`${change}_count`]
    return (
      <Box
        key={change}
        as="span"
        color={color}
        justifyContent="end"
        title={count ? `${count} ${change}` : undefined}
      >
        <Text as="span" color="inherit" tabularNums>
          {count ? (
            <span className="font-mono">
              {glyph}
              {count}
            </span>
          ) : null}
        </Text>
      </Box>
    )
  })

export const VersionsTab = ({
  organization,
  catalogs,
}: {
  organization: schemas['Organization']
  catalogs: schemas['Catalog'][]
}) => (
  <List size="small">
    {catalogs
      // The draft is shown above the list
      .filter(({ status }) => status !== 'draft')
      .map((catalog) => (
        <Link
          key={catalog.id}
          href={`/dashboard/${organization.slug}/products/versions/${catalog.id}`}
          className="block"
        >
          <ListItem onSelect={() => {}}>
            <Grid
              templateColumns={columns}
              columnGap="l"
              alignItems="center"
              width="100%"
            >
              <Box alignItems="center" columnGap="s" minWidth={0}>
                <span className="truncate text-base">
                  {catalog.name ?? 'Untitled'}
                </span>
                {catalog.status === 'live' ? (
                  <Pill color="gray">Current</Pill>
                ) : null}
              </Box>
              <Text color="muted" tabularNums>
                <PublishedAt catalog={catalog} />
              </Text>
              <Counts catalog={catalog} />
              <Text color="muted">
                <ChevronRight size={16} aria-hidden="true" />
              </Text>
            </Grid>
          </ListItem>
        </Link>
      ))}
  </List>
)
