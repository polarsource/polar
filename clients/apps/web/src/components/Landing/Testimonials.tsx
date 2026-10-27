import { Avatar, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { ReactNode } from 'react'

interface Testimonial {
  link: string
  name: string
  company: string
  avatar: string
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
    company: 'Superlogical',
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

const isExternalLink = (link: string) => /^https?:\/\//.test(link)

const QuoteLink = ({
  testimonial,
  children,
}: {
  testimonial: Testimonial
  children: ReactNode
}) =>
  isExternalLink(testimonial.link) ? (
    <a
      href={testimonial.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full w-full flex-col"
    >
      {children}
    </a>
  ) : (
    <Link href={testimonial.link} className="flex h-full w-full flex-col">
      {children}
    </Link>
  )

const Attribution = ({ testimonial }: { testimonial: Testimonial }) => (
  <figcaption>
    <Box alignItems="center" columnGap="m">
      <Avatar
        name={testimonial.name}
        avatar_url={testimonial.avatar}
        className="h-10 w-10"
        width={40}
      />
      <Box flexDirection="column">
        <Text variant="body" leading="tight">
          {testimonial.name}
        </Text>
        <Text variant="body" color="muted" leading="tight">
          {testimonial.company}
        </Text>
      </Box>
    </Box>
  </figcaption>
)

/**
 * Testimonials: one lead quote set large as type on the page, the rest as cards in a row. Everything is
 * visible at once; each quote links to its source.
 */
export const Testimonials = () => {
  const [lead, ...rest] = TESTIMONIALS
  return (
    <Box
      as="section"
      width="100%"
      flexDirection="column"
      rowGap={{ base: '3xl', md: '5xl' }}
      paddingVertical={{ base: '4xl', md: '5xl' }}
      marginVertical={{ base: 'none', md: '2xl' }}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      {/* The chapter grid, with the lead quote where a chapter puts its headline. */}
      <Grid
        templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
        gap={{ base: '2xl', lg: 'l' }}
      >
        <Box alignItems="start" display={{ md: 'flex', base: 'none' }}>
          <Text variant="heading-s">What people say</Text>
        </Box>
        <QuoteLink testimonial={lead}>
          <figure>
            <Box
              flexDirection="column"
              rowGap="2xl"
              opacity={{ base: 1, hover: 0.75 }}
              transitionProperty="opacity"
              transitionDuration="base"
            >
              <blockquote>
                <Text variant="heading-s" as="p" wrap="pretty">
                  “{lead.quote.join(' ')}”
                </Text>
              </blockquote>
              <Attribution testimonial={lead} />
            </Box>
          </figure>
        </QuoteLink>
      </Grid>
      <Grid
        templateColumns={{ base: '1fr', md: `repeat(${rest.length}, 1fr)` }}
        gap="xs"
      >
        {rest.map((testimonial) => (
          <QuoteLink key={testimonial.name} testimonial={testimonial}>
            <figure className="dark:bg-polar-900 dark:hover:bg-polar-800 flex h-full flex-col rounded-xl bg-gray-50 transition-colors hover:bg-gray-100">
              <Box
                flexDirection="column"
                rowGap="3xl"
                flex={1}
                justifyContent="between"
                padding="xl"
              >
                <blockquote>
                  <Text variant="heading-xxs" as="p" wrap="pretty">
                    “{testimonial.quote.join(' ')}”
                  </Text>
                </blockquote>
                <Attribution testimonial={testimonial} />
              </Box>
            </figure>
          </QuoteLink>
        ))}
      </Grid>
    </Box>
  )
}
