import { Grid, GridItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ChapterHeadline } from './Chapter'
import { StillaAI } from './Logos'

const STORY = {
  href: '/customers/stilla-ai',
  label: 'Read the Stilla AI story',
  quote:
    'The Polar team treated us like a design partner, not just a customer. They built features we needed on tight timelines and worked collaboratively to resolve issues. That’s rare.',
  name: 'Siavash Ghorbani',
  company: 'Stilla AI',
}

export const CustomerStory = () => (
  <Box
    as="section"
    width="100%"
    paddingVertical={{ base: '4xl', md: '5xl' }}
    marginVertical={{ base: 'none', md: '2xl' }}
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {/* On mobile the story link follows the quote; on desktop it sits under the headline, beside it. */}
    <Grid
      width="100%"
      templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      templateRows={{ base: 'auto', lg: 'auto 1fr' }}
      templateAreas={{
        base: '"head" "quote" "link"',
        lg: '"head quote" "link quote"',
      }}
      rowGap="3xl"
      columnGap="l"
    >
      <GridItem area="head">
        <ChapterHeadline
          title="Trusted by leading AI companies"
          subtitle="See how they run billing on Polar"
        />
      </GridItem>
      <GridItem area="link">
        <Link href={STORY.href} prefetch>
          <Box
            alignItems="center"
            columnGap="l"
            color={{ base: 'text-primary', hover: 'text-secondary' }}
            transitionProperty="colors"
            transitionDuration="fast"
          >
            <Box
              width="2.5rem"
              height="2.5rem"
              borderRadius="full"
              backgroundColor="background-secondary"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <ArrowRight size={16} />
            </Box>
            <Text variant="body" color="inherit">
              {STORY.label}
            </Text>
          </Box>
        </Link>
      </GridItem>
      <GridItem area="quote">
        <figure>
          <Box flexDirection="column" alignItems="start" rowGap="xl">
            <StillaAI size={32} />
            <blockquote>
              <Text variant="heading-xs" as="p" wrap="pretty">
                “{STORY.quote}”
              </Text>
            </blockquote>
            <figcaption>
              <Box flexDirection="column" alignItems="start" rowGap="l">
                <Text color="muted">
                  {STORY.name}, {STORY.company}
                </Text>
              </Box>
            </figcaption>
          </Box>
        </figure>
      </GridItem>
    </Grid>
  </Box>
)
