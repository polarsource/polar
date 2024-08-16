import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import GetStartedButton from '../Auth/GetStartedButton'
import { Section } from './Section'
import { APIFirst } from './molecules/APIFirst'
import { Circles } from './molecules/Circles'

export const API = () => {
  return (
    <Section
      id="integrations"
      className="flex flex-col items-center justify-center gap-y-24"
      wrapperClassName="overflow-hidden dark:bg-black"
    >
      <Circles className="absolute inset-0 top-1/2 -z-10 hidden -translate-y-1/2 text-white dark:block" />
      <Circles className="absolute inset-0 top-1/2 -z-10 block -translate-y-1/2 text-black dark:hidden" />
      <APIFirst />
      <div className="hidden flex-col items-center gap-y-12 text-center md:flex">
        <h1 className="text-5xl leading-snug">
          Custom experiences powered by Polar
        </h1>
        <p className="dark:text-polar-200 text-lg text-gray-500">
          Use our OAuth, API & Webhooks to ship custom integrations across docs,
          sites, apps and services.
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <GetStartedButton />
          <Link href="/docs/api">
            <Button size="lg" variant="ghost">
              Explore the Polar API (Beta)
            </Button>
          </Link>
        </div>
      </div>
    </Section>
  )
}
