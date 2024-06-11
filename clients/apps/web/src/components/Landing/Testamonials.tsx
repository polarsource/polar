import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { Section } from './Section'

const testamonials = [
  {
    link: 'https://x.com/mitchellh/status/1775925951668552005',
    name: 'Mitchell Hashimoto',
    company: 'Ghostty',
    avatar:
      'https://pbs.twimg.com/profile_images/1141762999838842880/64_Y4_XB_400x400.jpg',
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
    company: 'SerenityOS & Ladybird',
    avatar:
      'https://pbs.twimg.com/profile_images/1743699387165925376/-Zd5Bwsi_400x400.jpg',
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
    link: 'https://x.com/cpojer/status/1795905984977576017',
    name: 'Christoph Nakazawa',
    avatar:
      'https://pbs.twimg.com/profile_images/1189537722286952449/OrscO0bD_400x400.jpg',
    company: 'Athena Crisis',
    text: (
      <>
        <p className="dark:text-polar-200 text-gray-500">
          It&apos;s only been two weeks but Polar has been extremely good for
          funding contributions for Athena Crisis.
        </p>
        <p>Frictionless, fast, easy.</p>
      </>
    ),
  },
  {
    link: 'https://x.com/samuel_colvin/status/1676167205715582978',
    name: 'Samuel Colvin',
    company: 'Pydantic',
    avatar:
      'https://pbs.twimg.com/profile_images/1678332260569710594/of0Ed11O_400x400.jpg',
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
]

export const Testamonials = () => {
  return (
    <Section className="gap-y-16">
      <h3 className="text-center text-4xl leading-relaxed">
        Why developers use Polar
      </h3>
      <div className="dark:border-polar-700 flex flex-col divide-y overflow-hidden rounded-3xl border">
        <Link
          className="hover:bg-gray-75 dark:hover:bg-polar-900 flex flex-col gap-y-6 p-12 transition-colors"
          href={testamonials[0].link}
          target="_blank"
        >
          <div className="flex flex-col gap-y-4 text-lg md:w-2/3">
            {testamonials[0].text}
          </div>
          <div className="flex flex-row items-center gap-x-4">
            <Avatar
              className="h-10 w-10"
              avatar_url={testamonials[0].avatar}
              name={testamonials[0].name}
            />

            <div className="flex flex-col text-sm">
              <span>{testamonials[0].name}</span>
              <span className="dark:text-polar-500 text-gray-500">
                {testamonials[0].company}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex flex-col divide-y md:flex-row md:divide-x md:divide-y-0">
          {testamonials.slice(1).map((testamonial) => (
            <Link
              key={testamonial.name}
              className="hover:bg-gray-75 dark:hover:bg-polar-900 group relative flex flex-col transition-colors md:w-1/3"
              href={testamonial.link}
              target="_blank"
            >
              <div className=" flex h-full w-full flex-col gap-y-8 rounded-none border-none p-12">
                <div className="flex h-full flex-col gap-y-4 leading-relaxed">
                  {testamonial.text}
                </div>
                <div className="flex flex-row items-center gap-x-4 space-y-0">
                  <Avatar
                    className="h-10 w-10"
                    avatar_url={testamonial.avatar}
                    name={testamonial.name}
                  />
                  <div className="flex flex-col text-sm">
                    <span>{testamonial.name}</span>
                    <span className="dark:text-polar-500 text-gray-500">
                      {testamonial.company}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Section>
  )
}
