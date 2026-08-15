import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Chapter } from '../Chapter'
import { VolumetricSlices } from '../graphics/VolumetricSlices'
import { CardSection, TIERS } from '../Pricing'

const SCALE_FEATURES =
  TIERS.find((tier) => tier.name === 'Scale')?.features ?? []

export const StartupProgram = () => (
  <Chapter
    index="06"
    name="Startup Program"
    title="Your first year is on us"
    subtitle="The Scale plan, free for twelve months"
    description="Early-stage AI startups get our most generous plan free for a year. Lowest fees, priority support and preview access to every new feature while you find your growth."
    cta={
      <Link href="/startup-program" prefetch>
        <Button>Apply now</Button>
      </Link>
    }
  >
    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
      <Box
        alignItems="center"
        justifyContent="center"
        backgroundColor="background-secondary"
        padding="2xl"
        aspectRatio="1 / 1"
      >
        <Box width={{ base: '60%', md: '50%' }} aspectRatio="1 / 1">
          <VolumetricSlices />
        </Box>
      </Box>
      <Box
        alignItems="center"
        justifyContent="center"
        backgroundColor="background-secondary"
        padding={{ base: 'l', md: '3xl' }}
        aspectRatio="1 / 1"
      >
        <Box
          flexDirection="column"
          rowGap="xl"
          width="100%"
          maxWidth="24rem"
          backgroundColor="background-card"
          padding="2xl"
        >
          <Box flexDirection="column" rowGap="xl">
            <Text variant="heading-s" as="h3">
              Startup Program
            </Text>
            <Box alignItems="baseline" columnGap="m">
              <Text variant="heading-s" as="span">
                Free
              </Text>
              <Text as="span" variant="body" color="muted">
                for 12 months
              </Text>
            </Box>
          </Box>
          <CardSection items={['3.40% + 30¢ per transaction']} />
          <CardSection
            label="Everything in Scale"
            check
            items={SCALE_FEATURES}
          />
        </Box>
      </Box>
    </Grid>
  </Chapter>
)
