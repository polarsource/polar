'use client'

import { ArrowForward } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Section } from './Section'
import { APIFirst } from './molecules/APIFirst'

export const API = () => {
  return (
    <Section
      id="integrations"
      className="flex flex-col items-center justify-center gap-y-24"
      wrapperClassName="overflow-hidden"
    >
      <div className="flex flex-col items-center gap-y-12">
        <div className="flex flex-col gap-y-4 text-center">
          <span className="font-mono text-xs uppercase tracking-wider dark:text-yellow-400">
            API & Developer First
          </span>
          <h3 className="text-2xl font-medium leading-snug md:text-3xl">
            Powerful Custom Integrations
          </h3>
          <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500">
            Ship faster with our API, Webhooks, OAuth & SDKs.
          </p>
        </div>
        <APIFirst />
        <Link href={`/docs/api`}>
          <Button size="lg">
            <span>Explore the API</span>
            <ArrowForward className="ml-2" fontSize="inherit" />
          </Button>
        </Link>
      </div>
    </Section>
  )
}
