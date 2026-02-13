'use client'

import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Section } from './Section'
import EventStream from './animated/EventStream'

type UsageProps = {
  className?: string
}

const Usage = ({ className }: UsageProps) => {
  return (
    <Section className={twMerge('flex flex-col gap-y-12', className)}>
      <div className="dark:bg-polar-900 flex flex-col gap-12 rounded-4xl bg-gray-50 p-2 md:flex-row">
        <div className="flex flex-col gap-y-6 p-12 xl:flex-1">
          <span className="dark:text-polar-500 text-lg text-gray-400">
            Usage Billing
          </span>
          <h2 className="text-3xl leading-tight text-pretty text-black md:text-5xl md:leading-tight dark:text-white">
            Usage Billing for the AI era
          </h2>
          <p className="dark:text-polar-500 max-w-lg text-lg leading-relaxed text-pretty text-gray-500">
            Ingest events from your application in real-time. Meter API calls,
            tokens, compute minutes, or any custom metric — and bill your
            customers with precision.
          </p>
          <ul className="dark:text-polar-400 flex flex-col gap-y-2 text-gray-600">
            <li className="flex items-center gap-x-2">
              <span className="dark:bg-polar-500 inline-block h-1 w-1 rounded-full bg-gray-400" />
              Real-time event ingestion
            </li>
            <li className="flex items-center gap-x-2">
              <span className="dark:bg-polar-500 inline-block h-1 w-1 rounded-full bg-gray-400" />
              Flexible metering & aggregation
            </li>
            <li className="flex items-center gap-x-2">
              <span className="dark:bg-polar-500 inline-block h-1 w-1 rounded-full bg-gray-400" />
              Automatic invoice reconciliation
            </li>
          </ul>
          <div>
            <Link
              href="https://polar.sh/docs/features/usage-based-billing/introduction"
              target="_blank"
            >
              <Button variant="secondary" className="rounded-full">
                Learn More
                <ArrowOutwardOutlined fontSize="inherit" className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="dark:bg-polar-950 overflow-hidden rounded-3xl bg-white p-24 xl:flex-1">
          <EventStream />
        </div>
      </div>
    </Section>
  )
}

export default Usage
