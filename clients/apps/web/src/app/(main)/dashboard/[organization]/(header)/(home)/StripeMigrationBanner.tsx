'use client'

import { useHasPermission } from '@/hooks/permissions'
import { useOrders } from '@/hooks/queries/orders'
import { useMerchantMigrations } from '@/hooks/queries/merchantMigrations'
import { useOrganizationKYC } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'
import { MIGRATION_ENABLED_STATUSES } from '../settings/migrations/MigrationsPage'

const FINISHED_MIGRATION_STEPS: schemas['MerchantMigrationStep'][] = [
  'completed',
  'closed',
]

interface StripeMigrationBannerProps {
  organization: schemas['Organization']
}

export const StripeMigrationBanner = ({
  organization,
}: StripeMigrationBannerProps) => {
  const router = useRouter()
  const canManageOrganization = useHasPermission(
    organization.id,
    'organization:manage',
  )
  const eligible =
    canManageOrganization &&
    MIGRATION_ENABLED_STATUSES.includes(organization.status)

  const { data: kyc } = useOrganizationKYC(organization.id, eligible)
  const switchingFromStripe = kyc?.details?.switching_from === 'stripe'

  const { data: migrations } = useMerchantMigrations(
    eligible && switchingFromStripe ? organization.id : '',
  )
  const { data: orders } = useOrders(
    eligible && switchingFromStripe ? organization.id : undefined,
    { limit: 1 },
  )

  if (!eligible || !switchingFromStripe || !migrations || !orders) {
    return null
  }

  const hasOngoingMigration = migrations.items.some(
    (migration) => !FINISHED_MIGRATION_STEPS.includes(migration.step),
  )
  const hasSales = orders.pagination.total_count > 0

  if (hasOngoingMigration || hasSales) {
    return null
  }

  return (
    <Alert
      title="Bring your Stripe business to Polar"
      description="Import your products, customers and subscriptions from Stripe, including saved payment methods, so your customers don't have to check out again."
      actions={[
        {
          text: 'Start migration',
          onClick: () => {
            router.push(`/dashboard/${organization.slug}/settings/migrations`)
          },
        },
      ]}
    />
  )
}
