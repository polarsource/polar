import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropsWithChildren, ReactNode } from 'react'

/**
 * A manifesto chapter: the hairline top rule and column rhythm of the
 * landing Chapter, with the chapter name as the only headline, on the left,
 * and body copy alone in the right column. `after` renders full width below.
 */
export const VisionChapter = ({
  name,
  after,
  children,
}: PropsWithChildren<{ name: string; after?: ReactNode }>) => (
  <Box
    as="section"
    width="100%"
    flexDirection="column"
    rowGap={{ base: '3xl', md: '5xl' }}
    paddingVertical={{ base: '4xl', md: '5xl' }}
    marginVertical={{ base: 'none', md: '2xl' }}
  >
    <Grid
      templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap={{ base: '2xl', lg: 'l' }}
    >
      <Box alignItems="start">
        <Box
          position={{ base: 'static', lg: 'sticky' }}
          top="2rem"
          alignSelf="start"
        >
          <Text variant="heading-l" as="h2">
            {name}
          </Text>
        </Box>
      </Box>
      <Box flexDirection="column" rowGap="xl">
        {children}
      </Box>
    </Grid>
    {after}
  </Box>
)

export const ChapterBody = ({ children }: PropsWithChildren) => (
  <Grid
    templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
    gap={{ base: '2xl', lg: 'l' }}
  >
    <Box display={{ base: 'none', lg: 'flex' }} />
    <Box flexDirection="column" rowGap="xl">
      {children}
    </Box>
  </Grid>
)

export const Paragraph = ({ children }: PropsWithChildren) => (
  <Text variant="heading-s" as="p" wrap="pretty" lineHeight="relaxed">
    {children}
  </Text>
)

export const Code = ({ children }: PropsWithChildren) => (
  <Text variant="heading-s" as="code" monospace color="inherit">
    {children}
  </Text>
)
