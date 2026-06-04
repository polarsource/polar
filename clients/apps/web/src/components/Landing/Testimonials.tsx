import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { StillaAI } from './Logos'
import { Avatar } from '@polar-sh/orbit'

export const companyTestimonials = [
  {
    link: '/customers/stilla-ai',
    name: 'Siavash Ghorbani',
    company: 'Stilla AI',
    verified: true,
    logo: <StillaAI size={48} />,
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
    link: 'https://repoprompt.com',
    name: 'Eric Provencher',
    company: 'Repo Prompt',
    verified: true,
    avatar: '/assets/landing/testamonials/eric.jpg',
    text: (
      <>
        <Text variant="heading-xxs" as="p">
          Polar was a turning point for Repo Prompt.
        </Text>
        <Text variant="heading-xxs" as="p">
          I went from dreading payments to having everything live in a weekend.
        </Text>
      </>
    ),
  },
]

const userTestimonials = [
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
    link: 'https://x.com/mrblackstudio/status/1987257923291259224',
    name: 'Lee Black',
    company: '1042 Studio',
    verified: true,
    avatar: '/assets/landing/testamonials/lee.jpg',
    text: (
      <Text variant="heading-xxs" as="p">
        I switched to Polar a few weeks back. Best decision ever.
      </Text>
    ),
  },
]

export const Testimonials = () => (
  <Box display="flex" flexDirection="column" rowGap="3xl">
    <Text variant="heading-xl" as="h2" wrap="balance">
      What industry leaders
      <br /> think about Polar.
    </Text>
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
            rowGap="3xl"
            padding="2xl"
            height="100%"
          >
            <Avatar avatar_url={t.avatar} name={t.name} className="size-10" />
            <Box display="flex" flexDirection="column" rowGap="m" flexGrow={1}>
              {t.text}
            </Box>
            <Box
              borderTopWidth={2}
              borderStyle="solid"
              borderColor="border-primary"
              width="1.5rem"
            />
            <Box display="flex" flexDirection="column">
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
)
