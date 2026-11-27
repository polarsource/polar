import { useCreateMerchantMigration } from '@/hooks/queries/merchantMigrations'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Alert, Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight } from '@polar-sh/orbit/icons'
import { useState } from 'react'

const CONNECT_FALLBACK = 'Please check the API key and try again.'
const LEMON_SQUEEZY_API_KEYS_URL = 'https://app.lemonsqueezy.com/settings/api'

export function LemonSqueezyConnectForm({
  organizationId,
  onCreated,
}: {
  organizationId: string
  onCreated: (migration: schemas['MerchantMigration']) => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [storeId, setStoreId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMigration = useCreateMerchantMigration(organizationId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) {
      return
    }
    setError(null)
    try {
      const result = await createMigration.mutateAsync({
        organization_id: organizationId,
        source_platform: 'lemon_squeezy',
        api_key: apiKey.trim(),
        store_id: storeId.trim() || null,
      })
      if (result.data) {
        onCreated(result.data)
        return
      }
      setError(
        extractApiErrorMessage(result.error ?? {}, CONNECT_FALLBACK).trim() ||
          CONNECT_FALLBACK,
      )
    } catch {
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <Box as="form" onSubmit={handleSubmit} flexDirection="column" rowGap="xl">
      <Text color="muted">
        Connect Lemon Squeezy with an API key so Polar can read your products,
        discounts, customers and subscriptions. Nothing in Lemon Squeezy changes
        until you approve each step.
      </Text>

      <Button variant="secondary" fullWidth asChild>
        <a
          href={LEMON_SQUEEZY_API_KEYS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Box alignItems="center" columnGap="s">
            Create an API key in Lemon Squeezy
            <ArrowUpRight size={16} />
          </Box>
        </a>
      </Button>

      <Box flexDirection="column" rowGap="m">
        <Input
          type="password"
          placeholder="Lemon Squeezy API key"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value)
            setError(null)
          }}
          autoFocus
        />
        <Box flexDirection="column" rowGap="xs">
          <Input
            placeholder="Store ID (optional)"
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value)
              setError(null)
            }}
          />
          <Text variant="caption" color="muted">
            Only needed when the key can read more than one store.
          </Text>
        </Box>
      </Box>

      {error ? (
        <Alert
          variant="danger"
          title="We couldn't connect this store"
          description={error}
        />
      ) : null}

      <Button
        type="submit"
        disabled={!apiKey.trim() || createMigration.isPending}
        loading={createMigration.isPending}
        fullWidth
      >
        Validate &amp; create migration
      </Button>
    </Box>
  )
}
