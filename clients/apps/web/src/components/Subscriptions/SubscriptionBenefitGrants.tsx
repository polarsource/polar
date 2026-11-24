'use client'

import { BenefitGrantAction } from '@/components/Benefit/BenefitGrantAction'
import { BenefitGrantStatus } from '@/components/Benefit/BenefitGrantStatus'
import { benefitsDisplayNames } from '@/components/Benefit/utils'
import {
  CondensedTable,
  CondensedTableHeader,
  useCondensedTable,
  type CondensedTableColumn,
} from '@/components/Shared/CondensedTable'
import { useHasPermission } from '@/hooks/permissions'
import { useBenefitGrants } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { format } from 'date-fns'
import Link from 'next/link'

type Grant = schemas['BenefitGrant']

const getRowId = (grant: Grant) => grant.id

// What the subscription gives the customer, and whether each grant went
// through.
export const SubscriptionBenefitGrants = ({
  organization,
  subscription,
}: {
  organization: schemas['Organization']
  subscription: schemas['Subscription']
}) => {
  const canManageCustomers = useHasPermission(
    organization.id,
    'customers:manage',
  )
  // Grants cannot be listed by subscription, so the customer's are, with the
  // same request the customer page makes.
  const { data, isLoading } = useBenefitGrants(organization.id, {
    customer_id: [subscription.customer_id],
    limit: 999,
    sorting: ['-granted_at'],
  })
  const grants = (data?.items ?? []).filter(
    ({ subscription_id }) => subscription_id === subscription.id,
  )

  const columns: CondensedTableColumn<Grant>[] = [
    {
      id: 'benefit',
      header: 'Benefit',
      meta: { grow: 2, minWidth: 120 },
      cell: ({ row: { original: grant } }) =>
        grant.benefit.is_deleted ? (
          <Text truncate>{grant.benefit.description}</Text>
        ) : (
          <Link
            href={`/dashboard/${organization.slug}/products/benefits/${grant.benefit.id}`}
            className="min-w-0 truncate hover:underline"
          >
            <Text truncate>{grant.benefit.description}</Text>
          </Link>
        ),
    },
    {
      id: 'type',
      header: 'Type',
      meta: { width: 160 },
      cell: ({ row: { original: grant } }) => (
        <Text color="muted" truncate>
          {benefitsDisplayNames[grant.benefit.type]}
        </Text>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      meta: { width: 170 },
      cell: ({ row: { original: grant } }) => (
        <BenefitGrantStatus grant={grant} />
      ),
    },
    {
      id: 'granted',
      header: 'Granted',
      meta: { width: 120 },
      cell: ({ row: { original: grant } }) => (
        <Text color="muted" tabularNums wrap="nowrap">
          {grant.granted_at
            ? format(new Date(grant.granted_at), 'MMM d, yyyy')
            : '—'}
        </Text>
      ),
    },
    {
      id: 'action',
      header: '',
      meta: { width: 88, align: 'end' },
      cell: ({ row: { original: grant } }) =>
        canManageCustomers ? <BenefitGrantAction grant={grant} /> : null,
    },
  ]
  const table = useCondensedTable({ columns, rows: grants, getRowId })

  return (
    <Box as="section" flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Benefit grants
      </Text>
      {grants.length === 0 ? (
        <Text color="muted">
          {isLoading ? 'Loading benefit grants' : 'No benefits granted'}
        </Text>
      ) : (
        <Box flexDirection="column" marginHorizontal="-m">
          <CondensedTableHeader table={table} compact />
          <CondensedTable
            table={table}
            renderCompact={(grant) => (
              <Box alignItems="center" justifyContent="between" gap="l">
                <Text truncate>{grant.benefit.description}</Text>
                <BenefitGrantStatus grant={grant} />
              </Box>
            )}
          />
        </Box>
      )}
    </Box>
  )
}
