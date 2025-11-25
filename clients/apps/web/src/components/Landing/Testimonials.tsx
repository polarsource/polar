import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Image from 'next/image'
import Link from 'next/link'

export const testimonials = [
  {
    link: 'https://x.com/rauchg/status/1909810055622672851',
    name: 'Guillermo Rauch',
    company: 'Vercel',
    verified: true,
    avatar: '/assets/landing/testamonials/rauch.jpg',
    text: (
      <p>
        The speed at which Polar is executing on the financial infrastructure
        primitives the new world needs is very impressive
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
          If you&apos;re selling stuff online and haven&apos;t tried @polar_sh
          yet — 100% recommend doing so!
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
    link: 'https://x.com/samuel_colvin/status/1676167205715582978',
    name: 'Samuel Colvin',
    company: 'Pydantic',
    verified: true,
    avatar: '/assets/landing/testamonials/samuel.jpg',
    text: (
      <>
        <p>Amazing! Really excited to seeing how this turns out.</p>
        <p>
          Polar is the cutting edge of how open source might be financed in the
          future.
        </p>
      </>
    ),
  },
  {
    link: 'https://x.com/morganlinton/status/1935336619718148373',
    name: 'Morgan Linton',
    company: 'Bold Metrics',
    verified: true,
    avatar: '/assets/landing/testamonials/morgan.jpg',
    text: (
      <>
        <p>
          Huge congrats to Polar, love what this team is doing. Three person
          team, executing like crazy.
        </p>
        <p>Building the perfect solution at the perfect time in history.</p>
        <p>
          There has never been a better time to build software, and now, there
          has never been an easier way to charge for the software you build.
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
        <p>I switched to @polar_sh a few weeks back. Best decision ever.</p>
      </>
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
  {
    link: 'https://x.com/zuess05/status/1988311142515831017',
    name: 'Suhas',
    company: 'Cubix',
    verified: true,
    avatar: '/assets/landing/testamonials/suhas.jpg',
    text: (
      <>
        <p>
          man, @polar_sh has one of the BEST onboardings I&apos;ve seen for a
          payment provider.
        </p>
        <p>
          Took me less than 20 minutes while some others took literally weeks
        </p>
      </>
    ),
  },
]

interface TestamonialProps {
  name: string
  company: string
  avatar: string
  text: React.ReactNode
  link: string
  verified?: boolean
}

export const Testamonial = ({
  name,
  company,
  avatar,
  text,
  link,
}: TestamonialProps) => {
  return (
    <Link
      href={link}
      target="_blank"
      className="dark:bg-polar-900 dark:border-polar-800 dark:hover:bg-polar-800 flex h-full flex-col justify-between gap-x-4 gap-y-12 rounded-2xl border border-transparent bg-white p-8 transition-colors hover:bg-white"
    >
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between gap-x-2">
          <Avatar
            name={name}
            avatar_url={avatar}
            className="h-12 w-12"
            width={64}
            height={64}
            loading="lazy"
            CustomImageComponent={Image}
          />
        </div>
        <div className="flex flex-col gap-y-6">
          <span className="dark:text-polar-50 flex flex-col gap-y-4 text-lg text-gray-950">
            {text}
          </span>
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <Testamonial key={`testimonial-${index}`} {...testimonial} />
        ))}
      </div>
    </div>
  )
}
