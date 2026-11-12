'use client'

// PROTOTYPE: every version, newest first, with what changed in it. Throwaway.
import { schemas } from '@polar-sh/client'
import { Grid, List, ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { PublishedAt } from '../VersionList'
import { History } from './history'

const columns = 'minmax(0, 1fr) 128px repeat(3, 32px) 16px'

export const kinds = [
  { change: 'added', glyph: '+', color: 'text-success' },
  { change: 'changed', glyph: '~', color: 'text-secondary' },
  { change: 'removed', glyph: '-', color: 'text-danger' },
] as const

export const counts = (history: History, index: number) => {
  const count = { added: 0, changed: 0, removed: 0 }
  for (const { steps } of history.entities) {
    const step = steps[index]
    if (step?.change === 'added') count.added++
    if (step?.change === 'changed') count.changed++
    if (index && steps[index - 1] && !step) count.removed++
  }
  return count
}

const Counts = ({ history, index }: { history: History; index: number }) => {
  const count = counts(history, index)
  return kinds.map(({ change, glyph, color }) => (
    <Box
      key={change}
      as="span"
      color={color}
      justifyContent="end"
      title={index && count[change] ? `${count[change]} ${change}` : undefined}
    >
      <Text as="span" color="inherit" tabularNums>
        {index && count[change] ? (
          <span className="font-mono">
            {glyph}
            {count[change]}
          </span>
        ) : null}
      </Text>
    </Box>
  ))
}

export const VersionsTab = ({
  organization,
  history,
}: {
  organization: schemas['Organization']
  history: History
}) => (
  <List size="small">
    {history.versions
      .map(({ catalog }, index) => ({ catalog, index }))
      // The draft is shown above the list
      .filter(({ catalog }) => catalog.status !== 'draft')
      .reverse()
      .map(({ catalog, index }) => (
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
              <Counts history={history} index={index} />
              <Text color="muted">
                <ChevronRight size={16} aria-hidden="true" />
              </Text>
            </Grid>
          </ListItem>
        </Link>
      ))}
  </List>
)
