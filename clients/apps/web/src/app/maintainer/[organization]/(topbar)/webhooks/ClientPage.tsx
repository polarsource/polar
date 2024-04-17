'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'

import { Organization, WebhookEndpoint } from '@polar-sh/sdk'
import Link from 'next/link'

import Button from 'polarkit/components/ui/atoms/button'

export default function ClientPage({
  organization,
  endpoints,
}: {
  organization: Organization
  endpoints: WebhookEndpoint[]
}) {
  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Webhooks</h2>
        </div>

        <Link
          href={`/maintainer/${organization.name}/webhooks/new`}
          className="shrink-0"
        >
          <Button asChild>New</Button>
        </Link>

        <div className="flex flex-col gap-2">
          {endpoints.map((e) => (
            <div
              className="space-between flex w-full items-center gap-2"
              key={e.id}
            >
              <span className="font-mono">{e.url}</span>

              <Link
                href={`/maintainer/${organization.name}/webhooks/endpoints/${e.id}`}
                className="shrink-0"
              >
                <Button asChild>Events</Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </DashboardBody>
  )
}
