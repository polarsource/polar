import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'

const testimonials = [
  {
    link: 'https://x.com/mitchellh/status/1775925951668552005',
    name: 'Mitchell Hashimoto',
    username: 'mitchellh',
    verified: true,
    avatar: '/assets/landing/testamonials/mitchell.jpg',
    text: (
      <>
        <p className="dark:text-polar-200 text-gray-500">
          I&apos;ve joined Polar as an advisor!
        </p>
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
    link: 'https://x.com/awesomekling/status/1794769509305528625',
    name: 'Andreas Kling',
    username: 'awesomekling',
    verified: true,
    avatar: '/assets/landing/testamonials/andreas.jpg',
    text: (
      <>
        <p className="dark:text-polar-200 text-gray-500">
          I just used Polar to sponsor someone to improve Polar in Ladybird
          Browser!
        </p>
        <p>
          It&apos;s honestly such a comfy way to spread the love and share some
          of my funding with more of our developers!
        </p>
      </>
    ),
  },
  {
    link: 'https://x.com/samuel_colvin/status/1676167205715582978',
    name: 'Samuel Colvin',
    username: 'samuel_colvin',
    verified: true,
    avatar: '/assets/landing/testamonials/samuel.jpg',
    text: (
      <>
        <p className="dark:text-polar-200 text-gray-500">
          Amazing! Really excited to seeing how this turns out.
        </p>
        <p>
          Polar is the cutting edge of how open source might be financed in the
          future.
        </p>
      </>
    ),
  },
  {
    link: 'https://x.com/martin_buur/status/1831618586374201843',
    name: 'Martin Buur',
    username: 'martin_buur',
    verified: true,
    avatar: '/assets/landing/testamonials/martin.jpg',
    text: (
      <>
        <p>
          Wow, less than 10 minutes to get a fully working sales page for
          private Github repo access, really impressive.
        </p>
        <p className="dark:text-polar-200 text-gray-500">
          Already connected with Stripe for payouts too 🤯
        </p>
      </>
    ),
  },
  {
    link: 'https://x.com/LinusEkenstam/status/1831697198280524065',
    name: 'Linus Ekenstam',
    username: 'LinusEkenstam',
    verified: true,
    avatar: '/assets/landing/testamonials/linus.jpg',
    text: (
      <p>
        I&apos;ve been waiting for this so hard. LFG, congratulations on the
        launch guys!
      </p>
    ),
  },
  {
    link: 'https://x.com/Mike_Andreuzza/status/1856338674406875385',
    name: 'Mike Andreuzza',
    username: 'Mike_Andreuzza',
    verified: true,
    avatar: '/assets/landing/testamonials/mike.jpg',
    text: (
      <>
        <p>
          Officially using @polar_sh for payments and lowered prices on
          Lexington.
        </p>
        <p>
          I also want to thank @birk and the people at Polar for helping me out
          with the move and adapting the UI to my use case during the move. They
          are worth their weight in gold.
        </p>
      </>
    ),
  },
  {
    link: 'https://x.com/arcastrodev/status/1853033088596492409',
    name: 'arcastro',
    username: 'arcastrodev',
    verified: false,
    avatar: '/assets/landing/testamonials/arcastro.jpg',
    text: <p>this is an insanely good product</p>,
  },
  {
    link: 'https://x.com/thatguyDOR/status/1854800736925696249',
    name: 'DOR',
    username: 'thatguyDOR',
    verified: true,
    avatar: '/assets/landing/testamonials/dor.jpg',
    text: <p>Damn this is super clean!</p>,
  },
]

interface TestamonialProps {
  name: string
  username: string
  avatar: string
  text: React.ReactNode
  link: string
  verified?: boolean
}

const Testamonial = ({
  name,
  username,
  avatar,
  text,
  link,
  verified,
}: TestamonialProps) => {
  return (
    <Link
      href={link}
      target="_blank"
      className="dark:bg-polar-900 dark:hover:bg-polar-800 flex flex-row gap-x-4 rounded-2xl bg-white p-6 transition-colors hover:bg-white"
    >
      <div className="flex flex-shrink-0">
        <Avatar className="h-12 w-12" avatar_url={avatar} name={name} />
      </div>
      <div className="flex flex-col gap-y-4 pt-1.5">
        <div className="flex flex-row items-center gap-x-3">
          <div className="flex flex-col text-sm">
            <div className="flex flex-row items-center gap-x-2">
              <span>{name}</span>
              {verified && <VerifiedBadge />}
            </div>
            <span className="dark:text-polar-500 text-gray-500">
              @{username}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-y-4">{text}</div>
        </div>
      </div>
    </Link>
  )
}

export const Testimonials = () => {
  return (
    <div className="flex flex-col items-center gap-y-24">
      <h3 className="text-center text-2xl leading-snug md:text-5xl">
        Trusted by thousands of developers
      </h3>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex flex-1 flex-col gap-y-4">
          {testimonials
            .filter((_, index) => index % 2 === 0)
            .map((testimonial, index) => (
              <Testamonial {...testimonial} key={index} />
            ))}
        </div>
        <div className="flex flex-1 flex-col gap-y-4">
          {testimonials
            .filter((_, index) => index % 2 === 1)
            .map((testimonial, index) => (
              <Testamonial {...testimonial} key={index} />
            ))}
        </div>
      </div>
    </div>
  )
}

const VerifiedBadge = () => {
  return (
    <div className="relative flex">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="fill-[#1D9BF0] text-[#1D9BF0]"
      >
        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
      </svg>
      <div className="absolute inset-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
        >
          <path d="M20 6 9 17l-5-5"></path>
        </svg>
      </div>
    </div>
  )
}
