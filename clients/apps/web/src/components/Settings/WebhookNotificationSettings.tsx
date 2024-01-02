'use client'

import { Organization, WebhookIntegration } from '@polar-sh/sdk'
import {
  Button,
  FormattedDateTime,
  Input,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import {
  useCreateWebhookNotification,
  useDeleteWebhookNotification,
  useSearchWebhookNotifications,
} from 'polarkit/hooks'
import { useState } from 'react'

const WebhookNotification = (props: WebhookIntegration) => {
  const deleteToken = useDeleteWebhookNotification()

  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between ">
        <div className="flex  flex-row overflow-hidden">
          <div className="gap-y flex flex-col overflow-hidden">
            <h3 className="text-md mr-4 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
              {props.url}
            </h3>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              <FormattedDateTime datetime={props.created_at} dateStyle="long" />
            </p>
          </div>
        </div>
        <div className="dark:text-polar-400 flex flex-shrink-0 flex-row items-center gap-x-4 space-x-4 text-gray-500">
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              await deleteToken.mutateAsync({ id: props.id })
            }}
          >
            <span>Delete</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

const ucfirst = (s: string): string => {
  return s.charAt(0).toUpperCase() + s.substring(1)
}

const WebhookNotificationSettings = (props: { org: Organization }) => {
  const webhooks = useSearchWebhookNotifications(
    props.org.platform,
    props.org.name,
  )
  const createWebhook = useCreateWebhookNotification()

  const [webhookUrl, setWebhookUrl] = useState('')

  const integration = webhookUrl.startsWith('https://discord.com/api/webhooks/')
    ? 'discord'
    : webhookUrl.startsWith('https://hooks.slack.com/services/')
      ? 'slack'
      : ''

  const onCreate = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (!integration) {
      return
    }

    const created = await createWebhook.mutateAsync({
      url: webhookUrl,
      organization_id: props.org.id,
      integration: integration,
    })
    // setCreatedToken(created)
    setWebhookUrl('')
  }

  return (
    <div className="flex w-full flex-col overflow-hidden">
      <ShadowListGroup>
        {webhooks.data?.items && webhooks.data.items.length > 0 ? (
          webhooks.data?.items?.map((w) => {
            return (
              <ShadowListGroup.Item key={w.id}>
                <WebhookNotification {...w} />
              </ShadowListGroup.Item>
            )
          })
        ) : (
          <ShadowListGroup.Item>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              You don&apos;t have any active webhooks.
            </p>
          </ShadowListGroup.Item>
        )}
        <ShadowListGroup.Item>
          <div className="flex flex-row items-center gap-x-4">
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              id="webhook-url"
              name="webhook-url"
              placeholder="Enter webhook URL"
            />
            <Button
              fullWidth={false}
              size="lg"
              onClick={onCreate}
              disabled={webhookUrl.length < 1 || !integration}
            >
              {integration ? `Add ${ucfirst(integration)} webhook` : 'Create'}
            </Button>
          </div>
        </ShadowListGroup.Item>
      </ShadowListGroup>
    </div>
  )
}

export default WebhookNotificationSettings
