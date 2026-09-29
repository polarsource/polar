import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren, ReactNode } from 'react'

export const EmptyCell = () => <Box display={{ base: 'none', lg: 'flex' }} />

export const SectionTitle = ({ children }: PropsWithChildren) => (
  <Text variant="heading-s" as="h2" wrap="balance">
    {children}
  </Text>
)

type FeatureChapterProps = PropsWithChildren<{
  aside?: ReactNode
  content?: ReactNode
}>

export const FeatureChapter = ({
  aside,
  content,
  children,
}: FeatureChapterProps) => (
  <Box
    as="section"
    width="100%"
    flexDirection="column"
    rowGap={{ base: '3xl', md: '5xl' }}
    paddingVertical={{ base: '4xl', md: '5xl' }}
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Grid
      templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap={{ base: '2xl', lg: 'l' }}
    >
      {aside ?? <EmptyCell />}
      {content}
    </Grid>
    {children}
  </Box>
)

export const HairlineRow = ({ children }: PropsWithChildren) => (
  <Box
    display="block"
    paddingVertical="xl"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {children}
  </Box>
)
