'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import { useMerchantMigrations } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Button, Grid, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { CreateMigrationModal } from './CreateMigrationModal'
import { MigrationCard } from './MigrationCard'

const GRID_COLUMNS = {
  base: '1fr',
  md: 'repeat(2, minmax(0, 1fr))',
  xl: 'repeat(3, minmax(0, 1fr))',
}

interface Props {
  organization: schemas['Organization']
}

export default function MigrationsPage({ organization }: Props) {
  const router = useRouter()
  const { data, isLoading } = useMerchantMigrations(organization.id)
  const { isShown, show, hide } = useModal()

  const migrations = data?.items ?? []
  const basePath = `/dashboard/${organization.slug}/settings/migrations`

  const onCreated = useCallback(
    (migration: schemas['MerchantMigration']) => {
      hide()
      router.push(`${basePath}/${migration.id}`)
    },
    [hide, router, basePath],
  )

  return (
    <DashboardBody title="Migrations">
      <Box flexDirection="column" rowGap="2xl">
        <Box
          flexDirection={{ base: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="between"
          rowGap="m"
          columnGap="l"
        >
          <Text color="muted" wrap="pretty">
            Migrate your billing from Stripe to Polar. Each migration connects
            one Stripe account and runs in guided steps.
          </Text>
          <Button onClick={show}>
            <Box alignItems="center" columnGap="s">
              <AddOutlined fontSize="inherit" />
              New migration
            </Box>
          </Button>
        </Box>

        {isLoading ? (
          <SkeletonGrid />
        ) : migrations.length === 0 ? (
          <EmptyState onStart={show} />
        ) : (
          <Grid templateColumns={GRID_COLUMNS} gap="l">
            {migrations.map((migration) => (
              <MigrationCard
                key={migration.id}
                migration={migration}
                href={`${basePath}/${migration.id}`}
              />
            ))}
          </Grid>
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

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      rowGap="l"
      paddingVertical="5xl"
      borderRadius="l"
      backgroundColor="background-card"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Text variant="heading-xs" as="h2">
        No migrations yet
      </Text>
      <Text color="muted">
        Start a migration to bring your Stripe billing to Polar.
      </Text>
      <Button variant="secondary" onClick={onStart}>
        <Box alignItems="center" columnGap="s">
          <AddOutlined fontSize="inherit" />
          New migration
        </Box>
      </Button>
    </Box>
  )
}

function SkeletonGrid() {
  return (
    <Grid templateColumns={GRID_COLUMNS} gap="l">
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          flexDirection="column"
          rowGap="l"
          padding="xl"
          borderRadius="l"
          backgroundColor="background-card"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Box
            width={40}
            height={40}
            borderRadius="m"
            backgroundColor="background-secondary"
          />
          <Text variant="body" loading placeholderText="Stripe" />
          <Text variant="caption" loading placeholderText="Started recently" />
        </Box>
      ))}
    </Grid>
  )
}
