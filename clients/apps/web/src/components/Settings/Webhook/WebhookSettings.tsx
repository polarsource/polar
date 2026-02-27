'use client'

import { useListWebhooksEndpoints } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowListGroup from '@polar-sh/ui/components/atoms/ShadowListGroup'
import { ArrowUpRightIcon } from 'lucide-react'
import Link from 'next/link'
import { InlineModal } from '../../Modal/InlineModal'
import { useModal } from '../../Modal/useModal'
import NewWebhookModal from './NewWebhookModal'

const WebhookSettings = (props: { org: schemas['Organization'] }) => {
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
    <>
      <ShadowListGroup>
        {endpoints.data?.items && endpoints.data.items.length > 0 ? (
          endpoints.data?.items.map((e) => {
            return (
              <ShadowListGroup.Item key={e.id}>
                <Endpoint organization={props.org} endpoint={e} />
              </ShadowListGroup.Item>
            )
          })
        ) : (
          <ShadowListGroup.Item>
            {/* eslint-disable-next-line no-restricted-syntax */}
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
              href="https://polar.sh/docs/integrate/webhooks/endpoints"
              className="shrink-0"
            >
              <Button className="gap-x-1" asChild variant="ghost">
                {/* eslint-disable-next-line no-restricted-syntax */}
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
    </>
  )
}

export default WebhookSettings

const Endpoint = ({
  organization,
  endpoint,
}: {
  organization: schemas['Organization']
  endpoint: schemas['WebhookEndpoint']
}) => {
  const hasName = endpoint.name && endpoint.name.length > 0

  return (
    <div className="flex items-center justify-between overflow-hidden">
      <div className="flex w-2/3 flex-col gap-y-1">
        <div className="flex items-center gap-x-2 pl-0.5">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              endpoint.enabled
                ? 'bg-emerald-500 ring-2 ring-emerald-100'
                : 'dark:bg-polar-600 bg-gray-300'
            }`}
            title={endpoint.enabled ? 'Enabled' : 'Disabled'}
          />
          {hasName ? (
            <>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <p className="truncate text-sm font-medium">{endpoint.name}</p>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <p className="truncate font-mono text-sm">{endpoint.url}</p>
            </>
          )}
        </div>
        {hasName && (
          <>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <p className="dark:text-polar-400 truncate pl-4 font-mono text-xs text-gray-500">
              {endpoint.url}
            </p>
          </>
        )}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <p className="dark:text-polar-400 pl-4 text-sm text-gray-500">
          Added on{' '}
          <FormattedDateTime datetime={endpoint.created_at} dateStyle="long" />
        </p>
      </div>
      <div className="dark:text-polar-400 text-gray-500">
        <Link
          href={`/dashboard/${organization.slug}/settings/webhooks/endpoints/${endpoint.id}`}
        >
          <Button asChild variant="secondary">
            Details
          </Button>
        </Link>
      </div>
    </div>
  )
}
