import { StaticImage } from '@/components/Image/StaticImage'
import { Chapter } from '@/components/Landing/Chapter'
import { TextRings } from '@/components/Landing/graphics/TextRings'
import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { HowWeWork } from './HowWeWork'
import { investors } from './investors'
import { OpenRoles } from './OpenRoles'
import { TeamCarouselWrapper } from './TeamCarouselWrapper'

const MISSION = [
  'Billing was built for a world where a customer was a person, a product was a seat, and a price was set once a year.',
  'AI products are consumed by the token, by agents nobody is watching. Costs move hourly, pricing changes weekly, and every request has to decide whether an agent may keep going.',
  'Our mission is to make billing a function of events. Usage in, revenue out, with what every customer has used, is entitled to and costs to serve known the moment it happens. A finance layer that keeps pace with the products it bills.',
]

export default function CompanyPage() {
  return (
    <Box width="100%" flexDirection="column">
      <Box
        as="section"
        width="100%"
        flexDirection="column"
        rowGap={{ base: '3xl', md: '5xl' }}
        paddingTop={{ base: 'm', md: '5xl' }}
        paddingBottom={{ base: '3xl', md: '5xl' }}
      >
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={{ base: '2xl', lg: 'l' }}
        >
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-xl" as="h1" wrap="balance">
              Small team, big ambitions
            </Text>
            <Text variant="heading-xl" as="p" color="muted" wrap="balance">
              Rewriting billing for the AI era
            </Text>
          </Box>
        </Grid>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={{ base: '2xl', lg: 'l' }}
        >
          <Box
            flexDirection="column"
            justifyContent="end"
            alignItems="start"
            rowGap="3xl"
          >
            <Box display="block" maxWidth="32rem">
              <Text variant="heading-m" wrap="pretty">
                A small, senior team working remotely across the world.
              </Text>
              <Text variant="heading-m" color="muted" wrap="pretty">
                Building the finance layer for the next generation of AI
                products.
              </Text>
            </Box>
            <a href="#open-roles">
              <Button size="lg">Join us</Button>
            </a>
          </Box>
          <TeamCarouselWrapper />
        </Grid>
      </Box>

      <Chapter
        index="01"
        name="Mission"
        title="billing = fn(events)"
        subtitle="Usage in, revenue out"
      >
        <Box flexDirection="column" rowGap={{ base: '3xl', md: '5xl' }}>
          <Box
            display="grid"
            gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
            gap="l"
          >
            <Box display={{ base: 'none', lg: 'flex' }} />
            <Box flexDirection="column" rowGap="xl">
              {MISSION.map((paragraph) => (
                <Text
                  key={paragraph}
                  variant="heading-s"
                  as="p"
                  color="muted"
                  wrap="pretty"
                >
                  {paragraph}
                </Text>
              ))}
            </Box>
          </Box>
          <StaticImage
            src="/assets/landing/company/polar.jpg"
            alt="Polar graphic"
            width={1920}
            height={1080}
            className="object-cover"
            sizes="100vw"
          />
        </Box>
      </Chapter>

      <Chapter
        index="02"
        name="How we work"
        title="Fewer people, more ownership"
        subtitle="Five principles keep us fast"
        description="Our mission is to build the finance layer for the next generation of AI products. We get there with a small set of principles that keep us fast and focused."
      >
        <HowWeWork />
      </Chapter>

      <Chapter
        index="03"
        name="Design"
        title="Design taken as seriously as uptime"
        subtitle="From API ergonomics to checkout"
        description="Design at Polar spans the entire stack. Great developer ergonomics, docs that respect your time, dashboards that make usage billing legible and checkouts your customers trust."
        cta={
          <Link href="/brand">
            <Button size="lg">Explore the brand</Button>
          </Link>
        }
      >
        <Link href="/brand">
          <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
            <Box backgroundColor="background-secondary">
              <TextRings />
            </Box>
            <Box position="relative" overflow="hidden" aspectRatio="1 / 1">
              <StaticImage
                src="/assets/brand/marketing/billboard_01.jpg"
                alt="Polar billboard reading 'Your customers 10x'd their usage overnight. Polar already invoiced for it.'"
                fill
                className="object-cover"
                sizes="(min-width: 768px) 40rem, 100vw"
              />
            </Box>
          </Grid>
        </Link>
      </Chapter>

      <span id="open-roles" className="block scroll-mt-12 md:scroll-mt-28" />
      <Chapter
        index="04"
        name="Join us"
        title="Open roles"
        subtitle="Remote, senior, high ownership"
        description="We're a small, senior team working remotely across the world. High ownership, high pace and a direct line to the people using what you build."
      >
        <OpenRoles />
      </Chapter>

      <Chapter
        index="05"
        name="Backers"
        title="Investors, angels & advisors"
        subtitle="Behind us since day one"
        description="The incredible people and early stage firms who have had our back through thick and thin, supporting us from day one."
      >
        <Grid
          templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
          columnGap="l"
          rowGap="xl"
        >
          {investors.map((investor) => (
            <Box key={investor.name} flexDirection="column">
              <Text variant="heading-xs" as="span">
                {investor.name}
              </Text>
              <Text variant="heading-xs" as="span" color="muted">
                {investor.company}
              </Text>
            </Box>
          ))}
        </Grid>
      </Chapter>
    </Box>
  )
}
