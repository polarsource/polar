'use client'

import { useListWebhooksEndpoints } from '@/hooks/queries'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import { Organization, WebhookEndpoint } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  FormattedDateTime,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { InlineModal } from '../../Modal/InlineModal'
import { useModal } from '../../Modal/useModal'
import NewWebhookModal from './NewWebhookModal'

const WebhookSettings = (props: { org: Organization }) => {
  const {
    isShown: isNewWebhookModalShown,
    show: showNewWebhookModal,
    hide: hideNewWebhookModal,
  } = useModal()

  const endpoints = useListWebhooksEndpoints({
    organizationId: props.org.id,
    limit: 100,
    page: 1,
  })

  return (
    <div className="flex w-full flex-col">
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
            <Button asChild onClick={showNewWebhookModal}>
              Add Endpoint
            </Button>
            <Link
              href="https://docs.polar.sh/api/webhooks"
              className="shrink-0"
            >
              <Button className="gap-x-1" asChild variant="ghost">
                <span>Documentation</span>
                <ArrowUpRightIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </ShadowListGroup.Item>
      </ShadowListGroup>
      <InlineModal
        isShown={isNewWebhookModalShown}
        hide={hideNewWebhookModal}
        modalContent={
          <NewWebhookModal
            hide={hideNewWebhookModal}
            organization={props.org}
          />
        }
      />
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
          <div className="flex flex-col gap-y-1 overflow-hidden">
            <h3 className="text-md mr-4 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm">
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
            href={`/dashboard/${organization.slug}/settings/webhooks/endpoints/${endpoint.id}`}
          >
            <Button asChild variant="secondary">
              Details
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
