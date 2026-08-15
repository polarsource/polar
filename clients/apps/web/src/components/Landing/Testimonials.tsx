import { Avatar, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Chapter } from './Chapter'
import { LogoGrid } from './LogoGrid'

interface Testimonial {
  link: string
  name: string
  company: string
  avatar?: string
  mark?: ReactNode
  quote: string[]
}

const TESTIMONIALS: Testimonial[] = [
  {
    link: 'https://x.com/rauchg/status/1909810055622672851',
    name: 'Guillermo Rauch',
    company: 'Vercel',
    avatar: '/assets/landing/testamonials/rauch.jpg',
    quote: [
      'The speed at which Polar is executing on the financial infrastructure primitives the new world needs is very impressive.',
    ],
  },
  {
    link: '/customers/stilla-ai',
    name: 'Siavash Ghorbani',
    company: 'Stilla AI',
    avatar: '/assets/landing/testamonials/siavash.jpg',
    quote: [
      "Polar's Python SDK and Webhook infrastructure made our billing integration straightforward.",
      'It gave us production-ready billing in hours, not weeks.',
      "It's rare to find a vendor that moves this fast.",
    ],
  },
  {
    link: 'https://x.com/mitchellh/status/1775925951668552005',
    name: 'Mitchell Hashimoto',
    company: 'Hashicorp',
    avatar: '/assets/landing/testamonials/mitchell.jpg',
    quote: [
      "I've joined Polar as an advisor!",
      "I think it benefits everyone for devs to have more options to get paid to work on their passions, to support upstreams, and for users to have more confidence/transparency in the software they're supporting/purchasing.",
    ],
  },
  {
    link: 'https://fastapicloud.com',
    name: 'Sebastián Ramírez',
    company: 'FastAPI',
    avatar: '/assets/landing/testamonials/sebastian.jpg',
    quote: [
      'Polar has been giving us the high attention support of a startup, with an enterprise-level product and service.',
    ],
  },
]

const TestimonialRow = ({ testimonial }: { testimonial: Testimonial }) => (
  <Link href={testimonial.link} target="_blank" className="flex w-full">
    <Grid
      width="100%"
      templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap={{ base: 'xl', lg: 'l' }}
      paddingVertical={{ base: '2xl', md: '3xl' }}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box flexDirection="column" rowGap="xl">
        {testimonial.mark ?? (
          <Avatar
            avatar_url={testimonial.avatar ?? ''}
            name={testimonial.name}
            className="size-12"
          />
        )}
        <Box flexDirection="column">
          <Text variant="heading-xxs" as="span">
            {testimonial.name}
          </Text>
          <Text variant="heading-xxs" as="span" color="muted">
            {testimonial.company}
          </Text>
        </Box>
      </Box>
      <Box flexDirection="column" rowGap="m">
        {testimonial.quote.map((paragraph) => (
          <Text key={paragraph} variant="heading-s" as="p">
            {paragraph}
          </Text>
        ))}
      </Box>
    </Grid>
  </Link>
)

export const Testimonials = () => (
  <Chapter
    index="04"
    name="What people say"
    title="Trusted by the teams shipping fastest"
    subtitle="From AI startups to infrastructure veterans"
  >
    <Box flexDirection="column" rowGap="3xl" width="100%">
      <LogoGrid />
      <Box flexDirection="column">
        {TESTIMONIALS.map((testimonial) => (
          <TestimonialRow key={testimonial.name} testimonial={testimonial} />
        ))}
      </Box>
    </Box>
  </Chapter>
)
