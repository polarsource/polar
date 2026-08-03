import { StaticImage } from '@/components/Image/StaticImage'
import { Section } from '@/components/Landing/Section'
import { SectionHeader } from '@/components/Landing/SectionHeader'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { HowWeWork } from './HowWeWork'
import { investors } from './investors'
import { TeamCarouselWrapper } from './TeamCarouselWrapper'
import { TextRings } from '@/components/Landing/graphics/TextRings'

// ── Data ──────────────────────────────────────────────────────────────────────

const JOBS = [
  {
    category: 'Product & Engineering',
    roles: [
      {
        role: 'Senior Platform Engineer',
        location: 'Remote, Europe',
        experience: '5-8+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/8a82633e-e7b9-42f4-92e1-33032a56097a',
      },
      {
        role: 'Senior Product Engineer',
        location: 'Remote, Europe',
        experience: '7+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/955c6935-6d03-46e5-b649-a8b958a52962',
      },
    ],
  },
  {
    category: 'Merchant Operations',
    roles: [
      {
        role: 'Risk & Compliance Specialist',
        link: 'https://jobs.ashbyhq.com/polar/64aa23ec-38c2-4d8e-8510-cdda2197042d',
        location: 'Remote, United States',
        experience: '2+ Years Experience',
      },
      {
        role: 'Merchant Support Specialist',
        link: 'https://jobs.ashbyhq.com/polar/2f3744b5-f33b-4611-bdfa-d99700dfa0e7',
        location: 'Remote, United States',
        experience: '2+ Years Experience',
      },
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyPage() {
  return (
    <Box
      flexDirection="column"
      minHeight="100vh"
      backgroundColor="background-primary"
      color="text-primary"
    >
      {/* Hero */}
      <Box
        as="section"
        flexDirection="column"
        alignItems="center"
        rowGap="2xl"
        paddingTop="3xl"
        paddingBottom="5xl"
        paddingHorizontal={{ md: 'l' }}
        textAlign="center"
      >
        <Box display="block" maxWidth="42rem">
          <Text variant="heading-xl" as="h1">
            Small team, big ambitions.
          </Text>
        </Box>
        <Box display="block" maxWidth="36rem">
          <Text variant="heading-xxs" wrap="balance">
            We&apos;re building the billing layer for the next generation of AI
            products. Come build it with us.
          </Text>
        </Box>
        <Box display="block" marginTop="s">
          <a href="#open-roles">
            <Button size="lg">Join Us</Button>
          </a>
        </Box>
      </Box>

      <TeamCarouselWrapper />

      {/* About */}
      <Section>
        <Box display="block" paddingVertical="5xl">
          <SectionHeader
            align="start"
            title="billing = fn(events)"
            description={
              <Box flexDirection="column" rowGap="xl">
                <Text variant="heading-xs">
                  Modern software is priced around usage. Yet billing systems
                  remain static.
                </Text>
                <Text variant="heading-xxs" color="muted">
                  We believe analytics & billing belong in the same platform.
                  Real-time event ingestion powers instant unit economics and
                  analytics, leading to deterministic and versioned billing as
                  code.
                </Text>
                <Text variant="heading-xxs" color="muted">
                  We&apos;re building Polar to become the standard Events →
                  Analytics → Billing stack for the next generation of software.
                </Text>
                <Text variant="heading-xxs" color="muted">
                  We&apos;re a small team with big ambitions, working with high
                  ownership and autonomy. Polar is open source and built in the
                  open with our community.
                </Text>
              </Box>
            }
          />
        </Box>
      </Section>

      <Section>
        <HowWeWork />
      </Section>

      {/* Design */}
      <Section>
        <Box flexDirection="column" rowGap="4xl">
          <SectionHeader
            title="We take design as seriously as uptime"
            description={
              <Box flexDirection="column" alignItems="start" rowGap="2xl">
                <Text variant="heading-xs" color="muted" wrap="pretty">
                  Design at Polar spans the entire stack. Great developer
                  ergonomics, docs that respect your time, dashboards that make
                  usage billing legible & checkouts your customers trust.
                </Text>
                <Link href="/brand">
                  <Button size="lg">Explore the brand</Button>
                </Link>
              </Box>
            }
          />
          <Link href="/brand">
            <Grid
              templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}
              gap="4xl"
            >
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
        </Box>
      </Section>

      {/* Open roles */}
      <Section id="open-roles">
        <Box flexDirection="column" rowGap="4xl">
          <SectionHeader
            title="Open Roles"
            description="We're a small, senior team working remotely across the world. High ownership, high pace and a direct line to the people using what you build."
          />
          <Box flexDirection="column" rowGap="2xl">
            {JOBS.map(({ category, roles }) => (
              <Box key={category} flexDirection="column" rowGap="xl">
                <Text variant="heading-xxs" as="h3">
                  {category}
                </Text>
                <Box flexDirection="column">
                  {roles.map((job) => (
                    <Link
                      key={job.link}
                      href={job.link}
                      target="_blank"
                      className="group"
                    >
                      <Box
                        alignItems="baseline"
                        justifyContent="between"
                        columnGap="l"
                        paddingVertical="xl"
                        borderTopWidth={1}
                        borderStyle="solid"
                        borderColor="border-primary"
                      >
                        <Box flexDirection="column" rowGap="xs" flex={1}>
                          <Text variant="body" as="span">
                            <span className="group-hover:underline">
                              {job.role}
                            </span>
                          </Text>
                          <Box columnGap="s">
                            {job.experience && (
                              <>
                                <Text as="span" color="muted" variant="body">
                                  {job.experience}
                                </Text>
                                <Text as="span" color="muted" variant="body">
                                  ·
                                </Text>
                              </>
                            )}
                            <Text as="span" color="muted" variant="body">
                              {job.location}
                            </Text>
                          </Box>
                        </Box>
                        <ArrowOutwardOutlined fontSize="inherit" />
                      </Box>
                    </Link>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Section>

      {/* Investors */}
      <Section>
        <Box flexDirection="column" rowGap="4xl">
          <SectionHeader
            title="Investors, Angels & Advisors"
            description="The incredible people and early stage firms who have had our back through thick and thin, supporting us from Day 1."
          />
          <Grid
            templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
            columnGap="4xl"
            rowGap="xl"
          >
            {investors.map((investor) => (
              <Box key={investor.name} flexDirection="column">
                <Text variant="body" as="span">
                  {investor.name}
                </Text>
                <Text variant="body" as="span" color="muted">
                  {investor.company}
                </Text>
              </Box>
            ))}
          </Grid>
        </Box>
      </Section>
    </Box>
  )
}
