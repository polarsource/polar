import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { StillaAI } from './Logos'

export const companyTestimonials = [
  {
    link: '/customers/stilla-ai',
    name: 'Siavash Ghorbani',
    company: 'Stilla AI',
    verified: true,
    logo: <StillaAI size={48} />,
    text: (
      <>
        <p>
          Polar&apos;s Python SDK and Webhook infrastructure made our billing
          integration straightforward.
        </p>
        <p>It gave us production-ready billing in hours, not weeks.</p>
        <p>It&apos;s rare to find a vendor that moves this fast.</p>
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
        <p>Polar was a turning point for Repo Prompt.</p>
        <p>
          I went from dreading payments to having everything live in a weekend.
        </p>
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
      <p>
        The speed at which Polar is executing on the financial infrastructure
        primitives the new world needs is very impressive.
      </p>
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
        <p>I&apos;ve joined Polar as an advisor!</p>
        <p>
          I think it benefits everyone for devs to have more options to get paid
          to work on their passions, to support upstreams, and for users to have
          more confidence/transparency in the software they&apos;re
          supporting/purchasing.
        </p>
      </>
    ),
  },
  {
    link: 'https://x.com/mrblackstudio/status/1987257923291259224',
    name: 'Lee Black',
    company: '1042 Studio',
    verified: true,
    avatar: '/assets/landing/testamonials/lee.jpg',
    text: <p>I switched to Polar a few weeks back. Best decision ever.</p>,
  },
]

export const Testimonials = () => (
  <Box
    display="grid"
    gridTemplateColumns={{
      base: 'repeat(1, minmax(0, 1fr))',
      md: 'repeat(3, minmax(0, 1fr))',
    }}
    gap="l"
  >
    {userTestimonials.map((t, i) => (
      <Link
        key={t.name}
        href={t.link}
        target="_blank"
        className="dark:bg-polar-900 dark:hover:bg-polar-900 flex flex-col justify-between gap-y-12 bg-gray-50 p-10 transition-colors hover:bg-gray-100"
      >
        <Avatar name={t.name} avatar_url={t.avatar} className="h-8 w-8" />
        <Box display="flex" height="100%" flexDirection="column" rowGap="xl">
          <Text as="p" variant="heading-xxs" color="default">
            {t.text}
          </Text>
        </Box>
        <Box height={4} width={24} className="dark:bg-polar-700 bg-gray-100" />
        <Box display="flex" flexDirection="column">
          <Text as="span" variant="body" color="default">
            {t.name}
          </Text>
          <Text as="span" variant="body" color="muted">
            {t.company}
          </Text>
        </Box>
      </Link>
    ))}
  </Box>
)
