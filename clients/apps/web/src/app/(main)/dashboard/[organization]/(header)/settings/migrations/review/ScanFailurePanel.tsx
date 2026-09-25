'use client'

import { useReconnectMerchantMigration } from '@/hooks/queries/merchantMigrations'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { Alert, Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { FormEvent, useState } from 'react'
import { ConnectGuide } from '../ConnectGuide'
import {
  parseMissingStripeScopes,
  stripeKeyError,
  stripeKeyPlaceholder,
} from '../stripeKey'

const MISSING_PERMISSIONS_TITLE = 'This Stripe key is missing permissions'
const REPLACE_KEY_FALLBACK = 'Please check the API key and try again.'

interface Props {
  migrationId: string
  error: string
  onRetry?: () => void
  showRetry?: boolean
}

export function ScanFailurePanel({
  migrationId,
  error,
  onRetry,
  showRetry = true,
}: Props) {
  const missingResources = parseMissingStripeScopes({ detail: error })

  return (
    <Box flexDirection="column" rowGap="xl">
      <Alert
        variant="danger"
        title={
          missingResources.length > 0
            ? MISSING_PERMISSIONS_TITLE
            : "We couldn't refresh from Stripe"
        }
        description={error}
      />
      {missingResources.length > 0 ? (
        <ReconnectStripeKey
          migrationId={migrationId}
          missingResources={missingResources}
          onReconnected={onRetry}
        />
      ) : null}
      {showRetry && onRetry ? (
        <Box>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Refresh from Stripe
          </Button>
        </Box>
      ) : null}
    </Box>
  )
}

function ReconnectStripeKey({
  migrationId,
  missingResources,
  onReconnected,
}: {
  migrationId: string
  missingResources: string[]
  onReconnected?: () => void
}) {
  const reconnect = useReconnectMerchantMigration(migrationId)
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(missingResources)
  const keyError = stripeKeyError(apiKey)

  const replaceKey = async () => {
    setError(null)
    try {
      const result = await reconnect.mutateAsync(apiKey.trim())
      if (result.data) {
        onReconnected?.()
        return
      }
      const apiError = result.error ?? {}
      const parsed = parseMissingStripeScopes(apiError)
      const message = extractApiErrorMessage(
        apiError,
        REPLACE_KEY_FALLBACK,
      ).trim()
      setMissing(parsed)
      setError(message || REPLACE_KEY_FALLBACK)
    } catch {
      setError(REPLACE_KEY_FALLBACK)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    replaceKey()
  }

  return (
    <Box as="form" onSubmit={handleSubmit} flexDirection="column" rowGap="xl">
      <Text color="muted">
        Paste a key for this same Stripe account that includes the missing
        permissions. Updating permissions on the current key and refreshing
        also works.
      </Text>
      <ConnectGuide
        missingResources={missing}
        pasteHint="We'll validate the key and keep this migration on the same Stripe account."
      />
      <Box flexDirection="column" rowGap="xs">
        <Input
          type="password"
          placeholder={stripeKeyPlaceholder()}
          value={apiKey}
          aria-invalid={keyError !== null}
          onChange={(event) => {
            setApiKey(event.target.value)
            setError(null)
          }}
          autoFocus
        />
        {keyError ? (
          <Text variant="caption" color="danger" role="alert">
            {keyError}
          </Text>
        ) : null}
      </Box>
      {error && !keyError ? (
        <Alert
          variant="danger"
          title={missing.length > 0 ? MISSING_PERMISSIONS_TITLE : error}
          description={missing.length > 0 ? error : undefined}
        />
      ) : null}
      <Button
        type="submit"
        disabled={!apiKey.trim() || keyError !== null || reconnect.isPending}
        loading={reconnect.isPending}
      >
        Validate & replace key
      </Button>
    </Box>
  )
}
