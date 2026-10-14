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
        <Text variant="body">{testimonial.name}</Text>
        <Text variant="body" color="muted">
          {testimonial.company}
        </Text>
      </Box>
    </Box>
  </figcaption>
)

/**
 * Testimonials as type on the page, not another product window: one lead quote set large, the rest in a row
 * between hairlines. Everything is visible at once; each quote links to its source.
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
      <Box width="100%" flexDirection="column">
        <Grid
          templateColumns={{ base: '1fr', md: `repeat(${rest.length}, 1fr)` }}
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          {rest.map((testimonial, i) => (
            <Box
              key={testimonial.name}
              paddingTop={{ base: '2xl', md: '3xl' }}
              paddingBottom={{ base: '2xl', md: 'none' }}
              paddingLeft={{ base: 'none', md: i === 0 ? 'none' : 'xl' }}
              paddingRight={{ base: 'none', md: 'xl' }}
              borderLeftWidth={{ base: 0, md: i === 0 ? 0 : 1 }}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <QuoteLink testimonial={testimonial}>
                <figure className="flex h-full flex-col">
                  <Box
                    flexDirection="column"
                    rowGap="3xl"
                    flex={1}
                    justifyContent="between"
                    opacity={{ base: 1, hover: 0.75 }}
                    transitionProperty="opacity"
                    transitionDuration="base"
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
            </Box>
          ))}
        </Grid>
      </Box>
    </Box>
  )
}
