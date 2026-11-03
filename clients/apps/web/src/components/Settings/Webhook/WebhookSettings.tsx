'use client'

import { useListWebhooksEndpoints } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import {
  Alert,
  SpinnerNoMargin,
  Status,
  Text,
  Truncated,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, Send } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { EmptyState } from '../../Shared/EmptyState'
import { SettingsGroup } from '../SettingsGroup'
import { WebhookSignatureNotice } from './WebhookSignatureNotice'
import { WebhookSigningSchemeStatus } from './WebhookSigningSchemeStatus'

const WebhookSettings = ({ org }: { org: schemas['Organization'] }) => {
  const endpoints = useListWebhooksEndpoints({
    organizationId: org.id,
    limit: 100,
    page: 1,
  })

  return (
    <Box flexDirection="column" rowGap="l">
      <WebhookSignatureNotice organizationCreatedAt={org.created_at} />
      {endpoints.isError ? (
        <Alert
          variant="danger"
          title="We couldn't load your webhook endpoints"
          description="Refresh the page to try again."
        />
      ) : endpoints.data?.items.length === 0 ? (
        <EmptyState
          icon={<Send />}
          title="No webhook endpoints"
          description="Add an endpoint to receive events from Polar."
        />
      ) : (
        <SettingsGroup>
          {!endpoints.data ? (
            <Box justifyContent="center" paddingVertical="3xl">
              <SpinnerNoMargin />
            </Box>
          ) : (
            endpoints.data.items.map((endpoint) => (
              <Endpoint
                key={endpoint.id}
                organization={org}
                endpoint={endpoint}
              />
            ))
          )}
        </SettingsGroup>
      )}
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
