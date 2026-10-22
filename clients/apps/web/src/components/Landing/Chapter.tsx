import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropsWithChildren, ReactNode } from 'react'

interface ChapterMarkerProps {
  index?: string
  name: string
  note?: string
}

/** The chapter's name, with an optional muted line under it. A leading number, as in "03 Charge", is set muted ahead of it. */
const ChapterMarker = ({ name, note }: ChapterMarkerProps) => {
  const [, number, label] = name.match(/^(\d+)\s+(.*)$/) ?? [null, null, name]
  return (
    <Box
      flexDirection="column"
      alignItems="start"
      display={{ md: 'flex', base: 'none' }}
    >
      <Text variant="heading-s">
        {number ? (
          <Text as="span" variant="heading-s" color="muted">
            <span className="mr-4">{number}</span>
          </Text>
        ) : null}
        {label}
      </Text>
      {note ? (
        <Text variant="heading-s" color="muted">
          {note}
        </Text>
      ) : null}
    </Box>
  )
}

interface ChapterHeadlineProps {
  title: string
  subtitle: string
}

export const ChapterHeadline = ({ title, subtitle }: ChapterHeadlineProps) => (
  <Box flexDirection="column">
    <Text variant="heading-s" as="h2" wrap="balance">
      {title}
    </Text>
    <Text variant="heading-s" as="p" color="muted" wrap="balance">
      {subtitle}
    </Text>
  </Box>
)

export type ChapterProps = PropsWithChildren<{
  id?: string
  index?: string
  name?: string
  /** A muted line under the name. */
  nameNote?: string
  title: string
  subtitle: string
  description?: ReactNode
  cta?: ReactNode
}>

/**
 * A full-width narrative chapter: a hairline top border, a header row with
 * the chapter marker on the left and a two-tone headline plus supporting
 * description on the right, then the chapter's content spanning the entire
 * viewport width. Chapters without an index/name keep the same column rhythm
 * with an empty marker cell.
 */
export const Chapter = ({
  id,
  index,
  name,
  nameNote,
  title,
  subtitle,
  description,
  cta,
  children,
}: ChapterProps) => (
  <Box
    as="section"
    id={id}
    width="100%"
    flexDirection="column"
    rowGap={{ base: '3xl', md: '5xl' }}
    paddingVertical={{ base: '4xl', md: '5xl' }}
    marginVertical={{ base: 'none', md: '2xl' }}
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Grid
      templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap={{ base: '2xl', lg: 'l' }}
    >
      {name ? (
        <ChapterMarker index={index} name={name} note={nameNote} />
      ) : (
        <Box display={{ base: 'none', lg: 'flex' }} />
      )}
      <Box flexDirection="column" rowGap="4xl" alignItems="start">
        <ChapterHeadline title={title} subtitle={subtitle} />
        {description ? (
          <Box display="block" width="100%">
            <Text variant="heading-xs" as="p" color="muted" wrap="pretty">
              {description}
            </Text>
          </Box>
        ) : null}
        {cta ? (
          <Box alignItems="center" columnGap="l" paddingTop="s">
            {cta}
          </Box>
        ) : null}
      </Box>
    </Grid>
    {children}
  </Box>
)
