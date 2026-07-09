'use client'

import {
  useImportMerchantMigrationCatalog,
  useMigrationRecords,
  useRunMerchantMigrationPrecheck,
} from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { ReviewTableView } from './ReviewTableView'
import { ReviewRow } from './reviewRows'

const LIMIT = 100

export function ReviewTable({
  migrationId,
  eyebrow,
}: {
  migrationId: string
  eyebrow?: string
}) {
  const products = useMigrationRecords(migrationId, {
    entity: 'products',
    page: 1,
    limit: LIMIT,
  })
  const customers = useMigrationRecords(migrationId, {
    entity: 'customers',
    page: 1,
    limit: LIMIT,
  })
  const subscriptions = useMigrationRecords(migrationId, {
    entity: 'subscriptions',
    page: 1,
    limit: LIMIT,
  })
  const importCatalog = useImportMerchantMigrationCatalog(migrationId)
  const rerunPrecheck = useRunMerchantMigrationPrecheck(migrationId)

  const rows = useMemo<ReviewRow[]>(
    () => [
      ...(subscriptions.data?.items ?? []),
      ...(products.data?.items ?? []),
      ...(customers.data?.items ?? []),
    ],
    [subscriptions.data, products.data, customers.data],
  )

  if (products.isLoading || customers.isLoading || subscriptions.isLoading) {
    return (
      <Box padding="2xl" alignItems="center" justifyContent="center">
        <Spinner />
      </Box>
    )
  }

  if (products.isError || customers.isError || subscriptions.isError) {
    return (
      <Alert
        variant="danger"
        title="We couldn't load these records"
        description="Something went wrong. Please refresh and try again."
      />
    )
  }

  return (
    <ReviewTableView
      rows={rows}
      eyebrow={eyebrow}
      onImport={(recordIds) => importCatalog.mutate(recordIds)}
      importing={importCatalog.isPending}
      importResult={importCatalog.data}
      importError={importCatalog.isError}
      onRerunPrecheck={() => rerunPrecheck.mutate()}
      rerunning={rerunPrecheck.isPending}
    />
  )
}
