'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import { useMerchantMigrations } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Alert, Button, InlineModal, SpinnerNoMargin } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { CreateMigrationModal } from './CreateMigrationModal'
import { SettingsGroup } from '@/components/Settings/SettingsGroup'
import { EmptyState } from '@/components/Shared/EmptyState'
import { Download } from '@polar-sh/orbit/icons'
import { MigrationRow } from './MigrationRow'

// Mirrors the server's create guard: only organizations that finished
// onboarding (active or under review) can start a migration.
const MIGRATION_ENABLED_STATUSES: schemas['OrganizationStatus'][] = [
  'active',
  'review',
]

interface Props {
  organization: schemas['Organization']
}

export default function MigrationsPage({ organization }: Props) {
  const router = useRouter()
  const { data, isLoading, isError } = useMerchantMigrations(organization.id)
  const { isShown, show, hide } = useModal()

  const migrations = data?.items ?? []
  const basePath = `/dashboard/${organization.slug}/settings/migrations`
  const canCreate = MIGRATION_ENABLED_STATUSES.includes(organization.status)

  const onCreated = useCallback(
    (migration: schemas['MerchantMigration']) => {
      hide()
      router.push(`${basePath}/${migration.id}`)
    },
    [hide, router, basePath],
  )

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-md)!"
      title="Migrations"
      header={
        <Button onClick={show} disabled={!canCreate}>
          New migration
        </Button>
      }
    >
      <Box flexDirection="column" rowGap="l">
        {!canCreate && (
          <Alert
            variant="warning"
            title="Finish onboarding before migrating from Stripe."
            description="Migrations open once your organization has completed onboarding."
            actions={[
              {
                text: 'Finish onboarding',
                onClick: () =>
                  router.push(
                    `/dashboard/${organization.slug}/finance/account`,
                  ),
              },
            ]}
          />
        )}

        {isError ? (
          <Alert
            variant="danger"
            title="We couldn't load your migrations"
            description="Something went wrong. Please refresh the page and try again."
          />
        ) : !isLoading && migrations.length === 0 ? (
          <EmptyState
            icon={<Download />}
            title="No migrations"
            description="Start a migration to move your Stripe billing to Polar."
          />
        ) : (
          <SettingsGroup>
            {isLoading ? (
              <Box justifyContent="center" paddingVertical="3xl">
                <SpinnerNoMargin />
              </Box>
            ) : (
              migrations.map((migration) => (
                <MigrationRow
                  key={migration.id}
                  migration={migration}
                  href={`${basePath}/${migration.id}`}
                />
              ))
            )}
          </SettingsGroup>
        )}
      </Box>

      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={
          <CreateMigrationModal
            organizationId={organization.id}
            onCreated={onCreated}
            onClose={hide}
          />
        }
      />
    </DashboardBody>
  )
}
