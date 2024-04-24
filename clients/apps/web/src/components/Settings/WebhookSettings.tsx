'use client'

import { useSearchWebhooksEndpoints } from '@/hooks/queries'
import { Organization, WebhookEndpoint } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  FormattedDateTime,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'

const WebhookSettings = (props: { org: Organization }) => {
  const endpoints = useSearchWebhooksEndpoints({
    organizationId: props.org.id,
    limit: 100,
    page: 1,
  })

  return (
    <div className="flex w-full flex-col overflow-hidden">
      <ShadowListGroup>
        {endpoints.data?.items && endpoints.data.items.length > 0 ? (
          endpoints.data?.items?.map((e) => {
            return (
              <ShadowListGroup.Item key={e.id}>
                <Endpoint organization={props.org} endpoint={e} />
              </ShadowListGroup.Item>
            )
          })
        ) : (
          <ShadowListGroup.Item>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              {props.org.name} doesn&apos;t have any webhooks yet
            </p>
          </ShadowListGroup.Item>
        )}
        <ShadowListGroup.Item>
          <div className="flex flex-row items-center gap-x-4">
            <Link
              href={`/maintainer/${props.org.name}/webhooks/new`}
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
        </ShadowListGroup.Item>
      </ShadowListGroup>
    </div>
  )
}

export default WebhookSettings

const Endpoint = ({
  organization,
  endpoint,
}: {
  organization: Organization
  endpoint: WebhookEndpoint
}) => {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between ">
        <div className="flex  flex-row overflow-hidden">
          <div className="gap-y flex flex-col overflow-hidden">
            <h3 className="text-md mr-4 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
              {endpoint.url}
            </h3>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              <FormattedDateTime
                datetime={endpoint.created_at}
                dateStyle="long"
              />
            </p>
          </div>
        </div>
        <div className="dark:text-polar-400 flex flex-shrink-0 flex-row items-center gap-x-4 space-x-4 text-gray-500">
          <Link
            href={`/maintainer/${organization.name}/webhooks/endpoints/${endpoint.id}`}
          >
            <Button asChild size={'sm'}>
              Edit
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
