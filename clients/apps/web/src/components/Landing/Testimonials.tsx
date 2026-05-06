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
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    {userTestimonials.map((t) => (
      <Link
        key={t.name}
        href={t.link}
        target="_blank"
        className="dark:bg-polar-900 dark:hover:bg-polar-900 flex flex-col justify-between gap-y-12 bg-gray-50 p-10 transition-colors hover:bg-gray-100"
      >
        <Avatar avatar_url={t.avatar} name={t.name} className="size-8" />
        <div className="flex h-full flex-col gap-y-6 text-xl leading-snug text-gray-900 dark:text-white">
          {t.text}
        </div>
        <div className="dark:bg-polar-700 h-1 w-6 bg-gray-100" />
        <div>
          <div className="text-lg text-gray-900 dark:text-white">{t.name}</div>
          <div className="dark:text-polar-400 text-lg text-gray-400">
            {t.company}
          </div>
        </div>
      </Link>
    ))}
  </div>
)
