'use client'

import { useReconnectMerchantMigration } from '@/hooks/queries/merchantMigrations'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { useTranslations } from '@polar-sh/i18n'
import { Alert, Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { FormEvent, useState } from 'react'
import { ConnectGuide } from '../ConnectGuide'
import {
  parseMissingStripeScopes,
  stripeKeyError,
  stripeKeyPlaceholder,
} from '../stripeKey'

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
  const t = useTranslations('en')

  return (
    <Box flexDirection="column" rowGap="xl">
      <Alert
        variant="danger"
        title={
          missingResources.length > 0
            ? t('merchantMigration.reconnect.missingTitle')
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
  const t = useTranslations('en')
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
      setMissing(parsed.length > 0 ? parsed : missingResources)
      setError(
        extractApiErrorMessage(
          apiError,
          t('merchantMigration.reconnect.fallbackError'),
        ),
      )
    } catch {
      setError(t('merchantMigration.reconnect.fallbackError'))
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    replaceKey()
  }

  return (
    <Box as="form" onSubmit={handleSubmit} flexDirection="column" rowGap="xl">
      <Text color="muted">{t('merchantMigration.reconnect.hint')}</Text>
      <ConnectGuide
        missingResources={missing}
        pasteHint={t('merchantMigration.reconnect.pasteHint')}
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
          title={t('merchantMigration.reconnect.missingTitle')}
          description={error}
        />
      ) : null}
      <Button
        type="submit"
        disabled={!apiKey.trim() || keyError !== null || reconnect.isPending}
        loading={reconnect.isPending}
      >
        {t('merchantMigration.reconnect.submit')}
      </Button>
    </Box>
  )
}
