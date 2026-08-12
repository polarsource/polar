import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Chapter } from './Chapter'
import { LogoGrid } from './LogoGrid'
import { FastAPICloud, StillaAI } from './Logos'

const userTestimonials = [
  {
    link: '/customers/stilla-ai',
    name: 'Siavash Ghorbani',
    company: 'Stilla AI',
    verified: true,
    logo: <StillaAI size={40} />,
    text: (
      <>
        <Text variant="heading-xxs" as="p">
          Polar&apos;s Python SDK and Webhook infrastructure made our billing
          integration straightforward.
        </Text>
        <Text variant="heading-xxs" as="p">
          It gave us production-ready billing in hours, not weeks.
        </Text>
        <Text variant="heading-xxs" as="p">
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
      <Text variant="heading-xxs" as="p">
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
        <Text variant="heading-xxs" as="p">
          I&apos;ve joined Polar as an advisor!
        </Text>
        <Text variant="heading-xxs" as="p">
          I think it benefits everyone for devs to have more options to get paid
          to work on their passions, to support upstreams, and for users to have
          more confidence/transparency in the software they&apos;re
          supporting/purchasing.
        </Text>
      </>
    ),
  },
  {
    link: 'https://fastapicloud.com',
    name: 'Sebastián Ramírez',
    company: 'FastAPI',
    verified: true,
    logo: (
      <div className="mt-4">
        <FastAPICloud size={24} />
      </div>
    ),
    text: (
      <Text variant="heading-xxs" as="p">
        Polar has been giving us the high attention support of a startup, with
        an enterprise-level product and service.
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
      <Text variant="heading-xxs" as="p">
        We switched to @polar_sh because of their killer API, UX, and product.
        Also love that it&apos;s Open-Source. Their team cares A LOT as well.
        Worth the minor fee difference.
      </Text>
    ),
  },
  {
    link: 'https://x.com/pontusab/status/1886140577634463870',
    name: 'Pontus Abrahamsson',
    company: 'Midday',
    verified: true,
    avatar: '/assets/landing/testamonials/pontus.jpg',
    text: (
      <Text variant="heading-xxs" as="p">
        You can tell @polar_sh is building DX first
      </Text>
    ),
  },
]

export const Testimonials = () => (
  <Chapter
    title="Trusted by the teams shipping fastest"
    subtitle="From AI startups to infrastructure veterans"
  >
    <Box flexDirection="column" rowGap="l" width="100%">
      <LogoGrid />
      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}
        gap="l"
      >
        {userTestimonials.map((t) => (
          <Link key={t.name} href={t.link} target="_blank">
            <Box
              flexDirection="column"
              justifyContent="between"
              rowGap="2xl"
              padding="3xl"
              height="100%"
              backgroundColor={{
                base: 'background-secondary',
                hover: 'background-card',
              }}
              transitionProperty="colors"
              transitionDuration="fast"
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
              <Box flexDirection="column" rowGap="m" flexGrow={1}>
                {t.text}
              </Box>
              <Box
                display="block"
                borderTopWidth={2}
                borderStyle="solid"
                borderColor="border-primary"
                width="1.5rem"
              />
              <Box flexDirection="column">
                <Text variant="heading-xxs" as="span">
                  {t.name}
                </Text>
                <Text variant="heading-xxs" as="span" color="muted">
                  {t.company}
                </Text>
              </Box>
            </Box>
          </Link>
        ))}
      </Box>
    </Box>
  </Chapter>
)
