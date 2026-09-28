import { StaticImage } from '@/components/Image/StaticImage'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Chapter } from '../Chapter'
import {
  CheckoutVignette,
  MeterVignette,
  PayoutVignette,
} from './PlatformVignettes'

interface Pillar {
  title: string
  desc: string
  image: string
  focus: string
  docs: string
  vignette: ReactNode
}

const PILLARS: Pillar[] = [
  {
    title: 'Usage metering',
    desc: 'Every token, agent run and GPU second streams into live meters, priced and ready to bill the moment it happens.',
    image: '/assets/landing/company/Polar_Flow_01_No_Logo.jpg',
    focus: 'center',
    docs: '/docs/features/usage-based-billing/introduction',
    vignette: <MeterVignette />,
  },
  {
    title: 'Checkout',
    desc: 'A hosted checkout that converts out of the box. Localized currencies, sales tax included, one link to start selling.',
    image: '/assets/landing/company/Polar_Flow_02_No_Logo.jpg',
    focus: 'center',
    docs: '/docs/features/checkout/session',
    vignette: <CheckoutVignette />,
  },
  {
    title: 'Payouts',
    desc: 'Revenue settles to your bank account on your schedule. Sales tax already collected, remitted and off your plate.',
    image: '/assets/landing/company/Polar_Flow_03_No_Logo.jpg',
    focus: 'right center',
    docs: '/docs/features/finance/payouts',
    vignette: <PayoutVignette />,
  },
]

export const Platform = () => (
  <Chapter
    name="Platform"
    title="The brains of a finance team"
    subtitle="in the body of an API"
    description="Polar meters your usage, runs your subscriptions & invoicing, and sells to your customers as merchant of record. One integration, from first event to payout."
  >
    <Grid
      templateColumns={{
        base: '1fr',
        md: 'repeat(2, 1fr)',
        xl: 'repeat(3, 1fr)',
      }}
      gap="2xl"
    >
      {PILLARS.map((pillar) => (
        <Box key={pillar.title} flexDirection="column" rowGap="xl">
          <Box
            position="relative"
            overflow="hidden"
            backgroundColor="background-secondary"
            alignItems="center"
            justifyContent="center"
            paddingHorizontal="2xl"
            minHeight={{ base: '14rem', xl: '20rem' }}
          >
            <StaticImage
              src={pillar.image}
              alt=""
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
              style={{ objectPosition: pillar.focus }}
            />
            <Box
              position="absolute"
              inset={0}
              backgroundColor="background-secondary"
              opacity={0.6}
            />
            <Box
              position="relative"
              width="100%"
              alignItems="center"
              justifyContent="center"
            >
              {pillar.vignette}
            </Box>
          </Box>
          <Box flexDirection="column" rowGap="xs">
            <Text variant="heading-xxs" as="h3">
              {pillar.title}
            </Text>
            <Text variant="body" color="muted" as="p">
              {pillar.desc}
            </Text>
            <a href={pillar.docs}>
              <Box
                alignItems="center"
                columnGap="xs"
                paddingTop="s"
                color={{ base: 'text-primary', hover: 'text-secondary' }}
                transitionProperty="colors"
                transitionDuration="fast"
              >
                <Text variant="body" color="inherit">
                  Learn more
                </Text>
                <ArrowRight size={16} />
              </Box>
            </a>
          </Box>
        </Box>
      ))}
    </Grid>
  </Chapter>
)
