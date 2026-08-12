import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropsWithChildren, ReactNode } from 'react'

interface ChapterMarkerProps {
  index?: string
  name: string
}

const ChapterMarker = ({ name }: ChapterMarkerProps) => (
  <Box alignItems="start">
    <Text variant="heading-m">{name}</Text>
  </Box>
)

interface ChapterHeadlineProps {
  title: string
  subtitle: string
}

export const ChapterHeadline = ({ title, subtitle }: ChapterHeadlineProps) => (
  <Box flexDirection="column" rowGap="xs">
    <Text variant="heading-l" as="h2" wrap="balance">
      {title}
    </Text>
    <Text variant="heading-l" as="p" color="muted" wrap="balance">
      {subtitle}
    </Text>
  </Box>
)

export type ChapterProps = PropsWithChildren<{
  id?: string
  index?: string
  name?: string
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
        <ChapterMarker index={index} name={name} />
      ) : (
        <Box display={{ base: 'none', lg: 'flex' }} />
      )}
      <Box flexDirection="column" rowGap="2xl" alignItems="start">
        <ChapterHeadline title={title} subtitle={subtitle} />
        {description ? (
          <Box display="block" maxWidth="32rem">
            <Text variant="heading-xs" color="muted" wrap="pretty">
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
