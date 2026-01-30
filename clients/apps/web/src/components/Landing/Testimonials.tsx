import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Image from 'next/image'
import Link from 'next/link'
import { JSX } from 'react'
import { twMerge } from 'tailwind-merge'
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
    link: '/customers/repo-prompt',
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

export const userTestimonials = [
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
    link: 'https://x.com/steventey/status/1886124389357490670',
    name: 'Steven Tey',
    company: 'Dub',
    verified: true,
    avatar: '/assets/landing/testamonials/steven.jpg',
    text: (
      <>
        <p>Open source + great DX + responsive support always wins.</p>
        <p>
          If you&apos;re selling stuff online and haven&apos;t tried Polar yet —
          100% recommend doing so!
        </p>
      </>
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
    text: (
      <>
        <p>I switched to Polar a few weeks back. Best decision ever.</p>
      </>
    ),
  },
  {
    link: 'https://x.com/pontusab/status/1886140577634463870',
    name: 'Pontus Abrahamsson',
    company: 'Midday',
    verified: true,
    avatar: '/assets/landing/testamonials/pontus.jpg',
    text: <p>You can tell Polar is building DX first.</p>,
  },
  {
    link: 'https://x.com/tonykelly/status/2016615925701570990',
    name: 'Tony Kelly',
    company: 'Spicebox',
    verified: false,
    avatar: '/assets/landing/testamonials/tony.jpg',
    text: (
      <>
        <p>
          Highly recommend using Polar for billing. Easiest and quickest payment
          integration I’ve done in… ever actually!
        </p>
        <p>
          Within 50 minutes of signing up had onboarded, integrated, tested in
          sandbox and was migrating to Production.
        </p>
        <p>That’s hard to beat.</p>
      </>
    ),
  },
]

interface TestamonialProps {
  name: string
  company: string
  avatar?: string
  logo?: JSX.Element
  text: React.ReactNode
  link: string
  className?: string
  size?: 'sm' | 'lg'
}

export const Testamonial = ({
  name,
  company,
  avatar,
  logo,
  text,
  link,
  className,
  size = 'sm',
}: TestamonialProps) => {
  return (
    <Link
      href={link}
      target="_blank"
      className={twMerge(
        'dark:hover:bg-polar-800 dark:bg-polar-950 bg-white flex h-full flex-col justify-between gap-x-4 gap-y-12 p-8 transition-colors hover:bg-gray-50',
        className,
      )}
    >
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between gap-x-2">
          {logo ? (
            logo
          ) : (
            <Avatar
              name={name}
              avatar_url={avatar ?? ''}
              className="h-12 w-12"
              width={64}
              height={64}
              loading="lazy"
              CustomImageComponent={Image}
            />
          )}
        </div>
        <div
          className={twMerge(
            'dark:text-polar-50 flex flex-col text-gray-950',
            size === 'lg' ? 'gap-y-8 text-xl' : 'gap-y-4 text-lg',
          )}
        >
          {text}
        </div>
      </div>
      <div className="flex flex-col">
        <p className="dark:text-polar-600 mb-4 text-gray-400">—</p>
        <div className="flex flex-row items-center gap-x-2">
          <span>{name}</span>
        </div>
        <span className="dark:text-polar-500 text-gray-500">{company}</span>
      </div>
    </Link>
  )
}

export const Testimonials = () => {
  return (
    <div className="flex flex-col items-center gap-y-12 md:gap-y-24 md:py-12">
      <div className="flex flex-col items-center gap-y-8">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Testimonials
        </span>
        <h1 className="w-fit max-w-2xl text-center text-3xl text-pretty md:text-5xl md:leading-normal">
          Why people love Polar
        </h1>
      </div>
      <div className="grid grid-cols-1 dark:bg-polar-800 bg-gray-200 p-px gap-px md:grid-cols-3">
        {userTestimonials.map((testimonial, index) => (
          <Testamonial key={`testimonial-${index}`} {...testimonial} />
        ))}
      </div>
    </div>
  )
}
