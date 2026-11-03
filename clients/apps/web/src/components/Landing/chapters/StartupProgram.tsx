import { Button, Grid } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Chapter } from '../Chapter'
import { VolumetricSlices } from '../graphics/VolumetricSlices'
import { TIERS, TierSheet, type Tier } from '../Pricing'
import { Window } from '../story/Frame'

const SCALE = TIERS.find((tier) => tier.name === 'Scale')

/** The program as a tier: Scale's fees and features, free for the first year. */
const STARTUP: Tier = {
  name: 'Startup Program',
  free: true,
  period: 'for 12 months',
  desc: 'Everything in Scale',
  fees: SCALE?.fees ?? [],
  features: SCALE?.features ?? [],
}

export const StartupProgram = () => (
  <Chapter
    id="startup-program"
    name="Startup Program"
    title="Your first year is on us"
    subtitle="the Scale plan, free for twelve months"
    description="Early-stage AI startups get our most generous plan free for a year. Lowest fees, priority support and preview access to every new feature while you find your growth."
    cta={
      <Link href="/startup-program" prefetch>
        <Button>Apply now</Button>
      </Link>
    }
  >
    <Window flow={3} narrow aside="Startup Program">
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="xs">
        <div className="dark:bg-polar-900 flex aspect-square w-full items-center justify-center rounded-xl bg-white md:aspect-auto md:py-12">
          <Box width={{ base: '60%', md: '50%' }} aspectRatio="1 / 1">
            <VolumetricSlices />
          </Box>
        </div>
        <TierSheet tier={STARTUP} />
      </Grid>
    </Window>
  </Chapter>
)
