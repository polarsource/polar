'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useMerchantMigration } from '@/hooks/queries/merchantMigrations'
import { getPublicServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { Alert, Spinner, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useCallback } from 'react'
import { MigrationTimeline } from '../MigrationTimeline'
import { StripeMark } from '../StripeMark'

interface Props {
  organization: schemas['Organization']
  migrationId: string
  error?: string
}

export default function MigrationDetailPage({
  organization,
  migrationId,
  error,
}: Props) {
  const { data: migration, isLoading } = useMerchantMigration(migrationId)

  const basePath = `/dashboard/${organization.slug}/settings/migrations`
  const connected = migration?.source_connected ?? false

  const connect = useCallback(() => {
    const returnTo = `${basePath}/${migrationId}`
    window.location.href = getPublicServerURL(
      `/v1/merchant-migrations/stripe/authorize?migration_id=${migrationId}` +
        `&return_to=${encodeURIComponent(returnTo)}`,
    )
  }, [basePath, migrationId])

  return (
    <DashboardBody title="Migration">
      <Box flexDirection="column" rowGap="2xl">
        <Link href={basePath}>
          <Box
            alignItems="center"
            columnGap="xs"
            color={{ base: 'text-secondary', hover: 'text-primary' }}
            cursor={{ hover: 'pointer' }}
          >
            <ChevronLeft size={16} />
            <Text variant="caption" color="inherit">
              All migrations
            </Text>
          </Box>
        </Link>

        {error && (
          <Alert
            variant="danger"
            title="We couldn't connect your Stripe account"
            description="The authorization didn't complete. Please try connecting again."
          />
        )}

        {isLoading ? (
          <Box padding="3xl" alignItems="center" justifyContent="center">
            <Spinner />
          </Box>
        ) : !migration ? (
          <Text color="muted">This migration no longer exists.</Text>
        ) : (
          <Box as="section" flexDirection="column" rowGap="xl">
            <AccountHeader migration={migration} />

            <Divider />

            <MigrationTimeline migration={migration} onConnect={connect} />

            {connected && (
              <Text variant="caption" color="muted">
                Import and cutover steps are being rolled out. We&apos;ll move
                each one forward and keep this page up to date.
              </Text>
            )}
          </Box>
        )}
      </Box>
    </DashboardBody>
  )
}

function AccountHeader({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const connected = migration.source_connected
  const stripeUserId = migration.source?.stripe_user_id as string | undefined
  const livemode = migration.source?.livemode as boolean | undefined
  return (
    <Box alignItems="center" justifyContent="between" columnGap="m">
      <Box alignItems="center" columnGap="m">
        <StripeMark size={44} />
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h2">
            Stripe
          </Text>
          {connected && stripeUserId ? (
            <Text variant="caption" color="muted" monospace>
              {stripeUserId}
            </Text>
          ) : (
            <Text variant="caption" color="muted">
              Not connected yet
            </Text>
          )}
        </Box>
      </Box>
      <Box alignItems="center" columnGap="s">
        {connected && (
          <Status
            status={livemode ? 'Live' : 'Test'}
            color={livemode ? 'green' : 'yellow'}
            size="small"
          />
        )}
        <Status
          status={connected ? 'Connected' : 'Not connected'}
          color={connected ? 'green' : 'gray'}
          size="small"
        />
      </Box>
    </Box>
  )
}

function Divider() {
  return (
    <Box borderTopWidth={1} borderStyle="solid" borderColor="border-primary" />
  )
}
