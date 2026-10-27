'use client'

import { useIsManagedAsCode } from '@/hooks/permissions'
import { useListWebhooksEndpoints } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Button, Status, Text, Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { SettingsGroup } from '../SettingsGroup'
import { WebhookSignatureNotice } from './WebhookSignatureNotice'
import { WebhookSigningSchemeStatus } from './WebhookSigningSchemeStatus'

const WebhookSettings = ({
  org,
  onAddEndpoint,
}: {
  org: schemas['Organization']
  onAddEndpoint: () => void
}) => {
  const managedAsCode = useIsManagedAsCode(org.id)

  const endpoints = useListWebhooksEndpoints({
    organizationId: org.id,
    limit: 100,
    page: 1,
  })

  if (!endpoints.data) return null

  return (
    <Box flexDirection="column" rowGap="l">
      <WebhookSignatureNotice organizationCreatedAt={org.created_at} />
      <SettingsGroup>
        {endpoints.data.items.length > 0 ? (
          endpoints.data.items.map((endpoint) => (
            <Endpoint
              key={endpoint.id}
              organization={org}
              endpoint={endpoint}
            />
          ))
        ) : (
          <Box
            flexDirection="column"
            alignItems="center"
            rowGap="l"
            paddingVertical="3xl"
            paddingHorizontal="xl"
          >
            <Box flexDirection="column" alignItems="center" rowGap="xs">
              <Text variant="title">No webhook endpoints</Text>
              <Text color="muted" align="center">
                Get notified when orders, subscriptions and customers change.
              </Text>
            </Box>
            {!managedAsCode && (
              <Button variant="secondary" onClick={onAddEndpoint}>
                Add Endpoint
              </Button>
            )}
          </Box>
        )}
      </SettingsGroup>
    </Box>
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
  const hasName = !!endpoint.name

  return (
    <Link
      href={`/dashboard/${organization.slug}/settings/webhooks/endpoints/${endpoint.id}`}
    >
      <Box
        alignItems="center"
        columnGap="xl"
        paddingHorizontal="xl"
        paddingVertical="l"
        backgroundColor={{ hover: 'background-card' }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <Box flexDirection="column" rowGap="xs" flex={1} minWidth={0}>
          <Truncated>
            <Text variant="title">
              {hasName ? endpoint.name : endpoint.url}
            </Text>
          </Truncated>
          {hasName && (
            <Truncated>
              <Text color="muted">{endpoint.url}</Text>
            </Truncated>
          )}
          <Text variant="caption" color="muted">
            Added{' '}
            <FormattedDateTime
              datetime={endpoint.created_at}
              dateStyle="medium"
            />
            {' · '}API version {endpoint.api_version}
          </Text>
        </Box>
        <Box alignItems="center" columnGap="s" flexShrink={0}>
          <WebhookSigningSchemeStatus
            organizationCreatedAt={organization.created_at}
            usesStandardWebhookSignature={
              endpoint.uses_standard_webhook_signature
            }
          />
          <Status
            size="small"
            color={endpoint.enabled ? 'green' : 'gray'}
            status={endpoint.enabled ? 'Enabled' : 'Disabled'}
          />
          <Text color="muted">
            <ChevronRight size={16} aria-hidden="true" />
          </Text>
        </Box>
      </Box>
    </Link>
  )
}
