'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MoreVertOutlined } from '@mui/icons-material'

import { Organization, WebhookEndpoint } from '@polar-sh/sdk'
import Link from 'next/link'

import Button from 'polarkit/components/ui/atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  organization,
  endpoints,
}: {
  organization: Organization
  endpoints: WebhookEndpoint[]
}) {
  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-row items-center gap-2">
          <Link
            href={`/maintainer/${organization.name}/webhooks/new`}
            className="shrink-0"
          >
            <Button asChild>Add endpoint</Button>
          </Link>

          <Link
            href="https://api.polar.sh/docs#/webhooks/"
            className="shrink-0"
          >
            <Button asChild variant={'outline'}>
              Documentation
            </Button>
          </Link>
        </div>
        <div className="relative flex w-full flex-row items-start gap-x-12">
          <div className="dark:border-polar-800 dark:divide-polar-800 dark:bg-polar-900 flex w-2/3 flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100  bg-white">
            {endpoints.map((e) => (
              <Endpoint organization={organization} endpoint={e} key={e.id} />
            ))}
          </div>
        </div>
      </div>
    </DashboardBody>
  )
}

const Endpoint = ({
  organization,
  endpoint,
}: {
  organization: Organization
  endpoint: WebhookEndpoint
}) => {
  return (
    <div className="flex flex-col">
      <div
        className={twMerge(
          'flex cursor-pointer flex-row items-center justify-between px-4 py-3 transition-colors',
          'dark:hover:bg-polar-800 hover:bg-gray-50',
        )}
      >
        <div className="flex flex-row items-center gap-x-2">
          <div className="flex flex-row gap-x-4">
            <span className="font-mono text-sm">{endpoint.url}</span>
          </div>
        </div>
        <div className="flex flex-row items-center gap-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Button
                className={
                  'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                }
                size="icon"
                variant="secondary"
              >
                <MoreVertOutlined fontSize="inherit" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="dark:bg-polar-800 bg-gray-50 shadow-lg"
            >
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link
                  href={`/maintainer/${organization.name}/webhooks/endpoints/${endpoint.id}`}
                >
                  Edit
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
