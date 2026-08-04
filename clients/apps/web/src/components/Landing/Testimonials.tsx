import { Box } from '@polar-sh/orbit/Box'
import { StillaAI } from './Logos'
import { SectionHeader } from './SectionHeader'
import type { Testimonial } from './TestimonialSlideshow'
import { TestimonialSlideshow } from './TestimonialSlideshow'

const userTestimonials: Testimonial[] = [
  {
    link: 'https://x.com/rauchg/status/1909810055622672851',
    name: 'Guillermo Rauch',
    company: 'Vercel',
    avatar: '/assets/landing/testamonials/rauch.jpg',
    quote:
      'The speed at which Polar is executing on the financial infrastructure primitives the new world needs is very impressive.',
  },
  {
    link: '/customers/stilla-ai',
    name: 'Siavash Ghorbani',
    company: 'Stilla AI',
    logo: <StillaAI size={40} />,
    quote:
      'Polar’s Python SDK and Webhook infrastructure made our billing integration straightforward. It gave us production-ready billing in hours, not weeks. It’s rare to find a vendor that moves this fast.',
  },
  {
    link: 'https://x.com/mitchellh/status/1775925951668552005',
    name: 'Mitchell Hashimoto',
    company: 'Ghostty',
    avatar: '/assets/landing/testamonials/mitchell.jpg',
    quote:
      'I’ve joined Polar as an advisor! I think it benefits everyone for devs to have more options to get paid to work on their passions, to support upstreams, and for users to have more confidence in the software they’re supporting.',
  },
  {
    link: 'https://fastapicloud.com',
    name: 'Sebastián Ramírez',
    company: 'FastAPI',
    avatar: '/assets/landing/testamonials/sebastian.jpg',
    quote:
      'Polar has been giving us the high attention support of a startup, with an enterprise-level product and service.',
  },
  {
    link: 'https://x.com/alexhbass/status/1895688367066747251',
    name: 'Alex Bass',
    company: 'Efficient',
    avatar: '/assets/landing/testamonials/alex.jpg',
    quote:
      'We switched to @polar_sh because of their killer API, UX, and product. Also love that it’s Open-Source. Their team cares A LOT as well. Worth the minor fee difference.',
  },
  {
    link: 'https://x.com/pontusab/status/1886140577634463870',
    name: 'Pontus Abrahamsson',
    company: 'Midday',
    avatar: '/assets/landing/testamonials/pontus.jpg',
    quote: 'You can tell @polar_sh is building DX first',
  },
]

export const Testimonials = () => (
  <Box flexDirection="column" rowGap="3xl">
    <SectionHeader
      title="What industry leaders think about Polar"
      description="From AI startups to infrastructure veterans, the teams building the future ship production billing on Polar in days, not weeks."
    />
    <TestimonialSlideshow testimonials={userTestimonials} />
  </Box>
)
