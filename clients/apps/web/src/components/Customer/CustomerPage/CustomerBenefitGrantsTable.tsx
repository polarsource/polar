'use client'

import { BenefitGrantAction } from '@/components/Benefit/BenefitGrantAction'
import { BenefitGrantStatus } from '@/components/Benefit/BenefitGrantStatus'
import { benefitsDisplayNames } from '@/components/Benefit/utils'
import { useHasPermission } from '@/hooks/permissions'
import { useBenefitGrants } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Button, DataTable, Text, Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { GrantBenefitSheet } from './GrantBenefitSheet'

interface CustomerBenefitGrantsTableProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerBenefitGrantsTable = ({
  organization,
  customer,
}: CustomerBenefitGrantsTableProps) => {
  const canManageCustomers = useHasPermission(
    organization.id,
    'customers:manage',
  )
  const { data: benefitGrants, isLoading } = useBenefitGrants(
    customer.organization_id,
    {
      customer_id: [customer.id],
      limit: 999,
      sorting: ['-granted_at'],
    },
  )

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <Text variant="heading-xxs" as="h3">
          Benefit Grants
        </Text>
        {canManageCustomers && <GrantBenefitSheet customer={customer} />}
      </Box>
      <DataTable
        data={benefitGrants?.items ?? []}
        columns={[
          {
            header: 'Benefit Name',
            accessorKey: 'benefit.description',
            cell: ({ row: { original } }) => (
              <Box flexDirection="column" rowGap="xs" minWidth={0}>
                <Truncated>
                  <Text as="span">{original.benefit.description}</Text>
                </Truncated>
                <Text as="span" variant="caption" color="muted">
                  {benefitsDisplayNames[original.benefit.type]}
                </Text>
              </Box>
            ),
          },
          ...(customer.type === 'team'
            ? [
                {
                  header: 'Member',
                  accessorKey: 'member.email',
                  cell: ({
                    row,
                  }: {
                    row: { original: schemas['BenefitGrant'] }
                  }) => (
                    <Truncated>{row.original.member?.email ?? '—'}</Truncated>
                  ),
                },
              ]
            : []),
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row: { original: grant } }) => (
              <BenefitGrantStatus grant={grant} />
            ),
          },
          {
            header: 'Granted At',
            accessorKey: 'granted_at',
            cell: ({ row: { original } }) =>
              original.granted_at ? (
                <FormattedDateTime datetime={original.granted_at} />
              ) : (
                <span>—</span>
              ),
          },
          {
            header: 'Revoked At',
            accessorKey: 'revoked_at',
            cell: ({ row: { original } }) => {
              const revokedAt =
                original.manually_revoked_at ?? original.revoked_at
              return revokedAt ? (
                <FormattedDateTime datetime={revokedAt} />
              ) : (
                <Text as="span" color="disabled">
                  —
                </Text>
              )
            },
          },
          {
            header: '',
            accessorKey: 'benefit_action',
            cell: ({ row: { original } }) => {
              const licenseKeyId =
                original.benefit.type === 'license_keys' &&
                'license_key_id' in original.properties
                  ? original.properties.license_key_id
                  : undefined
              const href = licenseKeyId
                ? `/dashboard/${organization.slug}/products/benefits/${original.benefit.id}?license_key_id=${licenseKeyId}`
                : `/dashboard/${organization.slug}/products/benefits/${original.benefit.id}`
              return (
                <Box justifyContent="end" columnGap="s">
                  {!original.benefit.is_deleted && (
                    <Link href={href}>
                      <Button variant="secondary" size="sm">
                        View Benefit
                      </Button>
                    </Link>
                  )}
                  {canManageCustomers && (
                    <BenefitGrantAction grant={original} />
                  )}
                </Box>
              )
            },
          },
        ]}
        isLoading={isLoading}
        className="text-sm"
      />
    </Box>
  )
}
