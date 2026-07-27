import { useCreateMerchantMigration } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Alert, Button, InlineModalHeader, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { ConnectGuide } from './ConnectGuide'
import { StripeMark } from './StripeMark'

export function CreateMigrationModal({
  organizationId,
  onCreated,
  onClose,
}: {
  organizationId: string
  onCreated: (migration: schemas['MerchantMigration']) => void
  onClose: () => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMigration = useCreateMerchantMigration(organizationId)

  const create = async () => {
    if (!apiKey) return
    setError(null)
    try {
      const result = await createMigration.mutateAsync({
        organization_id: organizationId,
        source_platform: 'stripe',
        api_key: apiKey,
      })
      if (result.data) {
        onCreated(result.data)
        return
      }
      const detail = result.error?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : 'Please check the API key and try again.',
      )
    } catch {
      setError('Something went wrong. Please try again.')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    create()
  }

  return (
    <>
      <InlineModalHeader hide={onClose}>
        <Text variant="body">New migration</Text>
      </InlineModalHeader>

      <Box
        as="form"
        onSubmit={handleSubmit}
        flexDirection="column"
        rowGap="xl"
        paddingHorizontal="2xl"
        paddingBottom="2xl"
      >
        <Box alignItems="center" columnGap="m">
          <StripeMark size={48} />
          <Box flexDirection="column" rowGap="xs">
            <Text variant="heading-xs" as="h2">
              Stripe
            </Text>
            <Text variant="caption" color="muted">
              The only source available for now.
            </Text>
          </Box>
        </Box>

        <Text color="muted">
          Connect Stripe with a restricted API key so Polar can read your
          billing. Nothing in Stripe changes until you approve each step.
        </Text>

        <ConnectGuide />

        <Input
          type="password"
          placeholder="rk_live_..."
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value)
            setError(null)
          }}
          autoFocus
        />

        {error && (
          <Alert
            variant="danger"
            title="Couldn't validate the key"
            description={error}
          />
        )}

        <Button
          type="submit"
          disabled={!apiKey || createMigration.isPending}
          loading={createMigration.isPending}
          fullWidth
        >
          Validate &amp; create migration
        </Button>
      </Box>
    </>
  )
}
