import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { StillaAI } from './Logos'
import { Avatar } from '@polar-sh/orbit'
import { SectionHeader } from './SectionHeader'

const userTestimonials = [
  {
    link: '/customers/stilla-ai',
    name: 'Siavash Ghorbani',
    company: 'Stilla AI',
    verified: true,
    logo: <StillaAI size={40} />,
    text: (
      <>
        <Text variant="body" as="p">
          Polar&apos;s Python SDK and Webhook infrastructure made our billing
          integration straightforward.
        </Text>
        <Text variant="body" as="p">
          It gave us production-ready billing in hours, not weeks.
        </Text>
        <Text variant="body" as="p">
          It&apos;s rare to find a vendor that moves this fast.
        </Text>
      </>
    ),
  },
  {
    link: 'https://x.com/rauchg/status/1909810055622672851',
    name: 'Guillermo Rauch',
    company: 'Vercel',
    verified: true,
    avatar: '/assets/landing/testamonials/rauch.jpg',
    text: (
      <Text variant="body" as="p">
        The speed at which Polar is executing on the financial infrastructure
        primitives the new world needs is very impressive.
      </Text>
    ),
  },
  {
    link: 'https://x.com/mitchellh/status/1775925951668552005',
    name: 'Mitchell Hashimoto',
    company: 'Ghostty',
    verified: true,
    avatar: '/assets/landing/testamonials/mitchell.jpg',
    text: (
      <>
        <Text variant="body" as="p">
          I&apos;ve joined Polar as an advisor!
        </Text>
        <Text variant="body" as="p">
          I think it benefits everyone for devs to have more options to get paid
          to work on their passions, to support upstreams, and for users to have
          more confidence/transparency in the software they&apos;re
          supporting/purchasing.
        </Text>
      </>
    ),
  },
  {
    link: 'https://x.com/mrblackstudio/status/1987257923291259224',
    name: 'Lee Black',
    company: '1042 Studio',
    verified: true,
    avatar: '/assets/landing/testamonials/lee.jpg',
    text: (
      <Text variant="body" as="p">
        I switched to Polar a few weeks back. Best decision ever.
      </Text>
    ),
  },
  {
    link: 'https://x.com/alexhbass/status/1895688367066747251',
    name: 'Alex Bass',
    company: 'Efficient',
    verified: true,
    avatar: '/assets/landing/testamonials/alex.jpg',
    text: (
      <p>
        We switched to @polar_sh because of their killer API, UX, and product.
        Also love that it&apos;s Open-Source. Their team cares A LOT as well.
        Worth the minor fee difference.
      </p>
    ),
  },
  {
    link: 'https://x.com/pontusab/status/1886140577634463870',
    name: 'Pontus Abrahamsson',
    company: 'Midday',
    verified: true,
    avatar: '/assets/landing/testamonials/pontus.jpg',
    text: <p>You can tell @polar_sh is building DX first</p>,
  },
]

export const Testimonials = () => (
  <Box display="flex" flexDirection="column" rowGap="3xl">
    <SectionHeader
      title="What industry leaders think about Polar"
      description="From AI startups to infrastructure veterans, the teams building the future ship production billing on Polar in days, not weeks."
    />
    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
      gap="l"
    >
      {userTestimonials.map((t) => (
        <Link
          key={t.name}
          href={t.link}
          target="_blank"
          className="dark:bg-polar-900 dark:hover:bg-polar-900 bg-gray-50 transition-colors hover:bg-gray-100"
        >
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="between"
            rowGap="2xl"
            padding="3xl"
            height="100%"
          >
            {t.logo ? (
              t.logo
            ) : (
              <Avatar
                avatar_url={t.avatar ?? ''}
                name={t.name}
                className="size-10"
              />
            )}
            <Box display="flex" flexDirection="column" rowGap="m" flexGrow={1}>
              {t.text}
            </Box>
            <Box
              display="block"
              borderTopWidth={2}
              borderStyle="solid"
              borderColor="border-primary"
              width="1.5rem"
            />
            <Box display="flex" flexDirection="column">
              <Text variant="body" as="span">
                {t.name}
              </Text>
              <Text variant="body" as="span" color="muted">
                {t.company}
              </Text>
            </Box>
          </Box>
        </Link>
      ))}
    </Box>
  </Box>
)
