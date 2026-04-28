import Link from 'next/link'
import { Section } from './Section'
import { StillaAI } from './Logos'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { StaticImage } from '../Image/StaticImage'

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
  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
    {userTestimonials.map((t) => (
      <Link
        key={t.name}
        href={t.link}
        target="_blank"
        className="dark:bg-dark-900 dark:hover:bg-dark-800 flex flex-col justify-between gap-y-12 bg-neutral-50 p-10 py-16 transition-colors hover:bg-neutral-100"
      >
        <div className="flex flex-row items-center justify-between gap-x-2">
          <Avatar
            name={t.name}
            avatar_url={t.avatar ?? ''}
            className="h-12 w-12"
            width={64}
            height={64}
            loading="lazy"
            CustomImageComponent={StaticImage}
          />
        </div>
        <div className="flex h-full flex-col gap-y-6 text-xl leading-snug text-neutral-900 dark:text-white">
          {t.text}
        </div>
        <div>
          <div className="text-xl text-neutral-900 dark:text-white">
            {t.name}
          </div>
          <div className="dark:text-dark-400 text-xl text-neutral-400">
            {t.company}
          </div>
        </div>
      </Link>
    ))}
  </div>
)
